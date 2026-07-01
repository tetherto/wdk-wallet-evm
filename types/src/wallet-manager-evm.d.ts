/** @typedef {import('ethers').Provider} Provider */
/** @typedef {import("@tetherto/wdk-wallet").FeeRates} FeeRates */
/** @typedef {import("@tetherto/wdk-wallet").ISigner} ISigner */
/** @typedef {import('./wallet-account-evm.js').EvmWalletConfig} EvmWalletConfig */
export default class WalletManagerEvm extends WalletManager {
    /**
     * Multiplier for normal fee rate calculations (in %).
     *
     * @protected
     * @type {bigint}
     */
    protected static _FEE_RATE_NORMAL_MULTIPLIER: bigint;
    /**
     * Multiplier for fast fee rate calculations (in %).
     *
     * @protected
     * @type {bigint}
     */
    protected static _FEE_RATE_FAST_MULTIPLIER: bigint;
    /**
     * Creates a new wallet manager for evm blockchains.
     *
     * Accepts either a BIP-39 seed (string/Uint8Array) for backwards compatibility, or a
     * pre-built root signer object. The default signer must be derivable (it must be able to
     * derive child accounts); non-derivable signers (e.g. private-key signers) are not allowed
     * as the default but may be registered by name via {@link addSigner} - If not adding to your global account managment for using just one non derivable signer create a standalone account.
     *
     * @param {string|Uint8Array|ISigner} seedOrSigner - A BIP-39 seed phrase, seed bytes, or a root signer. Root signers must be derivable — non-derivable signers (e.g. private-key signers) can only be registered by name via {@link addSigner}.
     * @param {EvmWalletConfig} [config] - The configuration object.
     */
    constructor(seedOrSigner: string | Uint8Array | ISigner, config?: EvmWalletConfig);
    /**
     * An ethers provider to interact with a node of the blockchain.
     *
     * @protected
     * @type {Provider | undefined}
     */
    protected _provider: Provider | undefined;
    /**
     * Returns the wallet account at a specific index.
     *
     * @param {number} [index] - The index of the account to get (default: 0).
     * @param {Object} [options] - Account options.
     * @param {string} [options.signerName] - The signer name. Omit to use the default signer.
     * @returns {Promise<WalletAccountEvm>} The account.
     * @throws {Error} If a signer name is given but no signer exists with that name.
     * @throws {SignerError} If the signer doesn't support account derivation.
     */
    getAccount(index?: number, options?: {
        signerName?: string;
    }): Promise<WalletAccountEvm>;
    /**
     * Returns the wallet account associated with a registered signer. Non-derivable
     * signers (e.g. private-key signers) return the signer's single account; derivable signers
     * derive a detached child at the signer's own account (the root is never handed out).
     *
     * @param {string} signerName - The signer name registered via {@link addSigner}.
     * @returns {Promise<WalletAccountEvm>} The account.
     * @throws {Error} If no signer exists with the given name.
     */
    getAccount(signerName: string): Promise<WalletAccountEvm>;
    /**
     * Returns the wallet account at a specific derivation path.
     *
     * @param {string} path - The derivation path (e.g. "0'/0/0").
     * @param {Object} [options] - Account options.
     * @param {string} [options.signerName] - The signer name. Omit to use the default signer.
     * @returns {Promise<WalletAccountEvm>} The account.
     * @throws {Error} If a signer name is given but no signer exists with that name.
     * @throws {SignerError} If the signer doesn't support account derivation.
     */
    getAccountByPath(path: string, options?: {
        signerName?: string;
    }): Promise<WalletAccountEvm>;
    /**
     * Returns the current fee rates.
     *
     * @returns {Promise<FeeRates>} The fee rates (in weis).
     */
    getFeeRates(): Promise<FeeRates>;
}
export type ISignerEvm = import("./signers/seed-signer-evm.js").ISignerEvm;
export type Provider = import("ethers").Provider;
export type FeeRates = import("@tetherto/wdk-wallet").FeeRates;
export type ISigner = import("@tetherto/wdk-wallet").ISigner;
export type EvmWalletConfig = import("./wallet-account-evm.js").EvmWalletConfig;
import WalletManager from '@tetherto/wdk-wallet';
import WalletAccountEvm from './wallet-account-evm.js';
