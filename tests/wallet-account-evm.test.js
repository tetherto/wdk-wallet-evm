import hre from 'hardhat'

import { ContractFactory, Contract } from 'ethers'

import * as bip39 from 'bip39'

import { afterEach, beforeEach, describe, expect, test, jest } from '@jest/globals'

import { WalletAccountEvm, WalletAccountReadOnlyEvm } from '../index.js'

import TestToken from './artifacts/TestToken.json' with { type: 'json' }

const USDT_MAINNET_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7'

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

const INITIAL_BALANCE = 1_000_000_000_000_000_000n
const INITIAL_TOKEN_BALANCE = 1_000_000n

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

    await sendEthersTo(ACCOUNT.address, INITIAL_BALANCE)

    await sendTestTokensTo(ACCOUNT.address, INITIAL_TOKEN_BALANCE)

    account = new WalletAccountEvm(SEED_PHRASE, "0'/0/0", {
      provider: hre.network.provider
    })
  })

  afterEach(async () => {
    account.dispose()

    await hre.network.provider.send('hardhat_reset')
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

  describe('sign', () => {
    const MESSAGE = 'Dummy message to sign.'

    const EXPECTED_SIGNATURE = '0xd130f94c52bf393206267278ac0b6009e14f11712578e5c1f7afe4a12685c5b96a77a0832692d96fc51f4bd403839572c55042ecbcc92d215879c5c8bb5778c51c'

    test('should return the correct signature', async () => {
      const signature = await account.sign(MESSAGE)

      expect(signature).toBe(EXPECTED_SIGNATURE)
    })
  })

  describe('sendTransaction', () => {
    test('should successfully send a transaction', async () => {
      const TRANSACTION = {
        to: '0xa460AEbce0d3A4BecAd8ccf9D6D4861296c503Bd',
        value: 1_000
      }

      const EXPECTED_FEE = 49_611_983_472_910n

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

      const EXPECTED_FEE = 57_395_969_261_360n

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

  describe('transfer', () => {
    test('should successfully transfer tokens', async () => {
      const TRANSFER = {
        token: testToken.target,
        recipient: '0xa460AEbce0d3A4BecAd8ccf9D6D4861296c503Bd',
        amount: 100
      }

      const EXPECTED_FEE = 123_145_253_772_480n

      const { hash, fee } = await account.transfer(TRANSFER)
      const transaction = await hre.ethers.provider.getTransaction(hash)
      const data = testToken.interface.encodeFunctionData('transfer', [TRANSFER.recipient, TRANSFER.amount])

      expect(transaction.hash).toBe(hash)
      expect(transaction.to).toBe(TRANSFER.token)
      expect(transaction.value).toBe(0n)

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

  describe('approve', () => {
    const SPENDER = '0xa460AEbce0d3A4BecAd8ccf9D6D4861296c503Bd'
    const AMOUNT = 100n

    test('should successfully approve tokens for a spender', async () => {
      const APPROVE_OPTIONS = {
        token: testToken.target,
        spender: SPENDER,
        amount: AMOUNT
      }

      const { hash, fee } = await account.approve(APPROVE_OPTIONS)
      const transaction = await hre.ethers.provider.getTransaction(hash)
      const data = testToken.interface.encodeFunctionData('approve', [SPENDER, AMOUNT])

      expect(transaction.hash).toBe(hash)
      expect(transaction.to).toBe(APPROVE_OPTIONS.token)
      expect(transaction.data).toBe(data)
      expect(typeof fee).toBe('bigint')
      expect(fee).toBeGreaterThan(0n)

      const allowance = await testToken.allowance(ACCOUNT.address, SPENDER)
      expect(allowance).toBe(AMOUNT)
    })

    test('should throw if approving non-zero USDT on mainnet when allowance is non-zero', async () => {
      jest.spyOn(account, 'getAllowance').mockResolvedValue(1n)
      jest.spyOn(account._provider, 'getNetwork').mockResolvedValue({ chainId: 1n })

      const approveOptions = {
        token: USDT_MAINNET_ADDRESS,
        spender: SPENDER,
        amount: AMOUNT
      }

      await expect(account.approve(approveOptions))
        .rejects.toThrow('USDT requires the current allowance to be reset to 0 before setting a new non-zero value.')
    })
    
    test('should successfully approve a non-zero amount for USDT on mainnet when allowance is zero', async () => {
      jest.spyOn(account, 'getAllowance').mockResolvedValue(0n)
      jest.spyOn(account._provider, 'getNetwork').mockResolvedValue({ chainId: 1n })
      const sendTxSpy = jest.spyOn(account, 'sendTransaction').mockResolvedValue({ hash: '0xhash', fee: 0n })

      const approveOptions = {
        token: USDT_MAINNET_ADDRESS,
        spender: SPENDER,
        amount: AMOUNT
      }

      const abi = ['function approve(address spender, uint256 amount) returns (bool)']
      const contract = new Contract(USDT_MAINNET_ADDRESS, abi, hre.ethers.provider)
      const expectedData = contract.interface.encodeFunctionData('approve', [SPENDER, AMOUNT])

      const { hash, fee } = await account.approve(approveOptions)

      expect(hash).toBe('0xhash')
      expect(fee).toBe(0n)
      expect(sendTxSpy).toHaveBeenCalledWith({
        to: USDT_MAINNET_ADDRESS,
        value: 0,
        data: expectedData
      })
    })

    test('should successfully approve a zero amount for USDT on mainnet when allowance is non-zero', async () => {
      jest.spyOn(account, 'getAllowance').mockResolvedValue(1n)
      jest.spyOn(account._provider, 'getNetwork').mockResolvedValue({ chainId: 1n })
      const sendTxSpy = jest.spyOn(account, 'sendTransaction').mockResolvedValue({ hash: '0xhash', fee: 0n })

      const approveOptions = {
        token: USDT_MAINNET_ADDRESS,
        spender: SPENDER,
        amount: 0
      }

      const abi = ['function approve(address spender, uint256 amount) returns (bool)']
      const contract = new Contract(USDT_MAINNET_ADDRESS, abi, hre.ethers.provider)
      const expectedData = contract.interface.encodeFunctionData('approve', [SPENDER, 0])

      const { hash, fee } = await account.approve(approveOptions)

      expect(hash).toBe('0xhash')
      expect(fee).toBe(0n)
      expect(sendTxSpy).toHaveBeenCalledWith({
        to: USDT_MAINNET_ADDRESS,
        value: 0,
        data: expectedData
      })
    })

    test('should throw if the account is not connected to a provider', async () => {
      const accountWithoutProvider = new WalletAccountEvm(SEED_PHRASE, "0'/0/0")
      const approveOptions = {
        token: testToken.target,
        spender: SPENDER,
        amount: AMOUNT
      }

      await expect(accountWithoutProvider.approve(approveOptions))
        .rejects.toThrow('The wallet must be connected to a provider to approve funds.')
    })
  })

  describe('toReadOnlyAccount', () => {
    test('should return a read-only copy of the account', async () => {
      const readOnlyAccount = await account.toReadOnlyAccount()

      expect(readOnlyAccount).toBeInstanceOf(WalletAccountReadOnlyEvm)

      expect(await readOnlyAccount.getAddress()).toBe(ACCOUNT.address)
    })
  })
})
