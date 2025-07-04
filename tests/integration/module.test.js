import hre from 'hardhat'

import { ContractFactory } from 'ethers'

import { describe, expect, test, beforeAll, afterAll } from '@jest/globals'

import WalletManagerEvm from '../../index.js'

import TestToken from './../abis/TestToken.json'

const SEED_PHRASE = 'cook voyage document eight skate token alien guide drink uncle term abuse'

const ACCOUNT0 = {
  index: 0,
  path: "m/44'/60'/0'/0/0",
  address: '0x405005C7c4422390F4B334F64Cf20E0b767131d0',
  keyPair: {
    privateKey: '260905feebf1ec684f36f1599128b85f3a26c2b817f2065a2fc278398449c41f',
    publicKey: '036c082582225926b9356d95b91a4acffa3511b7cc2a14ef5338c090ea2cc3d0aa'
  }
}

const ACCOUNT1 = {
  index: 1,
  path: "m/44'/60'/0'/0/1",
  address: '0xcC81e04BadA16DEf9e1AFB027B859bec42BE49dB',
  keyPair: {
    privateKey: 'ba3d34b786d909f83be1422b75ea18005843ff979862619987fb0bab59580158',
    publicKey: '02f8d04c3de44e53e5b0ef2f822a29087e6af80114560956518767c64fec6b0f69'
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

describe('Integration tests', () => {
  describe('Sending Eth while checking fees', () => {
    let wallet
    let account0, account1
    const txAmount = 1_000
    let estimatedFee
    let startBalance0
    let startBalance1
    let actualFee

    beforeAll(async () => {
      await hre.network.provider.send('hardhat_reset')
    })

    afterAll(async () => {
      account0.dispose()
      account1.dispose()
    })

    test('should create a wallet and derive 2 accounts using path', async () => {
      wallet = new WalletManagerEvm(SEED_PHRASE, {
        provider: hre.network.provider
      })

      account0 = await wallet.getAccountByPath("0'/0/0")

      account1 = await wallet.getAccountByPath("0'/0/1")

      expect(account0.index).toBe(ACCOUNT0.index)

      expect(account0.path).toBe(ACCOUNT0.path)

      expect(account0.keyPair).toEqual({
        privateKey: new Uint8Array(Buffer.from(ACCOUNT0.keyPair.privateKey, 'hex')),
        publicKey: new Uint8Array(Buffer.from(ACCOUNT0.keyPair.publicKey, 'hex'))
      })

      expect(account1.index).toBe(ACCOUNT1.index)

      expect(account1.path).toBe(ACCOUNT1.path)

      expect(account1.keyPair).toEqual({
        privateKey: new Uint8Array(Buffer.from(ACCOUNT1.keyPair.privateKey, 'hex')),
        publicKey: new Uint8Array(Buffer.from(ACCOUNT1.keyPair.publicKey, 'hex'))
      })
    })

    test('should quote the cost of sending eth to from account0 to account1 and check the fee', async () => {
      const TRANSACTION = {
        to: await account1.getAddress(),
        value: txAmount
      }

      const EXPECTED_FEE = 63_003_000_000_000

      const { fee } = await account0.quoteSendTransaction(TRANSACTION)

      estimatedFee = fee

      expect(fee).toBe(EXPECTED_FEE)
    })

    test('should execute transaction', async () => {
      const TRANSACTION = {
        to: await account1.getAddress(),
        value: txAmount
      }

      startBalance0 = await account0.getBalance()
      startBalance1 = await account1.getBalance()

      const { hash, fee } = await account0.sendTransaction(TRANSACTION)
      const receipt = await hre.ethers.provider.getTransactionReceipt(hash)

      await new Promise(resolve => setTimeout(resolve, 200))

      expect(fee).toBe(estimatedFee)
      expect(receipt.status).toBe(1)
      actualFee = receipt.fee
    })

    test('should decrease sender balance by transaction amount plus fee', async () => {
      const endBalance0 = await account0.getBalance()

      const expectedBalance0 = startBalance0 - txAmount - parseInt(actualFee)
      expect(endBalance0).toEqual(expectedBalance0)
    })

    test('should increase recipient balance by transaction amount', async () => {
      const endBalance1 = await account1.getBalance()

      expect(endBalance1).toEqual(startBalance1 + txAmount)
    })
  })

  describe('Sending Eth to another account', () => {
    let wallet
    let account0, account1
    const txAmount = 1_000
    let startBalance1

    beforeAll(async () => {
      await hre.network.provider.send('hardhat_reset')
    })

    afterAll(async () => {
      account0.dispose()
      account1.dispose()
    })

    test('should create a wallet and derive 2 accounts using path', async () => {
      wallet = new WalletManagerEvm(SEED_PHRASE, {
        provider: hre.network.provider
      })

      account0 = await wallet.getAccountByPath("0'/0/0")

      account1 = await wallet.getAccountByPath("0'/0/1")

      expect(account0.index).toBe(ACCOUNT0.index)

      expect(account0.path).toBe(ACCOUNT0.path)

      expect(account0.keyPair).toEqual({
        privateKey: new Uint8Array(Buffer.from(ACCOUNT0.keyPair.privateKey, 'hex')),
        publicKey: new Uint8Array(Buffer.from(ACCOUNT0.keyPair.publicKey, 'hex'))
      })

      expect(account1.index).toBe(ACCOUNT1.index)

      expect(account1.path).toBe(ACCOUNT1.path)

      expect(account1.keyPair).toEqual({
        privateKey: new Uint8Array(Buffer.from(ACCOUNT1.keyPair.privateKey, 'hex')),
        publicKey: new Uint8Array(Buffer.from(ACCOUNT1.keyPair.publicKey, 'hex'))
      })
    })

    test('should successfully send transaction', async () => {
      const TRANSACTION = {
        to: await account1.getAddress(),
        value: txAmount
      }

      startBalance1 = await account1.getBalance()

      const { hash } = await account0.sendTransaction(TRANSACTION)
      const receipt = await hre.ethers.provider.getTransactionReceipt(hash)

      await new Promise(resolve => setTimeout(resolve, 200))

      expect(receipt.status).toBe(1)
    })

    test('should increase recipient balance by transaction amount', async () => {
      const endBalance1 = await account1.getBalance()

      expect(endBalance1).toEqual(startBalance1 + txAmount)
    })
  })

  describe('Sending Test Tokens while checking fees', () => {
    let wallet
    let account0, account1
    const txAmount = 100
    let testToken
    let startBalance0
    let startTokenBalance0
    let startTokenBalance1
    let actualFee

    beforeAll(async () => {
      await hre.network.provider.send('hardhat_reset')
      testToken = await deployTestToken()
    })

    afterAll(async () => {
      account0.dispose()
      account1.dispose()
    })

    test('should create a wallet and derive 2 accounts using path', async () => {
      wallet = new WalletManagerEvm(SEED_PHRASE, {
        provider: hre.network.provider
      })

      account0 = await wallet.getAccountByPath("0'/0/0")

      account1 = await wallet.getAccountByPath("0'/0/1")

      expect(account0.index).toBe(ACCOUNT0.index)

      expect(account0.path).toBe(ACCOUNT0.path)

      expect(account0.keyPair).toEqual({
        privateKey: new Uint8Array(Buffer.from(ACCOUNT0.keyPair.privateKey, 'hex')),
        publicKey: new Uint8Array(Buffer.from(ACCOUNT0.keyPair.publicKey, 'hex'))
      })

      expect(account1.index).toBe(ACCOUNT1.index)

      expect(account1.path).toBe(ACCOUNT1.path)

      expect(account1.keyPair).toEqual({
        privateKey: new Uint8Array(Buffer.from(ACCOUNT1.keyPair.privateKey, 'hex')),
        publicKey: new Uint8Array(Buffer.from(ACCOUNT1.keyPair.publicKey, 'hex'))
      })
    })

    test('should quote the cost of sending test tokens to from account0 to account1 and check the fee', async () => {
      const TRANSACTION = {
        token: testToken.target,
        recipient: await account1.getAddress(),
        amount: txAmount
      }

      const EXPECTED_FEE = 143_352_000_000_000

      const { fee } = await account0.quoteTransfer(TRANSACTION)

      expect(fee).toBe(EXPECTED_FEE)
    })

    test('should execute transaction', async () => {
      const TRANSACTION = {
        token: testToken.target,
        recipient: await account1.getAddress(),
        amount: txAmount
      }

      startBalance0 = await account0.getBalance()

      startTokenBalance0 = await account0.getTokenBalance(testToken.target)
      startTokenBalance1 = await account1.getTokenBalance(testToken.target)

      const { hash } = await account0.transfer(TRANSACTION)
      const receipt = await hre.ethers.provider.getTransactionReceipt(hash)

      await new Promise(resolve => setTimeout(resolve, 200))

      actualFee = receipt.fee

      expect(receipt.status).toBe(1)
    })

    test('should decrease sender balance by fee', async () => {
      const endBalance0 = await account0.getBalance()
      const expectedBalance0 = startBalance0 - parseInt(actualFee)
      expect(endBalance0).toEqual(expectedBalance0)
    })

    test('should decrease sender token balance by transaction amount', async () => {
      const endTokenBalance0 = await account0.getTokenBalance(testToken.target)

      const expectedTokenBalance0 = startTokenBalance0 - txAmount
      expect(endTokenBalance0).toEqual(expectedTokenBalance0)
    })

    test('should increase recipient token balance by transaction amount', async () => {
      const endTokenBalance1 = await account1.getTokenBalance(testToken.target)

      expect(endTokenBalance1).toEqual(startTokenBalance1 + txAmount)
    })
  })

  describe('Sending Test Tokens to another account', () => {
    let wallet
    let account0, account1
    const txAmount = 100
    let startTokenBalance1
    let testToken

    beforeAll(async () => {
      await hre.network.provider.send('hardhat_reset')
      testToken = await deployTestToken()
    })

    afterAll(async () => {
      account0.dispose()
      account1.dispose()
    })

    test('should create a wallet and derive 2 accounts using path', async () => {
      wallet = new WalletManagerEvm(SEED_PHRASE, {
        provider: hre.network.provider
      })

      account0 = await wallet.getAccountByPath("0'/0/0")

      account1 = await wallet.getAccountByPath("0'/0/1")

      expect(account0.index).toBe(ACCOUNT0.index)

      expect(account0.path).toBe(ACCOUNT0.path)

      expect(account0.keyPair).toEqual({
        privateKey: new Uint8Array(Buffer.from(ACCOUNT0.keyPair.privateKey, 'hex')),
        publicKey: new Uint8Array(Buffer.from(ACCOUNT0.keyPair.publicKey, 'hex'))
      })

      expect(account1.index).toBe(ACCOUNT1.index)

      expect(account1.path).toBe(ACCOUNT1.path)

      expect(account1.keyPair).toEqual({
        privateKey: new Uint8Array(Buffer.from(ACCOUNT1.keyPair.privateKey, 'hex')),
        publicKey: new Uint8Array(Buffer.from(ACCOUNT1.keyPair.publicKey, 'hex'))
      })
    })

    test('should successfully send transaction', async () => {
      const TRANSACTION = {
        token: testToken.target,
        recipient: await account1.getAddress(),
        amount: txAmount
      }

      startTokenBalance1 = await account1.getTokenBalance(testToken.target)

      const { hash } = await account0.transfer(TRANSACTION)
      const receipt = await hre.ethers.provider.getTransactionReceipt(hash)

      await new Promise(resolve => setTimeout(resolve, 200))

      expect(receipt.status).toBe(1)
    })

    test('should increase recipient token balance by transaction amount', async () => {
      const endTokenBalance1 = await account1.getTokenBalance(testToken.target)

      expect(endTokenBalance1).toEqual(startTokenBalance1 + txAmount)
    })
  })

  describe('Approving and sending Test Tokens to another account', () => {
    let wallet
    let account0, account1
    const txAmount = 100
    let startTokenBalance0
    let startTokenBalance1
    let testToken

    beforeAll(async () => {
      await hre.network.provider.send('hardhat_reset')
      testToken = await deployTestToken()
    })

    afterAll(async () => {
      account0.dispose()
      account1.dispose()
    })

    test('should create a wallet and derive 2 accounts using path', async () => {
      wallet = new WalletManagerEvm(SEED_PHRASE, {
        provider: hre.network.provider
      })

      account0 = await wallet.getAccountByPath("0'/0/0")

      account1 = await wallet.getAccountByPath("0'/0/1")

      expect(account0.index).toBe(ACCOUNT0.index)

      expect(account0.path).toBe(ACCOUNT0.path)

      expect(account0.keyPair).toEqual({
        privateKey: new Uint8Array(Buffer.from(ACCOUNT0.keyPair.privateKey, 'hex')),
        publicKey: new Uint8Array(Buffer.from(ACCOUNT0.keyPair.publicKey, 'hex'))
      })

      expect(account1.index).toBe(ACCOUNT1.index)

      expect(account1.path).toBe(ACCOUNT1.path)

      expect(account1.keyPair).toEqual({
        privateKey: new Uint8Array(Buffer.from(ACCOUNT1.keyPair.privateKey, 'hex')),
        publicKey: new Uint8Array(Buffer.from(ACCOUNT1.keyPair.publicKey, 'hex'))
      })
    })

    test('should get token balance of account0', async () => {
      const tokenBalance = await account0.getTokenBalance(testToken.target)
      expect(tokenBalance).toBe(1000000000000000000)

      startTokenBalance0 = await account0.getTokenBalance(testToken.target)
      startTokenBalance1 = await account1.getTokenBalance(testToken.target)
    })

    test('should approve tokens for account1', async () => {
      const TRANSACTION_WITH_DATA = {
        to: testToken.target,
        value: 0,
        data: testToken.interface.encodeFunctionData('approve', [
          await account1.getAddress(),
          txAmount
        ])
      }

      const { hash } = await account0.sendTransaction(TRANSACTION_WITH_DATA)

      const receipt = await hre.ethers.provider.getTransactionReceipt(hash)

      await new Promise(resolve => setTimeout(resolve, 200))

      expect(receipt.status).toBe(1)
    })

    test('should get allowance of account0 for account1', async () => {
      const allowance = await testToken.allowance(await account0.getAddress(), await account1.getAddress())
      expect(allowance).toBe(BigInt(txAmount))
    })

    test('should send eth to account1 for gas', async () => {
      const TRANSACTION = {
        to: await account1.getAddress(),
        value: 1_000_000_000_000_000
      }
      const { hash } = await account0.sendTransaction(TRANSACTION)
      const receipt = await hre.ethers.provider.getTransactionReceipt(hash)

      await new Promise(resolve => setTimeout(resolve, 200))

      expect(receipt.status).toBe(1)
      expect(await account1.getBalance()).toBeGreaterThan(0)
    })

    test('should allow account1 to send tokens to itself from account0', async () => {
      const TRANSACTION_WITH_DATA = {
        to: testToken.target,
        from: await account1.getAddress(),
        value: 0,
        data: testToken.interface.encodeFunctionData('transferFrom', [
          await account0.getAddress(),
          await account1.getAddress(),
          txAmount
        ])
      }

      const { hash } = await account1.sendTransaction(TRANSACTION_WITH_DATA)

      const receipt = await hre.ethers.provider.getTransactionReceipt(hash)

      await new Promise(resolve => setTimeout(resolve, 200))

      expect(receipt.status).toBe(1)
    })

    test('should decrease sender token balance by transaction amount', async () => {
      const endTokenBalance0 = await account0.getTokenBalance(testToken.target)

      const expectedTokenBalance0 = startTokenBalance0 - txAmount
      expect(endTokenBalance0).toEqual(expectedTokenBalance0)
    })

    test('should increase recipient token balance by transaction amount', async () => {
      const endTokenBalance1 = await account1.getTokenBalance(testToken.target)

      expect(endTokenBalance1).toEqual(startTokenBalance1 + txAmount)
    })
  })

  describe('Signing a message and verifying its signature', () => {
    let wallet
    let account0
    const message = 'Hello, world!'
    let signature

    beforeAll(async () => {
      await hre.network.provider.send('hardhat_reset')
    })

    afterAll(async () => {
      account0.dispose()
    })

    test('should create a wallet and derive account using path', async () => {
      wallet = new WalletManagerEvm(SEED_PHRASE, {
        provider: hre.network.provider
      })

      account0 = await wallet.getAccountByPath("0'/0/0")

      expect(account0.index).toBe(ACCOUNT0.index)

      expect(account0.path).toBe(ACCOUNT0.path)
    })

    test('should sign a message and verify its signature', async () => {
      signature = await account0.sign(message)
      expect(signature).toBeDefined()
    })

    test('should verify the signature', async () => {
      const verified = await account0.verify(message, signature)
      expect(verified).toBe(true)
    })
  })

  describe('Disposing the wallet', () => {
    let wallet
    let account0
    let account1
    const message = 'Hello, world!'

    beforeAll(async () => {
      await hre.network.provider.send('hardhat_reset')
    })

    test('should create a wallet and derive account using path', async () => {
      wallet = new WalletManagerEvm(SEED_PHRASE, {
        provider: hre.network.provider
      })

      account0 = await wallet.getAccountByPath("0'/0/0")

      account1 = await wallet.getAccountByPath("0'/0/1")

      expect(account0.index).toBe(ACCOUNT0.index)

      expect(account0.path).toBe(ACCOUNT0.path)

      expect(account0.keyPair).toEqual({
        privateKey: new Uint8Array(Buffer.from(ACCOUNT0.keyPair.privateKey, 'hex')),
        publicKey: new Uint8Array(Buffer.from(ACCOUNT0.keyPair.publicKey, 'hex'))
      })

      expect(account1.index).toBe(ACCOUNT1.index)

      expect(account1.path).toBe(ACCOUNT1.path)

      expect(account1.keyPair).toEqual({
        privateKey: new Uint8Array(Buffer.from(ACCOUNT1.keyPair.privateKey, 'hex')),
        publicKey: new Uint8Array(Buffer.from(ACCOUNT1.keyPair.publicKey, 'hex'))
      })
    })

    test('should dispose the wallet and throw an error when trying to access the private key', async () => {
      wallet.dispose()

      expect(() => {
        account0.keyPair.privateKey // eslint-disable-line
      }).toThrow('Uint8Array expected')

      expect(() => {
        account1.keyPair.privateKey // eslint-disable-line
      }).toThrow('Uint8Array expected')
    })

    test('should throw an error when trying to send a transaction', async () => {
      await expect(account0.sendTransaction({ to: await account1.getAddress(), value: 1000 })).rejects.toThrow('Uint8Array expected')
    })

    test('should throw an error when trying to sign a message', async () => {
      await expect(account0.sign(message)).rejects.toThrow('Uint8Array expected')
    })
  })

  describe('Sending a transaction with a low transfer max fee', () => {
    let wallet
    let account0
    let account1
    const maxFee = 1_000_000
    let testToken

    beforeAll(async () => {
      await hre.network.provider.send('hardhat_reset')
      testToken = await deployTestToken()
    })

    afterAll(async () => {
      account0.dispose()
      account1.dispose()
    })

    test('should create a wallet and derive account using path', async () => {
      wallet = new WalletManagerEvm(SEED_PHRASE, {
        provider: hre.network.provider,
        transferMaxFee: maxFee
      })

      account0 = await wallet.getAccountByPath("0'/0/0")

      account1 = await wallet.getAccountByPath("0'/0/1")

      expect(account0.index).toBe(ACCOUNT0.index)

      expect(account0.path).toBe(ACCOUNT0.path)

      expect(account0.keyPair).toEqual({
        privateKey: new Uint8Array(Buffer.from(ACCOUNT0.keyPair.privateKey, 'hex')),
        publicKey: new Uint8Array(Buffer.from(ACCOUNT0.keyPair.publicKey, 'hex'))
      })

      expect(account1.index).toBe(ACCOUNT1.index)

      expect(account1.path).toBe(ACCOUNT1.path)

      expect(account1.keyPair).toEqual({
        privateKey: new Uint8Array(Buffer.from(ACCOUNT1.keyPair.privateKey, 'hex')),
        publicKey: new Uint8Array(Buffer.from(ACCOUNT1.keyPair.publicKey, 'hex'))
      })
    })

    test('should send a transaction with a low transfer max fee', async () => {
      const TRANSACTION = {
        token: testToken.target,
        recipient: await account1.getAddress(),
        amount: 100000000000000
      }

      await expect(account0.transfer(TRANSACTION)).rejects.toThrow('Exceeded maximum fee cost for transfer operation.')
    })
  })
})
