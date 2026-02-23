require('@nomicfoundation/hardhat-ethers')

/** @type {import('hardhat/config').HardhatUserConfig} */
module.exports = {
  networks: {
    hardhat: {
      hardfork: 'prague',
      accounts: {
        mnemonic: 'anger burst story spy face pattern whale quit delay fiction ball solve',
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 2,
        accountsBalance: '1000000000000000000000'
      }
    }
  }
}
