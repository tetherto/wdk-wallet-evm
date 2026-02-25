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

import {
  assert,
  assertArgument,
  assertPrivate,
  BaseWallet,
  computeHmac,
  dataSlice,
  defineProperties,
  getBytes,
  getNumber,
  hexlify,
  isBytesLike,
  ripemd160,
  sha256
} from 'ethers'

import * as secp256k1 from '@noble/secp256k1'

import MemorySafeSigningKey from './signing-key.js'

/** @typedef {import("ethers").SigningKey} SigningKey */
/** @typedef {import("ethers").Provider} Provider */
/** @typedef {import("ethers").BytesLike} BytesLike */

const MasterSecret = new Uint8Array([
  66, 105, 116, 99, 111, 105, 110, 32, 115, 101, 101, 100
])

const HardenedBit = 0x80000000

const _guard = {}

/**
 * Serializes input and computes HMAC-SHA512 for BIP-32 child key derivation (IL, IR split).
 *
 * @param {number} index Child index (BIP-32, 0..2^32-1; plus HardenedBit=0x80000000 for hardened).
 * @param {string} chainCode 32-byte chain code.
 * @param {string} publicKey Compressed public key (Uint8Array or hex string).
 * @param {Uint8Array | null} privateKeyBuffer 32-byte private key buffer (required for hardened).
 * @returns {{ IL: Uint8Array, IR: Uint8Array }} Object with left (IL) and right (IR) 32-byte buffers from HMAC output.
 */
function serI (index, chainCode, publicKey, privateKeyBuffer) {
  const data = new Uint8Array(37)

  if (index & HardenedBit) {
    assert(
      privateKeyBuffer != null,
      'cannot derive child of neutered node',
      'UNSUPPORTED_OPERATION',
      {
        operation: 'deriveChild'
      }
    )

    data.set(getBytes(privateKeyBuffer), 1)
  } else {
    data.set(getBytes(publicKey))
  }

  for (let i = 24; i >= 0; i -= 8) {
    data[33 + (i >> 3)] = (index >> (24 - i)) & 0xff
  }
  const I = getBytes(computeHmac('sha512', chainCode, data))

  return { IL: I.slice(0, 32), IR: I.slice(32) }
}

/**
 * Utility function to derive a child HD wallet node along a BIP-32 path from a given node.
 *
 * @param {MemorySafeHDNodeWallet} node The starting HD wallet node.
 * @param {string} path BIP-32 derivation path (e.g. "m/44'/60'/0'/0/0").
 * @returns {MemorySafeHDNodeWallet} Derived HD wallet node.
 */
