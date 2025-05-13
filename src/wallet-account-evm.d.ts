/**
 * @typedef {Object} KeyPair
 * @property {string} publicKey - The public key.
 * @property {string} privateKey - The private key.
 */
/**
 * @typedef {Object} EvmTransaction
 * @property {string} to - The transaction's recipient.
 * @property {number} value - The amount of ethers to send to the recipient (in weis).
 * @property {string} [data] - The transaction's data in hex format.
 * @property {number} [gasLimit] - The maximum amount of gas this transaction is permitted to use.
 * @property {number} [gasPrice] - The price (in wei) per unit of gas this transaction will pay.
 * @property {number} [maxFeePerGas] - The maximum price (in wei) per unit of gas this transaction will pay for the combined [EIP-1559](https://eips.ethereum.org/EIPS/eip-1559) block's base fee and this transaction's priority fee.
 * @property {number} [maxPriorityFeePerGas] - The price (in wei) per unit of gas this transaction will allow in addition to the [EIP-1559](https://eips.ethereum.org/EIPS/eip-1559) block's base fee to bribe miners into giving this transaction priority. This is included in the maxFeePerGas, so this will not affect the total maximum cost set with maxFeePerGas.
 */
export default class WalletAccountEvm {
    constructor(account: any);
    /**
     * The derivation path's index of this account.
     *
     * @type {number}
     */
    get index(): number;
    /**
     * The derivation path of this account (see [BIP-44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki)).
     *
     * @type {number}
     */
    get path(): number;
    /**
     * The account's key pair.
     *
     * @type {KeyPair}
     */
    get keyPair(): KeyPair;
    /**
     * Returns the account's address.
     *
     * @returns {Promise<string>} The account's address.
     */
    getAddress(): Promise<string>;
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
     * Sends a transaction with arbitrary data.
     *
     * @param {EvmTransaction} tx - The transaction to send.
     * @returns {Promise<string>} The transaction's hash.
     */
    sendTransaction(tx: EvmTransaction): Promise<string>;
    /**
     * Quotes a transaction.
     *
     * @param {EvmTransaction} tx - The transaction to quote.
     * @returns {Promise<number>} The transaction’s fee (in weis).
     */
    quoteTransaction(tx: EvmTransaction): Promise<number>;
    /**
     * Returns the current fee rates.
     *
     * @returns {Promise<{ normal: number, fast: number }>} The fee rates (in weis).
     */
    getFeeRates(): Promise<{
        normal: number;
        fast: number;
    }>;
    /**
     * Returns the account's native token balance.
     *
     * @returns {Promise<number>} The native token balance.
     */
    getBalance(): Promise<number>;
    /**
     * Returns the account balance for a specific token.
     *
     * @param {string} tokenAddress - The smart contract address of the token.
     * @returns {Promise<number>} The token balance.
     */
    getTokenBalance(tokenAddress: string): Promise<number>;
    #private;
}
export type KeyPair = {
    /**
     * - The public key.
     */
    publicKey: string;
    /**
     * - The private key.
     */
    privateKey: string;
};
export type EvmTransaction = {
    /**
     * - The transaction's recipient.
     */
    to: string;
    /**
     * - The amount of ethers to send to the recipient (in weis).
     */
    value: number;
    /**
     * - The transaction's data in hex format.
     */
    data?: string;
    /**
     * - The maximum amount of gas this transaction is permitted to use.
     */
    gasLimit?: number;
    /**
     * - The price (in wei) per unit of gas this transaction will pay.
     */
    gasPrice?: number;
    /**
     * - The maximum price (in wei) per unit of gas this transaction will pay for the combined [EIP-1559](https://eips.ethereum.org/EIPS/eip-1559) block's base fee and this transaction's priority fee.
     */
    maxFeePerGas?: number;
    /**
     * - The price (in wei) per unit of gas this transaction will allow in addition to the [EIP-1559](https://eips.ethereum.org/EIPS/eip-1559) block's base fee to bribe miners into giving this transaction priority. This is included in the maxFeePerGas, so this will not affect the total maximum cost set with maxFeePerGas.
     */
    maxPriorityFeePerGas?: number;
};
