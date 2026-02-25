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

import { hmac } from '@noble/hashes/hmac'
import { sha256 } from '@noble/hashes/sha2'
import * as secp256k1 from '@noble/secp256k1'

import {
  assertArgument,
  dataLength,
  getBytesCopy,
  Signature,
  SigningKey,
  toBeHex
} from 'ethers'

// eslint-disable-next-line camelcase
import { sodium_memzero } from 'sodium-universal'

/**
 * @typedef {import("ethers").BytesLike} BytesLike
 */

const NULL =
  '0x0000000000000000000000000000000000000000000000000000000000000000'

secp256k1.etc.hmacSha256Sync = (key, ...messages) => {
  return hmac(sha256, key, secp256k1.etc.concatBytes(...messages))
}

/**
 * @internal
 */
export default class MemorySafeSigningKey extends SigningKey {
  /**
   * Generate a memory-safe signing key.
   *
   * @param {Uint8Array} privateKeyBuffer The private key buffer.
   */
  constructor (privateKeyBuffer) {
    super(NULL)

    /**
     * The private key. Note: after calling `dispose()` this may be `undefined`.
     *
     * @private
     * @type {Uint8Array | undefined}
     */
    this._privateKeyBuffer = privateKeyBuffer

    /**
     * The raw public key.
     *
     * @private
     * @type {Uint8Array}
     */
    this._publicKeyBuffer = secp256k1.getPublicKey(privateKeyBuffer, true)
  }

  /**
   * Hex-encoded uncompressed public key.
   *
   * @returns {string}
   */
  get publicKey () {
    return SigningKey.computePublicKey(this._privateKeyBuffer)
  }

  /**
   * Hex-encoded compressed public key.
   *
   * @returns {string}
   */
  get compressedPublicKey () {
    return SigningKey.computePublicKey(this._privateKeyBuffer, true)
  }

  /**
   * The private key buffer, or `undefined` if cleared.
   *
   * @returns {Uint8Array | undefined}
   */
  get privateKeyBuffer () {
    return this._privateKeyBuffer
  }

  /**
   * Compressed public key buffer (33 bytes).
   *
   * @returns {Uint8Array}
   */
  get publicKeyBuffer () {
    return this._publicKeyBuffer
  }

  /**
   * Sign a 32-byte digest using the memory-resident private key.
   *
   * The `digest` must be exactly 32 bytes long. This method performs an
   * ECDSA (secp256k1) signature using the in-memory private key and returns
   * a `Signature` instance with canonical `r`/`s` values and the
   * recovery `v` value.
   *
   * @param {BytesLike} digest - 32-byte digest to sign (hex string, byte array, or Uint8Array)
   * @returns {Signature} An `ethers` `Signature` object containing `r`, `s`, and `v`.
   */
  sign (digest) {
    assertArgument(
      dataLength(digest) === 32,
      'invalid digest length',
      'digest',
      digest
    )

    const sig = secp256k1.sign(getBytesCopy(digest), this._privateKeyBuffer, {
      lowS: true
    })

    return Signature.from({
      r: toBeHex(sig.r, 32),
      s: toBeHex(sig.s, 32),
      v: sig.recovery ? 0x1c : 0x1b
    })
  }

  /**
   * Wipe and clear the in-memory private key material.
   *
   * This method securely overwrites the private key buffer using
   * `sodium_memzero` and then removes the reference so the buffer can be
   * garbage-collected. Call this when the signing key must no longer reside
   * in memory.
   *
   * @returns {void}
   */
  dispose () {
    sodium_memzero(this._privateKeyBuffer)

    this._privateKeyBuffer = undefined
  }
}
