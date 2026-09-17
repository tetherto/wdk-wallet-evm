import { Interface, Transaction, ZeroAddress, toQuantity } from 'ethers'

import { beforeEach, describe, expect, jest, test } from '@jest/globals'

import * as bip39 from 'bip39'

import { MaximumFeeExceededError, ProviderRequiredError, ValueError } from '@tetherto/wdk-wallet'

import { WalletAccountEvm, WalletAccountReadOnlyEvm } from '../index.js'
import SeedSignerEvm from '../src/signers/seed-signer-evm.js'
import PrivateKeySignerEvm from '../src/signers/private-key-signer-evm.js'

const USDT_MAINNET_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7'
const DELEGATE_CONTRACT_ADDRESS = '0xbe08D4d81EbeA77f6AA54B2067EA5F56005F98dE'
const TOKEN_ADDRESS = '0x4CC1D60C268B68a7019034E6dE7Fb05d82d827E0'
const SPENDER_ADDRESS = '0xa460AEbce0d3A4BecAd8ccf9D6D4861296c503Bd'

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

const DUMMY_TX_HASH = '0xdef456abc123def456abc123def456abc123def456abc123def456abc123def4'
const SIGNED_TRANSACTION = '0x02f86e827a6980843b9aca00847735940082520894a460aebce0d3a4becad8ccf9d6d4861296c503bd8203e880c080a0189acf1d3170de712fd346182a77b08ccaa1317cdd13daf386f1405d52148171a04a83f7c7df7f258344e1726ac5b94f53fb415f0e41a58399b5031940b293b9ec'

// Fee constants implied by the mocked rpc responses below:
// maxFeePerGas = 2 * baseFee (1 gwei) + priorityFee (1 gwei) = 3 gwei.
const MOCKED_FEE_RATE = 3_000_000_000n
const MOCKED_GAS = 21_000n
const MOCKED_AUTH_LIST_GAS = 100_000n
const MOCKED_FEE = MOCKED_GAS * MOCKED_FEE_RATE

const DUMMY_BLOCK = {
  number: '0x1',
  hash: '0x' + '11'.repeat(32),
  parentHash: '0x' + '00'.repeat(32),
  timestamp: '0x64',
  nonce: '0x0000000000000000',
  difficulty: '0x0',
  gasLimit: '0x1c9c380',
  gasUsed: '0x0',
  miner: '0x0000000000000000000000000000000000000000',
  extraData: '0x',
  baseFeePerGas: '0x3b9aca00',
  transactions: []
}

function createProvider (overrides = {}) {
  const sentRawTransactions = []

  const handlers = {
    eth_chainId: () => '0x1',
    net_version: () => '1',
    eth_gasPrice: () => '0x3b9aca00',
    eth_maxPriorityFeePerGas: () => '0x3b9aca00',
    eth_getBlockByNumber: () => DUMMY_BLOCK,
    eth_estimateGas: (params) => params[0].type === '0x04' ? toQuantity(MOCKED_AUTH_LIST_GAS) : toQuantity(MOCKED_GAS),
    eth_getTransactionCount: () => '0x0',
    eth_sendRawTransaction: (params) => {
      sentRawTransactions.push(params[0])
      return DUMMY_TX_HASH
    },
    ...overrides
  }

  const provider = {
    sentRawTransactions,
    request: jest.fn(async ({ method, params }) => {
      const handler = handlers[method]
      if (!handler) throw new Error(`Unexpected rpc method: ${method}`)
      return handler(params)
    })
  }

  return provider
}

