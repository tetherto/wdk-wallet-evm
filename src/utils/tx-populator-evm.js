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

import { ValueError } from '@tetherto/wdk-wallet'

import { Signature, toQuantity } from 'ethers'

/** @typedef {import('ethers').Provider} Provider */
/** @typedef {import('ethers').AuthorizationLike} AuthorizationLike */

/**
 * A fully or partially specified EVM transaction, prior to signing.
 *
 * @typedef {Object} UnsignedEvmTransaction
 * @property {number} chainId - The id of the chain the transaction targets.
 * @property {number} nonce - The sender's transaction count, used to order transactions.
 * @property {string} from - The sender's address.
 * @property {string|null} to - The recipient's address, or null for contract creation.
 * @property {string} data - The transaction's calldata as a hex string.
 * @property {number|bigint} value - The amount of native currency (in wei) to transfer.
 * @property {number} type - The EIP-2718 transaction type (0/1 legacy, 2 EIP-1559, 4 EIP-7702).
 * @property {number|bigint} gasLimit - The maximum amount of gas the transaction may consume.
 * @property {number|bigint} [gasPrice] - The gas price (in wei) for legacy (type 0/1) transactions.
 * @property {number|bigint} [maxFeePerGas] - The maximum total fee (in wei) per gas for EIP-1559 transactions.
 * @property {number|bigint} [maxPriorityFeePerGas] - The maximum priority fee (in wei) per gas for EIP-1559 transactions.
 * @property {any[]} [accessList] - The EIP-2930 access list of addresses and storage keys.
 * @property {AuthorizationLike[]} [authorizationList] - The EIP-7702 authorization tuples.
 */

/**
 * Whether the given transaction is an EIP-4844 (type 3) blob transaction.
 *
 * @param {UnsignedEvmTransaction} tx - The transaction to inspect.
 * @returns {boolean} True if the transaction explicitly targets type 3, or carries any blob field.
 */
export function isBlobTransaction (tx) {
  const hasBlobs = (
    ('blobs' in tx && tx.blobs != null) ||
    ('blobVersionedHashes' in tx && tx.blobVersionedHashes != null) ||
    ('maxFeePerBlobGas' in tx && tx.maxFeePerBlobGas != null)
  )

  return Number(tx.type) === 3 || hasBlobs
}

/**
 * Build a fully populated unsigned transaction ready for signing.
 *
 * Resolves chain ID, nonce, gas limit and fee fields from the provider when not
 * explicitly supplied in `tx`. Supports legacy (type 0/1), EIP-1559 (type 2) and
 * EIP-7702 (type 4) transaction styles. EIP-4844 (type 3) blob transactions are
 * not supported.
 *
 * @param {Provider} provider - An ethers-compatible JSON-RPC provider.
 * @param {string} from - The sender address.
 * @param {UnsignedEvmTransaction} tx - The partial transaction to populate.
 * @returns {Promise<UnsignedEvmTransaction>} The fully populated unsigned transaction.
 * @throws {ValueError} If the transaction mixes fee fields that its type doesn't support, or if it is an EIP-4844 (type 3) blob transaction.
 */
export async function populateTransactionEvm (provider, from, tx) {
  const net = await provider.getNetwork()
  const chainId = Number(net.chainId)

  const has1559 = (tx.maxFeePerGas != null || tx.maxPriorityFeePerGas != null)
  const hasLegacy = (tx.gasPrice != null)
  const hasAccessList = (tx.accessList != null && Array.isArray(tx.accessList))
  const hasAuthList = (tx.authorizationList != null && Array.isArray(tx.authorizationList))

  const explicitType = (tx.type != null) ? Number(tx.type) : null

  if ((explicitType === 2 || (explicitType == null && has1559)) && hasLegacy) {
    throw new ValueError('eip-1559 transaction does not support gasPrice')
  }
  if ((explicitType === 0 || explicitType === 1) && has1559) {
    throw new ValueError('pre-eip-1559 transaction does not support maxFeePerGas/maxPriorityFeePerGas')
  }
  if (isBlobTransaction(tx)) {
    throw new ValueError('eip-4844 blob transactions are not supported')
  }

  const feeData = await provider.getFeeData()

  let type = explicitType
  if (type == null) {
    if (hasAuthList) {
      type = 4
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

  // Type 4 (EIP-7702) and future types; pass-through
  populated.type = type
  if (hasAccessList) populated.accessList = tx.accessList
  if (hasLegacy) {
    populated.gasPrice = tx.gasPrice
  } else {
    populated.maxFeePerGas = tx.maxFeePerGas ?? feeData.maxFeePerGas
    populated.maxPriorityFeePerGas = tx.maxPriorityFeePerGas ?? feeData.maxPriorityFeePerGas
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
