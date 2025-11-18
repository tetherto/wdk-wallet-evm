import dotenv from 'dotenv'
import { JsonRpcProvider, ethers } from 'ethers'
import WalletManagerEvm from '../../../index.js'

dotenv.config()

if (!process.env.SEPOLIA_TESTNET_RPC_URL) {
  throw new Error(
    '❌ Missing required environment variables.\n' +
    'Please copy `.env.example` to `.env` and set:\n' +
    '  SEPOLIA_TESTNET_RPC_URL'
  )
}


export const SEPOLIA_TESTNET_RPC_URL = process.env.SEPOLIA_TESTNET_RPC_URL || ''
export const LOCAL_FORK_RPC_URL = process.env.LOCAL_FORK_RPC_URL || ''
export const TESTNET_SEED_PHRASE = 'cook voyage document eight skate token alien guide drink uncle term abuse'
export const TEST_TOKEN_ADDRESS = '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9'
export const RECEIVER = '0xd13a8c33ecb4d38fbc1760c7f7f1e1c7b1162739'

export const CONFIG = {
  SEPOLIA_TESTNET_RPC_URL,
  LOCAL_FORK_RPC_URL,
  TESTNET_SEED_PHRASE,
  TEST_TOKEN_ADDRESS,
  RECEIVER
}

export const WETH_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint)',
  'function transfer(address dst, uint wad) returns (bool)',
  'function approve(address guy, uint wad) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function deposit() payable',
  'function withdraw(uint wad)',
  'function totalSupply() view returns (uint)',
  'function transferFrom(address src, address dst, uint wad) returns (bool)'
]

export function getProvider() {
  return new JsonRpcProvider("http://127.0.0.1:8545")
}


export function makeWallet() {
  return new WalletManagerEvm(CONFIG.TESTNET_SEED_PHRASE, {
    provider: CONFIG.LOCAL_FORK_RPC_URL,
    // Transfer fee limit (1e15 wei ≈ 0.001 ETH) for test safety
    transferMaxFee: 1_000_000_000_000_000n
  })
}

export function createWethContract(provider) {
  return new ethers.Contract(CONFIG.TEST_TOKEN_ADDRESS, WETH_ABI, provider)
}