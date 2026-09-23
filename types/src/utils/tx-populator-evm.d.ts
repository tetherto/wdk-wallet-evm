/**
 * A fully or partially specified EVM transaction, prior to signing.
 */
export type UnsignedEvmTransaction = {
    /**
     * - The id of the chain the transaction targets.
     */
    chainId: number;
    /**
     * - The sender's transaction count, used to order transactions.
     */
    nonce: number;
    /**
     * - The sender's address.
     */
    from: string;
    /**
     * - The recipient's address, or null for contract creation.
     */
    to: string | null;
    /**
     * - The transaction's calldata as a hex string.
     */
    data: string;
    /**
     * - The amount of native currency (in wei) to transfer.
     */
    value: number | bigint;
    /**
     * - The EIP-2718 transaction type (0/1 legacy, 2 EIP-1559, 3 EIP-4844, 4 EIP-7702).
     */
    type: number;
    /**
     * - The maximum amount of gas the transaction may consume.
     */
    gasLimit: number | bigint;
    /**
     * - The gas price (in wei) for legacy (type 0/1) transactions.
     */
    gasPrice?: number | bigint;
    /**
     * - The maximum total fee (in wei) per gas for EIP-1559 transactions.
     */
    maxFeePerGas?: number | bigint;
    /**
     * - The maximum priority fee (in wei) per gas for EIP-1559 transactions.
     */
    maxPriorityFeePerGas?: number | bigint;
    /**
     * - The EIP-2930 access list of addresses and storage keys.
     */
    accessList?: any[];
    /**
     * - The EIP-7702 authorization tuples.
     */
    authorizationList?: AuthorizationLike[];
};
export type Provider = import("ethers").Provider;
export type AuthorizationLike = import("ethers").AuthorizationLike;
/**
 * Whether the given transaction is an EIP-4844 (type 3) blob transaction.
 *
 * @param {UnsignedEvmTransaction} tx - The transaction to inspect.
 * @returns {boolean} True if the transaction explicitly targets type 3, or carries any blob field.
 */
export function isBlobTransaction(tx: UnsignedEvmTransaction): boolean;
/**
 * Build a fully populated unsigned transaction ready for signing.
 *
 * Resolves chain ID, nonce, gas limit and fee fields from the provider when not
 * explicitly supplied in `tx`. Supports legacy (type 0/1), EIP-1559 (type 2) and
 * EIP-7702 (type 4) transaction styles. EIP-4844 (type 3) blob transactions are
 * not supported.
 *
 * @param {Provider} provider - An ethers-compatible JSON-RPC provider.
 * @param {string} from - The sender address.
 * @param {UnsignedEvmTransaction} tx - The partial transaction to populate.
 * @returns {Promise<UnsignedEvmTransaction>} The fully populated unsigned transaction.
 * @throws {ValueError} If the transaction mixes fee fields that its type doesn't support, or if it is an EIP-4844 (type 3) blob transaction.
 */
export function populateTransactionEvm(provider: Provider, from: string, tx: UnsignedEvmTransaction): Promise<UnsignedEvmTransaction>;
