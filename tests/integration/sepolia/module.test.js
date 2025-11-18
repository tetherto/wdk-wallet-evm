import { describe, expect, test, beforeAll, afterAll } from '@jest/globals'
import WalletManagerEvm from '../../../index.js'
import {
    CONFIG,
    getProvider,
    makeWallet,
    createWethContract,
    TESTNET_SEED_PHRASE,
    SEPOLIA_TESTNET_RPC_URL,
    TEST_TOKEN_ADDRESS,
} from './helper.js'

describe('Integration Tests on Sepolia', () => {
    let wallet
    let provider
    let wethContract
    const cfg = CONFIG
    beforeAll(async () => {
        provider = getProvider()
        wallet = makeWallet()
        wethContract = createWethContract(provider)

        // Verify WETH contract connectivity
        const name = await wethContract.name()
        const symbol = await wethContract.symbol()
        console.log(`Connected to ${name} (${symbol}) at ${cfg.TEST_TOKEN_ADDRESS}`)
    })

    describe('Test Operations', () => {
        let account0
        let account1
        beforeAll(async () => {
            account0 = await wallet.getAccount(0)
            account1 = await wallet.getAccount(1)

            for (const acct of [account0, account1]) {
                if (!acct._provider) {
                    const prov = getProvider()
                    acct._provider = prov
                    if (acct._account && typeof acct._account.connect === 'function') {
                        acct._account = acct._account.connect(prov)
                    }
                }
            }

            console.log('Testing with accounts:', await account0.getAddress(), await account1.getAddress())
        })

        test('should send ETH to configured receiver', async () => {
            const account = await wallet.getAccount(0)
            const receiver = cfg.RECEIVER

            const beforeReceiver = await provider.getBalance(receiver)
            const amount = 1_000_000_000_000_000n // 0.001 ETH

            const tx = { to: receiver, value: amount }
            await account.sendTransaction(tx)

            // Wait briefly to ensure provider state updates (important for forked networks)
            await new Promise(res => setTimeout(res, 2000))

            const afterReceiver = await provider.getBalance(receiver)
            expect(afterReceiver).toBe(beforeReceiver + amount)
        })


        test('should wrap ETH to WETH', async () => {
            const wrapAmount = 1_000_000_000_000_000n // 0.001 ETH

            const initialEthBalance = await account0.getBalance()
            const initialWethBalance = await account0.getTokenBalance(TEST_TOKEN_ADDRESS)

            const depositTx = {
                to: TEST_TOKEN_ADDRESS,
                value: wrapAmount,
                data: wethContract.interface.encodeFunctionData('deposit', [])
            }

            await account0.sendTransaction(depositTx)
            await new Promise(res => setTimeout(res, 2000))

            const finalWethBalance = await account0.getTokenBalance(TEST_TOKEN_ADDRESS)
            expect(finalWethBalance).toBe(initialWethBalance + wrapAmount)
        })


        test('should transfer WETH between accounts', async () => {
            const transferAmount = 500_000_000_000_000n // 0.0005 ETH worth of WETH

            const initialBalance0 = await account0.getTokenBalance(TEST_TOKEN_ADDRESS)
            const initialBalance1 = await account1.getTokenBalance(TEST_TOKEN_ADDRESS)

            const transfer = {
                token: TEST_TOKEN_ADDRESS,
                recipient: await account1.getAddress(),
                amount: transferAmount
            }

            await account0.transfer(transfer)
            await new Promise(res => setTimeout(res, 2000))
            const finalBalance0 = await account0.getTokenBalance(TEST_TOKEN_ADDRESS)
            const finalBalance1 = await account1.getTokenBalance(TEST_TOKEN_ADDRESS)

            expect(finalBalance0).toBe(initialBalance0 - transferAmount)
            expect(finalBalance1).toBe(initialBalance1 + transferAmount)
        })


        test('should unwrap WETH to ETH', async () => {
            const unwrapAmount = 100_000_000_000_000n // 0.0001 ETH

            const initialEthBalance = await account0.getBalance()
            const initialWethBalance = await account0.getTokenBalance(TEST_TOKEN_ADDRESS)


            const withdrawTx = {
                to: TEST_TOKEN_ADDRESS,
                data: wethContract.interface.encodeFunctionData('withdraw', [unwrapAmount])
            }

            const result = await account0.sendTransaction(withdrawTx)
            await new Promise(res => setTimeout(res, 2000))

            const finalEthBalance = await account0.getBalance()
            const finalWethBalance = await account0.getTokenBalance(TEST_TOKEN_ADDRESS)

            expect(finalWethBalance).toBe(initialWethBalance - unwrapAmount)
            expect(finalEthBalance).toBeGreaterThan(initialEthBalance - result.fee)
        })

        test('should handle WETH approval and transferFrom', async () => {
            const approveAmount = 1_000_000_000_000_000n // 0.001 ETH worth of WETH


            const approveTx = {
                to: TEST_TOKEN_ADDRESS,
                data: wethContract.interface.encodeFunctionData('approve', [
                    await account1.getAddress(),
                    approveAmount
                ])
            }

            await account0.sendTransaction(approveTx)
            await new Promise(res => setTimeout(res, 2000))


            const allowance = await wethContract.allowance(
                await account0.getAddress(),
                await account1.getAddress()
            )
            expect(allowance).toBe(approveAmount)

            const desiredAmount = 500_000_000_000_000n
            const initialBalance0 = await account0.getTokenBalance(TEST_TOKEN_ADDRESS)
            const initialBalance1 = await account1.getTokenBalance(TEST_TOKEN_ADDRESS)
            const maxAllowed = allowance < initialBalance0 ? allowance : initialBalance0
            const transferAmount = desiredAmount <= maxAllowed ? desiredAmount : maxAllowed

            if (transferAmount === 0n)
                throw new Error('No transferable WETH available for transferFrom test.')

            const transferFromTx = {
                to: TEST_TOKEN_ADDRESS,
                data: wethContract.interface.encodeFunctionData('transferFrom', [
                    await account0.getAddress(),
                    await account1.getAddress(),
                    transferAmount
                ])
            }
            const gasEstimate = await provider.estimateGas({ from: await account1.getAddress(), ...transferFromTx })
            const feeEstimate = await account1.quoteSendTransaction(transferFromTx)
            const balance1 = await account1.getBalance()

            if (balance1 < feeEstimate.fee * 2n) {
                const topUp = feeEstimate.fee * 3n
                console.log('Topping up account1 with', topUp, 'wei for gas')
                await account0.sendTransaction({ to: await account1.getAddress(), value: topUp })
            }


            await account1.sendTransaction(transferFromTx)
            const finalBalance0 = await account0.getTokenBalance(TEST_TOKEN_ADDRESS)
            const finalBalance1 = await account1.getTokenBalance(TEST_TOKEN_ADDRESS)

            expect(finalBalance0).toBe(initialBalance0 - transferAmount)
            expect(finalBalance1).toBe(initialBalance1 + transferAmount)
        })

        test('should reject transfer if configured transferMaxFee too low', async () => {
            const lowFeeWallet = new WalletManagerEvm(TESTNET_SEED_PHRASE, {
                provider: SEPOLIA_TESTNET_RPC_URL,
                transferMaxFee: 1n // unrealistic fee cap
            })

            const lowFeeAccount = await lowFeeWallet.getAccount(0)
            const wethBal = await lowFeeAccount.getTokenBalance(TEST_TOKEN_ADDRESS)

            if (wethBal === 0n) {
                console.log('Skipping low-fee transfer test: no WETH balance')
                return
            }

            const transfer = {
                token: TEST_TOKEN_ADDRESS,
                recipient: await account1.getAddress(),
                amount: 1n
            }

            await expect(lowFeeAccount.transfer(transfer))
                .rejects.toThrow(/Exceeded maximum fee|max fee/i)
        })

        test('should revert withdraw when amount exceeds WETH balance', async () => {
            const bal = await account1.getTokenBalance(TEST_TOKEN_ADDRESS)
            const overdraw = bal + 1n

            const withdrawTx = {
                to: TEST_TOKEN_ADDRESS,
                data: wethContract.interface.encodeFunctionData('withdraw', [overdraw])
            }

            await expect(provider.estimateGas({ from: await account1.getAddress(), ...withdrawTx }))
                .rejects.toMatchObject({ code: 'CALL_EXCEPTION' })

            await expect(account1.sendTransaction(withdrawTx))
                .rejects.toThrow(/revert|CALL_EXCEPTION/i)
        })

        test('should fail transferFrom when allowance insufficient', async () => {

            const zeroApproveTx = {
                to: TEST_TOKEN_ADDRESS,
                data: wethContract.interface.encodeFunctionData('approve', [
                    await account1.getAddress(),
                    0n
                ])
            }

            await account0.sendTransaction(zeroApproveTx)
            const allowanceAfter = await wethContract.allowance(
                await account0.getAddress(),
                await account1.getAddress()
            )
            expect(allowanceAfter).toBe(0n)

            const account1Bal = await account1.getBalance()
            if (account1Bal === 0n) {
                const fundTx = { to: await account1.getAddress(), value: 1_000_000_000_000_000n } // 0.001 ETH
                await account0.sendTransaction(fundTx)
            }
            const transferFromTx = {
                to: TEST_TOKEN_ADDRESS,
                data: wethContract.interface.encodeFunctionData('transferFrom', [
                    await account0.getAddress(),
                    await account1.getAddress(),
                    1n
                ])
            }

            await expect(account1.sendTransaction(transferFromTx)).rejects.toThrow()
        })
    })
    afterAll(async () => {
        try {
            for (const target of [provider, wallet?._provider, account0?._provider, account1?._provider]) {
                if (target && typeof target.removeAllListeners === 'function') target.removeAllListeners()
            }
        } catch (e) {
            console.log('Teardown cleanup error (ignored):', e?.message)
        }
    })
})