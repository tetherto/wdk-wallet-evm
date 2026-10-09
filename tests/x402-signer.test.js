import { describe, test, expect, jest } from '@jest/globals'
import { verifyTypedData } from 'ethers'
import { WalletAccountEvm, createX402Signer } from '../index.js'

const address = '0x1111111111111111111111111111111111111111'
const input = () => ({
  domain: { name: 'ProjectionTest', version: '1', chainId: 31337, verifyingContract: address },
  types: { Payment: [{ name: 'amount', type: 'uint256' }] },
  primaryType: 'Payment', message: { amount: 1n }
})

function account (signature = '0xabcd') {
  return {
    get address () { throw new Error('Deprecated address must not be read') },
    async getAddress () { await Promise.resolve(); return address },
    async signTypedData () { return signature }
  }
}

// Async source deliberately has no synchronous address.
function source (signature = '0xabcd') {
  const result = account(signature)
  result.signTypedData = jest.fn(async function () { expect(this).toBe(result); return signature })
  return result
}

describe('createX402Signer', () => {
  test('waits for async getAddress and binds signing without reading address', async () => {
    const a = source()
    const signer = await createX402Signer(a)
    expect(signer.address).toBe(address)
    expect(await signer.signTypedData(input())).toBe('0xabcd')
    expect(Object.isFrozen(signer)).toBe(true)
    expect(Object.keys(signer).sort()).toEqual(['address', 'signTypedData'])
  })
  test.each(['', '0x', '0x1234', '0x' + 'g'.repeat(40), '11'.repeat(20), undefined])('rejects address %s before signing', async value => {
    const a = source(); a.getAddress = async () => value
    await expect(createX402Signer(a)).rejects.toThrow('Invalid EVM address')
    expect(a.signTypedData).not.toHaveBeenCalled()
  })
  test.each(['', '0x', '0xabc', '0xgg', 'abcd', undefined])('rejects non-byte hex signature %s', async value => {
    const a = source(); a.signTypedData = async () => value
    const signer = await createX402Signer(a)
    await expect(signer.signTypedData(input())).rejects.toThrow('Invalid hex signature')
  })
  test('propagates address and signing rejections', async () => {
    const a = source(); const error = new Error('Signer rejected')
    a.getAddress = async () => { throw error }
    await expect(createX402Signer(a)).rejects.toBe(error)
    a.getAddress = async () => address
    a.signTypedData = async () => { throw error }
    await expect((await createX402Signer(a)).signTypedData(input())).rejects.toBe(error)
  })
  test('maps frozen readonly fields to mutable ethers fields without modifying input', async () => {
    const a = source(); const data = input()
    Object.freeze(data.types.Payment[0]); Object.freeze(data.types.Payment); Object.freeze(data.types)
    await (await createX402Signer(a)).signTypedData(data)
    const forwarded = a.signTypedData.mock.calls[0][0]
    expect(forwarded.types).toEqual(data.types)
    expect(forwarded.types.Payment).not.toBe(data.types.Payment)
    expect(forwarded).not.toHaveProperty('primaryType')
  })
  test.each([
    d => { d.primaryType = 'Wrong' },
    d => { d.types.Payment = 'wrong' },
    d => { d.types.Payment = [{ name: 'x', type: 1 }] },
    d => { d.domain.chainId = {} },
    d => { d.domain.name = 1 },
    d => { d.domain.salt = '0xab' },
    d => { d.domain.extra = true }
  ])('rejects invalid typed data before signing', async mutate => {
    const a = source(); const data = input(); mutate(data)
    await expect((await createX402Signer(a)).signTypedData(data)).rejects.toThrow()
    expect(a.signTypedData).not.toHaveBeenCalled()
  })
  test('real WDK EOA signature verifies cryptographically offline', async () => {
    // Public deterministic fixture, never a funded key.
    const a = WalletAccountEvm.fromPrivateKey('0x' + '01'.repeat(32))
    try {
      const signer = await createX402Signer(a); const data = input()
      const sig = await signer.signTypedData(data)
      expect(verifyTypedData(data.domain, data.types, data.message, sig)).toBe(signer.address)
    } finally { a.dispose() }
  })
})
