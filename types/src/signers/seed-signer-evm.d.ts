/**
 * Signer implementation that derives keys from a BIP-39 seed using an HD path. Every signer
 * holds exactly one HD node (the Ethereum BIP-44 account at index 0 by default) and can derive
 * child signers below its own path. Each signer owns an independent copy of its key, so
 * disposing one never affects its parent, children or siblings.
 *
 * @implements {ISignerEvm}
 */
export default class SeedSignerEvm implements ISignerEvm {
    /**
     * Create a SeedSignerEvm from a BIP-39 seed.
     *
     * @param {string|Uint8Array} seed - BIP-39 mnemonic or seed bytes.
     * @param {string} [path] - A BIP-32 path (default: "m/44'/60'/0'/0/0").
     * @throws {ValueError} If the given seed phrase is invalid.
     */
    constructor(seed: string | Uint8Array, path?: string);
    /** @private */
    private _account;
    /**
     * Whether this signer can derive child signers. Always true: every seed signer holds an
     * HD node with a private key and can derive below its own path.
     *
     * @type {true}
     */
    get isDerivable(): true;
    /**
     * The signer's absolute derivation path.
     *
     * @type {string}
     */
    get path(): string;
    /**
     * The account's derived address.
     *
     * @deprecated Use {@link getAddress} instead. This property will be removed in an upcoming
     * release: not all signers (e.g. hardware signers) can expose the address synchronously.
     * @type {string}
     */
    get address(): string;
    /**
     * The account's key pair (private and public key buffers).
     *
     * @type {KeyPair}
     */
    get keyPair(): KeyPair;
    /**
     * Derive a child signer relative to this signer's own path (e.g. calling derive("0'/0/1") on
     * a signer at "m/44'/60'" yields a child at "m/44'/60'/0'/0/1"). Purely self-relative: no
     * coin-specific prefix is ever assumed or injected. The child owns an independent copy of
     * its key and can itself derive further.
     *
     * @param {string} relPath - The path segment to derive, relative to this signer's own path.
     * @returns {Promise<SeedSignerEvm>} The derived child signer.
     */
    derive(relPath: string): Promise<SeedSignerEvm>;
    /**
     * Returns the account's derived address.
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
     * Signs a transaction.
     *
     * @param {TransactionLike} tx - The transaction to sign.
     * @returns {Promise<string>} The signed transaction as a hex string.
     */
    signTransaction(tx: TransactionLike): Promise<string>;
    /**
     * Signs typed data according to EIP-712.
     *
     * @param {TypedData} typedData - The typed data to sign.
     * @returns {Promise<string>} The typed data signature.
     */
    signTypedData(typedData: TypedData): Promise<string>;
    /**
     * Signs an ERC-7702 authorization tuple.
     *
     * @param {AuthorizationRequest} auth - The authorization request.
     * @returns {Promise<Authorization>} The signed authorization.
     */
    signAuthorization(auth: AuthorizationRequest): Promise<Authorization>;
    /**
     * Disposes the signer, erasing its secrets from memory.
     */
    dispose(): void;
}
/**
 * Memory-safe BIP-32 HD node (implemented by the internal src/memory-safe/hd-node-wallet.js)
 */
export type MemorySafeHDNodeWallet = {
    readonly address: string;
    readonly path: string | null;
    readonly index: number;
    readonly depth: number;
    readonly publicKey: string;
    readonly privateKeyBuffer: Uint8Array | undefined;
    readonly publicKeyBuffer: Uint8Array;
    deriveChild(index: number): MemorySafeHDNodeWallet;
    derivePath(path: string): MemorySafeHDNodeWallet;
    dispose(): void;
};
export type ISignerEvm = import("./signer-evm.js").ISignerEvm;
export type KeyPair = import("@tetherto/wdk-wallet").KeyPair;
export type ValueError = import("@tetherto/wdk-wallet").ValueError;
export type TransactionLike = import("ethers").TransactionLike;
export type AuthorizationRequest = import("ethers").AuthorizationRequest;
export type Authorization = import("ethers").Authorization;
export type TypedData = import("../wallet-account-read-only-evm.js").TypedData;
/**
 * Absolute BIP-44 prefix for Ethereum (m/purpose'/coin_type'). Exported so callers that want
 * "the standard Ethereum path" (WalletAccountEvm's seed overload, WalletManagerEvm's own
 * internal default signer) can compose an absolute path without hardcoding it themselves.
 *
 * @internal
 */
export const BIP_44_ETH_DERIVATION_PATH_PREFIX: "m/44'/60'";
