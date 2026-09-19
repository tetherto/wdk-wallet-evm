export default class WalletAccountReadOnlyEvm extends WalletAccountReadOnly {
    /**
     * Returns an evm transaction to execute the given token transfer.
     *
     * @protected
     * @param {EvmTransferOptions} options - The transfer's options.
     * @returns {Promise<EvmTransaction>} The evm transaction.
     */
    protected static _getTransferTransaction(options: EvmTransferOptions): Promise<EvmTransaction>;
    /**
     * Creates a new evm read-only wallet account.
     *
     * @param {string} address - The account's address.
     * @param {Omit<EvmWalletConfig, 'transferMaxFee' | 'transactionMaxFee'>} [config] - The configuration object.
     */
    constructor(address: string, config?: Omit<EvmWalletConfig, "transferMaxFee" | "transactionMaxFee">);
    /**
     * The read-only wallet account configuration.
     *
     * @protected
     * @type {Omit<EvmWalletConfig, 'transferMaxFee' | 'transactionMaxFee'>}
     */
    protected _config: Omit<EvmWalletConfig, "transferMaxFee" | "transactionMaxFee">;
    /**
     * An ethers provider to interact with a node of the blockchain.
     *
     * @protected
     * @type {Provider | undefined}
     */
    protected _provider: Provider | undefined;
    /**
     * The account's address.
     *
     * @type {string}
     */
    get address(): string;
    /**
     * Returns the account's eth balance.
     *
     * @returns {Promise<bigint>} The eth balance (in weis).
     * @throws {ProviderRequiredError} If the wallet is not connected to a provider.
     */
    getBalance(): Promise<bigint>;
    /**
     * Returns the account balance for a specific token.
     *
     * @param {string} tokenAddress - The smart contract address of the token.
     * @returns {Promise<bigint>} The token balance (in base unit).
     * @throws {ProviderRequiredError} If the wallet is not connected to a provider.
     */
    getTokenBalance(tokenAddress: string): Promise<bigint>;
    /**
     * Returns the account balances for multiple tokens.
     *
     * @param {string[]} tokenAddresses - The smart contract addresses of the tokens.
     * @returns {Promise<Record<string, bigint>>} A mapping of token addresses to their balances (in base units).
     * @throws {ProviderRequiredError} If the wallet is not connected to a provider.
     */
    getTokenBalances(tokenAddresses: string[]): Promise<Record<string, bigint>>;
    /**
     * Quotes the costs of a send transaction operation.
     *
     * @param {EvmTransaction} tx - The transaction.
     * @returns {Promise<Omit<TransactionResult, 'hash'>>} The transaction's quotes.
     * @throws {ProviderRequiredError} If the wallet is not connected to a provider.
     */
    quoteSendTransaction(tx: EvmTransaction): Promise<Omit<TransactionResult, "hash">>;
    /**
     * Quotes the costs of a transfer operation.
     *
     * @param {EvmTransferOptions} options - The transfer's options.
     * @returns {Promise<Omit<TransferResult, 'hash'>>} The transfer's quotes.
     * @throws {ProviderRequiredError} If the wallet is not connected to a provider.
     */
    quoteTransfer(options: EvmTransferOptions): Promise<Omit<TransferResult, "hash">>;
    /**
     * Returns a transaction's receipt.
     *
     * @deprecated Use {@link getTransaction} instead, which returns a normalized, finality-based receipt. The raw ethers receipt remains available on its `receipt` property.
     * @param {string} hash - The transaction's hash.
     * @returns {Promise<EvmTransactionReceipt | null>} – The receipt, or null if the transaction has not been included in a block yet.
     * @throws {ProviderRequiredError} If the wallet is not connected to a provider.
     */
    getTransactionReceipt(hash: string): Promise<EvmTransactionReceipt | null>;
    /**
     * Returns a normalized, finality-based receipt for a transaction.
     *
     * @param {string} hash - The transaction's hash.
     * @returns {Promise<TransactionReceipt & EvmTransactionDetails>} The normalized receipt.
     * @throws {ProviderRequiredError} If the wallet is not connected to a provider.
     * @throws {ValueError} If the hash is not a valid transaction hash.
     * @throws {NoSuchElementError} If no transaction has been found for the given hash.
     */
    getTransaction(hash: string): Promise<TransactionReceipt & EvmTransactionDetails>;
    /**
     * Blocks until a transaction reaches a terminal state (the requested finality target or `dropped`), or times out.
     *
     * @param {string} hash - The transaction's hash.
     * @param {WaitForTransactionOptions} [options] - The wait options.
     * @returns {Promise<TransactionReceipt & EvmTransactionDetails>} The terminal receipt: the finality target reached (inspect `success` to tell success from revert), or `dropped`.
     * @throws {TimeoutError} If the target is not reached before the timeout.
     */
    waitForTransaction(hash: string, options?: WaitForTransactionOptions): Promise<TransactionReceipt & EvmTransactionDetails>;
    /**
     * Returns whether a block is at or below the chain's `finalized` block. Chains that don't support the tag are treated as not finalized.
     *
     * @protected
     * @param {number} blockNumber - The block number to check.
     * @returns {Promise<boolean>} True if the block is finalized.
     */
    protected _isFinalized(blockNumber: number): Promise<boolean>;
    /**
     * Returns whether an unmined transaction has been replaced, i.e. its sender's mined nonce has already advanced past the transaction's nonce.
     *
     * @protected
     * @param {EvmTransactionResponse} transaction - The unmined transaction.
     * @returns {Promise<boolean>} True if the transaction's nonce slot is already taken.
     */
    protected _isReplaced(transaction: EvmTransactionResponse): Promise<boolean>;
    /**
     * Overrides the base default to allow for slower EVM inclusion and confirmation.
     *
     * @type {number}
     */
    get defaultWaitTimeout(): number;
    /**
     * Returns the current allowance for the given token and spender.
     * @param {string} token The token's address.
     * @param {string} spender The spender's address.
     * @returns {Promise<bigint>} The allowance.
     * @throws {ProviderRequiredError} If the wallet is not connected to a provider.
     */
    getAllowance(token: string, spender: string): Promise<bigint>;
    /**
     * Verifies a message's signature.
     *
     * @param {string} message - The original message.
     * @param {string} signature - The signature to verify.
     * @returns {Promise<boolean>} True if the signature is valid.
     */
    verify(message: string, signature: string): Promise<boolean>;
    /**
     * Verifies a typed data signature.
     *
     * @param {TypedData} typedData - The typed data to verify.
     * @param {string} signature - The signature to verify.
     * @returns {Promise<boolean>} True if the signature is valid.
     */
    verifyTypedData(typedData: TypedData, signature: string): Promise<boolean>;
    /**
     * Checks if this account has an active ERC-7702 delegation.
     *
     * @returns {Promise<DelegationInfo>} The delegation info.
     * @throws {ProviderRequiredError} If the wallet is not connected to a provider.
     */
    getDelegation(): Promise<DelegationInfo>;
    /** @private */
    private _estimateGasWithAuthList;
}
export type Provider = import("ethers").Provider;
export type Eip1193Provider = import("ethers").Eip1193Provider;
export type TypedDataDomain = import("ethers").TypedDataDomain;
export type TypedDataField = import("ethers").TypedDataField;
export type BlobLike = import("ethers").BlobLike;
export type AuthorizationLike = import("ethers").AuthorizationLike;
export type EvmTransactionReceipt = import("ethers").TransactionReceipt;
export type EvmTransactionResponse = import("ethers").TransactionResponse;
export type TransactionResult = import("@tetherto/wdk-wallet").TransactionResult;
export type TransferResult = import("@tetherto/wdk-wallet").TransferResult;
export type TransactionReceipt = import("@tetherto/wdk-wallet").TransactionReceipt;
export type WaitForTransactionOptions = import("@tetherto/wdk-wallet").WaitForTransactionOptions;
/**
 * The EVM-specific fields added to a normalized transaction receipt.
 */
