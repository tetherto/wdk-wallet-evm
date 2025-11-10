import 'dotenv/config'
import '@nomicfoundation/hardhat-ethers'

// Read forking RPC and block number from environment with sensible defaults
const SEPOLIA_RPC = process.env.TESTNET_RPC_URL || ''
const FORK_BLOCK = process.env.FORK_BLOCK_NUMBER ? Number(process.env.FORK_BLOCK_NUMBER) : 9549571

/** @type {import('hardhat/config').HardhatUserConfig} */
export default {
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {
      forking: {
        url: SEPOLIA_RPC,
        blockNumber: FORK_BLOCK,
        enabled: true
      },
      chainId: 11155111,
      accounts: {
        mnemonic: process.env.TESTNET_SEED_PHRASE,
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 10,
        accountsBalance: '10000000000000000000000'
      },
      mining: {
        auto: true,
        interval: 0
      }
    }
  },
  mocha: {
    timeout: 60000
  }
}
