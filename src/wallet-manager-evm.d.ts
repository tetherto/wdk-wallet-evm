export default class WalletManagerEvm extends AbstractWalletManager {
    /**
     * Creates a new wallet manager for evm blockchains.
     *
     * @param {string | Uint8Array} seed - The wallet's [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) seed phrase.
     * @param {EvmWalletConfig} [config] - The configuration object.
     */
    constructor(seed: string | Uint8Array, config?: EvmWalletConfig);
    /**
     * The evm wallet configuration.
     *
     * @protected
     * @type {EvmWalletConfig}
     */
    protected _config: EvmWalletConfig;
    /**
     * A map between derivation paths and wallet accounts. It contains all the wallet accounts that have been accessed through the {@link getAccount} and {@link getAccountByPath} methods.
     *
     * @protected
     * @type {{ [path: string]: WalletAccountEvm }}
     */
    protected _accounts: {
        [path: string]: WalletAccountEvm;
    };
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
     * @example
     * // Returns the account with derivation path m/44'/60'/0'/0/1
     * const account = await wallet.getAccount(1);
     * @param {number} [index] - The index of the account to get (default: 0).
     * @returns {Promise<WalletAccountEvm>} The account.
     */
    getAccount(index?: number): Promise<WalletAccountEvm>;
    /**
     * Returns the wallet account at a specific BIP-44 derivation path.
     *
     * @example
     * // Returns the account with derivation path m/44'/60'/0'/0/1
     * const account = await wallet.getAccountByPath("0'/0/1");
     * @param {string} path - The derivation path (e.g. "0'/0/0").
     * @returns {Promise<WalletAccountEvm>} The account.
     */
    getAccountByPath(path: string): Promise<WalletAccountEvm>;
    /**
     * Returns the current fee rates.
     *
     * @returns {Promise<FeeRates>} The fee rates.
     */
    getFeeRates(): Promise<FeeRates>;
    /**
     * Disposes all the wallet accounts, erasing their private keys from the memory.
     */
    dispose(): void;
}
export type Provider = import("ethers").Provider;
export type FeeRates = import("@wdk/wallet").FeeRates;
export type EvmWalletConfig = import("./wallet-account-evm.js").EvmWalletConfig;
import AbstractWalletManager from '@wdk/wallet';
import WalletAccountEvm from './wallet-account-evm.js';
