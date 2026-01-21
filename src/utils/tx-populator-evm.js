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

/** @typedef {import('../wallet-account-read-only-evm.js').EvmTransaction} EvmTransaction */

/**
 * A fully-populated unsigned EVM transaction suitable for signing.
 * This shape is produced by `populateTransactionEvm` and consumed by signer implementations.
 *
 * - Exactly one of `gasPrice` or (`maxFeePerGas` + `maxPriorityFeePerGas`) is expected depending on `type`.
 * - For type 3 (EIP-4844), `maxFeePerBlobGas` is required; optional `blobs` and `blobVersionedHashes` may be present.
 *
 * @typedef {Object} UnsignedEvmTransaction
 * @property {number} chainId - Numeric chain id.
 * @property {number} nonce - Account nonce for the `from` address (pending).
 * @property {string} from - Sender address.
 * @property {string|null} to - Recipient address or null for contract creation.
 * @property {string} data - Hex-encoded call data (defaults to 0x).
 * @property {number|bigint} value - Amount to send in wei (defaults to 0).
 * @property {number} type - Transaction type: 0, 1, 2 (EIP-1559) or 3 (EIP-4844).
 * @property {number|bigint} gasLimit - Estimated or provided gas limit.
 * @property {number|bigint} [gasPrice] - Legacy gas price (type 0/1 only).
 * @property {number|bigint} [maxFeePerGas] - EIP-1559 max fee per gas (type 2/3).
 * @property {number|bigint} [maxPriorityFeePerGas] - EIP-1559 max priority fee per gas (type 2/3).
 * @property {any[]} [accessList] - Optional access list (type 1/2/3).
 * @property {number|bigint} [maxFeePerBlobGas] - EIP-4844 max fee per blob gas (type 3).
 * @property {any[]} [blobs] - EIP-4844 blobs (type 3 optional).
 * @property {string[]} [blobVersionedHashes] - EIP-4844 blob versioned hashes (type 3 optional).
 */

/**
 * Populates a raw EVM transaction object with derived fields based on the connected network and
 * user-provided parameters. It automatically chooses between legacy (type 0/1), EIP-1559 (type 2)
 * and EIP-4844 (type 3) styles, validates incompatible fee fields, and fills in missing values
 * like nonce, gas limit and fee parameters.
 *
 * - If `tx.type` is unspecified, the function detects support for EIP-1559/4844 using provider fee
 *   data and the presence of blob fields.
 * - When EIP-1559 fields are provided, legacy `gasPrice` is rejected and vice versa.
 *
 * @param {import('ethers').Provider} provider - The ethers provider.
 * @param {string} from - The sender address.
 * @param {EvmTransaction} tx - The partial transaction to populate.
 * @returns {Promise<UnsignedEvmTransaction>} The fully populated transaction.
 */
export async function populateTransactionEvm (provider, from, tx) {
  const net = await provider.getNetwork()
  const chainId = Number(net.chainId)

  const has1559 = (tx.maxFeePerGas != null || tx.maxPriorityFeePerGas != null)
  const hasLegacy = (tx.gasPrice != null)
  const hasAccessList = (tx.accessList != null && Array.isArray(tx.accessList))
  const hasBlobs = (tx.blobs != null || tx.blobVersionedHashes != null || tx.maxFeePerBlobGas != null)

  const explicitType = (tx.type != null) ? Number(tx.type) : null

  if ((explicitType === 2 || (explicitType == null && has1559)) && hasLegacy) {
    throw new Error('eip-1559 transaction does not support gasPrice')
  }
  if ((explicitType === 0 || explicitType === 1) && has1559) {
    throw new Error('pre-eip-1559 transaction does not support maxFeePerGas/maxPriorityFeePerGas')
  }
  if ((explicitType === 3 || hasBlobs) && hasLegacy) {
    throw new Error('blob transaction does not support gasPrice')
  }

  const feeData = await provider.getFeeData()

  let type = explicitType
  if (type == null) {
    if (hasBlobs) {
      type = 3
    } else if (feeData.maxFeePerGas != null && feeData.maxPriorityFeePerGas != null) {
      type = 2
    } else {
      type = 0
    }
  }

  const populated = {
    from,
    to: tx.to ?? null,
    data: tx.data ?? '0x',
    value: tx.value ?? 0,
    chainId,
    nonce: (tx.nonce != null) ? Number(tx.nonce) : Number(await provider.getTransactionCount(from, 'pending')),
    gasLimit: (tx.gasLimit != null)
      ? tx.gasLimit
      : await provider.estimateGas({ from, to: tx.to ?? null, data: tx.data ?? '0x', value: tx.value ?? 0 })
  }

  if (type === 0 || type === 1) {
    populated.type = type
    populated.gasPrice = tx.gasPrice ?? feeData.gasPrice ?? feeData.maxFeePerGas
    if (type === 1 && hasAccessList) populated.accessList = tx.accessList
    return populated
  }

  if (type === 2) {
    populated.type = 2
    if (tx.gasPrice != null) {
      populated.maxFeePerGas = tx.gasPrice
      populated.maxPriorityFeePerGas = tx.gasPrice
    } else {
      populated.maxFeePerGas = tx.maxFeePerGas ?? feeData.maxFeePerGas
      populated.maxPriorityFeePerGas = tx.maxPriorityFeePerGas ?? feeData.maxPriorityFeePerGas
    }
    if (hasAccessList) populated.accessList = tx.accessList
    return populated
  }

  if (type === 3) {
    populated.type = 3
    populated.maxFeePerGas = tx.maxFeePerGas ?? feeData.maxFeePerGas
    populated.maxPriorityFeePerGas = tx.maxPriorityFeePerGas ?? feeData.maxPriorityFeePerGas
    if (tx.maxFeePerBlobGas == null) throw new Error('maxFeePerBlobGas is required for type 3 transactions')
    populated.maxFeePerBlobGas = tx.maxFeePerBlobGas
    if (tx.blobs != null) populated.blobs = tx.blobs
    if (tx.blobVersionedHashes != null) populated.blobVersionedHashes = tx.blobVersionedHashes
    if (hasAccessList) populated.accessList = tx.accessList
    return populated
  }

  // Future types; pass-through
  populated.type = type
  if (hasAccessList) populated.accessList = tx.accessList
  if (hasLegacy) populated.gasPrice = tx.gasPrice
  if (has1559) {
    populated.maxFeePerGas = tx.maxFeePerGas
    populated.maxPriorityFeePerGas = tx.maxPriorityFeePerGas
  }
  if (hasBlobs) {
    populated.maxFeePerBlobGas = tx.maxFeePerBlobGas
    if (tx.blobs != null) populated.blobs = tx.blobs
    if (tx.blobVersionedHashes != null) populated.blobVersionedHashes = tx.blobVersionedHashes
  }

  return populated
}
