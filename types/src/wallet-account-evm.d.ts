/** @implements {IWalletAccount<string>} */
export default class WalletAccountEvm extends WalletAccountReadOnlyEvm implements IWalletAccount<string> {
    /**
     * Creates a new evm wallet account from a raw private key.
     *
     * @param {string | Uint8Array} privateKey - The raw private key (hex string with or without 0x, or 32 bytes).
     * @param {EvmWalletConfig} [config] - The configuration object.
     * @returns {WalletAccountEvm} The wallet account.
     */
    static fromPrivateKey(privateKey: string | Uint8Array, config?: EvmWalletConfig): WalletAccountEvm;
    /**
     * Creates a new evm wallet account from a BIP-39 seed, deriving the account's key at the
     * given BIP-44 path.
     *
     * Kept relative to Ethereum's coin type (m/44'/60') for backwards compatibility with
     * pre-existing callers of this constructor; unlike SeedSignerEvm's own constructor (which
     * now takes a full absolute path), this overload's `path` is still just the account path
     * segment below "m/44'/60'".
     *
     * @param {string | Uint8Array} seed - The wallet's BIP-39 seed phrase or seed bytes.
     * @param {string} path - The BIP-44 account path, relative to "m/44'/60'" (e.g. "0'/0/0").
     * @param {EvmWalletConfig} [config] - The configuration object.
     * @throws {ValueError} If the given seed phrase is invalid.
     */
    constructor(seed: string | Uint8Array, path: string, config?: EvmWalletConfig);
    /**
     * Creates a new evm wallet account using a signer.
     *
     * @param {ISignerEvm} signer - A signer implementing the EVM signer interface.
     * @param {EvmWalletConfig & SignerOptions} [config] - The configuration object.
     */
    constructor(signer: ISignerEvm, config?: EvmWalletConfig & SignerOptions);
    /**
     * If true, disposes the signer on calls to the 'dispose' method. Always true for an
     * account created from a seed, which owns its internally created signer.
     *
     * @protected
     * @type {boolean}
     */
    protected _shouldWipeSignerOnDisposal: boolean;
    /**
     * The wallet account configuration.
     *
     * @protected
     * @type {EvmWalletConfig}
     */
    protected _config: EvmWalletConfig;
    /** @private */
    private _signer;
    /**
     * The derivation path of this account (see [BIP-44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki)),
     * or null if the account's signer is not bound to a BIP-44 position (e.g. private-key signers).
     *
     * @type {string | null}
     */
    get path(): string | null;
    /**
     * The account's key pair.
     *
     * The uint8 arrays are bound to the wallet account, so any external change will reflect to the internal representation. For this reason,
     * it's strongly recommended to treat the key pair as a read-only view of the keys. While it's still technically possible to alter their
     * content, client code should never do so.
     *
     * @type {KeyPair | null}
     */
    get keyPair(): KeyPair | null;
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
     * Signs typed data according to EIP-712.
     *
     * @param {TypedData} typedData - The typed data to sign.
     * @returns {Promise<string>} The typed data signature.
     */
    signTypedData({ domain, types, message }: TypedData): Promise<string>;
    /**
     * Signs a transaction.
     *
     * If a provider is set, it also estimates the transaction's costs and checks them against the transaction max. fee option.
     *
     * @param {EvmTransaction} tx - The transaction to sign.
     * @returns {Promise<string>} The signed transaction as a hex string.
     * @throws {MaximumFeeExceededError} If a provider is set, and the transaction's cost surpasses the transaction max. fee option.
     */
    signTransaction(tx: EvmTransaction): Promise<string>;
    /**
     * Sends a transaction.
     *
     * @param {EvmTransaction | string} tx - The transaction, or a signed raw transaction as a hex string.
     * @returns {Promise<TransactionResult>} The transaction's result.
     * @throws {ProviderRequiredError} If the wallet is not connected to a provider.
     * @throws {MaximumFeeExceededError} If the transaction's cost exceeds the maximum transaction fee option.
     * @throws {ValueError} If the transaction mixes fee fields that its type doesn't support, or a type 3 transaction omits `maxFeePerBlobGas`.
     */
    sendTransaction(tx: EvmTransaction | string): Promise<TransactionResult>;
    /**
     * Quotes the costs of a send transaction operation.
     *
     * @param {EvmTransaction | string} tx - The transaction, or a signed raw transaction as a hex string.
     * @returns {Promise<Omit<TransactionResult, 'hash'>>} The transaction's quotes.
     * @throws {ProviderRequiredError} If the wallet is not connected to a provider.
     * @throws {ValueError} If the transaction mixes fee fields that its type doesn't support, or a type 3 transaction omits `maxFeePerBlobGas`.
     */
    quoteSendTransaction(tx: EvmTransaction | string): Promise<Omit<TransactionResult, "hash">>;
    /**
     * Transfers a token to another address.
     *
     * @param {EvmTransferOptions} options - The transfer's options.
     * @returns {Promise<TransferResult>} The transfer's result.
     * @throws {ProviderRequiredError} If the wallet is not connected to a provider.
     * @throws {MaximumFeeExceededError} If the transfer's cost exceeds the maximum transfer fee option.
     */
    transfer(options: EvmTransferOptions): Promise<TransferResult>;
    /**
     * Approves a specific amount of tokens to a spender.
     *
     * @param {ApproveOptions} options The approve options.
     * @returns {Promise<TransactionResult>} The transaction's result.
     * @throws {ProviderRequiredError} If the wallet is not connected to a provider.
     * @throws {ValueError} If trying to approve usdts on ethereum with allowance not equal to zero (due to the usdt allowance reset requirement).
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
     * The chainId and nonce are populated from the provider when not explicitly provided.
     *
     * @param {AuthorizationRequest} auth - The authorization request.
     * @returns {Promise<Authorization>} The signed authorization.
     * @throws {ProviderRequiredError} If the chainId or nonce are not provided and the wallet is not connected to a provider.
     */
    signAuthorization(auth: AuthorizationRequest): Promise<Authorization>;
    /**
     * Delegates this EOA to a smart contract via an ERC-7702 type 4 transaction.
     *
     * The transaction is sent to the EOA itself with zero value and no data.
     * A fixed gas limit is used because `eth_estimateGas` may revert when
     * the delegate contract lacks a `receive`/`fallback` function.
     *
     * @param {string} delegateAddress - The address of the contract to delegate to.
     * @returns {Promise<TransactionResult>} The transaction result.
     * @throws {ProviderRequiredError} If the wallet is not connected to a provider.
     */
    delegate(delegateAddress: string): Promise<TransactionResult>;
    /**
     * Revokes any active ERC-7702 delegation by delegating to the zero address.
     *
     * @returns {Promise<TransactionResult>} The transaction result.
     */
    revokeDelegation(): Promise<TransactionResult>;
    /**
     * Disposes the wallet account, erasing the private key from the memory. The signer is
     * wiped only if the account owns it: always for an account created from a seed, otherwise
     * only when `shouldWipeSignerOnDisposal` was set in the config -- a caller-supplied signer
     * is left untouched by default.
     */
    dispose(): void;
}
export type ISignerEvm = import("./signers/signer-evm.js").ISignerEvm;
export type HDNodeWallet = import("ethers").HDNodeWallet;
export type AuthorizationRequest = import("ethers").AuthorizationRequest;
export type Authorization = import("ethers").Authorization;
export type AuthorizationLike = import("ethers").AuthorizationLike;
export type IWalletAccount<TSignedTransaction> = import("@tetherto/wdk-wallet").IWalletAccount<TSignedTransaction>;
export type KeyPair = import("@tetherto/wdk-wallet").KeyPair;
export type ProviderRequiredError = import("@tetherto/wdk-wallet").ProviderRequiredError;
export type TransactionResult = import("@tetherto/wdk-wallet").TransactionResult;
export type TransferResult = import("@tetherto/wdk-wallet").TransferResult;
export type TypedData = import("./wallet-account-read-only-evm.js").TypedData;
export type EvmTransaction = import("./wallet-account-read-only-evm.js").EvmTransaction;
export type EvmTransferOptions = import("./wallet-account-read-only-evm.js").EvmTransferOptions;
export type EvmWalletConfig = import("./wallet-account-read-only-evm.js").EvmWalletConfig;
export type ApproveOptions = {
    /**
     * - The address of the token to approve.
     */
    token: string;
    /**
     * - The spender's address.
     */
    spender: string;
    /**
     * - The amount of tokens to approve to the spender.
     */
    amount: number | bigint;
};
export type SignerOptions = {
    /**
     * - If true, wipes the signer given at construction on calls to the 'dispose' method.
     */
    shouldWipeSignerOnDisposal?: boolean;
};
import WalletAccountReadOnlyEvm from './wallet-account-read-only-evm.js';
