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

import { MaximumFeeExceededError, ProviderRequiredError, ValueError } from '@tetherto/wdk-wallet'

import { Contract, Transaction, ZeroAddress } from 'ethers'

import WalletAccountReadOnlyEvm from './wallet-account-read-only-evm.js'

import SeedSignerEvm from './signers/seed-signer-evm.js'
import PrivateKeySignerEvm from './signers/private-key-signer-evm.js'
import { populateTransactionEvm } from './utils/tx-populator-evm.js'

/** @typedef {import('./signers/seed-signer-evm.js').ISignerEvm} ISignerEvm */
/** @typedef {import('ethers').HDNodeWallet} HDNodeWallet */
/** @typedef {import('ethers').AuthorizationRequest} AuthorizationRequest */
/** @typedef {import('ethers').Authorization} Authorization */
/** @typedef {import('ethers').AuthorizationLike} AuthorizationLike */

/** @typedef {import('@tetherto/wdk-wallet').IWalletAccount} IWalletAccount */

/** @typedef {import('@tetherto/wdk-wallet').KeyPair} KeyPair */
/** @typedef {import('@tetherto/wdk-wallet').TransactionResult} TransactionResult */
/** @typedef {import('@tetherto/wdk-wallet').TransferResult} TransferResult */

/** @typedef {import('./wallet-account-read-only-evm.js').TypedData} TypedData */
/** @typedef {import('./wallet-account-read-only-evm.js').EvmTransaction} EvmTransaction */
/** @typedef {import('./wallet-account-read-only-evm.js').EvmTransferOptions} EvmTransferOptions */
/** @typedef {import('./wallet-account-read-only-evm.js').EvmGasOverrides} EvmGasOverrides */
/** @typedef {import('./wallet-account-read-only-evm.js').EvmWalletConfig} EvmWalletConfig */

/**
 * @typedef {Object} ApproveOptions
 * @property {string} token - The address of the token to approve.
 * @property {string} spender - The spender's address.
 * @property {number | bigint} amount - The amount of tokens to approve to the spender.
 */

/**
 * The options of a token approval, extended with the optional gas overrides of an evm transaction.
 *
 * @typedef {ApproveOptions & EvmGasOverrides} EvmApproveOptions
 */

const USDT_MAINNET_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7'

const DELEGATION_TX_GAS_LIMIT = 100_000

/** @implements {IWalletAccount<string>} */
export default class WalletAccountEvm extends WalletAccountReadOnlyEvm {
  /**
   * Creates a new evm wallet account from a BIP-39 seed, deriving the account's key at the
   * given BIP-44 path.
   *
   * @overload
   * @param {string | Uint8Array} seed - The wallet's BIP-39 seed phrase or seed bytes.
   * @param {string} path - The BIP-44 derivation path (e.g. "0'/0/0").
   * @param {EvmWalletConfig} [config] - The configuration object.
   */

  /**
   * Creates a new evm wallet account using a signer.
   *
   * @overload
   * @param {ISignerEvm} signer - A signer implementing the EVM signer interface.
   * @param {EvmWalletConfig} [config] - The configuration object.
   */

  constructor (seedOrSigner, pathOrConfig = {}, config = {}) {
    const [signer, configuration] = typeof seedOrSigner === 'string' || seedOrSigner instanceof Uint8Array
      ? [new SeedSignerEvm(seedOrSigner, { path: pathOrConfig, isChild: true }), config]
      : [seedOrSigner, pathOrConfig]

    super(signer.address, configuration)

    /**
     * The wallet account configuration.
     *
     * @protected
     * @type {EvmWalletConfig}
     */
    this._config = configuration

    /** @private */
    this._signer = signer
  }

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
   * The uint8 arrays are bound to the wallet account, so any external change will reflect to the internal representation. For this reason,
   * it's strongly recommended to treat the key pair as a read-only view of the keys. While it's still technically possible to alter their
   * content, client code should never do so.
   *
   * @type {KeyPair}
   */
  get keyPair () {
    return this._signer.keyPair
  }

