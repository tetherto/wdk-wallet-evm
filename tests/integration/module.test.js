import { ContractFactory, HDNodeWallet, JsonRpcProvider, Mnemonic } from 'ethers'

import { describe, expect, test, beforeEach, afterEach, afterAll } from '@jest/globals'

import WalletManagerEvm from '../../index.js'
import SeedSignerEvm from '../../src/signers/seed-signer-evm.js'

import PrivateKeySignerEvm from '../../src/signers/private-key-signer-evm.js'

import TestToken from './../artifacts/TestToken.json' with { type: 'json' }

import SimpleDelegateContract from './../artifacts/SimpleDelegateContract.json' with { type: 'json' }

const RPC_URL = 'http://127.0.0.1:8545'

const NODE_MNEMONIC = 'anger burst story spy face pattern whale quit delay fiction ball solve'

// cacheTimeout -1: ethers' default 250ms read cache returns stale nonces under automining
const provider = new JsonRpcProvider(RPC_URL, undefined, { cacheTimeout: -1 })
provider.pollingInterval = 50

const nodeSigner = HDNodeWallet
  .fromMnemonic(Mnemonic.fromPhrase(NODE_MNEMONIC), "m/44'/60'/0'/0/0")
  .connect(provider)

const SEED_PHRASE = 'cook voyage document eight skate token alien guide drink uncle term abuse'

const DELEGATE_CONTRACT_ADDRESS = '0xbe08D4d81EbeA77f6AA54B2067EA5F56005F98dE'

const ACCOUNT_0 = {
  index: 0,
  path: "m/44'/60'/0'/0/0",
  address: '0x405005C7c4422390F4B334F64Cf20E0b767131d0',
  keyPair: {
    privateKey: '260905feebf1ec684f36f1599128b85f3a26c2b817f2065a2fc278398449c41f',
    publicKey: '036c082582225926b9356d95b91a4acffa3511b7cc2a14ef5338c090ea2cc3d0aa'
  }
}

const ACCOUNT_1 = {
  index: 1,
  path: "m/44'/60'/0'/0/1",
  address: '0xcC81e04BadA16DEf9e1AFB027B859bec42BE49dB',
  keyPair: {
    privateKey: 'ba3d34b786d909f83be1422b75ea18005843ff979862619987fb0bab59580158',
    publicKey: '02f8d04c3de44e53e5b0ef2f822a29087e6af80114560956518767c64fec6b0f69'
  }
}

const INITIAL_BALANCE = 1_000_000_000_000_000_000n
const INITIAL_TOKEN_BALANCE = 1_000_000n

async function deployTestToken () {
  const factory = new ContractFactory(TestToken.abi, TestToken.bytecode, nodeSigner)
  const contract = await factory.deploy()
  const transaction = await contract.deploymentTransaction()

  await transaction.wait()

  return contract
}

