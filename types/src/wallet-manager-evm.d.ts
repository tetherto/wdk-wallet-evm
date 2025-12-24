/** @typedef {import('ethers').Provider} Provider */
/** @typedef {import("@tetherto/wdk-wallet").FeeRates} FeeRates */
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
     * Creates a new wallet manager for evm blockchains using a root signer.
     *
     * @param {object} signer - The root signer (must not be a private key signer).
     * @param {EvmWalletConfig} [config] - The configuration object.
     */
    constructor(signer: object, config?: EvmWalletConfig);
    /**
     * An ethers provider to interact with a node of the blockchain.
     *
     * @protected
     * @type {Provider | undefined}
     */
    protected _provider: Provider | undefined;
    /**
     * Registers an additional root signer under a name.
     *
     * @param {string} signerName - The signer name.
     * @param {object} signer - The root signer to register.
     */
    createSigner(signerName: string, signer: object): void;
    /**
     * Returns the wallet account at a specific index (see [BIP-44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki)).
     *
     * @example
     * // Returns the account with derivation path m/44'/60'/0'/0/1
     * const account = await wallet.getAccount(1);
     * @param {number} [index] - The index of the account to get (default: 0).
     * @param {string} [signerName='default'] - The root signer name.
     * @returns {Promise<WalletAccountEvm>} The account.
     */
    getAccount(index?: number, signerName?: string): Promise<WalletAccountEvm>;
    /**
     * Returns the wallet account at a specific BIP-44 derivation path.
     *
     * @example
     * // Returns the account with derivation path m/44'/60'/0'/0/1
     * const account = await wallet.getAccountByPath("0'/0/1");
     * @param {string} path - The derivation path (e.g. "0'/0/0").
     * @param {string} [signerName='default'] - The root signer name.
     * @returns {Promise<WalletAccountEvm>} The account.
     */
    getAccountByPath(path: string, signerName?: string): Promise<WalletAccountEvm>;
}
export type Provider = import("ethers").Provider;
export type FeeRates = import("@tetherto/wdk-wallet").FeeRates;
export type EvmWalletConfig = import("./wallet-account-evm.js").EvmWalletConfig;
import WalletManager from '@tetherto/wdk-wallet';
import WalletAccountEvm from './wallet-account-evm.js';
