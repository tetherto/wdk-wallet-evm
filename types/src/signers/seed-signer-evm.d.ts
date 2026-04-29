/** @typedef {import('../wallet-account-read-only-evm.js').EvmWalletConfig} EvmWalletConfig */
/** @typedef {import('ethers').TypedDataDomain} TypedDataDomain */
/** @typedef {import('ethers').TypedDataField} TypedDataField */
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
 * Interface for EVM signers.
 * Follows the base `ISigner` from `@tetherto/wdk-wallet`. For interface compatibility,
 * the second argument to `derive` is accepted but ignored by EVM signers.
 * @interface
 */
export class ISignerEvm {
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
    /** @returns {string|undefined} */
    get address(): string | undefined;
    /**
     * Derive a child signer from this signer using a relative path (e.g. "0'/0/0").
     * @param {string} relPath
     * @param {EvmWalletConfig} [_cfg] - Ignored for EVM signers; present for base compatibility.
     * @returns {ISignerEvm}
     */
    derive(relPath: string, _cfg?: EvmWalletConfig): ISignerEvm;
    /** @returns {Promise<string>} */
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
    /** Clear any secret material from memory. */
    dispose(): void;
}
/**
 * @implements {ISignerEvm}
 * Signer implementation that derives keys from a BIP-39 seed using the BIP-44 Ethereum path.
 * Can represent either a root (no address, only derivation) or a child (derived account with address).
 */
export default class SeedSignerEvm implements ISignerEvm {
    /**
     * Create a SeedSignerEvm.
     * Provide either a mnemonic/seed or an existing root via opts.root.
     *
     * @param {string|Uint8Array|null} seed - BIP-39 mnemonic or seed bytes. Omit when providing `opts.root`.
     * @param {{root?: object, path?: string}} [opts]
     */
    constructor(seed: string | Uint8Array | null, opts?: {
        root?: object;
        path?: string;
    });
    /** @private */
    private _isRoot;
    /** @private */
    private _root;
    /** @private */
    private _account;
    /** @private */
    private _address;
    /** @private */
    private _path;
    get isRoot(): boolean;
    get isPrivateKey(): boolean;
    get index(): number;
    get path(): string;
    get address(): any;
    get keyPair(): {
        privateKey: Uint8Array | null;
        publicKey: Uint8Array | null;
    };
    /**
     * Derive a child signer using the provided relative path (e.g. "0'/0/0").
     * @param {string} relPath
     * @param {EvmWalletConfig} [_cfg] - Ignored for EVM signers; present for base compatibility.
     * @returns {SeedSignerEvm}
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
export type EvmWalletConfig = import("../wallet-account-read-only-evm.js").EvmWalletConfig;
export type TypedDataDomain = import("ethers").TypedDataDomain;
export type TypedDataField = import("ethers").TypedDataField;
export type AuthorizationRequest = import("ethers").AuthorizationRequest;
export type Authorization = import("ethers").Authorization;
export type AuthorizationLike = import("ethers").AuthorizationLike;
