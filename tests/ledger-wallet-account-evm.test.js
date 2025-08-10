import hre from 'hardhat'

import { ContractFactory } from 'ethers'

import { afterEach, beforeEach, describe, expect, test } from '@jest/globals'

import { LedgerWalletAccountEvm, WalletAccountReadOnlyEvm } from '../index.js'

import TestToken from './artifacts/TestToken.json' with { type: 'json' }

import { LedgerSigner } from '@ethers-ext/signer-ledger'

import { RecordStore, openTransportReplayer } from '@ledgerhq/hw-transport-mocker'

import { getAddressApdu, getSignMessageAdpu, getSignTransactionAdpu } from './helpers/ledger-mock.js'

const ACCOUNT = {
  index: 0,
  path: "m/44'/60'/0'/0/0",
  address: '0x405005C7c4422390F4B334F64Cf20E0b767131d0',
  keyPair: {
    privateKey: '260905feebf1ec684f36f1599128b85f3a26c2b817f2065a2fc278398449c41f',
    publicKey: '046c082582225926b9356d95b91a4acffa3511b7cc2a14ef5338c090ea2cc3d0aaf30a0badf95483c620a7ead0709a763b3a85018dac44b074c54345f162ffcc95'
  },
}

const MESSAGE = 'test'
const EXPECTED_SIGNATURE = '0x39eff56b9d8ff7ccb09e21f426b44034f3c8cb3c472dee473ef0662f43c16bbf43ccc223c79b011f5e2a9e12bcee3d795daf0e89408c48349ac7820dc8037a8b1b'

const INITIAL_BALANCE = 1_000_000_000_000_000_000
const INITIAL_TOKEN_BALANCE = 1_000_000

async function deployTestToken () {
  const [signer] = await hre.ethers.getSigners()

  const factory = new ContractFactory(TestToken.abi, TestToken.bytecode, signer)
  const contract = await factory.deploy()
  const transaction = contract.deploymentTransaction()

  await transaction.wait()

  return contract
}

