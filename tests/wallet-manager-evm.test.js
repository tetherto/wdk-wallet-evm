import hre from 'hardhat'

import { afterEach, beforeEach, describe, expect, test } from '@jest/globals'

import WalletManagerEvm, { WalletAccountEvm } from '../index.js'
import SeedSignerEvm from '../src/signers/seed-signer-evm.js'

const SEED_PHRASE = 'cook voyage document eight skate token alien guide drink uncle term abuse'

describe('WalletManagerEvm', () => {
  let wallet

  beforeEach(async () => {
    const root = new SeedSignerEvm(SEED_PHRASE)
    wallet = new WalletManagerEvm(root, { provider: hre.network.provider })
  })

  afterEach(() => {
    wallet.dispose()
  })

  describe('getAccount', () => {
    test('should return the account at index 0 by default', async () => {
      const account = await wallet.getAccount()

      expect(account).toBeInstanceOf(WalletAccountEvm)

      expect(account.path).toBe("m/44'/60'/0'/0/0")
    })

    test('should return the account at the given index', async () => {
      const account = await wallet.getAccount(3)

      expect(account).toBeInstanceOf(WalletAccountEvm)

      expect(account.path).toBe("m/44'/60'/0'/0/3")
    })

    test('should throw if the index is a negative number', async () => {
      await expect(wallet.getAccount(-1))
        .rejects.toThrow('invalid path component')
    })
  })

  describe('getAccountByPath', () => {
    test('should return the account with the given path', async () => {
      const account = await wallet.getAccountByPath("1'/2/3")

      expect(account).toBeInstanceOf(WalletAccountEvm)

      expect(account.path).toBe("m/44'/60'/1'/2/3")
    })

    test('should throw if the path is invalid', async () => {
      await expect(wallet.getAccountByPath("a'/b/c"))
        .rejects.toThrow('invalid path component')
    })
  })

  describe('getFeeRates', () => {
    test('should return the correct fee rates', async () => {
      const feeRates = await wallet.getFeeRates()

      expect(feeRates.normal).toBe(3_300_000_000n)

      expect(feeRates.fast).toBe(6_000_000_000n)
    })

    test('should throw if the wallet is not connected to a provider', async () => {
      const wallet = new WalletManagerEvm(new SeedSignerEvm(SEED_PHRASE))

      await expect(wallet.getFeeRates())
        .rejects.toThrow('The wallet must be connected to a provider to get fee rates.')
    })
  })
})
