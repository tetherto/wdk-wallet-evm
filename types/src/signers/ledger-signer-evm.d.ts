/**
 * @typedef {import("@ledgerhq/device-management-kit").DeviceManagementKit} DeviceManagementKit
 * @typedef {import("./seed-signer-evm.js").ISignerEvm} ISignerEvm
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
     * @param {EvmWalletConfig} [config]
     * @param {{dmk?: DeviceManagementKit}} [opts]
     */
    constructor(path: string, config?: EvmWalletConfig, opts?: {
        dmk?: DeviceManagementKit;
    });
    _config: import("../wallet-account-read-only-evm.js").EvmWalletConfig;
    _account: import("@ledgerhq/device-signer-kit-ethereum/internal/DefaultSignerEth.js").DefaultSignerEth;
    _address: any;
    _sessionId: string;
    _path: string;
    _isActive: boolean;
    /**
     * @type {DeviceManagementKit}
     */
    _dmk: DeviceManagementKit;
    get isActive(): boolean;
    get index(): number;
    get path(): string;
    get config(): import("../wallet-account-read-only-evm.js").EvmWalletConfig;
    get address(): any;
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
     * @param {string} context
     * @private
     */
    private _ensureDeviceReady;
    /**
     * Consume a DeviceAction observable and resolve on Completed; reject early on Error/Stopped.
     *
     * @template T
     * @param {import('rxjs').Observable<any>} observable
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
     * @param {EvmWalletConfig} [cfg] - Optional configuration overrides for the derived signer.
     * @returns {LedgerSignerEvm} A new hardware-backed signer bound to the derived path.
     */
    derive(relPath: string, cfg?: EvmWalletConfig): LedgerSignerEvm;
    /** @returns {Promise<string>} */
    getAddress(): Promise<string>;
    /**
     * Signs a message.
     *
     * @param {string} message - The message to sign.
     * @returns {Promise<string>} The message's signature.
     */
    sign(message: string): Promise<string>;
    /** @param {UnsignedEvmTransaction} unsignedTx @returns {Promise<string>} */
    signTransaction(unsignedTx: UnsignedEvmTransaction): Promise<string>;
    /**
     * EIP-712 typed data signing.
     * @param {Record<string, any>} domain
     * @param {Record<string, any>} types
     * @param {Record<string, any>} message
     * @returns {Promise<string>}
     */
    signTypedData(domain: Record<string, any>, types: Record<string, any>, message: Record<string, any>): Promise<string>;
    /** Clear device handles and local state. */
    dispose(): void;
}
export type EvmWalletConfig = import("../wallet-account-read-only-evm.js").EvmWalletConfig;
export type UnsignedEvmTransaction = import("../utils/tx-populator-evm.js").UnsignedEvmTransaction;
export type DeviceManagementKit = import("@ledgerhq/device-management-kit").DeviceManagementKit;
export type ISignerEvm = import("./seed-signer-evm.js").ISignerEvm;
