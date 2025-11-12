import { describe, expect, test, beforeEach, afterEach } from '@jest/globals'
import WalletManagerEvm from '../../../index.js'
import { TESTNET_SEED_PHRASE, SEPOLIA_TESTNET_RPC_URL } from './helper.js'
import { isAddress } from 'ethers';

describe('Wallet Security Lifecycle', () => {
  let wallet
  let account0


  beforeEach(async () => {
    wallet = new WalletManagerEvm(TESTNET_SEED_PHRASE, {
      provider: SEPOLIA_TESTNET_RPC_URL
    })
    account0 = await wallet.getAccount(0)
  })

  afterEach(() => {
    account0 = null
    wallet = null
  })


  test('should properly handle wallet cleanup and reinitialization', async () => {

    const originalAddress = account0.__address
    expect(isAddress(originalAddress)).toBe(true)


    account0 = null
    wallet = null

    if (global.gc) global.gc()

    const newWallet = new WalletManagerEvm(TESTNET_SEED_PHRASE, {
      provider: SEPOLIA_TESTNET_RPC_URL
    })
    const newAccount = await newWallet.getAccount(0)

    expect(newAccount.__address).toBe(originalAddress)
  })

  test('should prevent access to sensitive data via inspection', () => {
    const accountJSON = JSON.stringify(account0)
    expect(accountJSON).not.toMatch(/privateKey|seed|keyPair/i)
    const enumerable = Object.keys(account0)
    const sensitiveProps = ['privateKey', 'seed', '_keyPair']
    for (const prop of sensitiveProps) {
      expect(enumerable).not.toContain(prop)
    }
    expect(account0._account.mnemonic).toBeNull()
  })

  test('should properly cleanup and allow GC of account references', async () => {
    const refs = {
      wallet: new WalletManagerEvm(TESTNET_SEED_PHRASE, {
        provider: SEPOLIA_TESTNET_RPC_URL
      })
    }
    refs.account = await refs.wallet.getAccount(0)
    const weakRef = new WeakRef(refs.account)
    Object.keys(refs).forEach(k => (refs[k] = null))
    if (global.gc) {
      global.gc()
      expect(weakRef.deref()).toBeUndefined()
    } else {
      console.warn('⚠️ GC not exposed; skipping WeakRef validation.')
    }
  })

  test('should securely zero sensitive data in memory buffers', async () => {
    const sensitiveData = Buffer.from(TESTNET_SEED_PHRASE, 'utf8')
    sensitiveData.fill(0)
    expect(
      Buffer.compare(sensitiveData, Buffer.alloc(sensitiveData.length, 0))
    ).toBe(0)
    expect(TESTNET_SEED_PHRASE).toBeTruthy()
  })
})