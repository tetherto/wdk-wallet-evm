import hre from 'hardhat'

import { ContractFactory } from 'ethers'

import * as bip39 from 'bip39'

import { afterEach, beforeEach, describe, expect, test } from '@jest/globals'

import { WalletAccountEvm } from '../index.js'

import TestToken from './abis/TestToken.json' with { type: 'json' }

const SEED_PHRASE = 'cook voyage document eight skate token alien guide drink uncle term abuse'

const INVALID_SEED_PHRASE = 'invalid seed phrase'

const SEED = bip39.mnemonicToSeedSync(SEED_PHRASE)

const ACCOUNT = {
  index: 0,
  path: "m/44'/60'/0'/0/0",
  address: '0x405005C7c4422390F4B334F64Cf20E0b767131d0',
  keyPair: {
    privateKey: '260905feebf1ec684f36f1599128b85f3a26c2b817f2065a2fc278398449c41f',
    publicKey: '036c082582225926b9356d95b91a4acffa3511b7cc2a14ef5338c090ea2cc3d0aa'
  }
}

async function deployTestToken () {
  const [signer] = await hre.ethers.getSigners()

  const factory = new ContractFactory(TestToken.abi, TestToken.bytecode, signer)
  const contract = await factory.deploy()
  const transaction = await contract.deploymentTransaction()

  await transaction.wait()

  return contract
}