  /**
   * Creates a new evm wallet account from a raw private key.
   *
   * @param {string | Uint8Array} privateKey - The raw private key (hex string with or without 0x, or 32 bytes).
   * @param {EvmWalletConfig} [config] - The configuration object.
   * @returns {WalletAccountEvm} The wallet account.
   */
  static fromPrivateKey (privateKey, config = {}) {
    const signer = new PrivateKeySignerEvm(privateKey)
    return new WalletAccountEvm(signer, config)
  }

  /**
   * Returns the account's address. If it wasn't resolved at construction time (e.g hardware signers), it asks the
   * underlying signer to resolve it, then caches it locally.
   *
   * @returns {Promise<string>} The account's address.
   */
  async getAddress () {
    if (this._address) return this._address
    const addr = await this._signer.getAddress()
    this.__address = addr
    return addr
  }

  /**
   * Signs a message.
   *
   * @param {string} message - The message to sign.
   * @returns {Promise<string>} The message's signature.
   */
  async sign (message) {
    return await this._signer.sign(message)
  }

  /**
   * Signs typed data according to EIP-712.
   *
   * @param {TypedData} typedData - The typed data to sign.
   * @returns {Promise<string>} The typed data signature.
   */
  async signTypedData ({ domain, types, message }) {
    return await this._signer.signTypedData({ domain, types, message })
  }

  /**
   * Signs a transaction.
   *
   * If a provider is set, it also estimates the transaction's costs and checks them against the transaction max. fee option.
   *
   * @param {EvmTransaction} tx - The transaction to sign.
   * @returns {Promise<string>} The signed transaction as a hex string.
   * @throws {MaximumFeeExceededError} If a provider is set, and the transaction's cost surpasses the transaction max. fee option.
   */
  async signTransaction (tx) {
    if (this._provider && this._config.transactionMaxFee !== undefined) {
      const { fee } = await this.quoteSendTransaction(tx)

      if (fee > this._config.transactionMaxFee) {
        throw new MaximumFeeExceededError('Exceeded maximum fee cost for transaction operation.')
      }
    }
    return await this._signer.signTransaction({
      from: await this.getAddress(),
      ...tx
    })
  }

  /**
   * Sends a transaction.
   *
   * @param {EvmTransaction | string} tx - The transaction, or a signed raw transaction as a hex string.
   * @returns {Promise<TransactionResult>} The transaction's result.
   * @throws {ProviderRequiredError} If the wallet is not connected to a provider.
   * @throws {MaximumFeeExceededError} If the transaction's cost exceeds the maximum transaction fee option.
   * @throws {ValueError} If the transaction mixes fee fields that its type doesn't support, or a type 3 transaction omits `maxFeePerBlobGas`.
   */
  async sendTransaction (tx) {
    if (!this._provider) {
      throw new ProviderRequiredError('The wallet must be connected to a provider to send transactions.')
    }
    const { fee } = await this.quoteSendTransaction(tx)
    if (this._config.transactionMaxFee !== undefined && fee > this._config.transactionMaxFee) {
      throw new MaximumFeeExceededError('Exceeded maximum fee cost for transaction operation.')
    }

    if (typeof tx === 'string') {
      const hash = await this._provider.send('eth_sendRawTransaction', [tx])
      return { hash, fee }
    }

    // Build, sign and broadcast raw transaction using the signer
    const from = await this.getAddress()
    const unsignedTx = await populateTransactionEvm(this._provider, from, tx)
    const signed = await this._signer.signTransaction(unsignedTx)
    const hash = await this._provider.send('eth_sendRawTransaction', [signed])
    return { hash, fee }
  }

  /**
   * Quotes the costs of a send transaction operation.
   *
   * @param {EvmTransaction | string} tx - The transaction, or a signed raw transaction as a hex string.
   * @returns {Promise<Omit<TransactionResult, 'hash'>>} The transaction's quotes.
   * @throws {ProviderRequiredError} If the wallet is not connected to a provider.
   */
  async quoteSendTransaction (tx) {
    if (typeof tx === 'string') {
      if (!this._provider) {
        throw new ProviderRequiredError('The wallet must be connected to a provider to quote send transaction operations.')
      }

      const { from, to, value, data, gasLimit, gasPrice, maxFeePerGas, maxPriorityFeePerGas, type, nonce, chainId, authorizationList } = Transaction.from(tx)

      const transaction = { from, to, value, data, gasLimit, gasPrice, maxFeePerGas, maxPriorityFeePerGas, type, nonce, chainId, authorizationList }

      const gas = transaction.authorizationList
        ? await this._estimateGasWithAuthList(transaction)
        : await this._provider.estimateGas(transaction)

      const fees = await this._provider.getFeeData()

      const feeRate = fees.maxFeePerGas || fees.gasPrice

      return { fee: gas * feeRate }
    }

    return await super.quoteSendTransaction(tx)
  }

