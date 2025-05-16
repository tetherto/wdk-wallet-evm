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

import { HDNodeWallet, JsonRpcProvider, Contract, verifyMessage } from 'ethers'

/**
 * @typedef {Object} KeyPair
 * @property {string} publicKey - The public key.
 * @property {string} privateKey - The private key.
 */

/**
 * @typedef {Object} EvmTransaction
 * @property {string} to - The transaction's recipient.
 * @property {number} value - The amount of ethers to send to the recipient (in weis).
 * @property {string} [data] - The transaction's data in hex format.
 * @property {number} [gasLimit] - The maximum amount of gas this transaction is permitted to use.
 * @property {number} [gasPrice] - The price (in wei) per unit of gas this transaction will pay.
 * @property {number} [maxFeePerGas] - The maximum price (in wei) per unit of gas this transaction will pay for the combined [EIP-1559](https://eips.ethereum.org/EIPS/eip-1559) block's base fee and this transaction's priority fee.
 * @property {number} [maxPriorityFeePerGas] - The price (in wei) per unit of gas this transaction will allow in addition to the [EIP-1559](https://eips.ethereum.org/EIPS/eip-1559) block's base fee to bribe miners into giving this transaction priority. This is included in the maxFeePerGas, so this will not affect the total maximum cost set with maxFeePerGas.
 */

/**
 * @typedef {Object} EvmWalletConfig
 * @property {string} [rpcUrl] - rpc url of the provider.
 */

export default class WalletAccountEvm {
  #account

  /**
   * Creates a new evm wallet account.
   *
   * @param {string} seedPhrase - The bip-39 mnemonic.
   * @param {string} path - The bip-44 derivation path.
   * @param {EvmWalletConfig} [config] - The configuration object.
   */
  constructor (seedPhrase, path, config = {}) {
    if (!HDNodeWallet.isValidMnemonic(seedPhrase)) {
      throw new Error('Seed phrase is invalid.')
    }

    if (typeof path !== 'string' || !path.startsWith('m/')) {
      throw new Error('Invalid derivation path format.')
    }

    const { rpcUrl } = config

    const node = HDNodeWallet.fromPhrase(seedPhrase).derivePath(path)

    let wallet = node
    let provider = null

    if (rpcUrl) {
      provider = new JsonRpcProvider(rpcUrl)
      wallet = wallet.connect(provider)
    }

    this.#account = {
      privateKey: wallet.privateKey,
      publicKey: wallet.publicKey,
      address: wallet.address,
      signMessage: wallet.signMessage.bind(wallet),
      sendTransaction: wallet.sendTransaction.bind(wallet),
      provider,
      path,
      index: parseInt(path.split('/').pop(), 10) || 0
    }
  }

  /**
   * The derivation path's index of this account.
   *
   * @type {number}
   */
  get index () {
    return this.#account.index
  }

  /**
   * The derivation path of this account (see [BIP-44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki)).
   *
   * @type {string}
   */
  get path () {
    return this.#account.path
  }

  /**
   * The account's key pair.
   *
   * @type {KeyPair}
   */
  get keyPair () {
    return {
      privateKey: this.#account.privateKey,
      publicKey: this.#account.publicKey
    }
  }

  /**
   * Returns the account's address.
   *
   * @returns {Promise<string>} The account's address.
   */
  async getAddress () {
    return this.#account.address
  }

  /**
   * Signs a message.
   *
   * @param {string} message - The message to sign.
   * @returns {Promise<string>} The message's signature.
   */
  async sign (message) {
    return await this.#account.signMessage(message)
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
    return address.toLowerCase() === this.#account.address.toLowerCase()
  }

  /**
   * Sends a transaction with arbitrary data.
   *
   * @param {EvmTransaction} tx - The transaction to send.
   * @returns {Promise<string>} The transaction's hash.
   */
  async sendTransaction (tx) {
    if (!this.#account.provider) {
      throw new Error('The wallet must be connected to a provider to send transactions.')
    }

    const { hash } = await this.#account.sendTransaction(tx)
    return hash
  }

  /**
   * Quotes a transaction.
   *
   * @param {EvmTransaction} tx - The transaction to quote.
   * @returns {Promise<number>} The transaction’s fee (in weis).
   */
  async quoteTransaction (tx) {
    if (!this.#account.provider) {
      throw new Error('The wallet must be connected to a provider to quote transactions.')
    }

    const gasLimit = await this.#account.provider.estimateGas(tx)
    const { maxFeePerGas } = await this.#account.provider.getFeeData()
    return Number(gasLimit * maxFeePerGas)
  }

  /**
   * Returns the account's native token balance.
   *
   * @returns {Promise<number>} The native token balance.
   */
  async getBalance () {
    if (!this.#account.provider) {
      throw new Error('The wallet must be connected to a provider to retrieve balances.')
    }

    const balance = await this.#account.provider.getBalance(await this.getAddress())
    return Number(balance)
  }

  /**
   * Returns the account balance for a specific token.
   *
   * @param {string} tokenAddress - The smart contract address of the token.
   * @returns {Promise<number>} The token balance.
   */
  async getTokenBalance (tokenAddress) {
    if (!this.#account.provider) {
      throw new Error('The wallet must be connected to a provider to retrieve token balances.')
    }

    const abi = ['function balanceOf(address owner) view returns (uint256)']
    const token = new Contract(tokenAddress, abi, this.#account.provider)
    const balance = await token.balanceOf(await this.getAddress())
    return Number(balance)
  }
}
