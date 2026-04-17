/**
 * @typedef {import("@ledgerhq/device-management-kit").DeviceManagementKit} DeviceManagementKit
 * @typedef {import("./seed-signer-evm.js").ISignerEvm} ISignerEvm
 * @typedef {import("./seed-signer-evm.js").UnsignedEvmTransaction} UnsignedEvmTransaction
 * @typedef {import("../wallet-account-read-only-evm.js").EvmWalletConfig} EvmWalletConfig
 * @typedef {import('ethers').TypedDataDomain} TypedDataDomain
 * @typedef {import('ethers').TypedDataField} TypedDataField
 * @typedef {import('ethers').AuthorizationRequest} AuthorizationRequest
 * @typedef {import('ethers').Authorization} Authorization
 * @typedef {import('rxjs').Observable<any>} Observable
 */
/**
 * @implements {ISignerEvm}
 * Hardware-backed signer using Ledger DMK + Ethereum app.
 * Handles device connection, reconnection and provides signing primitives compatible with the
 * rest of the EVM wallet stack.
 */
export default class LedgerSignerEvm implements ISignerEvm {
    /**
     * @param {string} path - Relative BIP-44 path segment (e.g. "0'/0/0"). Prefixed internally.
     * @param {DeviceManagementKit} [dmk] - Optional DMK instance. Auto-created if omitted.
     */
    constructor(path: string, dmk?: DeviceManagementKit);
    /** @private */
    private _account;
    /** @private */
    private _address;
    /** @private */
    private _sessionId;
    /** @private */
    private _path;
    /** @private */
    private _dmk;
    /** @type {number|undefined} */
    get index(): number | undefined;
    /** @type {string|undefined} */
    get path(): string | undefined;
    /** @type {string|undefined} */
    get address(): string | undefined;
    /**
     * Ledger-backed signers do not expose private keys; key pairs are not available.
     *
     * @throws {Error} Always throws to indicate unavailability on Ledger.
     */
    get keyPair(): void;
    /**
     * Disconnect current session if any.
     *
     * @private
     */
    private _disconnect;
    /**
     * Reconnect device and refresh signer/address
     *
     * @private
     */
    private _reconnect;
    /**
     * Ensure the device is in a usable state before sending actions.
     * - If locked or busy: fail fast with a friendly error.
     * - If not connected: attempt reconnect.
     *
     * @private
     */
    private _ensureDeviceReady;
    /**
     * Consume a DeviceAction observable and resolve on Completed; reject early on Error/Stopped.
     *
     * @template T
     * @param {Observable} observable
     * @returns {Promise<T>}
     * @private
     */
    private _consumeDeviceAction;
    /**
     * Discover and connect the device
     *
     * @private
     */
    private _connect;
    /**
     * Derive a new signer at the given relative path, reusing the current device session.
     *
     * @param {string} relPath - Relative BIP-44 path (e.g. "0'/0/1").
     * @param {EvmWalletConfig} [_cfg] - Ignored for EVM signers; present for base compatibility.
     * @returns {LedgerSignerEvm} A new hardware-backed signer bound to the derived path.
     */
    derive(relPath: string, _cfg?: EvmWalletConfig): LedgerSignerEvm;
    /**
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
     * Signs a transaction and returns the serialized signed transaction hex.
     *
     * @param {UnsignedEvmTransaction} unsignedTx - The unsigned transaction object.
     * @returns {Promise<string>} The serialized signed transaction hex.
     */
    signTransaction(unsignedTx: UnsignedEvmTransaction): Promise<string>;
    /**
     * EIP-712 typed data signing.
     *
     * @param {TypedDataDomain} domain
     * @param {Record<string, TypedDataField[]>} types
     * @param {Record<string, any>} message
     * @returns {Promise<string>}
     */
    signTypedData(domain: TypedDataDomain, types: Record<string, TypedDataField[]>, message: Record<string, any>): Promise<string>;
    /**
     * Sign an ERC-7702 authorization tuple.
     *
     * Standalone authorization signing is not supported on Ledger devices.
     * Use `signTransaction` with a type 4 transaction containing an `authorizationList` instead.
     *
     * @param {AuthorizationRequest} _auth
     * @returns {Promise<Authorization>}
     * @throws {Error} Always throws — not supported on Ledger hardware.
     */
    signAuthorization(_auth: AuthorizationRequest): Promise<Authorization>;
    /** Clear device handles and local state. @returns {void} */
    dispose(): void;
}
export type EvmWalletConfig = import("../wallet-account-read-only-evm.js").EvmWalletConfig;
export type DeviceManagementKit = import("@ledgerhq/device-management-kit").DeviceManagementKit;
export type ISignerEvm = import("./seed-signer-evm.js").ISignerEvm;
export type UnsignedEvmTransaction = import("./seed-signer-evm.js").UnsignedEvmTransaction;
export type TypedDataDomain = import("ethers").TypedDataDomain;
export type TypedDataField = import("ethers").TypedDataField;
export type AuthorizationRequest = import("ethers").AuthorizationRequest;
export type Authorization = import("ethers").Authorization;
export type Observable = import("rxjs").Observable<any>;
