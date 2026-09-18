/**
 * Signer that wraps a raw private key in a memory-safe buffer, exposing a minimal
 * interface for signing messages, transactions and typed data. This signer does
 * not support derivation and always represents a single account.
 *
 * @implements {ISignerEvm}
 */
export default class PrivateKeySignerEvm implements ISignerEvm {
    /**
     * Create a signer from a raw private key.
     *
     * @param {string | Uint8Array} privateKey - The private key's hex string or byte sequence.
     */
    constructor(privateKey: string | Uint8Array);
    /** @private */
    private _signingKey;
    /** @private */
    private _wallet;
    /** @private */
    private _address;
    /**
     * Whether this signer can derive child signers.
     *
     * @type {false}
     */
    get isDerivable(): false;
    /**
     * The BIP 0044 derivation path.
     *
     * @type {string | null}
     */
    get path(): string | null;
    /**
     * The account's address.
     *
     * @deprecated Use {@link getAddress} instead. This property will be removed in an upcoming
     * release: not all signers (e.g. hardware signers) can expose the address synchronously.
     * @type {string}
     */
    get address(): string;
    /**
     * The account's key pair (private and public key buffers).
     *
     * @type {KeyPair}
     */
    get keyPair(): KeyPair;
    /**
     * Derive a child signer using a relative path (e.g., "0'/0/0").
     *
     * @param {string} path - The relative derivation path.
     * @returns {Promise<never>} The derived signer.
     * @throws {UnsupportedOperationError} If the signer does not support account derivation.
     * @throws {ValueError} If the path is not valid.
     */
    derive(path: string): Promise<never>;
    /**
     * Returns the account's address.
     *
     * @returns {Promise<string>} The account's address.
     */
    getAddress(): Promise<string>;
    /**
     * Signs a message.
     *
     * @param {string} message - The message to sign.
     * @returns {Promise<string>} The message's signature.
     */
    sign(message: string): Promise<string>;
    /**
     * Signs a transaction.
     *
     * @param {TransactionLike} tx - The transaction to sign.
     * @returns {Promise<string>} The signed transaction as a hex string.
     */
    signTransaction(tx: TransactionLike): Promise<string>;
    /**
     * Signs typed data according to EIP-712.
     *
     * @param {TypedData} typedData - The typed data to sign.
     * @returns {Promise<string>} The typed data signature.
     */
    signTypedData(typedData: TypedData): Promise<string>;
    /**
     * Signs an ERC-7702 authorization tuple.
     *
     * @param {AuthorizationRequest} auth - The authorization request.
     * @returns {Promise<Authorization>} The signed authorization.
     */
    signAuthorization(auth: AuthorizationRequest): Promise<Authorization>;
    /**
     * Disposes the signer, erasing its secrets from memory.
     */
    dispose(): void;
}
export type ISignerEvm = import("./signer-evm.js").ISignerEvm;
export type KeyPair = import("@tetherto/wdk-wallet").KeyPair;
export type UnsupportedOperationError = import("@tetherto/wdk-wallet").UnsupportedOperationError;
export type ValueError = import("@tetherto/wdk-wallet").ValueError;
export type TransactionLike = import("ethers").TransactionLike;
export type AuthorizationRequest = import("ethers").AuthorizationRequest;
export type Authorization = import("ethers").Authorization;
export type TypedData = import("../wallet-account-read-only-evm.js").TypedData;
