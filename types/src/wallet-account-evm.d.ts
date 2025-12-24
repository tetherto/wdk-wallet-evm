/** @implements {IWalletAccount} */
export default class WalletAccountEvm extends WalletAccountReadOnlyEvm implements IWalletAccount {
    /**
     * Legacy helper to create an account from seed + path.
     * Creates a root signer from the seed and derives a child for the given path.
     *
     * @param {string | Uint8Array} seed - The wallet's BIP-39 seed phrase or seed bytes.
     * @param {string} path - The BIP-44 derivation path (e.g. "0'/0/0").
     * @param {EvmWalletConfig} [config] - The configuration object.
     * @returns {WalletAccountEvm}
     */
    static fromSeed(seed: string | Uint8Array, path: string, config?: EvmWalletConfig): WalletAccountEvm;
    /**
     * Creates a new evm wallet account using a signer.
     *
     * @param {object} signer - A signer implementing the EVM signer interface (must be a child, not a root).
     * @param {EvmWalletConfig} [config] - The configuration object.
     */
    constructor(signer: object, config?: EvmWalletConfig);
    /** @private */
    private _signer;
    _isActive: boolean;
    get isActive(): boolean;
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
     * Approves a specific amount of tokens to a spender.
     *
     * @param {ApproveOptions} options The approve options.
     * @returns {Promise<TransactionResult>} The transaction’s result.
     * @throws {Error} If trying to approve usdts on ethereum with allowance not equal to zero (due to the usdt allowance reset requirement).
     */
    approve(options: ApproveOptions): Promise<TransactionResult>;
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
export type IWalletAccount = import("@tetherto/wdk-wallet").IWalletAccount;
export type KeyPair = import("@tetherto/wdk-wallet").KeyPair;
export type TransactionResult = import("@tetherto/wdk-wallet").TransactionResult;
export type TransferOptions = import("@tetherto/wdk-wallet").TransferOptions;
export type TransferResult = import("@tetherto/wdk-wallet").TransferResult;
export type EvmTransaction = import("./wallet-account-read-only-evm.js").EvmTransaction;
export type EvmWalletConfig = import("./wallet-account-read-only-evm.js").EvmWalletConfig;
export type ApproveOptions = {
    /**
     * - The address of the token to approve.
     */
    token: string;
    /**
     * - The spender’s address.
     */
    spender: string;
    /**
     * - The amount of tokens to approve to the spender.
     */
    amount: number | bigint;
};
import WalletAccountReadOnlyEvm from './wallet-account-read-only-evm.js';
