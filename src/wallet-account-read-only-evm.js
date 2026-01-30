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

import { WalletAccountReadOnly } from '@tetherto/wdk-wallet'

import { BrowserProvider, Contract, JsonRpcProvider, verifyMessage, verifyTypedData } from 'ethers'

/** @typedef {import('ethers').Provider} Provider */
/** @typedef {import('ethers').Eip1193Provider} Eip1193Provider */
/** @typedef {import('ethers').TransactionReceipt} EvmTransactionReceipt */

/** @typedef {import('@tetherto/wdk-wallet').TransactionResult} TransactionResult */
/** @typedef {import('@tetherto/wdk-wallet').TransferOptions} TransferOptions */
/** @typedef {import('@tetherto/wdk-wallet').TransferResult} TransferResult */

/** @typedef {import('ethers').TypedDataDomain} TypedDataDomain */
/** @typedef {import('ethers').TypedDataField} TypedDataField */

/**
 * @typedef {Object} TypedData
 * @property {Record<string, unknown>} domain - The domain separator.
 * @property {Record<string, unknown>} types - The type definitions.
 * @property {string} primaryType - The primary type.
 * @property {Record<string, unknown>} message - The message data.
 */

/**
 * @typedef {Object} EvmTransaction
 * @property {string} to - The transaction's recipient.
 * @property {number | bigint} value - The amount of ethers to send to the recipient (in weis).
 * @property {string} [data] - The transaction's data in hex format.
 * @property {number | bigint} [gasLimit] - The maximum amount of gas this transaction is permitted to use.
 * @property {number | bigint} [gasPrice] - The price (in wei) per unit of gas this transaction will pay.
 * @property {number | bigint} [maxFeePerGas] - The maximum price (in wei) per unit of gas this transaction will pay for the combined [EIP-1559](https://eips.ethereum.org/EIPS/eip-1559) block's base fee and this transaction's priority fee.
 * @property {number | bigint} [maxPriorityFeePerGas] - The price (in wei) per unit of gas this transaction will allow in addition to the [EIP-1559](https://eips.ethereum.org/EIPS/eip-1559) block's base fee to bribe miners into giving this transaction priority. This is included in the maxFeePerGas, so this will not affect the total maximum cost set with maxFeePerGas.
 */

/**
 * @typedef {Object} EvmWalletConfig
 * @property {string | Eip1193Provider} [provider] - The url of the rpc provider, or an instance of a class that implements eip-1193.
 * @property {number | bigint} [transferMaxFee] - The maximum fee amount for transfer operations.
 */

export default class WalletAccountReadOnlyEvm extends WalletAccountReadOnly {
  /**
   * Creates a new evm read-only wallet account.
   *
   * @param {string} address - The account's address.
   * @param {Omit<EvmWalletConfig, 'transferMaxFee'>} [config] - The configuration object.
   */
  constructor (address, config = { }) {
    super(address)

    /**
     * The read-only wallet account configuration.
     *
     * @protected
     * @type {Omit<EvmWalletConfig, 'transferMaxFee'>}
     */
    this._config = config

    const { provider } = config

    if (provider) {
      /**
       * An ethers provider to interact with a node of the blockchain.
       *
       * @protected
       * @type {Provider | undefined}
       */
      this._provider = typeof provider === 'string'
        ? new JsonRpcProvider(provider)
        : new BrowserProvider(provider)
    }
  }

  /**
   * Returns the account's eth balance.
   *
   * @returns {Promise<bigint>} The eth balance (in weis).
   */
  async getBalance () {
    if (!this._provider) {
      throw new Error('The wallet must be connected to a provider to retrieve balances.')
    }

    const address = await this.getAddress()

    const balance = await this._provider.getBalance(address)

    return balance
  }

  /**
   * Returns the account balance for a specific token.
   *
   * @param {string} tokenAddress - The smart contract address of the token.
   * @returns {Promise<bigint>} The token balance (in base unit).
   */
  async getTokenBalance (tokenAddress) {
    if (!this._provider) {
      throw new Error('The wallet must be connected to a provider to retrieve token balances.')
    }

    const address = await this.getAddress()

    const abi = ['function balanceOf(address owner) view returns (uint256)']
    const contract = new Contract(tokenAddress, abi, this._provider)
    const balance = await contract.balanceOf(address)

    return balance
  }

  /**
   * Quotes the costs of a send transaction operation.
   *
   * @param {EvmTransaction} tx - The transaction.
   * @returns {Promise<Omit<TransactionResult, 'hash'>>} The transaction's quotes.
   */
  async quoteSendTransaction (tx) {
    if (!this._provider) {
      throw new Error('The wallet must be connected to a provider to quote send transaction operations.')
    }

    const gas = await this._provider.estimateGas({
      from: await this.getAddress(),
      ...tx
    })

    const { maxFeePerGas } = await this._provider.getFeeData()

    return { fee: gas * maxFeePerGas }
  }

  /**
   * Quotes the costs of a transfer operation.
   *
   * @param {TransferOptions} options - The transfer's options.
   * @returns {Promise<Omit<TransferResult, 'hash'>>} The transfer's quotes.
   */
  async quoteTransfer (options) {
    if (!this._provider) {
      throw new Error('The wallet must be connected to a provider to quote transfer operations.')
    }

    const tx = await WalletAccountReadOnlyEvm._getTransferTransaction(options)

    const result = await this.quoteSendTransaction(tx)

    return result
  }

  /**
   * Returns a transaction's receipt.
   *
   * @param {string} hash - The transaction's hash.
   * @returns {Promise<EvmTransactionReceipt | null>} – The receipt, or null if the transaction has not been included in a block yet.
   */
  async getTransactionReceipt (hash) {
    if (!this._provider) {
      throw new Error('The wallet must be connected to a provider to fetch transaction receipts.')
    }

    return await this._provider.getTransactionReceipt(hash)
  }

  /**
   * Returns the current allowance for the given token and spender.
   * @param {string} token The token’s address.
   * @param {string} spender The spender’s address.
   * @returns {Promise<bigint>} The allowance.
   */
  async getAllowance (token, spender) {
    if (!this._provider) {
      throw new Error('The wallet must be connected to a provider to retrieve allowances.')
    }

    const address = await this.getAddress()
    const abi = ['function allowance(address owner, address spender) view returns (uint256)']
    const contract = new Contract(token, abi, this._provider)
    const allowance = await contract.allowance(address, spender)
    return allowance
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
    const accountAddress = await this.getAddress()

    return address.toLowerCase() === accountAddress.toLowerCase()
  }

  /**
   * Verifies a typed data signature.
   *
   * @param {TypedData} typedData - The typed data to verify.
   * @param {string} signature - The signature to verify.
   * @returns {Promise<boolean>} True if the signature is valid.
   */
  async verifyTypedData (typedData, signature) {
    const { domain, types, message } = typedData
    const address = verifyTypedData(domain, types, message, signature)
    const accountAddress = await this.getAddress()

    return address.toLowerCase() === accountAddress.toLowerCase()
  }

  /**
   * Returns an evm transaction to execute the given token transfer.
   *
   * @protected
   * @param {TransferOptions} options - The transfer's options.
   * @returns {Promise<EvmTransaction>} The evm transaction.
   */
  static async _getTransferTransaction (options) {
    const { token, recipient, amount } = options

    const abi = ['function transfer(address to, uint256 amount) returns (bool)']

    const contract = new Contract(token, abi)

    const tx = {
      to: token,
      value: 0,
      data: contract.interface.encodeFunctionData('transfer', [recipient, amount])
    }

    return tx
  }
}
