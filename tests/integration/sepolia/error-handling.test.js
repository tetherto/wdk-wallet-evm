import { describe, expect, test } from '@jest/globals'
import WalletManagerEvm from '../../../index.js'
import { generateMnemonic } from 'bip39'
import {
  SEPOLIA_TESTNET_RPC_URL,
  TESTNET_SEED_PHRASE,
  RECEIVER
} from './helper.js'

describe('Error handling tests', () => {
  test('malformed seed should throw during wallet creation', () => {
    const badSeed = 'this is not a valid seed phrase'
    expect(() =>
      new WalletManagerEvm(badSeed, { provider: SEPOLIA_TESTNET_RPC_URL })
    ).toThrow(/invalid|seed/i)
  })
  test('invalid network provider should reject fee rate retrieval', async () => {
    if (!SEPOLIA_TESTNET_RPC_URL) {
      console.warn('⚠️ Skipping test: SEPOLIA_TESTNET_RPC_URL not set.')
      return test.skip()
    }

    const wallet = new WalletManagerEvm(
      TESTNET_SEED_PHRASE || generateMnemonic(),
      { provider: 'http://127.0.0.1:9999' }
    )

    await expect(wallet.getFeeRates()).rejects.toThrow(/network|ECONNREFUSED|fetch/i)
  })

  test('insufficient balance should reject sendTransaction', async () => {
    if (!SEPOLIA_TESTNET_RPC_URL || !RECEIVER) {
      console.warn('⚠️ Skipping test: missing TESTNET_RPC_URL or RECEIVER.')
      return test.skip()
    }

    const freshSeed = generateMnemonic()
    const wallet = new WalletManagerEvm(freshSeed, { provider: SEPOLIA_TESTNET_RPC_URL })
    const account = await wallet.getAccount(0)

    await expect(
      account.sendTransaction({ to: RECEIVER, value: 1n })
    ).rejects.toThrow(/insufficient funds|intrinsic gas|gas cost|could not coalesce/i)
  })
})