import { ISignerEvm } from "./seed-signer-evm.js";
/** @typedef {import('./seed-signer-evm.js').UnsignedEvmTransaction} UnsignedEvmTransaction */
/** @typedef {import('../wallet-account-read-only-evm.js').TypedData} TypedData */
/** @typedef {import('@tetherto/wdk-wallet').KeyPair} KeyPair */
/** @typedef {import('ethers').AuthorizationRequest} AuthorizationRequest */
/** @typedef {import('ethers').Authorization} Authorization */
/**
 * @extends {ISignerEvm}
 * Signer that wraps a raw private key in a memory-safe buffer, exposing a minimal
 * interface for signing messages, transactions and typed data. This signer does
 * not support derivation and always represents a single account.
 */
export default class PrivateKeySignerEvm extends ISignerEvm {
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
    private _path;
    /** @private */
    private _disposed;
    /**
     * True if the signer has been disposed.
     * @type {boolean}
     */
    get disposed(): boolean;
    /** @type {boolean} */
    get isDerivable(): boolean;
    /** @type {number|undefined} */
    get index(): number | undefined;
    /** @type {string|undefined} */
    get path(): string | undefined;
    /** @type {string} */
    get address(): string;
    /**
     * The account's key pair (private and public key buffers).
     * @type {KeyPair}
     */
    get keyPair(): KeyPair;
    /**
     * PrivateKeySignerEvm is not a hierarchical signer and cannot derive.
     * @returns {Promise<never>}
     * @throws {DisposalError} If the signer has been disposed.
     * @throws {InvalidSignerError} Always (when not disposed) — private-key signers do not support derivation.
     */
    derive(): Promise<never>;
    /** @returns {Promise<string>} */
    getAddress(): Promise<string>;
    /**
     * Signs a message.
     *
     * @param {string} message - The message to sign.
     * @returns {Promise<string>} The message's signature.
     * @throws {DisposalError} If the signer has been disposed.
     */
    sign(message: string): Promise<string>;
    /**
     * Signs a transaction and returns the serialized signed transaction hex.
     *
     * @param {UnsignedEvmTransaction} unsignedTx - The unsigned transaction object.
     * @returns {Promise<string>}
     * @throws {DisposalError} If the signer has been disposed.
     */
    signTransaction(unsignedTx: UnsignedEvmTransaction): Promise<string>;
    /**
     * Signs typed data according to EIP-712.
     *
     * @param {TypedData} typedData - The typed data to sign.
     * @returns {Promise<string>} The typed data signature.
     * @throws {DisposalError} If the signer has been disposed.
     */
    signTypedData({ domain, types, message }: TypedData): Promise<string>;
    /**
     * Sign an ERC-7702 authorization tuple.
     * @param {AuthorizationRequest} auth
     * @returns {Promise<Authorization>}
     * @throws {DisposalError} If the signer has been disposed.
     */
    signAuthorization(auth: AuthorizationRequest): Promise<Authorization>;
    /**
     * Dispose secrets from memory.
     */
    dispose(): void;
}
export type UnsignedEvmTransaction = import("./seed-signer-evm.js").UnsignedEvmTransaction;
export type TypedData = import("../wallet-account-read-only-evm.js").TypedData;
export type KeyPair = import("@tetherto/wdk-wallet").KeyPair;
export type AuthorizationRequest = import("ethers").AuthorizationRequest;
export type Authorization = import("ethers").Authorization;
