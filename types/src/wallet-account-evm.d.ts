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
     * Signs typed data according to EIP-712.
     *
     * @param {TypedData} typedData - The typed data to sign.
     * @returns {Promise<string>} The typed data signature.
     */
    signTypedData({ domain, types, message }: TypedData): Promise<string>;
    /**
     * Sends a transaction. For type 4 (ERC-7702) transactions, gas estimation
     * is performed via raw RPC to include the authorization list, since the
     * provider's high-level `estimateGas` does not forward it.
     *
     * @param {EvmTransaction} tx - The transaction.
     * @returns {Promise<TransactionResult>} The transaction's result.
     */
    sendTransaction(tx: EvmTransaction): Promise<TransactionResult>;
    /**
     * Transfers a token to another address.
     *
     * @param {EvmTransferOptions} options - The transfer's options.
     * @returns {Promise<TransferResult>} The transfer's result.
     */
    transfer(options: EvmTransferOptions): Promise<TransferResult>;
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
     * Signs an ERC-7702 authorization tuple.
     *
     * @param {Erc7702AuthorizationRequest} auth - The authorization request.
     * @returns {Promise<Erc7702Authorization>} The signed authorization.
     */
    signAuthorization(auth: Erc7702AuthorizationRequest): Promise<Erc7702Authorization>;
    /**
     * Delegates this EOA to a smart contract via an ERC-7702 type 4 transaction.
     *
     * The transaction is sent to the EOA itself with zero value and no data.
     * A fixed gas limit is used because `eth_estimateGas` may revert when
     * the delegate contract lacks a `receive`/`fallback` function.
     *
     * @param {string} delegateAddress - The address of the contract to delegate to.
     * @returns {Promise<TransactionResult>} The transaction result.
     */
    delegate(delegateAddress: string): Promise<TransactionResult>;
    /**
     * Revokes any active ERC-7702 delegation by delegating to the zero address.
     *
     * @returns {Promise<TransactionResult>} The transaction result.
     */
    revokeDelegation(): Promise<TransactionResult>;
    /**
     * Estimates gas for a type 4 transaction by calling `eth_estimateGas`
     * directly on the underlying provider, including the authorization list.
     *
     * @private
     * @param {object} tx - The transaction with authorizationList.
     * @returns {Promise<bigint>} The estimated gas.
     */
    private _estimateGasWithAuthList;
    /**
     * Disposes the wallet account, erasing the private key from the memory.
     */
    dispose(): void;
}
export type Erc7702AuthorizationRequest = import("./wallet-account-read-only-evm.js").Erc7702AuthorizationRequest;
export type Erc7702Authorization = import("./wallet-account-read-only-evm.js").Erc7702Authorization;
export type DelegationInfo = import("./wallet-account-read-only-evm.js").DelegationInfo;
export type HDNodeWallet = import("ethers").HDNodeWallet;
export type IWalletAccount = import("@tetherto/wdk-wallet").IWalletAccount;
export type KeyPair = import("@tetherto/wdk-wallet").KeyPair;
export type TransactionResult = import("@tetherto/wdk-wallet").TransactionResult;
export type TransferOptions = import("@tetherto/wdk-wallet").TransferOptions;
export type TransferResult = import("@tetherto/wdk-wallet").TransferResult;
export type EvmTransaction = import("./wallet-account-read-only-evm.js").EvmTransaction;
export type EvmWalletConfig = import("./wallet-account-read-only-evm.js").EvmWalletConfig;
export type TypedData = import("./wallet-account-read-only-evm.js").TypedData;
export type EvmTransferOptions = TransferOptions & {
    authorizationList?: Erc7702Authorization[];
};
export type ApproveOptions = {
    /**
     * The address of the token to approve.
     */
    token: string;
    /**
     * The spender’s address.
     */
    spender: string;
    /**
     * The amount of tokens to approve to the spender.
     */
    amount: number | bigint;
};
import WalletAccountReadOnlyEvm from './wallet-account-read-only-evm.js';