function derivePath (node, path) {
  const components = path.split('/')

  assertArgument(components.length > 0, 'invalid path', 'path', path)

  if (components[0] === 'm') {
    assertArgument(
      node.depth === 0,
      `cannot derive root path (i.e. path starting with "m/") for a node at non-zero depth ${node.depth}`,
      'path',
      path
    )
    components.shift()
  }

  let result = node
  for (let i = 0; i < components.length; i++) {
    const component = components[i]

    if (component.match(/^[0-9]+'$/)) {
      const index = parseInt(component.substring(0, component.length - 1))
      assertArgument(
        index < HardenedBit,
        'invalid path index',
        `path[${i}]`,
        component
      )
      result = result.deriveChild(HardenedBit + index)
    } else if (component.match(/^[0-9]+$/)) {
      const index = parseInt(component)
      assertArgument(
        index < HardenedBit,
        'invalid path index',
        `path[${i}]`,
        component
      )
      result = result.deriveChild(index)
    } else {
      assertArgument(false, 'invalid path component', `path[${i}]`, component)
    }
  }

  return result
}

/**
 * Adds two 32-byte private key buffers (in-place) with carry, used for BIP-32 child key derivation.
 *
 * @param {Uint8Array} privateKey 32-byte private key buffer to modify (in-place sum).
 * @param {Uint8Array} x 32-byte buffer to add to privateKey.
 * @returns {boolean} `true` if there was an overflow (carry out), `false` otherwise.
 */
function addToPrivateKey (privateKey, x) {
  let carry = 0

  for (let i = 31; i >= 0; i--) {
    const sum = privateKey[i] + x[i] + carry
    privateKey[i] = sum & 0xff
    carry = sum >> 8
  }

  return carry > 0
}

/**
 * Subtracts the secp256k1 curve order from the given private key buffer in-place.
 *
 * @param {Uint8Array} privateKey 32-byte private key buffer to modify.
 */
function subtractCurveOrderFromPrivateKey (privateKey) {
  let carry = 0

  for (let i = 31; i >= 0; i--) {
    const curveOrderByte = Number(
      (secp256k1.CURVE.n >> BigInt(8 * (31 - i))) & 0xffn
    )
    const diff = privateKey[i] - curveOrderByte - carry
    privateKey[i] = diff < 0 ? diff + 256 : diff
    carry = diff < 0 ? 1 : 0
  }
}

/**
 * Compares a 32-byte buffer (optionally at an offset) with the secp256k1 curve order.
 *
 * @param {Uint8Array} buffer Buffer containing the value to compare.
 * @param {number} [offset=0] Optional offset into the buffer.
 * @returns {number} 1 if buffer > curve order, -1 if buffer < curve order, 0 if equal.
 */
function compareWithCurveOrder (buffer, offset = 0) {
  for (let i = 0; i < 32; i++) {
    const curveOrderByte = Number(
      (secp256k1.CURVE.n >> BigInt(8 * (31 - i))) & 0xffn
    )
    if (buffer[offset + i] > curveOrderByte) return 1
    if (buffer[offset + i] < curveOrderByte) return -1
  }

  return 0
}

/**
 * @internal
 */
export default class MemorySafeHDNodeWallet extends BaseWallet {
  /** @type {string} */ publicKey
  /** @type {string} */ parentFingerprint
  /** @type {string} */ fingerprint
  /** @type {string} */ chainCode
  /** @type {string} */ path
  /** @type {number} */ index
  /** @type {number} */ depth
  /** @type {string} */ mnemonic

  /**
   * Constructor for hierarchical deterministic (HD) wallet node with memory-safe signing.
   *
   * @param {{}} guard Internal instantiation guard to prevent external construction.
   * @param {MemorySafeSigningKey} signingKey
   * @param {string} parentFingerprint
   * @param {string} chainCode
   * @param {string} path
   * @param {number} index
   * @param {number} depth
   * @param {string} mnemonic
   * @param {null | Provider} [provider]
   */
  constructor (
    guard,
    signingKey,
    parentFingerprint,
    chainCode,
    path,
    index,
    depth,
    mnemonic,
    provider
  ) {
    super(signingKey, provider)
    assertPrivate(guard, _guard, 'MemorySafeHDNodeWallet')

    /**
     * @type {MemorySafeHDNodeWallet}
     */
    const self = this

    defineProperties(self, {
      publicKey: signingKey.compressedPublicKey
    })

    const fingerprint = dataSlice(ripemd160(sha256(this.publicKey)), 0, 4)
    defineProperties(self, {
      parentFingerprint,
      fingerprint,
      chainCode,
      path,
      index,
      depth
    })

    defineProperties(self, { mnemonic })
  }

  /**
   * Returns the memory-safe signing key for this wallet instance. This overrides the accessor from BaseWallet to provide a MemorySafeSigningKey.
   *
   * @return {MemorySafeSigningKey}
   */
  get signingKey () {
    return this.signingKey
  }

  /**
   * Returns a new MemorySafeHDNodeWallet instance connected to the specified provider.
   *
   * @param {Provider | null} provider Provider instance to connect the wallet instance to a network.
   * @returns {MemorySafeHDNodeWallet} New wallet instance connected to the provider.
   */
  connect (provider) {
    return new MemorySafeHDNodeWallet(
      _guard,
      this.signingKey,
      this.parentFingerprint,
      this.chainCode,
      this.path,
      this.index,
      this.depth,
      this.mnemonic,
      provider
    )
  }

  get privateKeyBuffer () {
    return this.signingKey.privateKeyBuffer
  }

  get publicKeyBuffer () {
    return this.signingKey.publicKeyBuffer
  }

  /**
   * Derives a direct child HD wallet node at the given index.
   *
   * @param {number} _index Child index (BIP-32, 0..2^32-1; plus HardenedBit=0x80000000 for hardened).
   * @returns {MemorySafeHDNodeWallet} Derived child HD wallet node.
   */
  deriveChild (_index) {
    const index = getNumber(_index, 'index')
    assertArgument(index <= 0xffffffff, 'invalid index', 'index', index)

    let path = this.path
    if (path) {
      path += '/' + (index & ~HardenedBit)
      if (index & HardenedBit) {
        path += "'"
      }
    }

    const { IR, IL } = serI(
      index,
      this.chainCode,
      this.publicKey,
      this.privateKeyBuffer
    )

    const overflow = addToPrivateKey(this.privateKeyBuffer, IL)

    if (overflow || compareWithCurveOrder(this.privateKeyBuffer) >= 0) {
      subtractCurveOrderFromPrivateKey(this.privateKeyBuffer)
    }

    const ki = new MemorySafeSigningKey(this.privateKeyBuffer)

    return new MemorySafeHDNodeWallet(
      _guard,
      ki,
      this.fingerprint,
      hexlify(IR),
      path,
      index,
      this.depth + 1,
      this.mnemonic,
      this.provider
    )
  }

  /**
   * Derives a child HD wallet node along the given BIP-32 path.
   *
   * @param {string} path BIP-32 derivation path (e.g. "m/44'/60'/0'/0/0")
   * @returns {MemorySafeHDNodeWallet} Derived HD wallet node
   */
  derivePath (path) {
    return derivePath(this, path)
  }

  /**
   * Securely wipes sensitive key material from this wallet.
   */
  dispose () {
    this.signingKey.dispose()
  }

  /**
   * Creates a new MemorySafeHDNodeWallet from a BIP-32 seed and optional mnemonic.
   *
   * @param {BytesLike} seed BIP-32 seed (16-64 bytes, hex or Uint8Array)
   * @returns {MemorySafeHDNodeWallet} New HD wallet instance
   */
  static fromSeed (seed) {
    return MemorySafeHDNodeWallet._fromSeed(seed, null)
  }

  /**
   * Underlying logic function for the public fromSeed().
   *
   * @private
   * @param {BytesLike} _seed BIP-32 seed (16-64 bytes, hex or Uint8Array).
   * @param {string} mnemonic BIP-39 mnemonic or object.
   * @returns {MemorySafeHDNodeWallet} New HD wallet instance.
   */
  static _fromSeed (_seed, mnemonic) {
    assertArgument(isBytesLike(_seed), 'invalid seed', 'seed', '[REDACTED]')

    const seed = getBytes(_seed, 'seed')
    assertArgument(
      seed.length >= 16 && seed.length <= 64,
      'invalid seed',
      'seed',
      '[REDACTED]'
    )

    const I = getBytes(computeHmac('sha512', MasterSecret, seed))
    const signingKey = new MemorySafeSigningKey(I.slice(0, 32))

    return new MemorySafeHDNodeWallet(
      _guard,
      signingKey,
      '0x00000000',
      hexlify(I.slice(32)),
      'm',
      0,
      0,
      mnemonic,
      null
    )
  }
}
