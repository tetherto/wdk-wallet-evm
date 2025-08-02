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

import { verifyMessage } from 'ethers'

import * as bip39 from 'bip39'

import WalletAccountReadOnlyEvm from './wallet-account-read-only-evm.js'

import MemorySafeHDNodeWallet from './memory-safe/hd-node-wallet.js'

/** @typedef {import('ethers').HDNodeWallet} HDNodeWallet */

/** @typedef {import('@wdk/wallet').IWalletAccount} IWalletAccount */

/** @typedef {import('@wdk/wallet').KeyPair} KeyPair */
/** @typedef {import('@wdk/wallet').TransactionResult} TransactionResult */
/** @typedef {import('@wdk/wallet').TransferOptions} TransferOptions */
/** @typedef {import('@wdk/wallet').TransferResult} TransferResult */

/** @typedef {import('./wallet-account-read-only-evm.js').EvmTransaction} EvmTransaction */
/** @typedef {import('./wallet-account-read-only-evm.js').EvmWalletConfig} EvmWalletConfig */

const BIP_44_ETH_DERIVATION_PATH_PREFIX = "m/44'/60'"

/** @implements {IWalletAccount} */
export default class WalletAccountEvm extends WalletAccountReadOnlyEvm {
  /**
   * Creates a new evm wallet account.
   *
   * @param {string | Uint8Array} seed - The wallet's [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) seed phrase.
   * @param {string} path - The BIP-44 derivation path (e.g. "0'/0/0").
   * @param {EvmWalletConfig} [config] - The configuration object.
   */
  constructor (seed, path, config = {}) {
    if (typeof seed === 'string') {
      if (!bip39.validateMnemonic(seed)) {
        throw new Error('The seed phrase is invalid.')
      }

      seed = bip39.mnemonicToSeedSync(seed)
    }

    path = BIP_44_ETH_DERIVATION_PATH_PREFIX + '/' + path

    const account = MemorySafeHDNodeWallet.fromSeed(seed)
      .derivePath(path)

    super(account.address, config)

    /**
     * The wallet account configuration.
     *
     * @protected
     * @type {EvmWalletConfig}
     */
    this._config = config

    /**
     * The account.
     *
     * @protected
     * @type {HDNodeWallet}
     */
    this._account = account

    if (this._provider) {
      this._account = this._account.connect(this._provider)
    }
  }

  /**
   * The derivation path's index of this account.
   *
   * @type {number}
   */
  get index () {
    return this._account.index
  }

  /**
   * The derivation path of this account (see [BIP-44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki)).
   *
   * @type {string}
   */
  get path () {
    return this._account.path
  }

  /**
   * The account's key pair.
   *
   * @type {KeyPair}
   */
  get keyPair () {
    return {
      privateKey: this._account.privateKeyBuffer,
      publicKey: this._account.publicKeyBuffer
    }
  }

  /**
   * Signs a message.
   *
   * @param {string} message - The message to sign.
   * @returns {Promise<string>} The message's signature.
   */
  async sign (message) {
    return await this._account.signMessage(message)
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

    return address.toLowerCase() === this._account.address.toLowerCase()
  }

  /**
   * Sends a transaction.
   *
   * @param {EvmTransaction} tx - The transaction.
   * @returns {Promise<TransactionResult>} The transaction's result.
   */
  async sendTransaction (tx) {
    if (!this._account.provider) {
      throw new Error('The wallet must be connected to a provider to send transactions.')
    }

    const { fee } = await this.quoteSendTransaction(tx)

    const { hash } = await this._account.sendTransaction({
      from: await this.getAddress(),
      ...tx
    })

    return { hash, fee }
  }

  /**
   * Transfers a token to another address.
   *
   * @param {TransferOptions} options - The transfer's options.
   * @returns {Promise<TransferResult>} The transfer's result.
   */
  async transfer (options) {
    if (!this._account.provider) {
      throw new Error('The wallet must be connected to a provider to transfer tokens.')
    }

    const tx = await WalletAccountEvm._getTransferTransaction(options)

    const { fee } = await this.quoteSendTransaction(tx)

    if (this._config.transferMaxFee !== undefined && fee >= this._config.transferMaxFee) {
      throw new Error('Exceeded maximum fee cost for transfer operation.')
    }

    const { hash } = await this._account.sendTransaction(tx)

    return { hash, fee }
  }

  /**
   * Returns a read-only copy of the account.
   *
   * @returns {Promise<WalletAccountReadOnlyEvm>} The read-only account.
   */
  async toReadOnlyAccount () {
    const readOnlyAccount = new WalletAccountReadOnlyEvm(this._account.address, this._config)

    return readOnlyAccount
  }

  /**
   * Disposes the wallet account, erasing the private key from the memory.
   */
  dispose () {
    this._account.dispose()
  }
}