describe('WalletAccountEvm', () => {
  let provider,
    account

  beforeEach(async () => {
    provider = createProvider()

    const root = new SeedSignerEvm(SEED_PHRASE)
    const signer = await root.derive("0'/0/0")
    account = new WalletAccountEvm(signer, { provider })
  })

  describe('constructor (seed overload)', () => {
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
        .toThrow(ValueError)
      // eslint-disable-next-line no-new
      expect(() => { new WalletAccountEvm(INVALID_SEED_PHRASE, "0'/0/0") })
        .toThrow('The seed phrase is invalid.')
    })

    test('should throw if the path is invalid', () => {
      // eslint-disable-next-line no-new
      expect(() => { new WalletAccountEvm(SEED_PHRASE, "a'/b/c") })
        .toThrow('invalid path component')
    })

    test('should derive the same account as a manually derived signer', async () => {
      const seededAccount = new WalletAccountEvm(SEED_PHRASE, "0'/0/0")
      const signerAccount = new WalletAccountEvm(await new SeedSignerEvm(SEED_PHRASE).derive("0'/0/0"))

      expect(await seededAccount.getAddress()).toBe(await signerAccount.getAddress())
    })
  })

  describe('fromPrivateKey', () => {
    test('should create the account from a raw private key', async () => {
      const account = WalletAccountEvm.fromPrivateKey(ACCOUNT.keyPair.privateKey, { provider })

      expect(account).toBeInstanceOf(WalletAccountEvm)
      expect(await account.getAddress()).toBe(ACCOUNT.address)

      account.dispose()
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

  describe('signTypedData', () => {
    const DOMAIN = {
      name: 'TestApp',
      version: '1',
      chainId: 1,
      verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC'
    }

    const TYPES = {
      Person: [
        { name: 'name', type: 'string' },
        { name: 'wallet', type: 'address' }
      ],
      Mail: [
        { name: 'from', type: 'Person' },
        { name: 'to', type: 'Person' },
        { name: 'contents', type: 'string' }
      ]
    }

    const MESSAGE = {
      from: {
        name: 'Alice',
        wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826'
      },
      to: {
        name: 'Bob',
        wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB'
      },
      contents: 'Hello, Bob!'
    }

    const EXPECTED_SIGNATURE = '0xd5d54d9a7fe501ab5dc1532a443a4f70bc8b6ad1c3f09caac9b891efa8701cac5ad1d4830c7bc7ed2688965ed6b04d25e8f55906a843689fdf79100aee3a5dc71c'

    test('should return the correct signature', async () => {
      const signature = await account.signTypedData({
        domain: DOMAIN,
        types: TYPES,
        primaryType: 'Mail',
        message: MESSAGE
      })

      expect(signature).toBe(EXPECTED_SIGNATURE)
    })
  })

  describe('signTransaction', () => {
    const TRANSACTION = {
      to: SPENDER_ADDRESS,
      value: 1_000n,
      gasLimit: 21_000n,
      maxFeePerGas: 2_000_000_000n,
      maxPriorityFeePerGas: 1_000_000_000n,
      nonce: 0,
      chainId: 31_337n
    }

    test('should sign a transaction and return a valid hex string', async () => {
      const accountWithoutProvider = new WalletAccountEvm(await new SeedSignerEvm(SEED_PHRASE).derive("0'/0/0"))

      const signedTx = await accountWithoutProvider.signTransaction(TRANSACTION)

      expect(signedTx).toBe(SIGNED_TRANSACTION)
    })

    test('should throw if transaction fee exceeds the transaction max fee configuration', async () => {
      const account = new WalletAccountEvm(await new SeedSignerEvm(SEED_PHRASE).derive("0'/0/0"), {
        provider,
        transactionMaxFee: 0
      })

      const promise = account.signTransaction(TRANSACTION)

      await expect(promise).rejects.toThrow(MaximumFeeExceededError)
      await expect(promise).rejects.toThrow('Exceeded maximum fee cost for transaction operation.')
    })

    test('should not enforce transaction max fee without a provider', async () => {
      const account = new WalletAccountEvm(await new SeedSignerEvm(SEED_PHRASE).derive("0'/0/0"), {
        transactionMaxFee: 0
      })

      const signedTx = await account.signTransaction(TRANSACTION)

      expect(signedTx).toBe(SIGNED_TRANSACTION)
    })

    test('should allow a fee exactly equal to transactionMaxFee', async () => {
      const accountAtLimit = new WalletAccountEvm(await new SeedSignerEvm(SEED_PHRASE).derive("0'/0/0"), {
        provider,
        transactionMaxFee: MOCKED_FEE
      })

      const signedTx = await accountAtLimit.signTransaction(TRANSACTION)

      expect(signedTx).toBeTruthy()
    })
  })

  describe('sendTransaction', () => {
    test('should broadcast a signed transaction unchanged', async () => {
      const { hash, fee } = await account.sendTransaction(SIGNED_TRANSACTION)

      expect(hash).toBe(DUMMY_TX_HASH)
      expect(fee).toBe(MOCKED_FEE)
      expect(provider.sentRawTransactions).toEqual([SIGNED_TRANSACTION])
    })

    test('should sign and broadcast a transaction', async () => {
      const TRANSACTION = {
        to: SPENDER_ADDRESS,
        value: 1_000
      }

      const { hash, fee } = await account.sendTransaction(TRANSACTION)

      expect(hash).toBe(DUMMY_TX_HASH)
      expect(fee).toBe(MOCKED_FEE)

      const transaction = Transaction.from(provider.sentRawTransactions[0])

      expect(transaction.to).toBe(TRANSACTION.to)
      expect(transaction.value).toBe(BigInt(TRANSACTION.value))
      expect(transaction.chainId).toBe(1n)
      expect(transaction.from).toBe(ACCOUNT.address)
    })

    test('should throw if transaction fee exceeds the transaction max fee configuration', async () => {
      const account = new WalletAccountEvm(await new SeedSignerEvm(SEED_PHRASE).derive("0'/0/0"), {
        provider,
        transactionMaxFee: 0
      })

      const promise = account.sendTransaction({ to: SPENDER_ADDRESS, value: 1_000 })

      await expect(promise).rejects.toThrow(MaximumFeeExceededError)
      await expect(promise).rejects.toThrow('Exceeded maximum fee cost for transaction operation.')
    })

    test('should not broadcast a signed transaction that exceeds the transaction max fee configuration', async () => {
      const account = new WalletAccountEvm(await new SeedSignerEvm(SEED_PHRASE).derive("0'/0/0"), {
        provider,
        transactionMaxFee: 0
      })

      await expect(account.sendTransaction(SIGNED_TRANSACTION))
        .rejects.toThrow('Exceeded maximum fee cost for transaction operation.')

      expect(provider.sentRawTransactions).toEqual([])
    })

    test('should throw if the account is not connected to a provider', async () => {
      const account = new WalletAccountEvm(await new SeedSignerEvm(SEED_PHRASE).derive("0'/0/0"))

      const promise = account.sendTransaction({ })

      await expect(promise).rejects.toThrow(ProviderRequiredError)
      await expect(promise).rejects.toThrow('The wallet must be connected to a provider to send transactions.')
    })

    test('should throw if an eip-1559 transaction also sets a gas price', async () => {
      const promise = account.sendTransaction({
        to: SPENDER_ADDRESS,
        value: 1_000,
        gasPrice: 1_000_000_000,
        maxFeePerGas: 2_000_000_000
      })

      await expect(promise).rejects.toThrow(ValueError)
      await expect(promise).rejects.toThrow('eip-1559 transaction does not support gasPrice')
    })

    test('should throw if a legacy transaction sets eip-1559 fee fields', async () => {
      const promise = account.sendTransaction({
        to: SPENDER_ADDRESS,
        value: 1_000,
        type: 0,
        maxFeePerGas: 2_000_000_000
      })

      await expect(promise).rejects.toThrow(ValueError)
      await expect(promise).rejects.toThrow('pre-eip-1559 transaction does not support maxFeePerGas/maxPriorityFeePerGas')
    })

    test('should throw if a blob transaction also sets a gas price', async () => {
      const promise = account.sendTransaction({
        to: SPENDER_ADDRESS,
        value: 1_000,
        type: 3,
        gasPrice: 1_000_000_000
      })

      await expect(promise).rejects.toThrow(ValueError)
      await expect(promise).rejects.toThrow('blob transaction does not support gasPrice')
    })

    test('should throw if a blob transaction omits the max fee per blob gas', async () => {
      const promise = account.sendTransaction({
        to: SPENDER_ADDRESS,
        value: 1_000,
        type: 3,
        blobVersionedHashes: ['0x' + '01'.repeat(32)]
      })

      await expect(promise).rejects.toThrow(ValueError)
      await expect(promise).rejects.toThrow('maxFeePerBlobGas is required for type 3 transactions')
    })
  })

  describe('quoteSendTransaction', () => {
    test('should throw if quoting a raw transaction without a provider', async () => {
      const account = new WalletAccountEvm(await new SeedSignerEvm(SEED_PHRASE).derive("0'/0/0"))

      const promise = account.quoteSendTransaction('0xdeadbeef')

      await expect(promise).rejects.toThrow(ProviderRequiredError)
      await expect(promise).rejects.toThrow('The wallet must be connected to a provider to quote send transaction operations.')
    })
  })

  describe('transfer', () => {
    test('should sign and broadcast a token transfer', async () => {
      const TRANSFER = {
        token: TOKEN_ADDRESS,
        recipient: SPENDER_ADDRESS,
        amount: 100
      }

      const { hash, fee } = await account.transfer(TRANSFER)

      expect(hash).toBe(DUMMY_TX_HASH)
      expect(fee).toBe(MOCKED_FEE)

      const iface = new Interface(['function transfer(address to, uint256 amount) returns (bool)'])
      const data = iface.encodeFunctionData('transfer', [TRANSFER.recipient, TRANSFER.amount])

      const transaction = Transaction.from(provider.sentRawTransactions[0])

      expect(transaction.to).toBe(TRANSFER.token)
      expect(transaction.value).toBe(0n)
      expect(transaction.data).toBe(data)
    })

    test('should carry the gas overrides set on the options onto the broadcast transaction', async () => {
      const TRANSFER = {
        token: TOKEN_ADDRESS,
        recipient: SPENDER_ADDRESS,
        amount: 100,
        gasLimit: 90_000n,
        maxFeePerGas: 30_000_000_000n,
        maxPriorityFeePerGas: 2_000_000_000n
      }

      const { hash, fee } = await account.transfer(TRANSFER)

      expect(hash).toBe(DUMMY_TX_HASH)
      expect(fee).toBe(MOCKED_FEE)

      const transaction = Transaction.from(provider.sentRawTransactions[0])

      expect(transaction.type).toBe(2)
      expect(transaction.gasLimit).toBe(TRANSFER.gasLimit)
      expect(transaction.maxFeePerGas).toBe(TRANSFER.maxFeePerGas)
      expect(transaction.maxPriorityFeePerGas).toBe(TRANSFER.maxPriorityFeePerGas)
    })

    test('should throw if transfer fee exceeds the transfer max fee configuration', async () => {
      const account = new WalletAccountEvm(
        await new SeedSignerEvm(SEED_PHRASE).derive("0'/0/0"),
        { provider, transferMaxFee: 0 }
      )

      const promise = account.transfer({ token: TOKEN_ADDRESS, recipient: SPENDER_ADDRESS, amount: 100 })

      await expect(promise).rejects.toThrow(MaximumFeeExceededError)
      await expect(promise).rejects.toThrow('Exceeded maximum fee cost for transfer operation.')
    })

    test('should throw if the account is not connected to a provider', async () => {
      const account = new WalletAccountEvm(await new SeedSignerEvm(SEED_PHRASE).derive("0'/0/0"))

      const promise = account.transfer({ })

      await expect(promise).rejects.toThrow(ProviderRequiredError)
      await expect(promise).rejects.toThrow('The wallet must be connected to a provider to transfer tokens.')
    })
  })

  describe('approve', () => {
    const AMOUNT = 100n

    test('should sign and broadcast an approve transaction', async () => {
      const APPROVE_OPTIONS = {
        token: TOKEN_ADDRESS,
        spender: SPENDER_ADDRESS,
        amount: AMOUNT
      }

      const { hash, fee } = await account.approve(APPROVE_OPTIONS)

      expect(hash).toBe(DUMMY_TX_HASH)
      expect(typeof fee).toBe('bigint')
      expect(fee).toBeGreaterThan(0n)

      const iface = new Interface(['function approve(address spender, uint256 amount) returns (bool)'])
      const data = iface.encodeFunctionData('approve', [SPENDER_ADDRESS, AMOUNT])

      const transaction = Transaction.from(provider.sentRawTransactions[0])

      expect(transaction.to).toBe(APPROVE_OPTIONS.token)
      expect(transaction.data).toBe(data)
    })

    test('should carry the gas overrides set on the options onto the broadcast transaction', async () => {
      const APPROVE_OPTIONS = {
        token: TOKEN_ADDRESS,
        spender: SPENDER_ADDRESS,
        amount: AMOUNT,
        gasLimit: 60_000n,
        gasPrice: 5_000_000_000n
      }

      const { hash, fee } = await account.approve(APPROVE_OPTIONS)

      expect(hash).toBe(DUMMY_TX_HASH)
      expect(fee).toBe(MOCKED_FEE)

      const transaction = Transaction.from(provider.sentRawTransactions[0])

      expect(transaction.type).toBe(2)
      expect(transaction.gasLimit).toBe(APPROVE_OPTIONS.gasLimit)
      expect(transaction.maxFeePerGas).toBe(APPROVE_OPTIONS.gasPrice)
      expect(transaction.maxPriorityFeePerGas).toBe(APPROVE_OPTIONS.gasPrice)
    })

    test('should throw if approving non-zero USDT on mainnet when allowance is non-zero', async () => {
      jest.spyOn(account, 'getAllowance').mockResolvedValue(1n)

      const approveOptions = {
        token: USDT_MAINNET_ADDRESS,
        spender: SPENDER_ADDRESS,
        amount: AMOUNT
      }

      const promise = account.approve(approveOptions)

      await expect(promise).rejects.toThrow(ValueError)
      await expect(promise).rejects.toThrow('USDT requires the current allowance to be reset to 0 before setting a new non-zero value.')
    })

    test('should successfully approve a non-zero amount for USDT on mainnet when allowance is zero', async () => {
      jest.spyOn(account, 'getAllowance').mockResolvedValue(0n)
      const sendTxSpy = jest.spyOn(account, 'sendTransaction').mockResolvedValue({ hash: '0xhash', fee: 0n })

      const approveOptions = {
        token: USDT_MAINNET_ADDRESS,
        spender: SPENDER_ADDRESS,
        amount: AMOUNT
      }

      const iface = new Interface(['function approve(address spender, uint256 amount) returns (bool)'])
      const expectedData = iface.encodeFunctionData('approve', [SPENDER_ADDRESS, AMOUNT])

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
      const sendTxSpy = jest.spyOn(account, 'sendTransaction').mockResolvedValue({ hash: '0xhash', fee: 0n })

      const approveOptions = {
        token: USDT_MAINNET_ADDRESS,
        spender: SPENDER_ADDRESS,
        amount: 0
      }

      const iface = new Interface(['function approve(address spender, uint256 amount) returns (bool)'])
      const expectedData = iface.encodeFunctionData('approve', [SPENDER_ADDRESS, 0])

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
      const accountWithoutProvider = new WalletAccountEvm(await new SeedSignerEvm(SEED_PHRASE).derive("0'/0/0"))
      const approveOptions = {
        token: TOKEN_ADDRESS,
        spender: SPENDER_ADDRESS,
        amount: AMOUNT
      }

      const promise = accountWithoutProvider.approve(approveOptions)

      await expect(promise).rejects.toThrow(ProviderRequiredError)
      await expect(promise).rejects.toThrow('The wallet must be connected to a provider to approve funds.')
    })
  })

  describe('toReadOnlyAccount', () => {
    test('should return a read-only copy of the account', async () => {
      const readOnlyAccount = await account.toReadOnlyAccount()

      expect(readOnlyAccount).toBeInstanceOf(WalletAccountReadOnlyEvm)

      expect(await readOnlyAccount.getAddress()).toBe(ACCOUNT.address)
    })
  })

  describe('signAuthorization', () => {
    test('should resolve chain id and nonce from the provider and sign', async () => {
      const auth = await account.signAuthorization({
        address: DELEGATE_CONTRACT_ADDRESS
      })

      expect(auth).toEqual({
        address: DELEGATE_CONTRACT_ADDRESS,
        nonce: 0n,
        chainId: 1n,
        signature: expect.objectContaining({
          r: expect.stringMatching(/^0x[0-9a-f]{64}$/),
          s: expect.stringMatching(/^0x[0-9a-f]{64}$/)
        })
      })
    })
  })

  describe('delegate', () => {
    test('should send a type 4 transaction delegating to the contract', async () => {
      const { hash, fee } = await account.delegate(DELEGATE_CONTRACT_ADDRESS)

      expect(hash).toBe(DUMMY_TX_HASH)
      expect(fee).toBe(MOCKED_AUTH_LIST_GAS * MOCKED_FEE_RATE)

      const transaction = Transaction.from(provider.sentRawTransactions[0])

      expect(transaction.type).toBe(4)
      expect(transaction.to).toBe(ACCOUNT.address)
      expect(transaction.value).toBe(0n)

      expect(transaction.authorizationList).toHaveLength(1)
      expect(transaction.authorizationList[0].address.toLowerCase()).toBe(DELEGATE_CONTRACT_ADDRESS.toLowerCase())
      // The authorization nonce is the account nonce plus one, since the
      // delegation transaction itself increments the account nonce first.
      expect(transaction.authorizationList[0].nonce).toBe(1n)
    })

    test('should throw if the account is not connected to a provider', async () => {
      const account = new WalletAccountEvm(await new SeedSignerEvm(SEED_PHRASE).derive("0'/0/0"))

      const promise = account.delegate(DELEGATE_CONTRACT_ADDRESS)

      await expect(promise).rejects.toThrow(ProviderRequiredError)
      await expect(promise).rejects.toThrow('The wallet must be connected to a provider to delegate.')
    })
  })

  describe('revokeDelegation', () => {
    test('should send a type 4 transaction delegating to the zero address', async () => {
      const { hash } = await account.revokeDelegation()

      expect(hash).toBe(DUMMY_TX_HASH)

      const transaction = Transaction.from(provider.sentRawTransactions[0])

      expect(transaction.type).toBe(4)
      expect(transaction.authorizationList[0].address).toBe(ZeroAddress)
    })

    test('should throw if the account is not connected to a provider', async () => {
      const account = new WalletAccountEvm(await new SeedSignerEvm(SEED_PHRASE).derive("0'/0/0"))

      const promise = account.revokeDelegation()

      await expect(promise).rejects.toThrow(ProviderRequiredError)
      await expect(promise).rejects.toThrow('The wallet must be connected to a provider to delegate.')
    })
  })

  describe('dispose', () => {
    test('should erase the private key from memory', async () => {
      const account = new WalletAccountEvm(SEED_PHRASE, "0'/0/0")

      account.dispose()

      expect(account.keyPair.privateKey).toBe(null)
    })
  })
})
