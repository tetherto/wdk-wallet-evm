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

import { WalletAccountReadOnly, NoSuchElementError, ProviderRequiredError, ValueError } from '@tetherto/wdk-wallet'

import { BrowserProvider, Contract, Interface, isError, isHexString, JsonRpcProvider, Network, Signature, toQuantity, verifyMessage, verifyTypedData } from 'ethers'

import { multicall } from './multicall.js'

import FailoverProvider from '@tetherto/wdk-failover-provider'

/** @typedef {import('ethers').Provider} Provider */
/** @typedef {import('ethers').Eip1193Provider} Eip1193Provider */
/** @typedef {import('ethers').TypedDataDomain} TypedDataDomain */
/** @typedef {import('ethers').TypedDataField} TypedDataField */
/** @typedef {import('ethers').AuthorizationLike} AuthorizationLike */
/** @typedef {import('ethers').BlobLike} BlobLike */
/** @typedef {import('ethers').TransactionReceipt} EvmTransactionReceipt */
/** @typedef {import('ethers').TransactionResponse} EvmTransactionResponse */

/** @typedef {import('@tetherto/wdk-wallet').TransactionResult} TransactionResult */
/** @typedef {import('@tetherto/wdk-wallet').TransferResult} TransferResult */
/** @typedef {import('@tetherto/wdk-wallet').TransactionReceipt} TransactionReceipt */
/** @typedef {import('@tetherto/wdk-wallet').WaitForTransactionOptions} WaitForTransactionOptions */
/** @typedef {import('@tetherto/wdk-wallet').TransferOptions} TransferOptions */

/**
 * The EVM-specific fields added to a normalized transaction receipt.
 *
 * @typedef {Object} EvmTransactionDetails
 * @property {number} confirmations - The number of confirmations (0 while pending or dropped).
 * @property {EvmTransactionReceipt | null} receipt - The native ethers receipt, or null while the transaction is pending or dropped.
 */

/**
 * @typedef {Object} TypedData
 * @property {TypedDataDomain} domain - The domain separator.
 * @property {Record<string, TypedDataField[]>} types - The type definitions.
 * @property {Record<string, unknown>} message - The message data.
 */

/**
 * @typedef {Object} DelegationInfo
 * @property {boolean} isDelegated - Whether the account has an active ERC-7702 delegation.
 * @property {string | null} delegateAddress - The address of the delegate contract, or null if not delegated.
 */

/**
 * @typedef {Object} EvmTransaction
 * @property {string | null} [to] - The transaction's recipient. Omit or pass null to deploy a contract.
 * @property {number | bigint} value - The amount of ethers to send to the recipient (in weis).
 * @property {string} [data] - The transaction's data in hex format.
 * @property {number | bigint} [gasLimit] - The maximum amount of gas this transaction is permitted to use.
 * @property {number | bigint} [gasPrice] - The price (in wei) per unit of gas this transaction will pay.
 * @property {number | bigint} [maxFeePerGas] - The maximum price (in wei) per unit of gas this transaction will pay for the combined [EIP-1559](https://eips.ethereum.org/EIPS/eip-1559) block's base fee and this transaction's priority fee.
 * @property {number | bigint} [maxPriorityFeePerGas] - The price (in wei) per unit of gas this transaction will allow in addition to the [EIP-1559](https://eips.ethereum.org/EIPS/eip-1559) block's base fee to bribe miners into giving this transaction priority. This is included in the maxFeePerGas, so this will not affect the total maximum cost set with maxFeePerGas.
 * @property {number} [type] - The transaction type (e.g. 4 for ERC-7702).
 * @property {number} [nonce] - The transaction nonce.
 * @property {number | bigint} [chainId] - The chain ID of the network.
 * @property {number | bigint} [maxFeePerBlobGas] - The maximum price (in wei) per unit of blob gas this transaction will pay for [EIP-4844](https://eips.ethereum.org/EIPS/eip-4844) blob data. Required for type 3 (blob) transactions.
 * @property {BlobLike[]} [blobs] - The blobs of an [EIP-4844](https://eips.ethereum.org/EIPS/eip-4844) type 3 transaction.
 * @property {string[]} [blobVersionedHashes] - The versioned hashes of the blobs of an [EIP-4844](https://eips.ethereum.org/EIPS/eip-4844) type 3 transaction.
 * @property {AuthorizationLike[]} [authorizationList] - An optional list of ERC-7702 signed authorizations for type 4 transactions.
 */

