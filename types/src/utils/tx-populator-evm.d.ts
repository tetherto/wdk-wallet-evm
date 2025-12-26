/** @typedef {import('../wallet-account-read-only-evm.js').EvmTransaction} EvmTransaction */
/**
 * A fully-populated unsigned EVM transaction suitable for signing.
 * This shape is produced by `populateTransactionEvm` and consumed by signer implementations.
 *
 * - Exactly one of `gasPrice` or (`maxFeePerGas` + `maxPriorityFeePerGas`) is expected depending on `type`.
 * - For type 3 (EIP-4844), `maxFeePerBlobGas` is required; optional `blobs` and `blobVersionedHashes` may be present.
 *
 * @typedef {Object} UnsignedEvmTransaction
 * @property {number} chainId - Numeric chain id.
 * @property {number} nonce - Account nonce for the `from` address (pending).
 * @property {string} from - Sender address.
 * @property {string|null} to - Recipient address or null for contract creation.
 * @property {string} data - Hex-encoded call data (defaults to 0x).
 * @property {number|bigint} value - Amount to send in wei (defaults to 0).
 * @property {number} type - Transaction type: 0, 1, 2 (EIP-1559) or 3 (EIP-4844).
 * @property {number|bigint} gasLimit - Estimated or provided gas limit.
 * @property {number|bigint} [gasPrice] - Legacy gas price (type 0/1 only).
 * @property {number|bigint} [maxFeePerGas] - EIP-1559 max fee per gas (type 2/3).
 * @property {number|bigint} [maxPriorityFeePerGas] - EIP-1559 max priority fee per gas (type 2/3).
 * @property {any[]} [accessList] - Optional access list (type 1/2/3).
 * @property {number|bigint} [maxFeePerBlobGas] - EIP-4844 max fee per blob gas (type 3).
 * @property {any[]} [blobs] - EIP-4844 blobs (type 3 optional).
 * @property {string[]} [blobVersionedHashes] - EIP-4844 blob versioned hashes (type 3 optional).
 */
/**
 * Populates a raw EVM transaction object with derived fields based on the connected network and
 * user-provided parameters. It automatically chooses between legacy (type 0/1), EIP-1559 (type 2)
 * and EIP-4844 (type 3) styles, validates incompatible fee fields, and fills in missing values
 * like nonce, gas limit and fee parameters.
 *
 * - If `tx.type` is unspecified, the function detects support for EIP-1559/4844 using provider fee
 *   data and the presence of blob fields.
 * - When EIP-1559 fields are provided, legacy `gasPrice` is rejected and vice versa.
 *
 * @param {import('ethers').Provider} provider - The ethers provider.
 * @param {string} from - The sender address.
 * @param {EvmTransaction} tx - The partial transaction to populate.
 * @returns {Promise<UnsignedEvmTransaction>} The fully populated transaction.
 */
export function populateTransactionEvm(provider: import("ethers").Provider, from: string, tx: EvmTransaction): Promise<UnsignedEvmTransaction>;
export type EvmTransaction = import("../wallet-account-read-only-evm.js").EvmTransaction;
/**
 * A fully-populated unsigned EVM transaction suitable for signing.
 * This shape is produced by `populateTransactionEvm` and consumed by signer implementations.
 *
 * - Exactly one of `gasPrice` or (`maxFeePerGas` + `maxPriorityFeePerGas`) is expected depending on `type`.
 * - For type 3 (EIP-4844), `maxFeePerBlobGas` is required; optional `blobs` and `blobVersionedHashes` may be present.
 */
export type UnsignedEvmTransaction = {
    /**
     * - Numeric chain id.
     */
    chainId: number;
    /**
     * - Account nonce for the `from` address (pending).
     */
    nonce: number;
    /**
     * - Sender address.
     */
    from: string;
    /**
     * - Recipient address or null for contract creation.
     */
    to: string | null;
    /**
     * - Hex-encoded call data (defaults to 0x).
     */
    data: string;
    /**
     * - Amount to send in wei (defaults to 0).
     */
    value: number | bigint;
    /**
     * - Transaction type: 0, 1, 2 (EIP-1559) or 3 (EIP-4844).
     */
    type: number;
    /**
     * - Estimated or provided gas limit.
     */
    gasLimit: number | bigint;
    /**
     * - Legacy gas price (type 0/1 only).
     */
    gasPrice?: number | bigint;
    /**
     * - EIP-1559 max fee per gas (type 2/3).
     */
    maxFeePerGas?: number | bigint;
    /**
     * - EIP-1559 max priority fee per gas (type 2/3).
     */
    maxPriorityFeePerGas?: number | bigint;
    /**
     * - Optional access list (type 1/2/3).
     */
    accessList?: any[];
    /**
     * - EIP-4844 max fee per blob gas (type 3).
     */
    maxFeePerBlobGas?: number | bigint;
    /**
     * - EIP-4844 blobs (type 3 optional).
     */
    blobs?: any[];
    /**
     * - EIP-4844 blob versioned hashes (type 3 optional).
     */
    blobVersionedHashes?: string[];
};
