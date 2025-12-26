/** @typedef {import('ethers').Provider} Provider */
/** @typedef {import('ethers').Eip1193Provider} Eip1193Provider */
/** @typedef {import('ethers').TransactionReceipt} EvmTransactionReceipt */
/** @typedef {import('@tetherto/wdk-wallet').TransactionResult} TransactionResult */
/** @typedef {import('@tetherto/wdk-wallet').TransferOptions} TransferOptions */
/** @typedef {import('@tetherto/wdk-wallet').TransferResult} TransferResult */
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
     * Returns an evm transaction to execute the given token transfer.
     *
     * @protected
     * @param {TransferOptions} options - The transfer's options.
     * @returns {Promise<EvmTransaction>} The evm transaction.
     */
    protected static _getTransferTransaction(options: TransferOptions): Promise<EvmTransaction>;
    /**
     * Creates a new evm read-only wallet account.
     *
     * @param {string} address - The account's address.
     * @param {Omit<EvmWalletConfig, 'transferMaxFee'>} [config] - The configuration object.
     */
    constructor(address: string, config?: Omit<EvmWalletConfig, "transferMaxFee">);
    /**
     * The read-only wallet account configuration.
     *
     * @protected
     * @type {Omit<EvmWalletConfig, 'transferMaxFee'>}
     */
    protected _config: Omit<EvmWalletConfig, "transferMaxFee">;
    /**
     * An ethers provider to interact with a node of the blockchain.
     *
     * @protected
     * @type {Provider | undefined}
     */
    protected _provider: Provider | undefined;
    /**
     * Quotes the costs of a send transaction operation.
     *
     * @param {EvmTransaction} tx - The transaction.
     * @returns {Promise<Omit<TransactionResult, 'hash'>>} The transaction's quotes.
     */
    quoteSendTransaction(tx: EvmTransaction): Promise<Omit<TransactionResult, "hash">>;
    /**
     * Returns a transaction's receipt.
     *
     * @param {string} hash - The transaction's hash.
     * @returns {Promise<EvmTransactionReceipt | null>} – The receipt, or null if the transaction has not been included in a block yet.
     */
    getTransactionReceipt(hash: string): Promise<EvmTransactionReceipt | null>;
    /**
     * Returns the current allowance for the given token and spender.
     * @param {string} token The token’s address.
     * @param {string} spender The spender’s address.
     * @returns {Promise<bigint>} The allowance.
     */
    getAllowance(token: string, spender: string): Promise<bigint>;
}
export type Provider = import("ethers").Provider;
export type Eip1193Provider = import("ethers").Eip1193Provider;
export type EvmTransactionReceipt = import("ethers").TransactionReceipt;
export type TransactionResult = import("@tetherto/wdk-wallet").TransactionResult;
export type TransferOptions = import("@tetherto/wdk-wallet").TransferOptions;
export type TransferResult = import("@tetherto/wdk-wallet").TransferResult;
export type EvmTransaction = {
    /**
     * - The transaction's recipient.
     */
    to: string;
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
};
export type EvmWalletConfig = {
    /**
     * - The url of the rpc provider, or an instance of a class that implements eip-1193.
     */
    provider?: string | Eip1193Provider;
    /**
     * - The maximum fee amount for transfer operations.
     */
    transferMaxFee?: number | bigint;
};
import { WalletAccountReadOnly } from '@tetherto/wdk-wallet';