/**
 * The gas and fee fields of an evm transaction that can be set on transfer and approve options.
 *
 * @typedef {Pick<EvmTransaction, 'gasLimit' | 'gasPrice' | 'maxFeePerGas' | 'maxPriorityFeePerGas'>} EvmGasOverrides
 */

/**
 * The options of a token transfer, extended with the optional gas overrides and ERC-7702 authorizations of an evm
 * transaction.
 *
 * @typedef {TransferOptions & EvmGasOverrides & Pick<EvmTransaction, 'authorizationList'>} EvmTransferOptions
 */

/**
 * @typedef {Object} EvmWalletConfig
 * @property {string | Provider | Eip1193Provider | Array<string | Provider | Eip1193Provider>} [provider] - The url of the rpc provider, an already-built ethers provider (e.g. a `JsonRpcProvider` or a failover wrapper), or an instance of a class that implements eip-1193. It's also possible to provide an array of these instead. In such case, connection errors will cause the wallet to automatically fallback on the next provider in the list. An already-built provider is reused as-is, which lets a manager share a single provider across all the accounts it creates.
 * @property {number} [retries] - If set and if 'provider' is a list of urls or EIP 1193 providers, the number of additional retry attempts after the initial call fails. Total attempts = `1 + retries`. For example, `retries: 3` with 4 providers will try each provider once before throwing. If `retries` exceeds the number of providers, the failover will loop back and retry already-failed providers in round-robin order. Default: 3.
 * @property {number} [chainId] - The chain ID of the network. When provided, skips automatic chain ID detection from the provider.
 * @property {number | bigint} [transferMaxFee] - The maximum fee amount for transfer operations.
 * @property {number | bigint} [transactionMaxFee] - The maximum fee amount for sendTransaction and signTransaction operations.
 */

const DELEGATION_DESIGNATOR_PREFIX = '0xef0100'

const DELEGATION_DESIGNATOR_LENGTH = 48

export default class WalletAccountReadOnlyEvm extends WalletAccountReadOnly {
  /**
   * Creates a new evm read-only wallet account.
   *
   * @param {string} address - The account's address.
   * @param {Omit<EvmWalletConfig, 'transferMaxFee' | 'transactionMaxFee'>} [config] - The configuration object.
   */
  constructor (address, config = { }) {
    super(address)

    /**
     * The read-only wallet account configuration.
     *
     * @protected
     * @type {Omit<EvmWalletConfig, 'transferMaxFee' | 'transactionMaxFee'>}
     */
    this._config = config

    /**
     * An ethers provider to interact with a node of the blockchain.
     *
     * @protected
     * @type {Provider | undefined}
     */
    this._provider = WalletAccountReadOnlyEvm._buildProvider(config)
  }

  /**
   * Whether a value is an EIP-1193 provider (e.g. a browser wallet).
   *
   * @protected
   * @param {string | Eip1193Provider | Provider} value - The value to inspect.
   * @returns {boolean} True if the value is an EIP-1193 provider.
   */
  static _isEip1193Provider (value) {
    return typeof value.request === 'function'
  }

  /**
   * Builds an ethers provider from the wallet configuration:
   * - a url string -> a new `JsonRpcProvider`
   * - an already-built ethers provider (or failover wrapper) -> reused as-is
   * - anything else (EIP-1193 / browser wallet) -> wrapped in a `BrowserProvider`
   * - an array of the above -> a `FailoverProvider` across each entry
   *
   * @protected
   * @param {Omit<EvmWalletConfig, 'transferMaxFee' | 'transactionMaxFee'>} [config] - The configuration object.
   * @returns {Provider | undefined} The provider, or undefined if none is configured.
   */
  static _buildProvider (config = {}) {
    const { provider, retries = 3 } = config
    const network = config.chainId ? Network.from(config.chainId) : undefined
    const providerOpts = config.chainId ? { staticNetwork: true } : undefined

    const toOption = (entry) => {
      if (typeof entry === 'string') {
        return new JsonRpcProvider(entry, network, providerOpts)
      }

      if (WalletAccountReadOnlyEvm._isEip1193Provider(entry)) {
        return new BrowserProvider(entry)
      }

      return entry
    }

    if (Array.isArray(provider)) {
      if (provider.length === 0) {
        return undefined
      }

      const failoverProvider = new FailoverProvider({ retries })

      for (const entry of provider) {
        failoverProvider.addProvider(toOption(entry))
      }

      return failoverProvider.initialize()
    }

    if (provider) {
      return toOption(provider)
    }

    return undefined
  }

