import dotenv from 'dotenv'
import { JsonRpcProvider, Contract } from 'ethers'
import WalletManagerEvm from '../../index.js'

// Load environment variables from .env when present
dotenv.config()

// Named exports for important test configuration values (read from env with sensible defaults)
export const TESTNET_RPC_URL = process.env.TESTNET_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/jlxrE4wpG-lcjCGyyPKa9rfVFgsbDor_'
export const TESTNET_SEED_PHRASE = process.env.TESTNET_SEED_PHRASE || 'cook voyage document eight skate token alien guide drink uncle term abuse'
export const TEST_TOKEN_ADDRESS = process.env.TEST_TOKEN_ADDRESS || '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9'
export const RECEIVER = process.env.RECEIVER || '0x405005C7c4422390F4B334F64Cf20E0b767131d0'

// Read configuration from environment with sensible defaults
export const CONFIG = {
  TESTNET_RPC_URL,
  TESTNET_SEED_PHRASE,
  TEST_TOKEN_ADDRESS,
  RECEIVER,
  confirmations: process.env.TEST_CONFIRMATIONS ? Number(process.env.TEST_CONFIRMATIONS) : 2,
  maxRetries: process.env.TEST_MAX_RETRIES ? Number(process.env.TEST_MAX_RETRIES) : 3,
  retryDelay: process.env.TEST_RETRY_DELAY ? Number(process.env.TEST_RETRY_DELAY) : 5000,
  timeout: process.env.TEST_TIMEOUT ? Number(process.env.TEST_TIMEOUT) : 180000
}

// Minimal WETH ABI used in tests
const WETH_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address dst, uint wad) public returns (bool)',
  'function approve(address guy, uint wad) public returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function deposit() public payable',
  'function withdraw(uint wad) public',
  'function totalSupply() public view returns (uint)',
  'function transferFrom(address src, address dst, uint wad) public returns (bool)'
]

export function getProvider () {
  return new JsonRpcProvider(CONFIG.TESTNET_RPC_URL)
}

export function makeWallet () {
  // Pass the URL string so WalletManagerEvm constructs its own provider (consistent with library expectations)
  return new WalletManagerEvm(CONFIG.TESTNET_SEED_PHRASE, {
    provider: CONFIG.TESTNET_RPC_URL,
    transferMaxFee: 1_000_000_000_000_000n
  })
}

export function createWethContract (provider) {
  return new Contract(CONFIG.TEST_TOKEN_ADDRESS, WETH_ABI, provider)
}

export async function waitForConfirmation (provider, txHash, confirmations = CONFIG.confirmations) {
  let retries = 0
  while (retries < CONFIG.maxRetries) {
    try {
      const receipt = await provider.waitForTransaction(txHash, confirmations, CONFIG.timeout)
      if (receipt && receipt.status === 0) throw new Error('Transaction reverted')
      return receipt
    } catch (err) {
      retries++
      if (retries === CONFIG.maxRetries) throw err
      await new Promise(resolve => setTimeout(resolve, CONFIG.retryDelay))
    }
  }
}

export async function retry (operation, maxRetries = CONFIG.maxRetries) {
  let lastError
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation()
    } catch (err) {
      lastError = err
      await new Promise(resolve => setTimeout(resolve, CONFIG.retryDelay))
    }
  }
  throw lastError
}

// Named exports only — prefer explicit imports in tests for clarity.