export type EvmTransactionDetails = {
    /**
     * - The number of confirmations (0 while pending or dropped).
     */
    confirmations: number;
    /**
     * - The native ethers receipt, or null while the transaction is pending or dropped.
     */
    receipt: EvmTransactionReceipt | null;
};
export type TypedData = {
    /**
     * - The domain separator.
     */
    domain: TypedDataDomain;
    /**
     * - The type definitions.
     */
    types: Record<string, TypedDataField[]>;
    /**
     * - The message data.
     */
    message: Record<string, unknown>;
};
export type DelegationInfo = {
    /**
     * - Whether the account has an active ERC-7702 delegation.
     */
    isDelegated: boolean;
    /**
     * - The address of the delegate contract, or null if not delegated.
     */
    delegateAddress: string | null;
};
export type EvmTransaction = {
    /**
     * - The transaction's recipient. Omit or pass null to deploy a contract.
     */
    to?: string | null;
    /**
     * - The amount of ethers to send to the recipient (in weis).
     */
    value: number | bigint;
    /**
     * - The transaction's data in hex format.
     */
    data?: string;
    /**
     * - The maximum amount of gas this transaction is permitted to use.
     */
    gasLimit?: number | bigint;
    /**
     * - The price (in wei) per unit of gas this transaction will pay.
     */
    gasPrice?: number | bigint;
    /**
     * - The maximum price (in wei) per unit of gas this transaction will pay for the combined [EIP-1559](https://eips.ethereum.org/EIPS/eip-1559) block's base fee and this transaction's priority fee.
     */
    maxFeePerGas?: number | bigint;
    /**
     * - The price (in wei) per unit of gas this transaction will allow in addition to the [EIP-1559](https://eips.ethereum.org/EIPS/eip-1559) block's base fee to bribe miners into giving this transaction priority. This is included in the maxFeePerGas, so this will not affect the total maximum cost set with maxFeePerGas.
     */
    maxPriorityFeePerGas?: number | bigint;
    /**
     * - The transaction type (e.g. 4 for ERC-7702).
     */
    type?: number;
    /**
     * - The transaction nonce.
     */
    nonce?: number;
    /**
     * - The chain ID of the network.
     */
    chainId?: number | bigint;
    /**
     * - The maximum price (in wei) per unit of blob gas this transaction will pay for [EIP-4844](https://eips.ethereum.org/EIPS/eip-4844) blob data. Required for type 3 (blob) transactions.
     */
    maxFeePerBlobGas?: number | bigint;
    /**
     * - The blobs of an [EIP-4844](https://eips.ethereum.org/EIPS/eip-4844) type 3 transaction.
     */
    blobs?: BlobLike[];
    /**
     * - The versioned hashes of the blobs of an [EIP-4844](https://eips.ethereum.org/EIPS/eip-4844) type 3 transaction.
     */
    blobVersionedHashes?: string[];
    /**
     * - An optional list of ERC-7702 signed authorizations for type 4 transactions.
     */
    authorizationList?: AuthorizationLike[];
};
export type EvmTransferOptions = {
    /**
     * - The address of the token to transfer.
     */
    token: string;
    /**
     * - The address of the recipient.
     */
    recipient: string;
    /**
     * - The amount of tokens to transfer to the recipient (in base units).
     */
    amount: number | bigint;
    /**
     * - An optional list of ERC-7702 signed authorizations.
     */
    authorizationList?: AuthorizationLike[];
};
export type EvmWalletConfig = {
    /**
     * - The url of the rpc provider, or an instance of a class that implements eip-1193. It's also possible to provide an array of urls or EIP 1193 providers instead. In such case, connection errors will cause the wallet to automatically fallback on the next provider in the list. 
     */
    provider?: string | Eip1193Provider | Array<string | Eip1193Provider>;
    /**
     * - If set and if 'provider' is a list of urls or EIP 1193 providers, the number of additional retry attempts after the initial call fails. Total attempts = `1 + retries`. For example, `retries: 3` with 4 providers will try each provider once before throwing. If `retries` exceeds the number of providers, the failover will loop back and retry already-failed providers in round-robin order. Default: 3. 
     */
    retries?: number;
    /**
     * - The chain ID of the network. When provided, skips automatic chain ID detection from the provider.
     */
    chainId?: number;
    /**
     * - The maximum fee amount for transfer operations.
     */
    transferMaxFee?: number | bigint;
    /**
     * - The maximum fee amount for sendTransaction and signTransaction operations.
     */
    transactionMaxFee?: number | bigint;
};
import { WalletAccountReadOnly } from '@tetherto/wdk-wallet';
