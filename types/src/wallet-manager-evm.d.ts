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
     * Signer-based construction is not yet supported by the EVM module: passing
     * an `ISigner` is accepted at the type level for parity with the abstract
     * `WalletManager` constructor overloads but throws a `SignerError` at
     * runtime.
     *
     * @overload
     * @param {string | Uint8Array} seed - The wallet's [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) seed phrase or raw seed bytes.
     * @param {EvmWalletConfig} [config] - The configuration object.
     */
    constructor(seed: string | Uint8Array, config?: EvmWalletConfig);
    /**
     * @overload
     * @param {ISigner} signer - The default signer. Not yet supported by the EVM module.
     * @param {EvmWalletConfig} [config] - The configuration object.
     */
    constructor(signer: ISigner, config?: EvmWalletConfig);
    /**
     * An ethers provider to interact with a node of the blockchain.
     *
     * @protected
     * @type {Provider | undefined}
     */
    protected _provider: Provider | undefined;
    /**
     * Returns the wallet account at a specific index (see [BIP-44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki)).
     *
     * Signer-derived accounts are not yet supported by the EVM module: passing a
     * `signerName` (positionally or via `options`) is accepted at the type level
     * for parity with the abstract `WalletManager.getAccount` overloads but
     * throws a `SignerError` at runtime.
     *
     * @example
     * // Returns the account with derivation path m/44'/60'/0'/0/1
     * const account = await wallet.getAccount(1);
     * @overload
     * @param {number} [index] - The index of the account to get (default: 0).
     * @param {Object} [options] - Account options.
     * @param {string} [options.signerName] - The signer name. Omit to use the default signer. Not yet supported by the EVM module.
     * @returns {Promise<WalletAccountEvm>} The account.
     * @throws {SignerError} If a signer name is given (signer-derived accounts are not yet supported by the EVM module).
     */
    getAccount(index?: number, options?: {
        signerName?: string;
    }): Promise<WalletAccountEvm>;
    /**
     * @overload
     * @param {string} signerName - The signer name registered via `addSigner`. Not yet supported by the EVM module.
     * @returns {Promise<WalletAccountEvm>} The account.
     * @throws {SignerError} Always — signer-derived accounts are not yet supported by the EVM module.
     */
    getAccount(signerName: string): Promise<WalletAccountEvm>;
    /**
     * Returns the wallet account at a specific BIP-44 derivation path.
     *
     * Signer-derived accounts are not yet supported by the EVM module: passing
     * `options.signerName` is accepted at the type level for parity with the
     * abstract `WalletManager.getAccountByPath` signature but throws a
     * `SignerError` at runtime.
     *
     * @example
     * // Returns the account with derivation path m/44'/60'/0'/0/1
     * const account = await wallet.getAccountByPath("0'/0/1");
     * @param {string} path - The derivation path (e.g. "0'/0/0").
     * @param {Object} [options] - Account options.
     * @param {string} [options.signerName] - The signer name. Omit to use the default signer. Not yet supported by the EVM module.
     * @returns {Promise<WalletAccountEvm>} The account.
     * @throws {SignerError} If a signer name is given (signer-derived accounts are not yet supported by the EVM module).
     */
    getAccountByPath(path: string, options?: {
        signerName?: string;
    }): Promise<WalletAccountEvm>;
}
export type Provider = import("ethers").Provider;
export type FeeRates = import("@tetherto/wdk-wallet").FeeRates;
export type ISigner = import("@tetherto/wdk-wallet").ISigner;
export type EvmWalletConfig = import("./wallet-account-evm.js").EvmWalletConfig;
import WalletManager from '@tetherto/wdk-wallet';
import WalletAccountEvm from './wallet-account-evm.js';
