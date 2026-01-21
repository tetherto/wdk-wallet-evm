/** @typedef {import('../wallet-account-read-only-evm.js').EvmWalletConfig} EvmWalletConfig */
/** @typedef {import('../utils/tx-populator-evm.js').UnsignedEvmTransaction} UnsignedEvmTransaction */
/**
 * Interface for EVM signers.
 * @implements {ISigner}
 * @interface
 */
export class ISignerEvm implements ISigner {
    /**
     * True if the signer is currently active and usable.
     * @type {boolean}
     */
    get isActive(): boolean;
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
    /** @returns {EvmWalletConfig} */
    get config(): EvmWalletConfig;
    /** @returns {string|undefined} */
    get address(): string | undefined;
    /**
     * Derive a child signer from this signer using a relative path (e.g. "0'/0/0").
     * @param {string} relPath
      * @param {EvmWalletConfig} [cfg]
     * @returns {ISignerEvm}
     */
    derive(relPath: string, cfg?: EvmWalletConfig): ISignerEvm;
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
     * @param {Record<string, any>} unsignedTx
     * @returns {Promise<string>} The serialized signed transaction hex.
     */
    signTransaction(unsignedTx: Record<string, any>): Promise<string>;
    /**
     * EIP-712 typed data signing.
     * @param {Record<string, any>} domain
     * @param {Record<string, any>} types
     * @param {Record<string, any>} message
     * @returns {Promise<string>}
     */
    signTypedData(domain: Record<string, any>, types: Record<string, any>, message: Record<string, any>): Promise<string>;
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
     * @param {EvmWalletConfig} [config] - Signer configuration propagated to children.
     * @param {{root?: import('../memory-safe/hd-node-wallet.js').default, path?: string}} [opts]
     */
    constructor(seed: string | Uint8Array | null, config?: EvmWalletConfig, opts?: {
        root?: import("../memory-safe/hd-node-wallet.js").default;
        path?: string;
    });
    _config: import("../wallet-account-read-only-evm.js").EvmWalletConfig;
    _isRoot: boolean;
    _root: MemorySafeHDNodeWallet;
    _account: any;
    _address: any;
    _path: string;
    _isActive: boolean;
    get isActive(): boolean;
    get isRoot(): boolean;
    get isPrivateKey(): boolean;
    get index(): number;
    get path(): string;
    get config(): import("../wallet-account-read-only-evm.js").EvmWalletConfig;
    get address(): any;
    get keyPair(): {
        privateKey: any;
        publicKey: any;
    };
    /**
     * Derive a child signer using the provided relative path (e.g. "0'/0/0").
     * @param {string} relPath
     * @param {EvmWalletConfig} [cfg]
     * @returns {SeedSignerEvm}
     */
    derive(relPath: string, cfg?: EvmWalletConfig): SeedSignerEvm;
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
     * @param {Record<string, any>} domain
     * @param {Record<string, any>} types
     * @param {Record<string, any>} message
     * @returns {Promise<string>}
     */
    signTypedData(domain: Record<string, any>, types: Record<string, any>, message: Record<string, any>): Promise<string>;
    /** Dispose secrets from memory. */
    dispose(): void;
}
export type EvmWalletConfig = import("../wallet-account-read-only-evm.js").EvmWalletConfig;
export type UnsignedEvmTransaction = import("../utils/tx-populator-evm.js").UnsignedEvmTransaction;
import MemorySafeHDNodeWallet from '../memory-safe/hd-node-wallet.js';
