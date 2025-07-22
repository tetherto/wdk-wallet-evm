import WalletAccountEvm from './wallet-account-evm.js';
import { EvmTransaction, EvmWalletConfig } from './wallet-account-evm';

export default class WalletAccountReadOnlyEvm extends WalletAccountEvm {
    /**
     * Creates a new read-only EVM wallet account.
     * 
     * @param {string} address - The wallet's address.
     * @param {EvmWalletConfig} [config] - The configuration object.
     */
    constructor(address: string, config?: EvmWalletConfig);

    /**
     * The wallet's address.
     * 
     * @protected
     * @type {string}
     */
    protected _address: string;

    /**
     * Returns the account's address.
     * 
     * @returns {Promise<string>} The account's address.
     */
    getAddress(): Promise<string>;

    /**
     * Signs a message. This operation is not supported for read-only accounts.
     * 
     * @param {string} message - The message to sign.
     * @throws {Error} Always throws an error as signing is not supported.
     */
    sign(message: string): Promise<never>;

    /**
     * Verifies a message's signature.
     * 
     * @param {string} message - The original message.
     * @param {string} signature - The signature to verify.
     * @returns {Promise<boolean>} True if the signature is valid and matches this account's address.
     */
    verify(message: string, signature: string): Promise<boolean>;

    /**
     * Sends a transaction. This operation is not supported for read-only accounts.
     * 
     * @param {EvmTransaction} tx - The transaction.
     * @throws {Error} Always throws an error as sending transactions is not supported.
     */
    sendTransaction(tx: EvmTransaction): Promise<never>;

    /**
     * Transfers tokens. This operation is not supported for read-only accounts.
     * 
     * @param {TransferOptions} options - The transfer's options.
     * @throws {Error} Always throws an error as transferring tokens is not supported.
     */
    transfer(options: TransferOptions): Promise<never>;
} 