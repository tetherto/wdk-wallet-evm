import { AbiCoder, Interface, toQuantity } from 'ethers'

import { describe, expect, jest, test } from '@jest/globals'

import { WalletAccountReadOnlyEvm } from '../index.js'
import { NoSuchElementError, ProviderRequiredError, ValueError } from '@tetherto/wdk-wallet'

const ADDRESS = '0x405005C7c4422390F4B334F64Cf20E0b767131d0'
const TOKEN_ADDRESS = '0x4CC1D60C268B68a7019034E6dE7Fb05d82d827E0'
const TOKEN_ADDRESS_2 = '0xbe08D4d81EbeA77f6AA54B2067EA5F56005F98dE'
const SPENDER_ADDRESS = '0xa460AEbce0d3A4BecAd8ccf9D6D4861296c503Bd'

const DUMMY_BALANCE = 1_000_000_000_000_000_000n
const DUMMY_TOKEN_BALANCE = 1_000_000n
const DUMMY_ALLOWANCE = 500_000n

// Fee constants implied by the mocked rpc responses below:
// maxFeePerGas = 2 * baseFee (1 gwei) + priorityFee (1 gwei) = 3 gwei.
const MOCKED_FEE_RATE = 3_000_000_000n
const MOCKED_GAS = 21_000n
const MOCKED_AUTH_LIST_GAS = 100_000n

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

const abi = AbiCoder.defaultAbiCoder()

function createProvider (overrides = {}) {
  const handlers = {
    eth_chainId: () => '0x1',
    net_version: () => '1',
    eth_gasPrice: () => '0x3b9aca00',
    eth_maxPriorityFeePerGas: () => '0x3b9aca00',
    eth_getBlockByNumber: () => DUMMY_BLOCK,
    eth_estimateGas: (params) => params[0].type === '0x04' ? toQuantity(MOCKED_AUTH_LIST_GAS) : toQuantity(MOCKED_GAS),
    eth_getTransactionCount: () => '0x0',
    eth_getBalance: () => toQuantity(DUMMY_BALANCE),
    eth_getTransactionReceipt: () => null,
    eth_getCode: () => '0x',
    eth_call: (params) => params[0].to
      ? abi.encode(['uint256'], [DUMMY_TOKEN_BALANCE])
      : abi.encode(['uint256', 'tuple(bool, bytes)[]'], [1n, [[true, abi.encode(['uint256'], [DUMMY_TOKEN_BALANCE])]]]),
    ...overrides
  }

  return {
    request: jest.fn(async ({ method, params }) => {
      const handler = handlers[method]
      if (!handler) throw new Error(`Unexpected rpc method: ${method}`)
      return handler(params)
    })
  }
}

function createAccount (overrides = {}) {
  return new WalletAccountReadOnlyEvm(ADDRESS, { provider: createProvider(overrides) })
}

