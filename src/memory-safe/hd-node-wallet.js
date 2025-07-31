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
  assert, assertArgument, assertPrivate, BaseWallet, computeHmac, dataSlice, defineProperties,
  getBytes, getNumber, hexlify, isBytesLike, ripemd160, sha256
} from 'ethers'

import * as secp256k1 from '@noble/secp256k1'

import MemorySafeSigningKey from './signing-key.js'

const MasterSecret = new Uint8Array([66, 105, 116, 99, 111, 105, 110, 32, 115, 101, 101, 100])

const HardenedBit = 0x80000000

const _guard = { }

// eslint-disable-next-line camelcase
function ser_I (index, chainCode, publicKey, privateKeyBuffer) {
  const data = new Uint8Array(37)

  if (index & HardenedBit) {
    assert(privateKeyBuffer != null, 'cannot derive child of neutered node', 'UNSUPPORTED_OPERATION', {
      operation: 'deriveChild'
    })

    data.set(getBytes(privateKeyBuffer), 1)
  } else {
    data.set(getBytes(publicKey))
  }

  for (let i = 24; i >= 0; i -= 8) { data[33 + (i >> 3)] = ((index >> (24 - i)) & 0xff) }
  const I = getBytes(computeHmac('sha512', chainCode, data))

  return { IL: I.slice(0, 32), IR: I.slice(32) }
}

function derivePath (node, path) {
  const components = path.split('/')

  assertArgument(components.length > 0, 'invalid path', 'path', path)

  if (components[0] === 'm') {
    assertArgument(node.depth === 0, `cannot derive root path (i.e. path starting with "m/") for a node at non-zero depth ${node.depth}`, 'path', path)
    components.shift()
  }

  let result = node
  for (let i = 0; i < components.length; i++) {
    const component = components[i]

    if (component.match(/^[0-9]+'$/)) {
      const index = parseInt(component.substring(0, component.length - 1))
      assertArgument(index < HardenedBit, 'invalid path index', `path[${i}]`, component)
      result = result.deriveChild(HardenedBit + index)
    } else if (component.match(/^[0-9]+$/)) {
      const index = parseInt(component)
      assertArgument(index < HardenedBit, 'invalid path index', `path[${i}]`, component)
      result = result.deriveChild(index)
    } else {
      assertArgument(false, 'invalid path component', `path[${i}]`, component)
    }
  }

  return result
}

function addToPrivateKey (privateKey, x) {
  let carry = 0

  for (let i = 31; i >= 0; i--) {
    const sum = privateKey[i] + x[i] + carry
    privateKey[i] = sum & 0xff
    carry = sum >> 8
  }

  return carry > 0
}

function subtractCurveOrderFromPrivateKey (privateKey) {
  let carry = 0

  for (let i = 31; i >= 0; i--) {
    const curveOrderByte = Number((secp256k1.CURVE.n >> BigInt(8 * (31 - i))) & 0xffn)
    const diff = privateKey[i] - curveOrderByte - carry
    privateKey[i] = diff < 0 ? diff + 256 : diff
    carry = diff < 0 ? 1 : 0
  }
}

function compareWithCurveOrder (buffer, offset = 0) {
  for (let i = 0; i < 32; i++) {
    const curveOrderByte = Number((secp256k1.CURVE.n >> BigInt(8 * (31 - i))) & 0xffn)
    if (buffer[offset + i] > curveOrderByte) return 1
    if (buffer[offset + i] < curveOrderByte) return -1
  }

  return 0
}

export default class MemorySafeHDNodeWallet extends BaseWallet {
  constructor (guard, signingKey, parentFingerprint, chainCode, path, index, depth, mnemonic, provider) {
    super(signingKey, provider)
    assertPrivate(guard, _guard, 'MemorySafeHDNodeWallet')

    defineProperties(this, { publicKey: signingKey.compressedPublicKey })

    const fingerprint = dataSlice(ripemd160(sha256(this.publicKey)), 0, 4)
    defineProperties(this, {
      parentFingerprint,
      fingerprint,
      chainCode,
      path,
      index,
      depth
    })

    defineProperties(this, { mnemonic })
  }

  connect (provider) {
    return new MemorySafeHDNodeWallet(_guard, this.signingKey, this.parentFingerprint,
      this.chainCode, this.path, this.index, this.depth, this.mnemonic, provider)
  }

  get privateKeyBuffer () {
    return this.signingKey.privateKeyBuffer
  }

  get publicKeyBuffer () {
    return this.signingKey.publicKeyBuffer
  }

  deriveChild (_index) {
    const index = getNumber(_index, 'index')
    assertArgument(index <= 0xffffffff, 'invalid index', 'index', index)

    let path = this.path
    if (path) {
      path += '/' + (index & ~HardenedBit)
      if (index & HardenedBit) { path += "'" }
    }

    const { IR, IL } = ser_I(index, this.chainCode, this.publicKey, this.privateKeyBuffer)

    const overflow = addToPrivateKey(this.privateKeyBuffer, IL)

    if (overflow || compareWithCurveOrder(this.privateKeyBuffer) >= 0) {
      subtractCurveOrderFromPrivateKey(this.privateKeyBuffer)
    }

    const ki = new MemorySafeSigningKey(this.privateKeyBuffer)

    return new MemorySafeHDNodeWallet(_guard, ki, this.fingerprint, hexlify(IR),
      path, index, this.depth + 1, this.mnemonic, this.provider)
  }

  derivePath (path) {
    return derivePath(this, path)
  }

  dispose () {
    this.signingKey.dispose()
  }

  static fromSeed (seed) {
    return MemorySafeHDNodeWallet.#fromSeed(seed, null)
  }

  static #fromSeed (_seed, mnemonic) {
    assertArgument(isBytesLike(_seed), 'invalid seed', 'seed', '[REDACTED]')

    const seed = getBytes(_seed, 'seed')
    assertArgument(seed.length >= 16 && seed.length <= 64, 'invalid seed', 'seed', '[REDACTED]')

    const I = getBytes(computeHmac('sha512', MasterSecret, seed))
    const signingKey = new MemorySafeSigningKey(I.slice(0, 32))

    return new MemorySafeHDNodeWallet(_guard, signingKey, '0x00000000', hexlify(I.slice(32)),
      'm', 0, 0, mnemonic, null)
  }
}