describe('LedgerWalletAccountEvm', () => {
  let testToken

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
  })

  afterEach(async () => {
    await hre.network.provider.send('hardhat_reset')
  })

  describe('constructor', () => {
    test('should successfully initialize an account for the given Ledger signer', async () => {
      const store = RecordStore.fromString(getAddressApdu(ACCOUNT))
      const transport = await openTransportReplayer(store)
      const ledgerSigner = new LedgerSigner(transport)

      const account = await LedgerWalletAccountEvm.new(ledgerSigner, {
        provider: hre.network.provider
      })

      expect(account.index).toBe(ACCOUNT.index)

      expect(account.path).toBe(ACCOUNT.path)
    })
  })

  describe('sign', () => {
    test('should return the correct signature', async () => {
      const store = RecordStore.fromString(getSignMessageAdpu(ACCOUNT, MESSAGE))
      const transport = await openTransportReplayer(store)
      const ledgerSigner = new LedgerSigner(transport)

      const account = await LedgerWalletAccountEvm.new(ledgerSigner, {
        provider: hre.network.provider
      })

      const signature = await account.sign(MESSAGE)

      expect(signature).toBe(EXPECTED_SIGNATURE)
    })
  })

  describe('verify', () => {
    test('should return true for a valid signature', async () => {
      const store = RecordStore.fromString(getSignMessageAdpu(ACCOUNT, MESSAGE))
      const transport = await openTransportReplayer(store)
      const ledgerSigner = new LedgerSigner(transport)

      const account = await LedgerWalletAccountEvm.new(ledgerSigner, {
        provider: hre.network.provider
      })
      
      const signature = await account.sign(MESSAGE)
      const result = await account.verify(MESSAGE, signature)

      expect(result).toBe(true)
    })

    test('should return false for an invalid signature', async () => {
      const store = RecordStore.fromString(getSignMessageAdpu(ACCOUNT, MESSAGE))
      const transport = await openTransportReplayer(store)
      const ledgerSigner = new LedgerSigner(transport)

      const account = await LedgerWalletAccountEvm.new(ledgerSigner, {
        provider: hre.network.provider
      })

      const signature = await account.sign(MESSAGE)
      const result = await account.verify('Another message.', signature)

      expect(result).toBe(false)
    })

    test('should throw on a malformed signature', async () => {
      const store = RecordStore.fromString(getSignMessageAdpu(ACCOUNT, MESSAGE))
      const transport = await openTransportReplayer(store)
      const ledgerSigner = new LedgerSigner(transport)

      const account = await LedgerWalletAccountEvm.new(ledgerSigner, {
        provider: hre.network.provider
      })

      await expect(account.verify(MESSAGE, 'A bad signature'))
        .rejects.toThrow('invalid BytesLike value')
    })
  })

  describe('sendTransaction', () => {
    test('should successfully send a transaction', async () => {     
      const TRANSACTION ={
        to: '0xa460AEbce0d3A4BecAd8ccf9D6D4861296c503Bd',
        value: '1000',
        nonce: 0,
        gasLimit: '21001',
        chainId: '31337',
        type: 2,
        maxFeePerGas: '2362362910',
        maxPriorityFeePerGas: '1000000000',
      }

      const EXPECTED_FEE = 49_611_983_472_910

      const store = RecordStore.fromString(
        await getSignTransactionAdpu(ACCOUNT, TRANSACTION, 4)
      )
      const transport = await openTransportReplayer(store)
      const ledgerSigner = new LedgerSigner(transport)

      const account = await LedgerWalletAccountEvm.new(ledgerSigner, {
        provider: hre.network.provider
      })

      const { hash, fee } = await account.sendTransaction({
        to: TRANSACTION.to,
        value: TRANSACTION.value,
      })

      const transaction = await hre.ethers.provider.getTransaction(hash)

      expect(transaction.hash).toBe(hash)
      expect(transaction.to).toBe(TRANSACTION.to)
      expect(transaction.value).toBe(BigInt(TRANSACTION.value))

      expect(fee).toBe(EXPECTED_FEE)
    })

    test('should successfully send a transaction with arbitrary data', async () => {
      const TRANSACTION = {
        to: testToken.target,
        value: "0",
        data: testToken.interface.encodeFunctionData('balanceOf', [ACCOUNT.address]),
        nonce: 0,
        gasLimit: "24296",
        chainId: "31337",
        type: 2,
        maxFeePerGas: "2362362910",
        maxPriorityFeePerGas: "1000000000"
      }

      const store = RecordStore.fromString(
        await getSignTransactionAdpu(ACCOUNT, TRANSACTION, 2)
      )
      const transport = await openTransportReplayer(store)
      const ledgerSigner = new LedgerSigner(transport)

      const account = await LedgerWalletAccountEvm.new(ledgerSigner, {
        provider: hre.network.provider
      })

      const EXPECTED_FEE = 57_395_969_261_360

      const { hash, fee } = await account.sendTransaction(TRANSACTION)

      const transaction = await hre.ethers.provider.getTransaction(hash)

      expect(transaction.hash).toBe(hash)
      expect(transaction.to).toBe(TRANSACTION.to)
      expect(transaction.value).toBe(BigInt(TRANSACTION.value))
      expect(transaction.data).toBe(TRANSACTION.data)

      expect(fee).toBe(EXPECTED_FEE)
    })

    test('should throw if the account is not connected to a provider', async () => {
      const store = RecordStore.fromString(getAddressApdu(ACCOUNT))
      const transport = await openTransportReplayer(store)
      const ledgerSigner = new LedgerSigner(transport)

      const account = await LedgerWalletAccountEvm.new(ledgerSigner)

      await expect(account.sendTransaction({ }))
        .rejects.toThrow('The wallet must be connected to a provider to send transactions.')
    })
  })

  describe('transfer', () => {
    test('should successfully transfer tokens', async () => {
      const RECEIPIENT = '0xa460AEbce0d3A4BecAd8ccf9D6D4861296c503Bd'
      const AMOUNT = 100
      const TRANSACTION = {
        to: testToken.target,
        value: "0",
        data: testToken.interface.encodeFunctionData('transfer', [RECEIPIENT, AMOUNT]),
        nonce: 0,
        gasLimit: "52128",
        chainId: "31337",
        type: 2,
        maxFeePerGas: "2362362910",
        maxPriorityFeePerGas: "1000000000"
      }

      const store = RecordStore.fromString(
        await getSignTransactionAdpu(ACCOUNT, TRANSACTION, 4)
      )
      const transport = await openTransportReplayer(store)
      const ledgerSigner = new LedgerSigner(transport)

      const account = await LedgerWalletAccountEvm.new(ledgerSigner, {
        provider: hre.network.provider
      })

      const EXPECTED_FEE = 123_145_253_772_480

      const { hash, fee } = await account.transfer({
        token: TRANSACTION.to,
        recipient: RECEIPIENT,
        amount: AMOUNT
      })
      const transaction = await hre.ethers.provider.getTransaction(hash)

      expect(transaction.hash).toBe(hash)
      expect(transaction.to).toBe(TRANSACTION.to)
      expect(transaction.value).toBe(BigInt(0))

      expect(transaction.data).toBe(TRANSACTION.data)

      expect(fee).toBe(EXPECTED_FEE)
    })

    test('should throw if transfer fee exceeds the transfer max fee configuration', async () => {
      const RECEIPIENT = '0xa460AEbce0d3A4BecAd8ccf9D6D4861296c503Bd'
      const AMOUNT = 100
      const TRANSACTION = {
        to: testToken.target,
        value: "0",
        data: testToken.interface.encodeFunctionData('transfer', [RECEIPIENT, AMOUNT]),
        nonce: 0,
        gasLimit: "52128",
        chainId: "31337",
        type: 2,
        maxFeePerGas: "2362362910",
        maxPriorityFeePerGas: "1000000000"
      }

      const store = RecordStore.fromString(
        await getSignTransactionAdpu(ACCOUNT, TRANSACTION, 4)
      )
      const transport = await openTransportReplayer(store)
      const ledgerSigner = new LedgerSigner(transport)

      const account = await LedgerWalletAccountEvm.new(ledgerSigner, {
        provider: hre.network.provider,
        transferMaxFee: 0
      })

      await expect(
        account.transfer({
          token: TRANSACTION.to,
          recipient: RECEIPIENT,
          amount: AMOUNT
        })
      ).rejects.toThrow('Exceeded maximum fee cost for transfer operation.')
    })

    test('should throw if the account is not connected to a provider', async () => {
      const store = RecordStore.fromString(getAddressApdu(ACCOUNT))
      const transport = await openTransportReplayer(store)
      const ledgerSigner = new LedgerSigner(transport)

      const account = await LedgerWalletAccountEvm.new(ledgerSigner)

      await expect(account.transfer({ }))
        .rejects.toThrow('The wallet must be connected to a provider to transfer tokens.')
    })
  })

  describe('toReadOnlyAccount', () => {
    test('should return a read-only copy of the account', async () => {
      const store = RecordStore.fromString(getAddressApdu(ACCOUNT))
      const transport = await openTransportReplayer(store)
      const ledgerSigner = new LedgerSigner(transport)

      const account = await LedgerWalletAccountEvm.new(ledgerSigner)
      
      const readOnlyAccount = await account.toReadOnlyAccount()

      expect(readOnlyAccount).toBeInstanceOf(WalletAccountReadOnlyEvm)

      expect(await readOnlyAccount.getAddress()).toBe(ACCOUNT.address)
    })
  })
})
