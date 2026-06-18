import { ISigner } from "@tetherto/wdk-wallet";
/** @typedef {import('../wallet-account-read-only-evm.js').EvmWalletConfig} EvmWalletConfig */
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
    maxFeePerBlobGas?: number | bigint;
    blobs?: any[];
    blobVersionedHashes?: string[];
    authorizationList?: AuthorizationLike[];
};
/**
 * Interface for EVM signers, extending the base `ISigner` from `@tetherto/wdk-wallet`.
 *
 * @extends {ISigner}
 * @interface
 */
export class ISignerEvm extends ISigner {
    /**
     * Whether this signer is a root (master) signer that holds the HD root and can derive children.
     * @type {boolean}
     */
    get isRoot(): boolean;
    /**
     * Whether this signer was created from a standalone private key.
     * @type {boolean}
     */
    get isPrivateKey(): boolean;
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
     * @param {EvmWalletConfig} [_cfg] - Ignored for EVM signers; present for base compatibility.
     * @returns {ISignerEvm} The derived child signer.
     * @throws {SignerError} If the signer does not support derivation (e.g. private-key signers).
     */
    derive(relPath: string, _cfg?: EvmWalletConfig): ISignerEvm;
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
     * @param {{root?: object, path?: string, isChild?: boolean}} [opts] - Construction options for root reuse, direct child derivation or path definition (default is index 0).
     * @throws {Error} If neither a seed nor a root is provided, or if both are provided.
     * @throws {Error} If a seed is provided but is not a valid BIP-39 mnemonic.
     */
    constructor(seed: string | Uint8Array | null, opts?: {
        root?: object;
        path?: string;
        isChild?: boolean;
    });
    /** @private */
    private _isRoot;
    /** @private */
    private _account;
    /** @private */
    private _address;
    /** @private */
    private _path;
    /**
     * The HD root node, kept only when this signer owns it (created from a seed).
     * A child derived via `derive` uses its parent's root to derive its own account
     * but does not retain it, so disposing a child never touches the shared root.
     * @private
     */
    private _root;
    get isRoot(): boolean;
    get isPrivateKey(): boolean;
    get index(): number | undefined;
    get path(): string | undefined;
    get address(): any;
    get keyPair(): KeyPair;
    /**
     * Derive a child signer using the provided relative path (e.g. "0'/0/0").
     * @param {string} relPath
     * @param {EvmWalletConfig} [_cfg] - Ignored for EVM signers; present for base compatibility.
     * @returns {SeedSignerEvm}
     * @throws {Error} If called on a derived child signer, which does not retain the root.
     */
    derive(relPath: string, _cfg?: EvmWalletConfig): SeedSignerEvm;
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
export type EvmWalletConfig = import("../wallet-account-read-only-evm.js").EvmWalletConfig;
export type TypedData = import("../wallet-account-read-only-evm.js").TypedData;
export type KeyPair = import("@tetherto/wdk-wallet").KeyPair;
export type AuthorizationRequest = import("ethers").AuthorizationRequest;
export type Authorization = import("ethers").Authorization;
export type AuthorizationLike = import("ethers").AuthorizationLike;
