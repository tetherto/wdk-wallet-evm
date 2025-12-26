/** @typedef {import('../wallet-account-read-only-evm.js').EvmWalletConfig} EvmWalletConfig */
/** @typedef {import('../utils/tx-populator-evm.js').UnsignedEvmTransaction} UnsignedEvmTransaction */
/**
 * * @implements {ISignerEvm}
 * Signer that wraps a raw private key in a memory-safe buffer, exposing a minimal
 * interface for signing messages, transactions and typed data. This signer does
 * not support derivation and always represents a single account.
 */
export default class PrivateKeySignerEvm implements ISignerEvm {
    /**
     * @param {string|Uint8Array} privateKey - Hex string (with/without 0x) or raw key bytes.
     * @param {EvmWalletConfig} [config]
     */
    constructor(privateKey: string | Uint8Array, config?: EvmWalletConfig);
    _config: import("../wallet-account-read-only-evm.js").EvmWalletConfig;
    _signingKey: MemorySafeSigningKey;
    _wallet: BaseWallet;
    _address: string;
    _isRoot: boolean;
    _path: any;
    _isActive: boolean;
    get isRoot(): boolean;
    get isPrivateKey(): boolean;
    get index(): number;
    get path(): any;
    get config(): import("../wallet-account-read-only-evm.js").EvmWalletConfig;
    get address(): string;
    get isActive(): boolean;
    get keyPair(): {
        privateKey: any;
        publicKey: import("@noble/secp256k1").Bytes;
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
    /** @param {UnsignedEvmTransaction} unsignedTx @returns {Promise<string>} */
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
import MemorySafeSigningKey from '../memory-safe/signing-key.js';
import { BaseWallet } from 'ethers';
