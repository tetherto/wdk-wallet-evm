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

import { Contract, toQuantity, ZeroAddress } from 'ethers'

import * as bip39 from 'bip39'

import WalletAccountReadOnlyEvm from './wallet-account-read-only-evm.js'

import MemorySafeHDNodeWallet from './memory-safe/hd-node-wallet.js'

/** @typedef {import('ethers').HDNodeWallet} HDNodeWallet */

/** @typedef {import('@tetherto/wdk-wallet').IWalletAccount} IWalletAccount */

/** @typedef {import('@tetherto/wdk-wallet').KeyPair} KeyPair */
/** @typedef {import('@tetherto/wdk-wallet').TransactionResult} TransactionResult */
/** @typedef {import('@tetherto/wdk-wallet').TransferOptions} TransferOptions */
/** @typedef {import('@tetherto/wdk-wallet').TransferResult} TransferResult */

/** @typedef {import('./wallet-account-read-only-evm.js').EvmTransaction} EvmTransaction */
/** @typedef {import('./wallet-account-read-only-evm.js').EvmWalletConfig} EvmWalletConfig */
/** @typedef {import('./wallet-account-read-only-evm.js').TypedData} TypedData */
/** @typedef {import('./wallet-account-read-only-evm.js').Erc7702AuthorizationRequest} Erc7702AuthorizationRequest */
/** @typedef {import('./wallet-account-read-only-evm.js').Erc7702Authorization} Erc7702Authorization */
/** @typedef {import('./wallet-account-read-only-evm.js').DelegationInfo} DelegationInfo */

/**
 * @typedef {Object} ApproveOptions
 * @property {string} token - The address of the token to approve.
 * @property {string} spender - The spender’s address.
 * @property {number | bigint} amount - The amount of tokens to approve to the spender.
 */

/**
 * @typedef {TransferOptions & { authorizationList?: Erc7702Authorization[] }} EvmTransferOptions
 */

const BIP_44_ETH_DERIVATION_PATH_PREFIX = "m/44'/60'"
const DELEGATION_TX_GAS_LIMIT = 100_000
const USDT_MAINNET_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7'

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
   * Signs typed data according to EIP-712.
   *
   * @param {TypedData} typedData - The typed data to sign.
   * @returns {Promise<string>} The typed data signature.
   */
  async signTypedData ({ domain, types, message }) {
    return await this._account.signTypedData(domain, types, message)
  }

  /**
   * Sends a transaction. For type 4 (ERC-7702) transactions, gas estimation
   * is performed via raw RPC to include the authorization list, since the
   * provider's high-level `estimateGas` does not forward it.
   *
   * @param {EvmTransaction} tx - The transaction.
   * @returns {Promise<TransactionResult>} The transaction's result.
   */
  async sendTransaction (tx) {
    if (!this._account.provider) {
      throw new Error('The wallet must be connected to a provider to send transactions.')
    }

    if (tx.authorizationList) {
      const from = await this.getAddress()
      const fullTx = { from, ...tx }

      if (!fullTx.gasLimit) {
        fullTx.gasLimit = await this._estimateGasWithAuthList(fullTx)
      }

      const response = await this._account.sendTransaction(fullTx)
      const receipt = await response.wait()
      const fee = receipt.gasUsed * receipt.gasPrice

      return { hash: response.hash, fee }
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
   * @param {EvmTransferOptions} options - The transfer's options.
   * @returns {Promise<TransferResult>} The transfer's result.
   */
  async transfer (options) {
    if (!this._account.provider) {
      throw new Error('The wallet must be connected to a provider to transfer tokens.')
    }

    const tx = await WalletAccountEvm._getTransferTransaction(options)

    if (options.authorizationList) {
      tx.authorizationList = options.authorizationList
      return await this.sendTransaction(tx)
    }

    const { fee } = await this.quoteSendTransaction(tx)

    if (this._config.transferMaxFee !== undefined && fee >= this._config.transferMaxFee) {
      throw new Error('Exceeded maximum fee cost for transfer operation.')
    }

    const { hash } = await this._account.sendTransaction(tx)

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
    if (!this._account.provider) {
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
    const readOnlyAccount = new WalletAccountReadOnlyEvm(this._account.address, this._config)

    return readOnlyAccount
  }

  /**
   * Signs an ERC-7702 authorization tuple.
   *
   * @param {Erc7702AuthorizationRequest} auth - The authorization request.
   * @returns {Promise<Erc7702Authorization>} The signed authorization.
   */
  async signAuthorization (auth) {
    if (!auth || !auth.address) {
      throw new Error('The authorization must include an address.')
    }

    return await this._account.authorize(auth)
  }

  /**
   * Delegates this EOA to a smart contract via an ERC-7702 type 4 transaction.
   *
   * The transaction is sent to the EOA itself with zero value and no data.
   * A fixed gas limit is used because `eth_estimateGas` may revert when
   * the delegate contract lacks a `receive`/`fallback` function.
   *
   * @param {string} delegateAddress - The address of the contract to delegate to.
   * @returns {Promise<TransactionResult>} The transaction result.
   */
  async delegate (delegateAddress) {
    if (!this._account.provider) {
      throw new Error('The wallet must be connected to a provider to delegate.')
    }

    const address = await this.getAddress()
    const nonceHex = await this._provider.send('eth_getTransactionCount', [address, 'latest'])
    const nonce = Number(nonceHex)

    const auth = await this.signAuthorization({
      address: delegateAddress,
      nonce: nonce + 1
    })

    return await this.sendTransaction({
      type: 4,
      nonce,
      to: address,
      value: 0,
      gasLimit: DELEGATION_TX_GAS_LIMIT,
      authorizationList: [auth]
    })
  }

  /**
   * Revokes any active ERC-7702 delegation by delegating to the zero address.
   *
   * @returns {Promise<TransactionResult>} The transaction result.
   */
  async revokeDelegation () {
    return await this.delegate(ZeroAddress)
  }

  /**
   * Estimates gas for a type 4 transaction by calling `eth_estimateGas`
   * directly on the underlying provider, including the authorization list.
   *
   * @private
   * @param {object} tx - The transaction with authorizationList.
   * @returns {Promise<bigint>} The estimated gas.
   */
  async _estimateGasWithAuthList (tx) {
    const formatAuth = (auth) => ({
      chainId: toQuantity(auth.chainId ?? 0),
      address: auth.address,
      nonce: toQuantity(auth.nonce ?? 0),
      ...(auth.signature
        ? {
            yParity: toQuantity(auth.signature.yParity),
            r: auth.signature.r,
            s: auth.signature.s
          }
        : {})
    })

    const rpcTx = {
      type: '0x04',
      from: tx.from,
      to: tx.to,
      value: toQuantity(tx.value ?? 0),
      data: tx.data ?? '0x',
      authorizationList: tx.authorizationList.map(formatAuth)
    }

    const result = await this._provider.send('eth_estimateGas', [rpcTx])

    return BigInt(result)
  }

  /**
   * Disposes the wallet account, erasing the private key from the memory.
   */
  dispose () {
    this._account.dispose()
  }
}
