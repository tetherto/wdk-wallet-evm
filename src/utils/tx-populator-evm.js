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

import { Signature, toQuantity } from 'ethers'

/**
 * @typedef {Object} UnsignedEvmTransaction
 * @property {number} chainId
 * @property {number} nonce
 * @property {string} from
 * @property {string|null} to
 * @property {string} data
 * @property {number|bigint} value
 * @property {number} type
 * @property {number|bigint} gasLimit
 * @property {number|bigint} [gasPrice]
 * @property {number|bigint} [maxFeePerGas]
 * @property {number|bigint} [maxPriorityFeePerGas]
 * @property {any[]} [accessList]
 * @property {number|bigint} [maxFeePerBlobGas]
 * @property {any[]} [blobs]
 * @property {string[]} [blobVersionedHashes]
 * @property {import('ethers').AuthorizationLike[]} [authorizationList]
 */

/**
 * Build a fully populated unsigned transaction ready for signing.
 *
 * Resolves chain ID, nonce, gas limit and fee fields from the provider when not
 * explicitly supplied in `tx`. Supports legacy (type 0/1), EIP-1559 (type 2),
 * EIP-4844 (type 3) and EIP-7702 (type 4) transaction styles.
 *
 * @param {import('ethers').Provider} provider - An ethers-compatible JSON-RPC provider.
 * @param {string} from - The sender address.
 * @param {UnsignedEvmTransaction} tx - The partial transaction to populate.
 * @returns {Promise<UnsignedEvmTransaction>} The fully populated unsigned transaction.
 */
export async function populateTransactionEvm (provider, from, tx) {
  const net = await provider.getNetwork()
  const chainId = Number(net.chainId)

  const has1559 = (tx.maxFeePerGas != null || tx.maxPriorityFeePerGas != null)
  const hasLegacy = (tx.gasPrice != null)
  const hasAccessList = (tx.accessList != null && Array.isArray(tx.accessList))
  const hasBlobs = (tx.blobs != null || tx.blobVersionedHashes != null || tx.maxFeePerBlobGas != null)
  const hasAuthList = (tx.authorizationList != null && Array.isArray(tx.authorizationList))

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
    if (hasAuthList) {
      type = 4
    } else if (hasBlobs) {
      type = 3
    } else if (feeData.maxFeePerGas != null && feeData.maxPriorityFeePerGas != null) {
      type = 2
    } else {
      type = 0
    }
  }

  let gasLimit
  if (tx.gasLimit != null) {
    gasLimit = tx.gasLimit
  } else if (hasAuthList) {
    gasLimit = await _estimateGasWithAuthList(provider, { from, ...tx })
  } else {
    gasLimit = await provider.estimateGas({ from, to: tx.to ?? null, data: tx.data ?? '0x', value: tx.value ?? 0 })
  }

  const populated = {
    from,
    to: tx.to ?? null,
    data: tx.data ?? '0x',
    value: tx.value ?? 0,
    chainId,
    nonce: (tx.nonce != null) ? Number(tx.nonce) : Number(await provider.getTransactionCount(from, 'pending')),
    gasLimit
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

  // Type 4 (EIP-7702) and future types; pass-through
  populated.type = type
  if (hasAccessList) populated.accessList = tx.accessList
  if (hasLegacy) {
    populated.gasPrice = tx.gasPrice
  } else {
    populated.maxFeePerGas = tx.maxFeePerGas ?? feeData.maxFeePerGas
    populated.maxPriorityFeePerGas = tx.maxPriorityFeePerGas ?? feeData.maxPriorityFeePerGas
  }
  if (hasBlobs) {
    populated.maxFeePerBlobGas = tx.maxFeePerBlobGas
    if (tx.blobs != null) populated.blobs = tx.blobs
    if (tx.blobVersionedHashes != null) populated.blobVersionedHashes = tx.blobVersionedHashes
  }
  if (tx.authorizationList != null) populated.authorizationList = tx.authorizationList

  return populated
}

async function _estimateGasWithAuthList (provider, { from, to, value, data, authorizationList }) {
  const formatAuth = (auth) => {
    const { address, nonce, chainId } = auth
    const signature = auth.signature instanceof Signature
      ? auth.signature
      : Signature.from(auth.signature)
    return {
      address,
      nonce: toQuantity(nonce),
      chainId: toQuantity(chainId),
      r: toQuantity(signature.r),
      s: toQuantity(signature.s),
      yParity: toQuantity(signature.yParity)
    }
  }
  const rpcTx = {
    from,
    to,
    value: toQuantity(value ?? 0),
    data: data ?? '0x',
    type: '0x04',
    authorizationList: authorizationList.map(formatAuth)
  }
  const result = await provider.send('eth_estimateGas', [rpcTx])
  return BigInt(result)
}