describe('@tetherto/wdk-wallet-evm', () => {
  let testToken,
    wallet,
    snapshotId

  async function sendEthersTo (to, value) {
    const transaction = await nodeSigner.sendTransaction({ to, value })
    await transaction.wait()
  }

  async function sendTestTokensTo (to, value) {
    const transaction = await testToken.transfer(to, value)
    await transaction.wait()
  }

  beforeEach(async () => {
    snapshotId = await provider.send('evm_snapshot', [])

    testToken = await deployTestToken()

    for (const account of [ACCOUNT_0, ACCOUNT_1]) {
      await sendEthersTo(account.address, INITIAL_BALANCE)

      await sendTestTokensTo(account.address, INITIAL_TOKEN_BALANCE)
    }

    wallet = new WalletManagerEvm(new SeedSignerEvm(SEED_PHRASE, "m/44'/60'"), { provider: RPC_URL })
  })

  afterEach(async () => {
    wallet.dispose()
    await provider.send('evm_revert', [snapshotId])
  })

  afterAll(() => {
    provider.destroy()
  })

  test('should derive an account, quote the cost of a tx and send the tx', async () => {
    const account = await wallet.getAccount(0)

    const TRANSACTION = {
      to: '0xa460AEbce0d3A4BecAd8ccf9D6D4861296c503Bd',
      value: 1_000
    }

    const EXPECTED_FEE = 42_732_792_840_002n

    const { fee: feeEstimate } = await account.quoteSendTransaction(TRANSACTION)

    expect(feeEstimate).toBe(EXPECTED_FEE)

    const { hash, fee } = await account.sendTransaction(TRANSACTION)

    const transaction = await provider.getTransaction(hash)

    expect(transaction.hash).toBe(hash)
    expect(transaction.to).toBe(TRANSACTION.to)
    expect(transaction.value).toBe(BigInt(TRANSACTION.value))

    expect(fee).toBe(EXPECTED_FEE)
  })

  test('should derive two accounts, send a tx from account 1 to 2 and get the correct balances', async () => {
    const account0 = await wallet.getAccount(0)

    const account1 = await wallet.getAccount(1)

    const TRANSACTION = {
      to: await account1.getAddress(),
      value: 1_000
    }

    const { hash } = await account0.sendTransaction(TRANSACTION)

    const { fee } = await provider.getTransactionReceipt(hash)

    const balanceAccount0 = await account0.getBalance()
    const balanceAccount1 = await account1.getBalance()

    expect(balanceAccount0).toBe(INITIAL_BALANCE - fee - 1_000n)
    expect(balanceAccount1).toBe(INITIAL_BALANCE + 1_000n)
  })

  test('should derive an account by its path, quote the cost of transferring a token and transfer a token', async () => {
    const account = await wallet.getAccountByPath("0'/0/0")

    const TRANSFER = {
      token: testToken.target,
      recipient: '0xa460AEbce0d3A4BecAd8ccf9D6D4861296c503Bd',
      amount: 100
    }

    const EXPECTED_FEE = 106_069_950_248_256n

    const { fee: feeEstimate } = await account.quoteTransfer(TRANSFER)

    expect(feeEstimate).toBe(EXPECTED_FEE)

    const { hash, fee } = await account.transfer(TRANSFER)
    const transaction = await provider.getTransaction(hash)
    const data = testToken.interface.encodeFunctionData('transfer', [TRANSFER.recipient, TRANSFER.amount])

    expect(transaction.hash).toBe(hash)
    expect(transaction.to).toBe(TRANSFER.token)
    expect(transaction.value).toBe(0n)

    expect(transaction.data).toBe(data)

    expect(fee).toBe(EXPECTED_FEE)
  })

  test('should derive two accounts by their paths, transfer a token from account 1 to 2 and get the correct balances and token balances', async () => {
    const account0 = await wallet.getAccountByPath("0'/0/0")
    const account1 = await wallet.getAccountByPath("0'/0/1")

    const TRANSFER = {
      token: testToken.target,
      recipient: await account1.getAddress(),
      amount: 100
    }

    const { hash } = await account0.transfer(TRANSFER)

    const { fee } = await provider.getTransactionReceipt(hash)

    const balanceAccount0 = await account0.getBalance()

    expect(balanceAccount0).toBe(INITIAL_BALANCE - fee)

    const tokenBalanceAccount0 = await account0.getTokenBalance(testToken.target)
    const tokenBalanceAccount1 = await account1.getTokenBalance(testToken.target)

    expect(tokenBalanceAccount0).toBe(INITIAL_TOKEN_BALANCE - 100n)
    expect(tokenBalanceAccount1).toBe(INITIAL_TOKEN_BALANCE + 100n)
  })

  test('should derive two accounts, approve x tokens from account 1 to 2, transfer x tokens from account 1 to 2 and get the correct balances and token balances', async () => {
    const account0 = await wallet.getAccount(0)

    const account1 = await wallet.getAccount(1)

    const TRANSACTION_APPROVE = {
      to: testToken.target,
      value: 0,
      data: testToken.interface.encodeFunctionData('approve', [
        await account1.getAddress(),
        100
      ])
    }

    const { hash: approveHash } = await account0.sendTransaction(TRANSACTION_APPROVE)

    const { fee: approveFee } = await provider.getTransactionReceipt(approveHash)

    const TRANSACTION_TRANSFER_FROM = {
      from: await account1.getAddress(),
      to: testToken.target,
      value: 0,
      data: testToken.interface.encodeFunctionData('transferFrom', [
        await account0.getAddress(),
        await account1.getAddress(),
        100
      ])
    }

    const { hash: transferFromHash } = await account1.sendTransaction(TRANSACTION_TRANSFER_FROM)

    const { fee: transferFromFee } = await provider.getTransactionReceipt(transferFromHash)

    const balanceAccount0 = await account0.getBalance()
    const balanceAccount1 = await account1.getBalance()

    expect(balanceAccount0).toBe(INITIAL_BALANCE - approveFee)
    expect(balanceAccount1).toBe(INITIAL_BALANCE - transferFromFee)

    const tokenBalanceAccount0 = await account0.getTokenBalance(testToken.target)
    const tokenBalanceAccount1 = await account1.getTokenBalance(testToken.target)

    expect(tokenBalanceAccount0).toBe(INITIAL_TOKEN_BALANCE - 100n)
    expect(tokenBalanceAccount1).toBe(INITIAL_TOKEN_BALANCE + 100n)
  })

  test('should create a wallet with a low transfer max fee, derive an account, try to transfer some tokens and gracefully fail', async () => {
    const wallet = new WalletManagerEvm(new SeedSignerEvm(SEED_PHRASE, "m/44'/60'"), { provider: RPC_URL, transferMaxFee: 0 })

    const account = await wallet.getAccount(0)

    const TRANSFER = {
      token: testToken.target,
      recipient: '0xa460AEbce0d3A4BecAd8ccf9D6D4861296c503Bd',
      amount: 100
    }

    await expect(account.transfer(TRANSFER))
      .rejects.toThrow('Exceeded maximum fee cost for transfer operation.')
  })

  test('should initialize an account with a non-derivable signer and send a transaction', async () => {
    const pkSigner = new PrivateKeySignerEvm(ACCOUNT_0.keyPair.privateKey)
    wallet.addSigner('imported', pkSigner)

    const account = await wallet.getAccount('imported')

    expect(await account.getAddress()).toBe(ACCOUNT_0.address)

    const TRANSACTION = {
      to: '0xa460AEbce0d3A4BecAd8ccf9D6D4861296c503Bd',
      value: 1_000
    }

    const { hash, fee } = await account.sendTransaction(TRANSACTION)

    const transaction = await provider.getTransaction(hash)

    expect(transaction.hash).toBe(hash)
    expect(transaction.to).toBe(TRANSACTION.to)
    expect(transaction.value).toBe(BigInt(TRANSACTION.value))
    expect(typeof fee).toBe('bigint')
  })

  test('should sign a transaction, then broadcast manually', async () => {
    const account = await wallet.getAccount(0)

    const address = await account.getAddress()
    const nonce = await provider.getTransactionCount(address)
    const { chainId } = await provider.getNetwork()

    const TRANSACTION = {
      to: '0xa460AEbce0d3A4BecAd8ccf9D6D4861296c503Bd',
      value: 1_000n,
      gasLimit: 21_000n,
      maxFeePerGas: 2_000_000_000n,
      maxPriorityFeePerGas: 1_000_000_000n,
      nonce,
      chainId
    }

    const signedTx = await account.signTransaction(TRANSACTION)

    const txResponse = await provider.broadcastTransaction(signedTx)
    await txResponse.wait()

    const { fee } = await provider.getTransactionReceipt(txResponse.hash)

    const transaction = await provider.getTransaction(txResponse.hash)

    expect(transaction.to).toBe(TRANSACTION.to)
    expect(transaction.value).toBe(TRANSACTION.value)

    const balanceAfterBroadcast = await account.getBalance()
    expect(balanceAfterBroadcast).toBe(INITIAL_BALANCE - fee - TRANSACTION.value)
  })

  test('should deploy a contract when the transaction has no recipient', async () => {
    const account = await wallet.getAccount(0)

    const { hash } = await account.sendTransaction({
      value: 0,
      data: SimpleDelegateContract.bytecode
    })

    const receipt = await provider.getTransactionReceipt(hash)

    // A contract-creation transaction has no recipient and yields a contract address.
    expect(receipt.to).toBeNull()
    expect(receipt.contractAddress).toBeTruthy()

    const code = await provider.getCode(receipt.contractAddress)
    expect(code).not.toBe('0x')
  })

  test('should send a type 4 transaction with an authorization list', async () => {
    const account = await wallet.getAccount(0)

    const auth = await account.signAuthorization({
      address: DELEGATE_CONTRACT_ADDRESS
    })

    const { hash, fee } = await account.sendTransaction({
      type: 4,
      to: account.address,
      value: 0,
      gasLimit: 100_000,
      authorizationList: [auth]
    })

    const transaction = await provider.getTransaction(hash)

    expect(transaction.to).toBe(account.address)
    expect(transaction.type).toBe(4)

    expect(transaction.authorizationList).toEqual([{
      address: DELEGATE_CONTRACT_ADDRESS,
      nonce: 0n,
      chainId: 1n,
      signature: expect.objectContaining({
        r: '0xa2b8fd8a79d4449081588213035817da714ea1062233ac6d3f276185408504fa',
        s: '0x0116b3fb7c6d7d7e8a084410fac2f6796a7d5810fff1415ec365d7502ac318b3',
        v: 27
      })
    }])

    expect(fee).toBeGreaterThan(0n)
  })

  test('should delegate an account to a contract and revoke the delegation', async () => {
    const account = await wallet.getAccount(0)

    await account.delegate(DELEGATE_CONTRACT_ADDRESS)

    expect(await account.getDelegation()).toEqual({
      isDelegated: true,
      delegateAddress: DELEGATE_CONTRACT_ADDRESS.toLowerCase()
    })

    await account.revokeDelegation()

    expect(await account.getDelegation()).toEqual({
      isDelegated: false,
      delegateAddress: null
    })
  })

  test('should approve tokens for a spender and read back the allowance', async () => {
    const account = await wallet.getAccount(0)

    const SPENDER = '0xa460AEbce0d3A4BecAd8ccf9D6D4861296c503Bd'

    const { fee } = await account.approve({
      token: testToken.target,
      spender: SPENDER,
      amount: 100n
    })

    expect(fee).toBeGreaterThan(0n)

    const allowance = await account.getAllowance(testToken.target, SPENDER)
    expect(allowance).toBe(100n)
  })

  test('should return the token balances of an account via multicall', async () => {
    const account = await wallet.getAccount(0)

    const testToken2 = await deployTestToken()
    const transaction = await testToken2.transfer(ACCOUNT_0.address, INITIAL_TOKEN_BALANCE * 2n)
    await transaction.wait()

    const balances = await account.getTokenBalances([testToken.target, testToken2.target])

    expect(balances).toEqual({
      [testToken.target]: INITIAL_TOKEN_BALANCE,
      [testToken2.target]: INITIAL_TOKEN_BALANCE * 2n
    })
  })

  test('should quote a transaction with an authorization list', async () => {
    const account = await wallet.getAccount(0)

    const { fee } = await account.quoteSendTransaction({
      to: ACCOUNT_0.address,
      value: 0,
      authorizationList: [{
        address: testToken.target,
        nonce: 0n,
        chainId: 31_337n,
        signature: '0x8350369e5b5aad1a0feade6d6549fe5494cfc6e4368dcebfbeb2ca7c684dfe33566860606b1c76dbaf823db90ad4d1cd79f97a486140fa9af801cb7f315ad4761c'
      }]
    })

    expect(fee).toBeGreaterThan(0n)
  })
})
