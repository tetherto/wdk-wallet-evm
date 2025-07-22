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
     * Sends a transaction. This operation is not supported for read-only accounts.
     * 
     * @param {EvmTransaction} tx - The transaction.
     * @throws {Error} Always throws an error as sending transactions is not supported.
     */
    sendTransaction(tx: EvmTransaction): Promise<never>;
} 