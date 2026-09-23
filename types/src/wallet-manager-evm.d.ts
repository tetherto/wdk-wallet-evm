/** @extends {WalletManager<ISignerEvm>} */
export default class WalletManagerEvm extends WalletManager<ISignerEvm> {
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
     * Creates a new wallet manager for evm blockchains from a BIP-39 seed.
     *
     * @param {string | Uint8Array} seed - The BIP-39 seed phrase or raw seed bytes.
     * @param {EvmWalletConfig} [config] - The configuration object.
     * @throws {ValueError} If the seed phrase is invalid.
     */
    constructor(seed: string | Uint8Array, config?: EvmWalletConfig);
    /**
     * Creates a new wallet manager for evm blockchains from a default signer.
     *
     * The default signer must be derivable (it must be able to derive child accounts);
     * non-derivable signers (e.g. private-key signers) are not allowed as the default but
     * may be registered by name via {@link addSigner}. To use a single non-derivable signer
     * outside of the wallet manager, create a standalone account instead.
     * **Warning:** the signer is kept exactly as given, not cloned -- if you still hold a
     * reference to it and dispose it directly, every subsequent {@link getAccount}/
     * {@link getAccountByPath} call that falls back to the default signer (i.e. without an
     * explicit `signerName`) fails, since deriving from a disposed signer isn't possible.
     * Conversely, the manager never disposes a signer you supplied: {@link dispose} wipes
     * only the default signer it creates internally from a seed.
     *
     * @param {ISignerEvm} signer - The default signer.
     * @param {EvmWalletConfig} [config] - The configuration object.
     * @throws {InvalidSignerError} If the default signer does not support account derivation.
     */
    constructor(signer: ISignerEvm, config?: EvmWalletConfig);
    /**
     * If true, disposes the default signer on calls to the 'dispose' method.
     *
     * @protected
     * @type {boolean}
     */
    protected _shouldWipeDefaultSignerOnDisposal: boolean;
    /**
     * An ethers provider to interact with a node of the blockchain. Shared with every account
     * this manager creates, so two accounts never open two clients for the same endpoint.
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
     * @throws {NoSuchElementError} If a signer name is given but no signer exists with that name.
     * @throws {UnsupportedOperationError} If the signer doesn't support account derivation.
     */
    getAccount(index?: number, options?: {
        signerName?: string;
    }): Promise<WalletAccountEvm>;
    /**
     * Returns the wallet account associated with a registered signer.
     *
     * The registered signer is used exactly as given, wherever it happens to sit -- this
     * overload never derives. For a private-key signer that's its one account; for a derivable
     * signer, it's the account at that signer's own current path, unchanged. If you want a
     * derived leaf from a derivable named signer (e.g. a second seed registered as a bank of
     * accounts), use {@link getAccount}(index, { signerName }) or {@link getAccountByPath}(path,
     * { signerName }) instead -- both of those always derive, and throw clearly if the named
     * signer can't.
     *
     * **Warning:** the returned account wraps the registered signer itself, exactly where it
     * sits -- e.g. a second seed registered at the intermediate path "m/44'/60'" yields the
     * account AT "m/44'/60'", not at a derived leaf, which is rarely what you want to transact
     * with. Disposing the returned account leaves the registered signer untouched.
     *
     * @param {string} signerName - The signer name registered via {@link addSigner}.
     * @returns {Promise<WalletAccountEvm>} The account.
     * @throws {NoSuchElementError} If no signer exists with the given name.
     */
    getAccount(signerName: string): Promise<WalletAccountEvm>;
    /**
     * Returns the wallet account at a specific derivation path.
     *
     * @param {string} path - The derivation path (e.g. "0'/0/0").
     * @param {Object} [options] - Account options.
     * @param {string} [options.signerName] - The signer name. Omit to use the default signer.
     * @returns {Promise<WalletAccountEvm>} The account.
     * @throws {NoSuchElementError} If a signer name is given but no signer exists with that name.
     * @throws {UnsupportedOperationError} If the signer doesn't support account derivation.
     */
    getAccountByPath(path: string, options?: {
        signerName?: string;
    }): Promise<WalletAccountEvm>;
    /** @private */
    private _accountConfig;
    /**
     * Returns the current fee rates.
     *
     * @returns {Promise<FeeRates>} The fee rates (in weis).
     */
    getFeeRates(): Promise<FeeRates>;
    /**
     * Disposes all the wallet accounts, erasing their private keys from the memory. If the
     * manager was created from a seed, the internally created default signer is wiped too;
     * a default signer supplied at construction is left untouched, as are signers registered
     * via {@link addSigner}.
     */
    dispose(): void;
}
export type ISignerEvm = import("./signers/signer-evm.js").ISignerEvm;
export type Provider = import("ethers").Provider;
export type FeeRates = import("@tetherto/wdk-wallet").FeeRates;
export type InvalidSignerError = import("@tetherto/wdk-wallet").InvalidSignerError;
export type UnsupportedOperationError = import("@tetherto/wdk-wallet").UnsupportedOperationError;
export type NoSuchElementError = import("@tetherto/wdk-wallet").NoSuchElementError;
export type ValueError = import("@tetherto/wdk-wallet").ValueError;
export type EvmWalletConfig = import("./wallet-account-evm.js").EvmWalletConfig;
import WalletManager from '@tetherto/wdk-wallet';
import WalletAccountEvm from './wallet-account-evm.js';
