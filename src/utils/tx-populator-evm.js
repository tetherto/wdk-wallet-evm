'use strict'

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
