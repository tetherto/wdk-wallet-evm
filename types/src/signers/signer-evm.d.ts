/**
 * Interface for EVM signers, extending the base `ISigner` from `@tetherto/wdk-wallet`.
 *
 * @interface
 */
export class ISignerEvm extends ISigner {
    /**
     * The account's address, if available.
     *
     * @deprecated Use {@link getAddress} instead. This property will be removed in an upcoming
     * release: not all signers (e.g. hardware signers) can expose the address synchronously.
     * @type {string | undefined}
     */
    get address(): string | undefined;
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
}
export type TransactionLike = import("ethers").TransactionLike;
export type AuthorizationRequest = import("ethers").AuthorizationRequest;
export type Authorization = import("ethers").Authorization;
export type TypedData = import("../wallet-account-read-only-evm.js").TypedData;
import { ISigner } from "@tetherto/wdk-wallet";
