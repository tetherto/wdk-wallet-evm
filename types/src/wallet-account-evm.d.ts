/** @implements {IWalletAccount} */
export default class WalletAccountEvm extends WalletAccountReadOnlyEvm implements IWalletAccount {
    /**
     * Creates a new evm wallet account.
     *
     * @param {string | Uint8Array} seed - The wallet's [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) seed phrase.
     * @param {string} path - The BIP-44 derivation path (e.g. "0'/0/0").
     * @param {EvmWalletConfig} [config] - The configuration object.
     */
    constructor(seed: string | Uint8Array, path: string, config?: EvmWalletConfig);
    /**
     * The wallet account configuration.
     *
     * @protected
     * @type {EvmWalletConfig}
     */
    protected _config: EvmWalletConfig;
    /**
     * The account.
     *
     * @protected
     * @type {HDNodeWallet}
     */
    protected _account: HDNodeWallet;
    /**
     * The derivation path's index of this account.
     *
     * @type {number}
     */
    get index(): number;
    /**
     * The derivation path of this account (see [BIP-44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki)).
     *
     * @type {string}
     */
    get path(): string;
    /**
     * The account's key pair.
     *
     * @type {KeyPair}
     */
    get keyPair(): KeyPair;
    /**
     * Signs a message.
     *
     * @param {string} message - The message to sign.
     * @returns {Promise<string>} The message's signature.
     */
    sign(message: string): Promise<string>;
    /**
     * Verifies a message's signature.
     *
     * @param {string} message - The original message.
     * @param {string} signature - The signature to verify.
     * @returns {Promise<boolean>} True if the signature is valid.
     */
    verify(message: string, signature: string): Promise<boolean>;
    /**
     * Sends a transaction.
     *
     * @param {EvmTransaction} tx - The transaction.
     * @returns {Promise<TransactionResult>} The transaction's result.
     */
    sendTransaction(tx: EvmTransaction): Promise<TransactionResult>;
    /**
     * Transfers a token to another address.
     *
     * @param {TransferOptions} options - The transfer's options.
     * @returns {Promise<TransferResult>} The transfer's result.
     */
    transfer(options: TransferOptions): Promise<TransferResult>;
    /**
     * Returns a read-only copy of the account.
     *
     * @returns {Promise<WalletAccountReadOnlyEvm>} The read-only account.
     */
    toReadOnlyAccount(): Promise<WalletAccountReadOnlyEvm>;
    /**
     * Disposes the wallet account, erasing the private key from the memory.
     */
    dispose(): void;
}
export type HDNodeWallet = import("ethers").HDNodeWallet;
export type IWalletAccount = import("@wdk/wallet").IWalletAccount;
export type KeyPair = import("@wdk/wallet").KeyPair;
export type TransactionResult = import("@wdk/wallet").TransactionResult;
export type TransferOptions = import("@wdk/wallet").TransferOptions;
export type TransferResult = import("@wdk/wallet").TransferResult;
export type EvmTransaction = import("./wallet-account-read-only-evm.js").EvmTransaction;
export type EvmWalletConfig = import("./wallet-account-read-only-evm.js").EvmWalletConfig;
import WalletAccountReadOnlyEvm from './wallet-account-read-only-evm.js';
