/** @internal */
export default class MemorySafeSigningKey extends SigningKey {
    constructor(privateKeyBuffer: any);
    _privateKeyBuffer: any;
    _publicKeyBuffer: secp256k1.Bytes;
    get privateKeyBuffer(): any;
    get publicKeyBuffer(): secp256k1.Bytes;
    sign(digest: any): Signature;
    dispose(): void;
}
import { SigningKey } from 'ethers';
import * as secp256k1 from '@noble/secp256k1';
import { Signature } from 'ethers';