  /**
   * Transfers a token to another address.
   *
   * @param {EvmTransferOptions} options - The transfer's options.
   * @returns {Promise<TransferResult>} The transfer's result.
   * @throws {ProviderRequiredError} If the wallet is not connected to a provider.
   * @throws {MaximumFeeExceededError} If the transfer's cost exceeds the maximum transfer fee option.
   */
  async transfer (options) {
    if (!this._provider) {
      throw new ProviderRequiredError('The wallet must be connected to a provider to transfer tokens.')
    }

    const tx = await WalletAccountEvm._getTransferTransaction(options)

    const { fee } = await this.quoteSendTransaction(tx)

    if (this._config.transferMaxFee !== undefined && fee > this._config.transferMaxFee) {
      throw new MaximumFeeExceededError('Exceeded maximum fee cost for transfer operation.')
    }

    const { hash } = await this.sendTransaction(tx)

    return { hash, fee }
  }

  /**
   * Approves a specific amount of tokens to a spender.
   *
   * @param {EvmApproveOptions} options - The approve options, including any gas overrides to carry onto the transaction.
   * @returns {Promise<TransactionResult>} The transaction's result.
   * @throws {ProviderRequiredError} If the wallet is not connected to a provider.
   * @throws {ValueError} If trying to approve usdts on ethereum with allowance not equal to zero (due to the usdt allowance reset requirement).
   */
  async approve (options) {
    if (!this._provider) {
      throw new ProviderRequiredError('The wallet must be connected to a provider to approve funds.')
    }

    const { token, spender, amount } = options
    const { chainId } = await this._provider.getNetwork()

    if (chainId === 1n && token.toLowerCase() === USDT_MAINNET_ADDRESS.toLowerCase()) {
      const currentAllowance = await this.getAllowance(token, spender)
      if (currentAllowance > 0n && BigInt(amount) > 0n) {
        throw new ValueError(
          'USDT requires the current allowance to be reset to 0 before setting a new non-zero value. Please send an "approve" transaction with an amount of 0 first.'
        )
      }
    }

    const abi = ['function approve(address spender, uint256 amount) returns (bool)']
    const contract = new Contract(token, abi, this._provider)

    const tx = {
      to: token,
      value: 0,
      data: contract.interface.encodeFunctionData('approve', [spender, amount]),
      ...WalletAccountReadOnlyEvm._getGasOverrides(options)
    }

    return await this.sendTransaction(tx)
  }

  /**
   * Returns a read-only copy of the account.
   *
   * @returns {Promise<WalletAccountReadOnlyEvm>} The read-only account.
   */
  async toReadOnlyAccount () {
    if (!this._evmReadOnlyAccount) {
      this._evmReadOnlyAccount = new WalletAccountReadOnlyEvm(await this.getAddress(), this._config)
    }

    return this._evmReadOnlyAccount
  }

  /**
   * Signs an ERC-7702 authorization tuple.
   *
   * @param {AuthorizationRequest} auth - The authorization request.
   * @returns {Promise<Authorization>} The signed authorization.
   */
  async signAuthorization (auth) {
    const populated = { ...auth }
    if (this._provider) {
      if (populated.chainId == null) {
        const { chainId } = await this._provider.getNetwork()
        populated.chainId = chainId
      }
      if (populated.nonce == null) {
        const address = await this.getAddress()
        populated.nonce = await this._provider.getTransactionCount(address)
      }
    }
    return await this._signer.signAuthorization(populated)
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
   * @throws {ProviderRequiredError} If the wallet is not connected to a provider.
   */
  async delegate (delegateAddress) {
    if (!this._provider) {
      throw new ProviderRequiredError('The wallet must be connected to a provider to delegate.')
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
   * Disposes the wallet account, erasing the private key from the memory.
   */
  dispose () {
    this._signer.dispose()
  }
}
