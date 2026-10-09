/**
 * Resolves an asynchronous WDK account into the required x402 signing surface.
 * Does not add transaction, approval, or read capabilities. Recreate after key rotation.
 *
 * @param {SigningAccount} account - The account providing async address and signing methods.
 * @returns {Promise<ClientSignerProjection>} An address snapshot and bound signing method.
 * @throws {TypeError} If the address, typed data, or returned signature is invalid.
 */
export function createX402Signer(account: SigningAccount): Promise<ClientSignerProjection>;
export type Hex = `0x${string}`;
export type TypedData = import("./wallet-account-read-only-evm.js").TypedData;
export type TypedDataDomain = import("ethers").TypedDataDomain;
export type TypedDataField = import("ethers").TypedDataField;
export type SigningAccount = Pick<import("./wallet-account-evm.js").default, "getAddress" | "signTypedData">;
export type ClientSigningInput = {
    domain: Record<string, unknown>;
    types: Record<string, unknown>;
    primaryType: string;
    message: Record<string, unknown>;
};
export type ClientSignerProjection = {
    address: Hex;
    signTypedData: (input: ClientSigningInput) => Promise<Hex>;
};