  /**
   * The account's address, or undefined if the account's signer doesn't expose its address
   * synchronously.
   *
   * @deprecated Use {@link getAddress} instead. This property will be removed in an upcoming
   * release: not all signers (e.g. hardware signers) can expose the address synchronously.
   * @type {string | undefined}
   */
  get address () {
    return this._address
  }

  /**
   * Returns the account's eth balance.
   *
   * @returns {Promise<bigint>} The eth balance (in weis).
   * @throws {ProviderRequiredError} If the wallet is not connected to a provider.
   */
  async getBalance () {
    if (!this._provider) {
      throw new ProviderRequiredError('The wallet must be connected to a provider to retrieve balances.')
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
   * @throws {ProviderRequiredError} If the wallet is not connected to a provider.
   */
  async getTokenBalance (tokenAddress) {
    if (!this._provider) {
      throw new ProviderRequiredError('The wallet must be connected to a provider to retrieve token balances.')
    }

    const address = await this.getAddress()

    const abi = ['function balanceOf(address owner) view returns (uint256)']
    const contract = new Contract(tokenAddress, abi, this._provider)
    const balance = await contract.balanceOf(address)

    return balance
  }

  /**
   * Returns the account balances for multiple tokens.
   *
   * @param {string[]} tokenAddresses - The smart contract addresses of the tokens.
   * @returns {Promise<Record<string, bigint>>} A mapping of token addresses to their balances (in base units).
   * @throws {ProviderRequiredError} If the wallet is not connected to a provider.
   */
  async getTokenBalances (tokenAddresses) {
    if (!this._provider) {
      throw new ProviderRequiredError(
        'The wallet must be connected to a provider to retrieve token balances.'
      )
    }

    if (tokenAddresses.length === 0) {
      return {}
    }

    const address = await this.getAddress()
    const iface = new Interface(['function balanceOf(address owner) view returns (uint256)'])
    const calldata = iface.encodeFunctionData('balanceOf', [address])

    const calls = tokenAddresses.map(tokenAddress => ({
      to: tokenAddress,
      data: calldata
    }))

    const results = await multicall(this._provider, calls)

    return tokenAddresses.reduce((acc, tokenAddress, index) => {
      const result = results[index]
      acc[tokenAddress] = result.status
        ? iface.decodeFunctionResult('balanceOf', result.data)[0]
        : 0n
      return acc
    }, {})
  }

  /**
   * Validates that a transaction does not mix fee fields its type doesn't support.
   *
   * @protected
   * @param {EvmTransaction} tx - The transaction to validate.
   * @throws {ValueError} If the transaction mixes fee fields that its type doesn't support, or a type 3 transaction omits `maxFeePerBlobGas`.
   */
  static _validateFeeFields (tx) {
    const has1559 = tx.maxFeePerGas !== undefined || tx.maxPriorityFeePerGas !== undefined
    const hasLegacy = tx.gasPrice !== undefined
    const hasBlobs = tx.blobs !== undefined || tx.blobVersionedHashes !== undefined || tx.maxFeePerBlobGas !== undefined
    const explicitType = (tx.type !== undefined) ? Number(tx.type) : null

    if ((explicitType === 2 || (explicitType === null && has1559)) && hasLegacy) {
      throw new ValueError('eip-1559 transaction does not support gasPrice')
    }
    if ((explicitType === 0 || explicitType === 1) && has1559) {
      throw new ValueError('pre-eip-1559 transaction does not support maxFeePerGas/maxPriorityFeePerGas')
    }
    if ((explicitType === 3 || hasBlobs) && hasLegacy) {
      throw new ValueError('blob transaction does not support gasPrice')
    }
    if ((explicitType === 3 || hasBlobs) && tx.maxFeePerBlobGas === undefined) {
      throw new ValueError('maxFeePerBlobGas is required for type 3 transactions')
    }
  }

  /**
   * Quotes the costs of a send transaction operation.
   *
   * @param {EvmTransaction} tx - The transaction.
   * @returns {Promise<Omit<TransactionResult, 'hash'>>} The transaction's quotes.
   * @throws {ProviderRequiredError} If the wallet is not connected to a provider.
   * @throws {ValueError} If the transaction mixes fee fields that its type doesn't support, or a type 3 transaction omits `maxFeePerBlobGas`.
   */
  async quoteSendTransaction (tx) {
    if (!this._provider) {
      throw new ProviderRequiredError('The wallet must be connected to a provider to quote send transaction operations.')
    }

    WalletAccountReadOnlyEvm._validateFeeFields(tx)

    const from = await this.getAddress()

    const gas = tx.authorizationList
      ? await this._estimateGasWithAuthList({ from, ...tx })
      : await this._provider.estimateGas({ from, ...tx })

    const data = await this._provider.getFeeData()

    const feeRate = data.maxFeePerGas || data.gasPrice

    return { fee: gas * feeRate }
  }

  /**
   * Quotes the costs of a transfer operation.
   *
   * @param {EvmTransferOptions} options - The transfer's options, including any gas overrides to carry onto the transaction.
   * @returns {Promise<Omit<TransferResult, 'hash'>>} The transfer's quotes.
   * @throws {ProviderRequiredError} If the wallet is not connected to a provider.
   */
  async quoteTransfer (options) {
    if (!this._provider) {
      throw new ProviderRequiredError('The wallet must be connected to a provider to quote transfer operations.')
    }

    const tx = await WalletAccountReadOnlyEvm._getTransferTransaction(options)

    const result = await this.quoteSendTransaction(tx)

    return result
  }

  /**
   * Returns a transaction's receipt.
   *
   * @deprecated Use {@link getTransaction} instead, which returns a normalized, finality-based receipt. The raw ethers receipt remains available on its `receipt` property.
   * @param {string} hash - The transaction's hash.
   * @returns {Promise<EvmTransactionReceipt | null>} – The receipt, or null if the transaction has not been included in a block yet.
   * @throws {ProviderRequiredError} If the wallet is not connected to a provider.
   */
  async getTransactionReceipt (hash) {
    if (!this._provider) {
      throw new ProviderRequiredError('The wallet must be connected to a provider to fetch transaction receipts.')
    }

    return await this._provider.getTransactionReceipt(hash)
  }

  /**
   * Returns a normalized, finality-based receipt for a transaction.
   *
   * @param {string} hash - The transaction's hash.
   * @returns {Promise<TransactionReceipt & EvmTransactionDetails>} The normalized receipt.
   * @throws {ProviderRequiredError} If the wallet is not connected to a provider.
   * @throws {ValueError} If the hash is not a valid transaction hash.
   * @throws {NoSuchElementError} If no transaction has been found for the given hash.
   */
  async getTransaction (hash) {
    if (!this._provider) {
      throw new ProviderRequiredError('The wallet must be connected to a provider to fetch transactions.')
    }

    if (!isHexString(hash, 32)) {
      throw new ValueError(`Invalid transaction hash: '${hash}'.`)
    }

    const [transaction, receipt] = await Promise.all([
      this._provider.getTransaction(hash),
      this._provider.getTransactionReceipt(hash)
    ])

    if (!transaction && !receipt) {
      throw new NoSuchElementError(`No transaction found for '${hash}'.`)
    }

    if (!receipt) {
      const dropped = transaction
        ? await this._isReplaced(transaction)
        : false

      return {
        hash,
        finality: dropped ? 'dropped' : 'pending',
        confirmations: 0,
        receipt: null
      }
    }

    const confirmations = await receipt.confirmations()
    const finalized = await this._isFinalized(receipt.blockNumber)

    return {
      hash,
      finality: finalized ? 'final' : 'confirmed',
      success: receipt.status === 1,
      block: receipt.blockNumber,
      fee: receipt.fee,
      confirmations,
      receipt
    }
  }

  /**
   * Blocks until a transaction reaches a terminal state (the requested finality target or `dropped`), or times out.
   *
   * @param {string} hash - The transaction's hash.
   * @param {WaitForTransactionOptions} [options] - The wait options.
   * @returns {Promise<TransactionReceipt & EvmTransactionDetails>} The terminal receipt: the finality target reached (inspect `success` to tell success from revert), or `dropped`.
   * @throws {TimeoutError} If the target is not reached before the timeout.
   */
  async waitForTransaction (hash, options = {}) {
    return await super.waitForTransaction(hash, options)
  }

  /**
   * Returns whether a block is at or below the chain's `finalized` block. Chains that don't support the tag are treated as not finalized.
   *
   * @protected
   * @param {number} blockNumber - The block number to check.
   * @returns {Promise<boolean>} True if the block is finalized.
   */
  async _isFinalized (blockNumber) {
    try {
      const finalizedBlock = await this._provider.getBlock('finalized')
      return !!finalizedBlock && blockNumber <= finalizedBlock.number
    } catch (error) {
      // Treat an unsupported 'finalized' block tag as not-finalized; let real failures propagate.
      const rpcCode = error?.info?.error?.code

      if (isError(error, 'UNSUPPORTED_OPERATION') || rpcCode === -32601 || rpcCode === -32602) {
        return false
      }

      throw error
    }
  }

  /**
   * Returns whether an unmined transaction has been replaced, i.e. its sender's mined nonce has already advanced past the transaction's nonce.
   *
   * @protected
   * @param {EvmTransactionResponse} transaction - The unmined transaction.
   * @returns {Promise<boolean>} True if the transaction's nonce slot is already taken.
   */
  async _isReplaced (transaction) {
    const accountNonce = await this._provider.getTransactionCount(transaction.from, 'latest')
    return accountNonce > transaction.nonce
  }

  /**
   * Overrides the base default to allow for slower EVM inclusion and confirmation.
   *
   * @type {number}
   */
  get defaultWaitTimeout () {
    return 120000
  }

  /**
   * Returns the current allowance for the given token and spender.
   * @param {string} token The token's address.
   * @param {string} spender The spender's address.
   * @returns {Promise<bigint>} The allowance.
   * @throws {ProviderRequiredError} If the wallet is not connected to a provider.
   */
  async getAllowance (token, spender) {
    if (!this._provider) {
      throw new ProviderRequiredError('The wallet must be connected to a provider to retrieve allowances.')
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
   * Checks if this account has an active ERC-7702 delegation.
   *
   * @returns {Promise<DelegationInfo>} The delegation info.
   * @throws {ProviderRequiredError} If the wallet is not connected to a provider.
   */
  async getDelegation () {
    if (!this._provider) {
      throw new ProviderRequiredError('The wallet must be connected to a provider to check delegation.')
    }

    const address = await this.getAddress()
    const code = await this._provider.send('eth_getCode', [address, 'latest'])

    if (
      code &&
      code.toLowerCase().startsWith(DELEGATION_DESIGNATOR_PREFIX) &&
      code.length === DELEGATION_DESIGNATOR_LENGTH
    ) {
      const delegateAddress = '0x' + code.slice(DELEGATION_DESIGNATOR_PREFIX.length)

      return {
        isDelegated: true,
        delegateAddress
      }
    }

    return {
      isDelegated: false,
      delegateAddress: null
    }
  }

  /** @private */
  async _estimateGasWithAuthList ({ from, to, value, data, authorizationList }) {
    const formatAuth = (auth) => {
      const { address, nonce, chainId } = auth

      const signature = auth.signature instanceof Signature
        ? auth.signature
        : Signature.from(auth.signature)

      return {
        address,
        nonce: toQuantity(nonce),
        chainId: toQuantity(chainId),
        r: toQuantity(signature.r),
        s: toQuantity(signature.s),
        yParity: toQuantity(signature.yParity)
      }
    }

    const rpcTx = {
      from,
      to,
      value: toQuantity(value),
      data: data ?? '0x',
      type: '0x04',
      authorizationList: authorizationList.map(formatAuth)
    }

    const result = await this._provider.send('eth_estimateGas', [rpcTx])

    return BigInt(result)
  }

  /**
   * Extracts the gas and fee overrides set on transfer or approve options.
   *
   * @protected
   * @param {EvmGasOverrides} options - The options to read the overrides from.
   * @returns {EvmGasOverrides} Only the gas and fee fields that are set on the options.
   */
  static _getGasOverrides (options) {
    const overrides = {}

    for (const field of ['gasLimit', 'gasPrice', 'maxFeePerGas', 'maxPriorityFeePerGas']) {
      if (options[field] !== undefined) overrides[field] = options[field]
    }

    return overrides
  }

  /**
   * Returns an evm transaction to execute the given token transfer.
   *
   * @protected
   * @param {EvmTransferOptions} options - The transfer's options, including any gas overrides and ERC-7702 authorizations to carry onto the transaction.
   * @returns {Promise<EvmTransaction>} The ERC-20 transfer call as an evm transaction, with the options' gas overrides and authorizations applied.
   */
  static async _getTransferTransaction (options) {
    const { token, recipient, amount, authorizationList } = options

    const abi = ['function transfer(address to, uint256 amount) returns (bool)']

    const contract = new Contract(token, abi)

    const tx = {
      to: token,
      value: 0,
      data: contract.interface.encodeFunctionData('transfer', [recipient, amount]),
      ...WalletAccountReadOnlyEvm._getGasOverrides(options),
      authorizationList
    }

    return tx
  }
}
