require('@nomicfoundation/hardhat-ethers')

/** @type {import('hardhat/config').HardhatUserConfig} */
module.exports = {
  networks: {
    hardhat: {
      chainId: 11155111,
      accounts: {
        mnemonic: 'anger burst story spy face pattern whale quit delay fiction ball solve',
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 1,
        accountsBalance: '1000000000000000000000'
      },
      mining: { auto: true, interval: 0 }
    }
  }
}
