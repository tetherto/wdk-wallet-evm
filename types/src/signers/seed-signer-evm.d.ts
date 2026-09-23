import { ISigner } from "@tetherto/wdk-wallet";
/** @typedef {import('../wallet-account-read-only-evm.js').TypedData} TypedData */
/** @typedef {import('@tetherto/wdk-wallet').KeyPair} KeyPair */
/** @typedef {import('ethers').AuthorizationRequest} AuthorizationRequest */
/** @typedef {import('ethers').Authorization} Authorization */
/** @typedef {import('ethers').AuthorizationLike} AuthorizationLike */
/**
 * A fully-populated unsigned EVM transaction suitable for signing.
 * Produced by the internal transaction populator and consumed by signer implementations.
 */
export type UnsignedEvmTransaction = {
    chainId: number;
    nonce: number;
    from: string;
    to: string | null;
    data: string;
    value: number | bigint;
    type: number;
    gasLimit: number | bigint;
    gasPrice?: number | bigint;
    maxFeePerGas?: number | bigint;
    maxPriorityFeePerGas?: number | bigint;
    accessList?: any[];
    authorizationList?: AuthorizationLike[];
};
export type SeedSignerEvmOpts = {
    /**
     * An existing HD node wallet root to derive from (internal; set by {@link SeedSignerEvm#derive}).
     */
    root?: object;
    /**
     * Relative BIP-44 path segment (e.g. "0'/0/0"). Defaults to the account at index 0.
     */
    path?: string;
    /**
     * Internal. When true, the signer is a derived child and does not retain the root (set by {@link SeedSignerEvm#derive}).
     */
    isChild?: boolean;
};
/**
 * Interface for EVM signers, extending the base `ISigner` from `@tetherto/wdk-wallet`.
 *
 * @extends {ISigner}
 * @interface
 */
export class ISignerEvm extends ISigner {
    /**
     * Whether this signer can derive child signers (i.e. it holds an HD root). Non-derivable
     * signers (e.g. private-key signers) are bound directly to an account; derivable signers
     * derive child accounts and keep the root for management only.
     * @type {boolean}
     */
    get isDerivable(): boolean;
    /**
     * The last component index for the derivation path of this signer, when applicable.
     * @type {number|undefined}
     */
    get index(): number | undefined;
    /**
     * The full derivation path if this is a child signer.
     * @type {string|undefined}
     */
    get path(): string | undefined;
    /**
     * The account's address, if available.
     * @type {string|undefined}
     */
    get address(): string | undefined;
    /**
     * The account's key pair.
     * @type {KeyPair}
     */
    get keyPair(): KeyPair;
    /**
     * Derive a child signer from this signer using a relative path (e.g. "0'/0/0").
     *
     * @param {string} relPath - The relative BIP-44 path segment.
     * @returns {Promise<ISignerEvm>} The derived child signer.
     * @throws {InvalidSignerError} If the signer does not support derivation (e.g. private-key signers).
     */
    derive(relPath: string): Promise<ISignerEvm>;
    /**
     * Returns the account's address.
     * @returns {Promise<string>}
     */
    getAddress(): Promise<string>;
    /**
     * Sign a plain message.
     * @param {string} message
     * @returns {Promise<string>}
     */
    sign(message: string): Promise<string>;
    /**
     * Sign a transaction-like object compatible with ethers Transaction.from.
     * @param {UnsignedEvmTransaction} unsignedTx
     * @returns {Promise<string>} The serialized signed transaction hex.
     */
    signTransaction(unsignedTx: UnsignedEvmTransaction): Promise<string>;
    /**
     * Signs typed data according to EIP-712.
     *
     * @param {TypedData} typedData - The typed data to sign.
     * @returns {Promise<string>} The typed data signature.
     */
    signTypedData({ domain, types, message }: TypedData): Promise<string>;
    /**
     * Sign an ERC-7702 authorization tuple.
     * @param {AuthorizationRequest} auth
     * @returns {Promise<Authorization>}
     */
    signAuthorization(auth: AuthorizationRequest): Promise<Authorization>;
    /** Clear any secret material from memory. */
    dispose(): void;
}
/**
 * @extends {ISignerEvm}
 * Signer implementation that derives keys from a BIP-39 seed using the BIP-44 Ethereum path.
 * Always holds a derived account (index 0 by default). A root signer also retains the HD root
 * and can derive child signers; a derived child holds only its own account.
 */
export default class SeedSignerEvm extends ISignerEvm {
    /**
     * Create a SeedSignerEvm.
     * Provide a mnemonic/seed (children built via {@link derive} pass a shared root internally).
     *
     * @param {string|Uint8Array|null} seed - BIP-39 mnemonic or seed bytes. Omit when providing `opts.root`.
     * @param {SeedSignerEvmOpts} [opts] - Construction options for root reuse, direct child derivation or path definition (default is index 0).
     * @throws {ValueError} If neither a seed nor a root is provided, or if both are provided.
     * @throws {ValueError} If a seed is provided but is not a valid BIP-39 mnemonic.
     */
    constructor(seed: string | Uint8Array | null, opts?: SeedSignerEvmOpts);
    /** @private */
    private _account;
    /** @private */
    private _address;
    /** @private */
    private _path;
    /** @private */
    private _root;
    get isDerivable(): boolean;
    get index(): number | undefined;
    get path(): string | undefined;
    get address(): string;
    get keyPair(): KeyPair;
    /**
     * Derive a child signer using the provided relative path (e.g. "0'/0/0").
     * @param {string} relPath
     * @returns {Promise<SeedSignerEvm>}
     * @throws {InvalidSignerError} If called on a derived child signer, which does not retain the root.
     */
    derive(relPath: string): Promise<SeedSignerEvm>;
    /**
     * Sign a plain message string.
     * @param {string} message
     * @returns {Promise<string>}
     */
    sign(message: string): Promise<string>;
    /**
     * Sign a transaction object and return its serialized form.
     * @param {UnsignedEvmTransaction} unsignedTx
     * @returns {Promise<string>}
     */
    signTransaction(unsignedTx: UnsignedEvmTransaction): Promise<string>;
    /**
     * Signs typed data according to EIP-712.
     *
     * @param {TypedData} typedData - The typed data to sign.
     * @returns {Promise<string>} The typed data signature.
     */
    signTypedData({ domain, types, message }: TypedData): Promise<string>;
    /**
     * Sign an ERC-7702 authorization tuple.
     * @param {AuthorizationRequest} auth
     * @returns {Promise<Authorization>}
     */
    signAuthorization(auth: AuthorizationRequest): Promise<Authorization>;
    /** Disposes secrets from memory. */
    dispose(): void;
}
export type TypedData = import("../wallet-account-read-only-evm.js").TypedData;
export type KeyPair = import("@tetherto/wdk-wallet").KeyPair;
export type AuthorizationRequest = import("ethers").AuthorizationRequest;
export type Authorization = import("ethers").Authorization;
export type AuthorizationLike = import("ethers").AuthorizationLike;
