// Copyright 2024 Tether Operations Limited
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use strict'

import { assertArgument, dataLength, getBytesCopy, Signature, SigningKey, toBeHex } from 'ethers'

// eslint-disable-next-line camelcase
import { sodium_memzero } from 'sodium-universal'

import * as secp256k1 from '@noble/secp256k1'

const NULL = '0x0000000000000000000000000000000000000000000000000000000000000000'

export default class MemorySafeSigningKey extends SigningKey {
  #privateKeyBuffer

  constructor (privateKeyBuffer) {
    if (!(privateKeyBuffer instanceof Uint8Array)) {
      throw new Error('The private key must be a uint8 array.')
    }
    if (privateKeyBuffer.length !== 32) {
      throw new Error('The private key must be 32 bytes long.')
    }

    super(NULL)

    this.#privateKeyBuffer = privateKeyBuffer
  }

  get privateKey () {
    return NULL
  }

  get publicKey () {
    return SigningKey.computePublicKey(this.#privateKeyBuffer)
  }

  get compressedPublicKey () {
    return SigningKey.computePublicKey(this.#privateKeyBuffer, true)
  }

  get privateKeyBuffer () {
    return this.#privateKeyBuffer
  }

  get publicKeyBuffer () {
    return secp256k1.getPublicKey(this.#privateKeyBuffer, false)
  }

  sign (digest) {
    assertArgument(dataLength(digest) === 32, 'invalid digest length', 'digest', digest)

    const sig = secp256k1.sign(getBytesCopy(digest), this.#privateKeyBuffer, {
      lowS: true
    })

    return Signature.from({
      r: toBeHex(sig.r, 32),
      s: toBeHex(sig.s, 32),
      v: (sig.recovery ? 0x1c : 0x1b)
    })
  }

  computeSharedSecret (other) {
    const pubKey = SigningKey.computePublicKey(other);
    return hexlify(secp256k1.getSharedSecret(this.#privateKeyBuffer, getBytes(pubKey), false));
  }

  dispose () {
    sodium_memzero(this.#privateKeyBuffer)

    this.#privateKeyBuffer = undefined
  }
}
