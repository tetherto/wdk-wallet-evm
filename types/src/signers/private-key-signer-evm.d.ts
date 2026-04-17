/** @typedef {import('./seed-signer-evm.js').ISignerEvm} ISignerEvm */
/** @typedef {import('./seed-signer-evm.js').UnsignedEvmTransaction} UnsignedEvmTransaction */
/** @typedef {import('ethers').TypedDataDomain} TypedDataDomain */
/** @typedef {import('ethers').TypedDataField} TypedDataField */
/** @typedef {import('ethers').AuthorizationRequest} AuthorizationRequest */
/** @typedef {import('ethers').Authorization} Authorization */
/**
 * @implements {ISignerEvm}
 * Signer that wraps a raw private key in a memory-safe buffer, exposing a minimal
 * interface for signing messages, transactions and typed data. This signer does
 * not support derivation and always represents a single account.
 */
export default class PrivateKeySignerEvm implements ISignerEvm {
    /**
     * @param {string|Uint8Array} privateKey - Hex string (with/without 0x) or raw key bytes.
     */
    constructor(privateKey: string | Uint8Array);
    /** @private */
    private _signingKey;
    /** @private */
    private _wallet;
    /** @private */
    private _address;
    /** @private */
    private _isRoot;
    /** @private */
    private _path;
    /** @type {boolean} */
    get isRoot(): boolean;
    /** @type {boolean} */
    get isPrivateKey(): boolean;
    /** @type {number} */
    get index(): number;
    /** @type {string|undefined} */
    get path(): string | undefined;
    /** @type {string} */
    get address(): string;
    /** @type {{privateKey: Uint8Array|null, publicKey: Uint8Array|null}} */
    get keyPair(): {
        privateKey: Uint8Array | null;
        publicKey: Uint8Array | null;
    };
    /**
     * PrivateKeySignerEvm is not a hierarchical signer and cannot derive.
     * @throws {Error}
     */
    derive(): void;
    /** @returns {Promise<string>} */
    getAddress(): Promise<string>;
    /**
     * Signs a message.
     *
     * @param {string} message - The message to sign.
     * @returns {Promise<string>} The message's signature.
     */
    sign(message: string): Promise<string>;
    /**
     * Signs a transaction and returns the serialized signed transaction hex.
     *
     * @param {UnsignedEvmTransaction} unsignedTx - The unsigned transaction object.
     * @returns {Promise<string>}
     */
    signTransaction(unsignedTx: UnsignedEvmTransaction): Promise<string>;
    /**
     * EIP-712 typed data signing.
     * @param {TypedDataDomain} domain
     * @param {Record<string, TypedDataField[]>} types
     * @param {Record<string, any>} message
     * @returns {Promise<string>}
     */
    signTypedData(domain: TypedDataDomain, types: Record<string, TypedDataField[]>, message: Record<string, any>): Promise<string>;
    /**
     * Sign an ERC-7702 authorization tuple.
     * @param {AuthorizationRequest} auth
     * @returns {Promise<Authorization>}
     */
    signAuthorization(auth: AuthorizationRequest): Promise<Authorization>;
    /** Dispose secrets from memory. */
    dispose(): void;
}
export type ISignerEvm = import("./seed-signer-evm.js").ISignerEvm;
export type UnsignedEvmTransaction = import("./seed-signer-evm.js").UnsignedEvmTransaction;
export type TypedDataDomain = import("ethers").TypedDataDomain;
export type TypedDataField = import("ethers").TypedDataField;
export type AuthorizationRequest = import("ethers").AuthorizationRequest;
export type Authorization = import("ethers").Authorization;
