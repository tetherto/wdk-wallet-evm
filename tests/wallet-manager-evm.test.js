import hre from 'hardhat'
import { mnemonicToSeedSync } from 'bip39'
import { wordlists } from 'ethers'

import WalletManagerEvm from '../src/wallet-manager-evm.js'
import WalletAccountEvm from '../src/wallet-account-evm.js'

const SEED_PHRASE = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const INVALID_SEED_PHRASE = 'invalid seed phrase'

describe('WalletManagerEvm', () => {
  let walletManager

  beforeEach(async () => {
    const seedBytes = mnemonicToSeedSync(SEED_PHRASE)
    walletManager = new WalletManagerEvm(seedBytes, {
      provider: hre.network.provider,
    })

    await hre.network.provider.send('hardhat_reset')
  })

  afterEach(() => {
    walletManager.dispose()
  })

  test('shouwld throw if seed phrase is invalid', () => {
    expect(() => {
      new WalletManagerEvm('invalid seed phrase', "0'/0/0")
    }).toThrow()
  })

  describe('static getRandomSeedPhrase', () => {
    test('generates a valid 12-word seed phrase', () => {
      const seedPhrase = WalletManagerEvm.getRandomSeedPhrase()
      const words = seedPhrase.trim().split(/\s+/)

      expect(words).toHaveLength(12)

      words.forEach(word => expect(wordlists.en.getWordIndex(word)).not.toBe(-1))
    })

    test('validates a valid seed phrase', () => {
      expect(WalletManagerEvm.isValidSeedPhrase(SEED_PHRASE))
        .toBe(true)
    })

    test('invalidates an invalid seed phrase', () => {
      expect(WalletManagerEvm.isValidSeedPhrase(INVALID_SEED_PHRASE))
        .toBe(false)
    })
  })

  describe('static isValidSeedPhrase', () => {
    test('returns false for an invalid mnemonic', () => {
      expect(WalletManagerEvm.isValidSeedPhrase(SEED_PHRASE)).toBe(true)
    })

    test('should return false if if mnemonic is not valid', () => {
      expect(WalletManagerEvm.isValidSeedPhrase(INVALID_SEED_PHRASE)).toBe(false)
    })

    test('returns false for empty string', () => {
      expect(WalletManagerEvm.isValidSeedPhrase('')).toBe(false)
    })

    test('returns false for null', () => {
      expect(WalletManagerEvm.isValidSeedPhrase(null)).toBe(false)
    })

    test('returns false for undefined', () => {
      expect(WalletManagerEvm.isValidSeedPhrase(undefined)).toBe(false)
    })

    test('returns false for non-string input (number)', () => {
      expect(WalletManagerEvm.isValidSeedPhrase(12345)).toBe(false)
    })
  })

  describe('seed getter', () => {
    test('returns the original seed phrase used during construction', () => {
      const wallet = new WalletManagerEvm(SEED_PHRASE)
      expect(wallet.seed).toStrictEqual(mnemonicToSeedSync(SEED_PHRASE))
    })

    test('throws if constructed with an invalid seed phrase', () => {
      expect(() => new WalletManagerEvm(INVALID_SEED_PHRASE)).toThrow()
    })
  })

  describe('getAccount', () => {
    test('returns an instance of WalletAccountEvm for index 0 by default', async () => {
      const account = await walletManager.getAccount()

      expect(account).toBeInstanceOf(WalletAccountEvm)
      expect(account.index).toBe(0)
    })

    test('returns different accounts for different indices', async () => {
      const account0 = await walletManager.getAccount(0)
      const account1 = await walletManager.getAccount(1)

      expect(account0.index).toBe(0)
      expect(account1.index).toBe(1)

      expect(await account0.getAddress()).not.toBe(await account1.getAddress())
    })

    test('throws if index is negative', async () => {
      expect(walletManager.getAccount(-1)).rejects.toThrow()
    })

    test('returns same account for same index consistently', async () => {
      const accountA = await walletManager.getAccount(5)
      const accountB = await walletManager.getAccount(5)

      expect(await accountA.getAddress()).toBe(await accountB.getAddress())
    })
  })

  describe('getAccountByPath', () => {
    test('returns an instance of WalletAccountEvm with correct path', async () => {
      const account = await walletManager.getAccountByPath("0'/0/0")

      expect(account.path).toBe("m/44'/60'/0'/0/0")
    })

    test('throws if path is missing or invalid', async () => {
      expect(walletManager.getAccountByPath(undefined)).rejects.toThrow()
    })
  })

  describe('getFeeRates', () => {
    test('should calculate normal and fast fee rates', async () => {
      const feeRates = await walletManager.getFeeRates()

      expect(feeRates).toHaveProperty('normal')
      expect(feeRates).toHaveProperty('fast')

      expect(feeRates.normal).toBeGreaterThan(0)
      expect(feeRates.fast).toBeGreaterThan(0)
    })

    test('should throw if not connected to provider', async () => {
      const invalidWalletManager = new WalletManagerEvm(SEED_PHRASE)
      await expect(invalidWalletManager.getFeeRates()).rejects.toThrow()
    })
  })
})
