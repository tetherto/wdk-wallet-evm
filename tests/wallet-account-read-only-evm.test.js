import hre from 'hardhat'

import { ContractFactory } from 'ethers'

import { afterEach, beforeEach, describe, expect, test } from '@jest/globals'

import { WalletAccountReadOnlyEvm } from '../index.js'

import TestToken from './artifacts/TestToken.json' with { type: 'json' }

const ACCOUNT = {
    index: 0,
    path: "m/44'/60'/0'/0/0",
    address: '0x405005C7c4422390F4B334F64Cf20E0b767131d0',
    keyPair: {
        privateKey: '260905feebf1ec684f36f1599128b85f3a26c2b817f2065a2fc278398449c41f',
        publicKey: '036c082582225926b9356d95b91a4acffa3511b7cc2a14ef5338c090ea2cc3d0aa'
    }
}

const INITIAL_BALANCE = 1_000_000_000_000_000_000,
      INITIAL_TOKEN_BALANCE = 1_000_000

async function deployTestToken () {
  const [signer] = await hre.ethers.getSigners()

  const factory = new ContractFactory(TestToken.abi, TestToken.bytecode, signer)
  const contract = await factory.deploy()
  const transaction = await contract.deploymentTransaction()

  await transaction.wait()

  return contract
}

describe('WalletAccountReadOnlyEvm', () => {
  let testToken,
      account

  async function sendEthersTo (to, value) {
    const [signer] = await hre.ethers.getSigners()
    const transaction = await signer.sendTransaction({ to, value })
    await transaction.wait()
  }

  async function sendTestTokensTo (to, value) {
    const transaction = await testToken.transfer(to, value)
    await transaction.wait()
  }

  beforeEach(async () => {
    testToken = await deployTestToken()

    await sendEthersTo(ACCOUNT.address, BigInt(INITIAL_BALANCE))

    await sendTestTokensTo(ACCOUNT.address, BigInt(INITIAL_TOKEN_BALANCE))

    account = new WalletAccountReadOnlyEvm(ACCOUNT.address, {
      provider: hre.network.provider
    })
  })

  afterEach(async () => {
    account.dispose()

    await hre.network.provider.send('hardhat_reset')
  })

  describe('constructor', () => {
    test('should successfully initialize an account for the given seed phrase and path', async () => {
      const account = new WalletAccountReadOnlyEvm(ACCOUNT.address)

      expect(account.index).toBe(ACCOUNT.index)

      expect(account.path).toBe(ACCOUNT.path)

      expect(await account.getAddress()).toBe(ACCOUNT.address)
    })

    test('should successfully initialize an account for the given address', async () => {
      const account = new WalletAccountReadOnlyEvm(ACCOUNT.address)

      expect(await account.getAddress()).toBe(ACCOUNT.address)
    })
  })

  describe('getAddress', () => {
    test('should return the correct address', async () => {
      const address = await account.getAddress()

      expect(address).toBe(ACCOUNT.address)
    })
  })

  describe('getBalance', () => {
    test('should return the correct balance of the account', async () => {
      const account = new WalletAccountReadOnlyEvm(ACCOUNT.address, {
        provider: hre.network.provider
      })

      const balance = await account.getBalance()

      expect(balance).toBe(INITIAL_BALANCE)
    })

    test('should throw if the account is not connected to a provider', async () => {
      const account = new WalletAccountReadOnlyEvm(ACCOUNT.address)

      await expect(account.getBalance())
        .rejects.toThrow('The wallet must be connected to a provider to retrieve balances.')
    })
  })

  describe('getTokenBalance', () => {
    test('should return the correct token balance of the account', async () => {
      const account = new WalletAccountReadOnlyEvm(ACCOUNT.address, {
        provider: hre.network.provider
      })

      const balance = await account.getTokenBalance(testToken.target)

      expect(balance).toBe(INITIAL_TOKEN_BALANCE)
    })

    test('should throw if the account is not connected to a provider', async () => {
      const account = new WalletAccountReadOnlyEvm(ACCOUNT.address)

      await expect(account.getTokenBalance(testToken.target))
        .rejects.toThrow('The wallet must be connected to a provider to retrieve token balances.')
    })
  })

  describe('getTransactionReceipt', () => {
    test('should return the correct transaction receipt', async () => {
      const [sender] = await hre.ethers.getSigners();

      const TRANSACTION = {
        to: "0xa460AEbce0d3A4BecAd8ccf9D6D4861296c503Bd",
        value: 0
      }

      const { hash } = await sender.sendTransaction(TRANSACTION);

      const receipt = await account.getTransactionReceipt(hash)

      expect(receipt.hash).toBe(hash)
      expect(receipt.to).toBe(TRANSACTION.to)
      expect(receipt.status).toBe(1)
    })

    test('should return null if the transaction has not been included in a block yet', async () => {
      const HASH = '0xe60970cd7685466037bac1ff337e08265ac9f48af70a12529bdca5caf5a2b14b'

      const receipt = await account.getTransactionReceipt(HASH)

      expect(receipt).toBe(null)
    })

    test('should throw if the account is not connected to a provider', async () => {
      const HASH = '0xe60970cd7685466037bac1ff337e08265ac9f48af70a12529bdca5caf5a2b14b'

      const account = new WalletAccountReadOnlyEvm(ACCOUNT.address)

      await expect(account.getTransactionReceipt(HASH))
        .rejects.toThrow('The wallet must be connected to a provider to fetch transaction receipts.')
    })
  })

  describe('verify', () => {
    const MESSAGE = 'Dummy message to sign.'

    const SIGNATURE = '0xd130f94c52bf393206267278ac0b6009e14f11712578e5c1f7afe4a12685c5b96a77a0832692d96fc51f4bd403839572c55042ecbcc92d215879c5c8bb5778c51c'

    test('should return true for a valid signature', async () => {
      const result = await account.verify(MESSAGE, SIGNATURE)

      expect(result).toBe(true)
    })

    test('should return false for an invalid signature', async () => {
      const result = await account.verify('Another message.', SIGNATURE)

      expect(result).toBe(false)
    })

    test('should throw on a malformed signature', async () => {
      await expect(account.verify(MESSAGE, 'A bad signature'))
        .rejects.toThrow('invalid BytesLike value')
    })
  })
}) 