describe('WalletAccountReadOnlyEvm', () => {
  const account = createAccount()

  describe('address', () => {
    test('should return the correct address', () => {
      expect(account.address).toBe(ADDRESS)
    })
  })

  describe('getBalance', () => {
    test('should return the correct balance of the account', async () => {
      const balance = await account.getBalance()

      expect(balance).toBe(DUMMY_BALANCE)
    })

    test('should throw if the account is not connected to a provider', async () => {
      const account = new WalletAccountReadOnlyEvm(ADDRESS)

      const promise = account.getBalance()

      await expect(promise).rejects.toThrow(ProviderRequiredError)
      await expect(promise).rejects.toThrow('The wallet must be connected to a provider to retrieve balances.')
    })
  })

  describe('getTokenBalance', () => {
    test('should return the correct token balance of the account', async () => {
      const balance = await account.getTokenBalance(TOKEN_ADDRESS)

      expect(balance).toBe(DUMMY_TOKEN_BALANCE)
    })

    test('should throw if the account is not connected to a provider', async () => {
      const account = new WalletAccountReadOnlyEvm(ADDRESS)

      const promise = account.getTokenBalance(TOKEN_ADDRESS)

      await expect(promise).rejects.toThrow(ProviderRequiredError)
      await expect(promise).rejects.toThrow('The wallet must be connected to a provider to retrieve token balances.')
    })
  })

  describe('getTokenBalances', () => {
    test('should return an empty object for an empty array', async () => {
      const balances = await account.getTokenBalances([])

      expect(balances).toEqual({})
    })

    test('should return the correct balance for a single token', async () => {
      const balances = await account.getTokenBalances([TOKEN_ADDRESS])

      expect(balances).toEqual({
        [TOKEN_ADDRESS]: DUMMY_TOKEN_BALANCE
      })
    })

    test('should return the correct token balances of the account', async () => {
      const account = createAccount({
        eth_call: () => abi.encode(
          ['uint256', 'tuple(bool, bytes)[]'],
          [1n, [
            [true, abi.encode(['uint256'], [DUMMY_TOKEN_BALANCE])],
            [true, abi.encode(['uint256'], [DUMMY_TOKEN_BALANCE * 2n])]
          ]]
        )
      })

      const balances = await account.getTokenBalances([TOKEN_ADDRESS, TOKEN_ADDRESS_2])

      expect(balances).toEqual({
        [TOKEN_ADDRESS]: DUMMY_TOKEN_BALANCE,
        [TOKEN_ADDRESS_2]: DUMMY_TOKEN_BALANCE * 2n
      })
    })

    test('should return 0n for tokens whose balance call fails', async () => {
      const account = createAccount({
        eth_call: () => abi.encode(
          ['uint256', 'tuple(bool, bytes)[]'],
          [1n, [[false, '0x']]]
        )
      })

      const balances = await account.getTokenBalances([TOKEN_ADDRESS])

      expect(balances).toEqual({
        [TOKEN_ADDRESS]: 0n
      })
    })

    test('should throw if the account is not connected to a provider', async () => {
      const account = new WalletAccountReadOnlyEvm(ADDRESS)

      const promise = account.getTokenBalances([TOKEN_ADDRESS])

      await expect(promise).rejects.toThrow(ProviderRequiredError)
      await expect(promise).rejects.toThrow('The wallet must be connected to a provider to retrieve token balances.')
    })
  })

  describe('quoteSendTransaction', () => {
    test('should quote a transaction as gas estimate times fee rate', async () => {
      const TRANSACTION = {
        to: SPENDER_ADDRESS,
        value: 1_000
      }

      const { fee } = await account.quoteSendTransaction(TRANSACTION)

      expect(fee).toBe(MOCKED_GAS * MOCKED_FEE_RATE)
    })

    test('should quote a transaction with an authorization list', async () => {
      const TRANSACTION_WITH_AUTHORIZATION_LIST = {
        to: ADDRESS,
        value: 0,
        authorizationList: [{
          address: TOKEN_ADDRESS,
          nonce: 0n,
          chainId: 1n,
          signature: '0x8350369e5b5aad1a0feade6d6549fe5494cfc6e4368dcebfbeb2ca7c684dfe33566860606b1c76dbaf823db90ad4d1cd79f97a486140fa9af801cb7f315ad4761c'
        }]
      }

      const { fee } = await account.quoteSendTransaction(TRANSACTION_WITH_AUTHORIZATION_LIST)

      expect(fee).toBe(MOCKED_AUTH_LIST_GAS * MOCKED_FEE_RATE)
    })

    test('should throw if the account is not connected to a provider', async () => {
      const account = new WalletAccountReadOnlyEvm(ADDRESS)

      const promise = account.quoteSendTransaction({})

      await expect(promise).rejects.toThrow(ProviderRequiredError)
      await expect(promise).rejects.toThrow('The wallet must be connected to a provider to quote send transaction operations.')
    })
  })

  describe('quoteTransfer', () => {
    test('should quote a transfer as gas estimate times fee rate', async () => {
      const TRANSFER = {
        token: TOKEN_ADDRESS,
        recipient: SPENDER_ADDRESS,
        amount: 100
      }

      const { fee } = await account.quoteTransfer(TRANSFER)

      expect(fee).toBe(MOCKED_GAS * MOCKED_FEE_RATE)
    })

    test('should estimate the transfer with the gas overrides set on the options', async () => {
      const estimateGasMock = jest.fn(() => toQuantity(MOCKED_GAS))
      const account = createAccount({ eth_estimateGas: estimateGasMock })

      const TRANSFER = {
        token: TOKEN_ADDRESS,
        recipient: SPENDER_ADDRESS,
        amount: 100,
        gasLimit: 90_000n,
        maxFeePerGas: 30_000_000_000n,
        maxPriorityFeePerGas: 2_000_000_000n
      }

      const iface = new Interface(['function transfer(address to, uint256 amount) returns (bool)'])
      const data = iface.encodeFunctionData('transfer', [TRANSFER.recipient, TRANSFER.amount])

      const { fee } = await account.quoteTransfer(TRANSFER)

      expect(fee).toBe(MOCKED_GAS * MOCKED_FEE_RATE)
      expect(estimateGasMock).toHaveBeenCalledWith([{
        from: ADDRESS.toLowerCase(),
        to: TOKEN_ADDRESS.toLowerCase(),
        data,
        value: '0x0',
        gas: toQuantity(TRANSFER.gasLimit),
        maxFeePerGas: toQuantity(TRANSFER.maxFeePerGas),
        maxPriorityFeePerGas: toQuantity(TRANSFER.maxPriorityFeePerGas)
      }])
    })

    test('should throw if the account is not connected to a provider', async () => {
      const account = new WalletAccountReadOnlyEvm(ADDRESS)

      const promise = account.quoteTransfer({})

      await expect(promise).rejects.toThrow(ProviderRequiredError)
      await expect(promise).rejects.toThrow('The wallet must be connected to a provider to quote transfer operations.')
    })
  })

  describe('getTransactionReceipt', () => {
    test('should return the correct transaction receipt', async () => {
      const HASH = '0xdef456abc123def456abc123def456abc123def456abc123def456abc123def4'

      const account = createAccount({
        eth_getTransactionReceipt: (params) => ({
          transactionHash: params[0],
          transactionIndex: '0x0',
          blockHash: '0x' + '22'.repeat(32),
          blockNumber: '0x1',
          from: ADDRESS,
          to: SPENDER_ADDRESS,
          contractAddress: null,
          gasUsed: '0x5208',
          cumulativeGasUsed: '0x5208',
          effectiveGasPrice: '0x77359400',
          logsBloom: '0x' + '00'.repeat(256),
          logs: [],
          status: '0x1',
          type: '0x2'
        })
      })

      const receipt = await account.getTransactionReceipt(HASH)

      expect(receipt.hash).toBe(HASH)
      expect(receipt.to).toBe(SPENDER_ADDRESS)
      expect(receipt.from).toBe(ADDRESS)
      expect(receipt.status).toBe(1)
      expect(receipt.blockNumber).toBe(1)
      expect(receipt.gasUsed).toBe(21_000n)
      expect(receipt.fee).toBe(21_000n * 2_000_000_000n)
    })

    test('should return null if the transaction has not been included in a block yet', async () => {
      const HASH = '0xe60970cd7685466037bac1ff337e08265ac9f48af70a12529bdca5caf5a2b14b'

      const receipt = await account.getTransactionReceipt(HASH)

      expect(receipt).toBe(null)
    })

    test('should throw if the account is not connected to a provider', async () => {
      const HASH = '0xe60970cd7685466037bac1ff337e08265ac9f48af70a12529bdca5caf5a2b14b'

      const account = new WalletAccountReadOnlyEvm(ADDRESS)

      const promise = account.getTransactionReceipt(HASH)

      await expect(promise).rejects.toThrow(ProviderRequiredError)
      await expect(promise).rejects.toThrow('The wallet must be connected to a provider to fetch transaction receipts.')
    })
  })

  describe('getTransaction', () => {
    const HASH = '0xdef456abc123def456abc123def456abc123def456abc123def456abc123def4'

    function receiptResponse (params, { status = '0x1', blockNumber = '0xa' } = {}) {
      return {
        transactionHash: params[0],
        transactionIndex: '0x0',
        blockHash: '0x' + '22'.repeat(32),
        blockNumber,
        from: ADDRESS,
        to: SPENDER_ADDRESS,
        contractAddress: null,
        gasUsed: '0x5208',
        cumulativeGasUsed: '0x5208',
        effectiveGasPrice: '0x77359400',
        logsBloom: '0x' + '00'.repeat(256),
        logs: [],
        status,
        type: '0x2'
      }
    }

    function txResponse (params) {
      return {
        hash: params[0],
        nonce: '0x0',
        blockHash: null,
        blockNumber: null,
        transactionIndex: null,
        from: ADDRESS,
        to: SPENDER_ADDRESS,
        value: '0x0',
        gasPrice: '0x77359400',
        gas: '0x5208',
        input: '0x',
        type: '0x0',
        chainId: '0x1',
        v: '0x1b',
        r: '0x' + '11'.repeat(32),
        s: '0x' + '22'.repeat(32)
      }
    }

    function finalizedBlock (number) {
      return (params) => params[0] === 'finalized' ? { ...DUMMY_BLOCK, number } : DUMMY_BLOCK
    }

    test('returns confirmed when mined but not yet finalized', async () => {
      const account = createAccount({
        eth_getTransactionByHash: () => null,
        eth_getTransactionReceipt: (params) => receiptResponse(params),
        eth_blockNumber: () => '0xa',
        eth_getBlockByNumber: finalizedBlock('0x5')
      })

      const info = await account.getTransaction(HASH)

      expect(info.hash).toBe(HASH)
      expect(info.finality).toBe('confirmed')
      expect(info.success).toBe(true)
      expect(info.confirmations).toBe(1)
      expect(info.fee).toBe(21_000n * 2_000_000_000n)
      expect(info.receipt).not.toBeNull()
    })

    test('returns final when the block is at or below the finalized block', async () => {
      const account = createAccount({
        eth_getTransactionByHash: () => null,
        eth_getTransactionReceipt: (params) => receiptResponse(params),
        eth_blockNumber: () => '0xa',
        eth_getBlockByNumber: finalizedBlock('0x14')
      })

      const info = await account.getTransaction(HASH)

      expect(info.finality).toBe('final')
      expect(info.success).toBe(true)
    })

    test('returns success false for a reverted transaction', async () => {
      const account = createAccount({
        eth_getTransactionByHash: () => null,
        eth_getTransactionReceipt: (params) => receiptResponse(params, { status: '0x0' }),
        eth_blockNumber: () => '0xa',
        eth_getBlockByNumber: finalizedBlock('0x5')
      })

      const info = await account.getTransaction(HASH)

      expect(info.finality).toBe('confirmed')
      expect(info.success).toBe(false)
    })

    test('returns pending when seen in the mempool but not mined', async () => {
      const account = createAccount({
        eth_getTransactionByHash: (params) => txResponse(params),
        eth_getTransactionReceipt: () => null
      })

      const info = await account.getTransaction(HASH)

      expect(info.finality).toBe('pending')
      expect(info.success).toBeUndefined()
      expect(info.confirmations).toBe(0)
      expect(info.receipt).toBeNull()
    })

    test('returns dropped when the nonce slot has been taken by another tx', async () => {
      const account = createAccount({
        eth_getTransactionByHash: (params) => txResponse(params),
        eth_getTransactionReceipt: () => null,
        eth_getTransactionCount: () => '0x1'
      })

      const info = await account.getTransaction(HASH)

      expect(info.finality).toBe('dropped')
      expect(info.success).toBeUndefined()
      expect(info.confirmations).toBe(0)
      expect(info.receipt).toBeNull()
    })

    test('stays pending when an earlier nonce is still unmined (nonce gap)', async () => {
      const account = createAccount({
        eth_getTransactionByHash: (params) => ({ ...txResponse(params), nonce: '0x5' }),
        eth_getTransactionReceipt: () => null,
        eth_getTransactionCount: () => '0x2'
      })

      const info = await account.getTransaction(HASH)

      expect(info.finality).toBe('pending')
    })

    test('throws NoSuchElementError when the transaction is unknown', async () => {
      const account = createAccount({
        eth_getTransactionByHash: () => null,
        eth_getTransactionReceipt: () => null
      })

      await expect(account.getTransaction(HASH)).rejects.toThrow(NoSuchElementError)
    })

    test('throws ValueError for a malformed transaction hash', async () => {
      const account = createAccount({})

      await expect(account.getTransaction('0x1234')).rejects.toThrow(ValueError)
    })

    test('should throw if the account is not connected to a provider', async () => {
      const account = new WalletAccountReadOnlyEvm(ADDRESS)

      const promise = account.getTransaction(HASH)

      await expect(promise).rejects.toThrow(ProviderRequiredError)
      await expect(promise).rejects.toThrow('The wallet must be connected to a provider to fetch transactions.')
    })
  })

  describe('getAllowance', () => {
    test('should return the current allowance', async () => {
      const account = createAccount({
        eth_call: () => abi.encode(['uint256'], [DUMMY_ALLOWANCE])
      })

      const allowance = await account.getAllowance(TOKEN_ADDRESS, SPENDER_ADDRESS)

      expect(allowance).toBe(DUMMY_ALLOWANCE)
    })

    test('should throw if the account is not connected to a provider', async () => {
      const account = new WalletAccountReadOnlyEvm(ADDRESS)

      const promise = account.getAllowance(TOKEN_ADDRESS, SPENDER_ADDRESS)

      await expect(promise).rejects.toThrow(ProviderRequiredError)
      await expect(promise).rejects.toThrow('The wallet must be connected to a provider to retrieve allowances.')
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

  describe('verifyTypedData', () => {
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

    const SIGNATURE = '0xd5d54d9a7fe501ab5dc1532a443a4f70bc8b6ad1c3f09caac9b891efa8701cac5ad1d4830c7bc7ed2688965ed6b04d25e8f55906a843689fdf79100aee3a5dc71c'

    test('should return true for a valid signature', async () => {
      const result = await account.verifyTypedData({
        domain: DOMAIN,
        types: TYPES,
        primaryType: 'Mail',
        message: MESSAGE
      }, SIGNATURE)

      expect(result).toBe(true)
    })

    test('should return false for an invalid signature', async () => {
      const result = await account.verifyTypedData({
        domain: DOMAIN,
        types: TYPES,
        primaryType: 'Mail',
        message: { ...MESSAGE, contents: 'Hello, Alice!' }
      }, SIGNATURE)

      expect(result).toBe(false)
    })

    test('should throw on a malformed signature', async () => {
      await expect(account.verifyTypedData({
        domain: DOMAIN,
        types: TYPES,
        primaryType: 'Mail',
        message: MESSAGE
      }, 'A bad signature'))
        .rejects.toThrow('invalid BytesLike value')
    })
  })

  describe('getDelegation', () => {
    test('should return false for a regular EOA', async () => {
      const delegation = await account.getDelegation()

      expect(delegation).toEqual({
        isDelegated: false,
        delegateAddress: null
      })
    })

    test('should return true for a delegated EOA', async () => {
      const DELEGATE_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678'

      const account = createAccount({
        eth_getCode: () => '0xef0100' + DELEGATE_ADDRESS.slice(2)
      })

      const delegation = await account.getDelegation()

      expect(delegation).toEqual({
        isDelegated: true,
        delegateAddress: DELEGATE_ADDRESS
      })
    })

    test('should throw if the account is not connected to a provider', async () => {
      const account = new WalletAccountReadOnlyEvm(ADDRESS)

      const promise = account.getDelegation()

      await expect(promise).rejects.toThrow(ProviderRequiredError)
      await expect(promise).rejects.toThrow('The wallet must be connected to a provider to check delegation.')
    })
  })
})
