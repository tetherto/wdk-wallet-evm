/** @internal */
export default class MemorySafeHDNodeWallet extends BaseWallet {
    static fromSeed(seed: any): MemorySafeHDNodeWallet;
    static _fromSeed(_seed: any, mnemonic: any): MemorySafeHDNodeWallet;
    constructor(guard: any, signingKey: any, parentFingerprint: any, chainCode: any, path: any, index: any, depth: any, mnemonic: any, provider: any);
    connect(provider: any): MemorySafeHDNodeWallet;
    get privateKeyBuffer(): any;
    get publicKeyBuffer(): any;
    deriveChild(_index: any): MemorySafeHDNodeWallet;
    derivePath(path: any): any;
    dispose(): void;
}
import { BaseWallet } from 'ethers';