describe('WalletAccountEvm', () => {
  let testToken,
      account

  async function giveEthersTo (recipient, value) {
    const [signer] = await hre.ethers.getSigners()

    const transaction = await signer.sendTransaction({
      to: recipient,
      value
    })

    await transaction.wait()
  }

  async function giveTestTokensTo (recipient, value) {
    const transaction = await testToken.transfer(
      recipient,
      value
    )

    await transaction.wait()
  }

  beforeEach(async () => {
    await hre.network.provider.send('hardhat_reset')

    testToken = await deployTestToken()

    account = new WalletAccountEvm(SEED_PHRASE, "0'/0/0", {
      provider: hre.network.provider
    })
  })

  afterEach(() => {
    account.dispose()
  })

  describe('constructor', () => {
    test('should successfully initialize an account for the given seed phrase and path', async () => {
      const account = new WalletAccountEvm(SEED_PHRASE, "0'/0/0")

      expect(account.index).toBe(ACCOUNT.index)

      expect(account.path).toBe(ACCOUNT.path)

      expect(account.keyPair).toEqual({
        privateKey: new Uint8Array(Buffer.from(ACCOUNT.keyPair.privateKey, 'hex')),
        publicKey: new Uint8Array(Buffer.from(ACCOUNT.keyPair.publicKey, 'hex'))
      })
    })

    test('should successfully initialize an account for the given seed and path', async () => {
      const account = new WalletAccountEvm(SEED, "0'/0/0")

      expect(account.index).toBe(ACCOUNT.index)

      expect(account.path).toBe(ACCOUNT.path)

      expect(account.keyPair).toEqual({
        privateKey: new Uint8Array(Buffer.from(ACCOUNT.keyPair.privateKey, 'hex')),
        publicKey: new Uint8Array(Buffer.from(ACCOUNT.keyPair.publicKey, 'hex'))
      })
    })

    test('should throw if the seed phrase is invalid', () => {
      // eslint-disable-next-line no-new
      expect(() => { new WalletAccountEvm(INVALID_SEED_PHRASE, "0'/0/0") })
        .toThrow('The seed phrase is invalid.')
    })

    test('should throw if the path is invalid', () => {
      // eslint-disable-next-line no-new
      expect(() => { new WalletAccountEvm(SEED_PHRASE, "a'/b/c") })
        .toThrow('invalid path component')
    })
  })

  describe('getAddress', () => {
    test('should return the correct address', async () => {
      const address = await account.getAddress()

      expect(address).toBe(ACCOUNT.address)
    })
  })

  describe('sign', () => {
    const MESSAGE = 'Dummy message to sign.'

    const EXPECTED_SIGNATURE = '0xd130f94c52bf393206267278ac0b6009e14f11712578e5c1f7afe4a12685c5b96a77a0832692d96fc51f4bd403839572c55042ecbcc92d215879c5c8bb5778c51c'

    test('should return the correct signature', async () => {
      const signature = await account.sign(MESSAGE)

      expect(signature).toBe(EXPECTED_SIGNATURE)
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

  describe('getBalance', () => {
    test('should return the correct balance of the account', async () => {
      const account = new WalletAccountEvm(SEED_PHRASE, "0'/0/1", {
        provider: hre.network.provider
      })

      await giveEthersTo(await account.getAddress(), 12_345)

      const balance = await account.getBalance()

      expect(balance).toBe(12_345)
    })

    test('should throw if the account is not connected to a provider', async () => {
      const account = new WalletAccountEvm(SEED_PHRASE, "0'/0/0")

      await expect(account.getBalance())
        .rejects.toThrow('The wallet must be connected to a provider to retrieve balances.')
    })
  })

  describe('getTokenBalance', () => {
    test('should return the correct token balance of the account', async () => {
      const account = new WalletAccountEvm(SEED_PHRASE, "0'/0/1", {
        provider: hre.network.provider
      })

      await giveTestTokensTo(await account.getAddress(), 67_890)

      const balance = await account.getTokenBalance(testToken.target)

      expect(balance).toBe(67_890)
    })

    test('should throw if the account is not connected to a provider', async () => {
      const account = new WalletAccountEvm(SEED_PHRASE, "0'/0/0")

      await expect(account.getTokenBalance(testToken.target))
        .rejects.toThrow('The wallet must be connected to a provider to retrieve token balances.')
    })
  })

  describe('sendTransaction', () => {
    test('should successfully send a transaction', async () => {
      const TRANSACTION = {
        to: '0xa460AEbce0d3A4BecAd8ccf9D6D4861296c503Bd',
        value: 1_000
      }

      const EXPECTED_FEE = 57_752_750_000_000

      const { hash, fee } = await account.sendTransaction(TRANSACTION)

      const transaction = await hre.ethers.provider.getTransaction(hash)

      expect(transaction.hash).toBe(hash)
      expect(transaction.to).toBe(TRANSACTION.to)
      expect(transaction.value).toBe(BigInt(TRANSACTION.value))

      expect(fee).toBe(EXPECTED_FEE)
    })

    test('should successfully send a transaction with arbitrary data', async () => {
      const TRANSACTION_WITH_DATA = {
        to: testToken.target,
        value: 0,
        data: testToken.interface.encodeFunctionData('balanceOf', ['0x636e9c21f27d9401ac180666bf8DC0D3FcEb0D24'])
      }

      const EXPECTED_FEE = 66_814_000_000_000

      const { hash, fee } = await account.sendTransaction(TRANSACTION_WITH_DATA)

      const transaction = await hre.ethers.provider.getTransaction(hash)

      expect(transaction.hash).toBe(hash)
      expect(transaction.to).toBe(TRANSACTION_WITH_DATA.to)
      expect(transaction.value).toBe(BigInt(TRANSACTION_WITH_DATA.value))
      expect(transaction.data).toBe(TRANSACTION_WITH_DATA.data)

      expect(fee).toBe(EXPECTED_FEE)
    })

    test('should throw if the account is not connected to a provider', async () => {
      const account = new WalletAccountEvm(SEED_PHRASE, "0'/0/0")

      await expect(account.sendTransaction({ }))
        .rejects.toThrow('The wallet must be connected to a provider to send transactions.')
    })
  })

  describe('quoteSendTransaction', () => {
    test('should successfully quote a transaction', async () => {
      const TRANSACTION = {
        to: '0xa460AEbce0d3A4BecAd8ccf9D6D4861296c503Bd',
        value: 1_000
      }

      const EXPECTED_FEE = 57_752_750_000_000

      const { fee } = await account.quoteSendTransaction(TRANSACTION)

      expect(fee).toBe(EXPECTED_FEE)
    })

    test('should successfully quote a transaction with arbitrary data', async () => {
      const TRANSACTION_WITH_DATA = {
        to: testToken.target,
        value: 0,
        data: testToken.interface.encodeFunctionData('balanceOf', ['0x636e9c21f27d9401ac180666bf8DC0D3FcEb0D24'])
      }

      const EXPECTED_FEE = 66_814_000_000_000

      const { fee } = await account.quoteSendTransaction(TRANSACTION_WITH_DATA)

      expect(fee).toBe(EXPECTED_FEE)
    })

    test('should throw if the account is not connected to a provider', async () => {
      const account = new WalletAccountEvm(SEED_PHRASE, "0'/0/0")

      await expect(account.quoteSendTransaction({ }))
        .rejects.toThrow('The wallet must be connected to a provider to quote send transaction operations.')
    })
  })

  describe('transfer', () => {
    test('should successfully transfer tokens', async () => {
      const TRANSFER = {
        token: testToken.target,
        recipient: '0xa460AEbce0d3A4BecAd8ccf9D6D4861296c503Bd',
        amount: 100
      }

      const EXPECTED_FEE = 143_352_000_000_000

      const { hash, fee } = await account.transfer(TRANSFER)

      const transaction = await hre.ethers.provider.getTransaction(hash)

      expect(transaction.hash).toBe(hash)
      expect(transaction.to).toBe(TRANSFER.token)
      expect(transaction.value).toBe(BigInt(0))

      const data = testToken.interface.encodeFunctionData('transfer', [TRANSFER.recipient, TRANSFER.amount])

      expect(transaction.data).toBe(data)

      expect(fee).toBe(EXPECTED_FEE)
    })

    test('should throw if transfer fee exceeds the transfer max fee configuration', async () => {
      const TRANSFER = {
        token: testToken.target,
        recipient: '0xa460AEbce0d3A4BecAd8ccf9D6D4861296c503Bd',
        amount: 100
      }

      const account = new WalletAccountEvm(SEED_PHRASE, "0'/0/0", {
        provider: hre.network.provider,
        transferMaxFee: 0
      })

      await expect(account.transfer(TRANSFER))
        .rejects.toThrow('Exceeded maximum fee cost for transfer operation.')
    })

    test('should throw if the account is not connected to a provider', async () => {
      const account = new WalletAccountEvm(SEED_PHRASE, "0'/0/0")

      await expect(account.transfer({ }))
        .rejects.toThrow('The wallet must be connected to a provider to transfer tokens.')
    })
  })

  describe('quoteTransfer', () => {
    test('should successfully quote a transfer operation', async () => {
      const TRANSFER = {
        token: testToken.target,
        recipient: '0xa460AEbce0d3A4BecAd8ccf9D6D4861296c503Bd',
        amount: 100
      }

      const EXPECTED_FEE = 143_352_000_000_000

      const { fee } = await account.quoteTransfer(TRANSFER)

      expect(fee).toBe(EXPECTED_FEE)
    })

    test('should throw if the account is not connected to a provider', async () => {
      const account = new WalletAccountEvm(SEED_PHRASE, "0'/0/0")

      await expect(account.quoteTransfer({ }))
        .rejects.toThrow('The wallet must be connected to a provider to quote transfer operations.')
    })
  })
})
