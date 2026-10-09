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
import { TypedDataEncoder } from 'ethers'

/** @typedef {`0x${string}`} Hex */
/** @typedef {import('./wallet-account-read-only-evm.js').TypedData} TypedData */
/** @typedef {import('ethers').TypedDataDomain} TypedDataDomain */
/** @typedef {import('ethers').TypedDataField} TypedDataField */
/** @typedef {Pick<import('./wallet-account-evm.js').default, 'getAddress' | 'signTypedData'>} SigningAccount */
/**
 * @typedef {Object} ClientSigningInput
 * @property {Record<string, unknown>} domain
 * @property {Record<string, unknown>} types
 * @property {string} primaryType
 * @property {Record<string, unknown>} message
 */
/**
 * @typedef {Object} ClientSignerProjection
 * @property {Hex} address
 * @property {(input: ClientSigningInput) => Promise<Hex>} signTypedData
 */

/** @param {unknown} value @returns {value is Hex} */
function isHex (value) {
  return typeof value === 'string' && /^0x(?:[0-9a-fA-F]{2})+$/.test(value)
}

/** @param {ClientSigningInput} input @returns {TypedData} */
function toTypedData ({ domain, types, primaryType, message }) {
  /** @type {TypedDataDomain} */
  const mappedDomain = {}
  for (const [key, value] of Object.entries(domain)) {
    if (value == null) continue
    switch (key) {
      case 'name': case 'version': case 'verifyingContract':
        if (typeof value !== 'string') throw new TypeError('Invalid typed data domain')
        mappedDomain[key] = value
        break
      case 'chainId':
        if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'bigint') {
          throw new TypeError('Invalid typed data chainId')
        }
        mappedDomain.chainId = value
        break
      case 'salt':
        if (!isHex(value) || value.length !== 66) throw new TypeError('Invalid typed data salt')
        mappedDomain.salt = value
        break
      default: throw new TypeError('Unsupported typed data domain field')
    }
  }
  /** @type {Record<string, TypedDataField[]>} */
  const mappedTypes = Object.create(null)
  for (const [name, fields] of Object.entries(types)) {
    if (!Array.isArray(fields)) throw new TypeError('Invalid typed data fields')
    mappedTypes[name] = fields.map(/** @param {unknown} field */ field => {
      if (field === null || typeof field !== 'object' ||
          !('name' in field) || !('type' in field) ||
          typeof field.name !== 'string' || typeof field.type !== 'string') {
        throw new TypeError('Invalid typed data field')
      }
      return { name: field.name, type: field.type }
    })
  }
  // ethers derives the root type; never silently discard a conflicting primaryType.
  if (TypedDataEncoder.getPrimaryType(mappedTypes) !== primaryType) {
    throw new TypeError('Typed data primaryType mismatch')
  }
  return { domain: mappedDomain, types: mappedTypes, message }
}

/**
 * Resolves an asynchronous WDK account into the required x402 signing surface.
 * Does not add transaction, approval, or read capabilities. Recreate after key rotation.
 *
 * @param {SigningAccount} account - The account providing async address and signing methods.
 * @returns {Promise<ClientSignerProjection>} An address snapshot and bound signing method.
 * @throws {TypeError} If the address, typed data, or returned signature is invalid.
 */
export async function createX402Signer (account) {
  const address = await account.getAddress()
  if (!isHex(address) || address.length !== 42) throw new TypeError('Invalid EVM address')
  return Object.freeze({
    address,
    /** @param {ClientSigningInput} input @returns {Promise<Hex>} */
    async signTypedData (input) {
      const signature = await account.signTypedData(toTypedData(input))
      if (!isHex(signature)) throw new TypeError('Invalid hex signature')
      return signature
    }
  })
}
