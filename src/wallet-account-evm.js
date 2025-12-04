// Copyright 2024 Tether Operations Limited
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use strict'

import { verifyMessage, Contract } from 'ethers'

import WalletAccountReadOnlyEvm from './wallet-account-read-only-evm.js'

import SeedSignerEvm from './signers/seed-signer-evm.js'
import { populateTransactionEvm } from './utils/tx-populator-evm.js'

/** @typedef {import('ethers').HDNodeWallet} HDNodeWallet */

/** @typedef {import('@tetherto/wdk-wallet').IWalletAccount} IWalletAccount */

/** @typedef {import('@tetherto/wdk-wallet').KeyPair} KeyPair */
/** @typedef {import('@tetherto/wdk-wallet').TransactionResult} TransactionResult */
/** @typedef {import('@tetherto/wdk-wallet').TransferOptions} TransferOptions */
/** @typedef {import('@tetherto/wdk-wallet').TransferResult} TransferResult */

/** @typedef {import('./wallet-account-read-only-evm.js').EvmTransaction} EvmTransaction */
/** @typedef {import('./wallet-account-read-only-evm.js').EvmWalletConfig} EvmWalletConfig */

/**
 * @typedef {Object} ApproveOptions
 * @property {string} token - The address of the token to approve.
 * @property {string} spender - The spender’s address.
 * @property {number | bigint} amount - The amount of tokens to approve to the spender.
 */

const USDT_MAINNET_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7'

/** @implements {IWalletAccount} */
export default class WalletAccountEvm extends WalletAccountReadOnlyEvm {
  /**
   * Creates a new evm wallet account using a signer.
   *
   * @param {object} signer - A signer implementing the EVM signer interface (must be a child, not a root).
   * @param {EvmWalletConfig} [config] - The configuration object.
   */
  constructor (signer, config = {}) {
    if (!signer) {
      throw new Error('A signer is required.')
    }
    if (signer.isRoot) {
      throw new Error('The signer is the root signer. Call derive method to create a child signer.')
    }

    super(signer.address, config)

    /**
     * The wallet account configuration.
     *
     * @protected
     * @type {EvmWalletConfig}
     */
    this._config = config

    /** @private */
    this._signer = signer
    this._isActive = true
  }

  get isActive () { return this._isActive }

  /**
   * The derivation path's index of this account.
   *
   * @type {number}
   */
  get index () {
    return this._signer.index
  }

  /**
   * The derivation path of this account (see [BIP-44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki)).
   *
   * @type {string}
   */
  get path () {
    return this._signer.path
  }

  /**
   * The account's key pair.
   *
   * @type {KeyPair}
   */
  get keyPair () {
    return this._signer.keyPair
  }

  /**
   * Legacy helper to create an account from seed + path.
   * Creates a root signer from the seed and derives a child for the given path.
   *
   * @param {string | Uint8Array} seed - The wallet's BIP-39 seed phrase or seed bytes.
   * @param {string} path - The BIP-44 derivation path (e.g. "0'/0/0").
   * @param {EvmWalletConfig} [config] - The configuration object.
   * @returns {WalletAccountEvm}
   */
  static fromSeed (seed, path, config = {}) {
    const root = new SeedSignerEvm(seed, config, {})
    const signer = root.derive(path, config)
    return new WalletAccountEvm(signer, config)
  }

  /**
   * Signs a message.
   *
   * @param {string} message - The message to sign.
   * @returns {Promise<string>} The message's signature.
   */
  async sign (message) {
    return this._signer.sign(message)
  }

  /**
   * Verifies a message's signature.
   *
   * @param {string} message - The original message.
   * @param {string} signature - The signature to verify.
   * @returns {Promise<boolean>} True if the signature is valid.
   */
  async verify (message, signature) {
    const address = await verifyMessage(message, signature)

    return address.toLowerCase() === this._signer.address.toLowerCase()
  }

  /**
   * Sends a transaction.
   *
   * @param {EvmTransaction} tx - The transaction.
   * @returns {Promise<TransactionResult>} The transaction's result.
   */
  async sendTransaction (tx) {
    if (!this._provider) {
      throw new Error('The wallet must be connected to a provider to send transactions.')
    }

    const { fee } = await this.quoteSendTransaction(tx)

    // Build, sign and broadcast raw transaction using the signer
    const from = await this.getAddress()
    const unsignedTx = await populateTransactionEvm(this._provider, from, tx)
    const signed = await this._signer.signTransaction(unsignedTx)
    const hash = await this._provider.send('eth_sendRawTransaction', [signed])
    return { hash, fee }
  }

  /**
   * Transfers a token to another address.
   *
   * @param {TransferOptions} options - The transfer's options.
   * @returns {Promise<TransferResult>} The transfer's result.
   */
  async transfer (options) {
    if (!this._provider) {
      throw new Error('The wallet must be connected to a provider to transfer tokens.')
    }

    const tx = await WalletAccountEvm._getTransferTransaction(options)

    const { fee } = await this.quoteSendTransaction(tx)

    if (this._config.transferMaxFee !== undefined && fee >= this._config.transferMaxFee) {
      throw new Error('Exceeded maximum fee cost for transfer operation.')
    }

    const { hash } = await this.sendTransaction(tx)

    return { hash, fee }
  }

  /**
   * Approves a specific amount of tokens to a spender.
   *
   * @param {ApproveOptions} options The approve options.
   * @returns {Promise<TransactionResult>} The transaction’s result.
   * @throws {Error} If trying to approve usdts on ethereum with allowance not equal to zero (due to the usdt allowance reset requirement).
   */
  async approve (options) {
    if (!this._provider) {
      throw new Error('The wallet must be connected to a provider to approve funds.')
    }

    const { token, spender, amount } = options
    const { chainId } = await this._provider.getNetwork()

    if (chainId === 1n && token.toLowerCase() === USDT_MAINNET_ADDRESS.toLowerCase()) {
      const currentAllowance = await this.getAllowance(token, spender)
      if (currentAllowance > 0n && BigInt(amount) > 0n) {
        throw new Error(
          'USDT requires the current allowance to be reset to 0 before setting a new non-zero value. Please send an "approve" transaction with an amount of 0 first.'
        )
      }
    }

    const abi = ['function approve(address spender, uint256 amount) returns (bool)']
    const contract = new Contract(token, abi, this._provider)

    const tx = {
      to: token,
      value: 0,
      data: contract.interface.encodeFunctionData('approve', [spender, amount])
    }

    return await this.sendTransaction(tx)
  }

  /**
   * Returns a read-only copy of the account.
   *
   * @returns {Promise<WalletAccountReadOnlyEvm>} The read-only account.
   */
  async toReadOnlyAccount () {
    const readOnlyAccount = new WalletAccountReadOnlyEvm(await this.getAddress(), this._config)

    return readOnlyAccount
  }

  /**
   * Disposes the wallet account, erasing the private key from the memory.
   */
  dispose () {
    this._signer.dispose()
    this._isActive = false
  }
}
