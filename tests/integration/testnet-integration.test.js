import { describe, expect, test, beforeAll, afterAll } from '@jest/globals'
import WalletManagerEvm from '../../index.js'
import {
    CONFIG,
    getProvider,
    makeWallet,
    createWethContract,
    waitForConfirmation,
    TESTNET_SEED_PHRASE,
    TESTNET_RPC_URL,
    TEST_TOKEN_ADDRESS,
} from '../helpers/testnet.js'

describe('Integration Tests on Sepolia', () => {
    let wallet
    let provider
    let wethContract
    const cfg = CONFIG

    beforeAll(async () => {
        provider = getProvider()

        // Initialize wallet & WETH contract via helpers
        wallet = makeWallet()
        wethContract = createWethContract(provider)

        // Verify WETH contract
        const name = await wethContract.name()
        const symbol = await wethContract.symbol()
        console.log(`Connected to ${name} (${symbol}) at ${cfg.TEST_TOKEN_ADDRESS}`)
    }, CONFIG.timeout)

    describe('Test Operations', () => {
        let account0
        let account1

        beforeAll(async () => {
            account0 = await wallet.getAccount(0)
            account1 = await wallet.getAccount(1)
            // Ensure accounts have a provider attached (the Wallet implementation may not always set it)
            if (!account0._provider) {
                const prov = getProvider()
                account0._provider = prov
                if (account0._account && typeof account0._account.connect === 'function') account0._account = account0._account.connect(prov)
            }
            if (!account1._provider) {
                const prov = getProvider()
                account1._provider = prov
                if (account1._account && typeof account1._account.connect === 'function') account1._account = account1._account.connect(prov)
            }

            console.log('Testing with accounts:', await account0.getAddress(), await account1.getAddress())
        })

        test('should send ETH to configured receiver', async () => {
            const account = await wallet.getAccount(0)
            const receiver = cfg.RECEIVER

            const beforeSender = await account.getBalance()
            const beforeReceiverBn = await provider.getBalance(receiver)
            const beforeReceiver = BigInt(beforeReceiverBn.toString())

            const amount = 10_000n
            const tx = { to: receiver, value: amount }

            const result = await account.sendTransaction(tx)
            await waitForConfirmation(provider, result.hash)

            const afterSender = await account.getBalance()
            const afterReceiverBn = await provider.getBalance(receiver)
            const afterReceiver = BigInt(afterReceiverBn.toString())

            // Ensure the transaction on-chain matches the intended transfer and it mined successfully
            const onchainTx = await provider.getTransaction(result.hash)
            const receipt = await waitForConfirmation(provider, result.hash)
            expect(receipt.status).toBe(1)
            expect(onchainTx.to.toLowerCase()).toBe(receiver.toLowerCase())
            expect(BigInt(onchainTx.value.toString())).toBe(amount)
        }, CONFIG.timeout)

        test('should wrap ETH to WETH', async () => {
            const wrapAmount = 1_000_000_000_000_000n // 0.001 ETH

            // Get initial balances
            const initialEthBalance = await account0.getBalance()
            const initialWethBalance = await account0.getTokenBalance(TEST_TOKEN_ADDRESS)

            console.log('Initial Balances:', {
                ETH: initialEthBalance,
                WETH: initialWethBalance
            })

            // Wrap ETH to WETH using deposit()
            const depositTx = {
                to: TEST_TOKEN_ADDRESS,
                value: wrapAmount,
                data: wethContract.interface.encodeFunctionData('deposit', [])
            }

            const result = await account0.sendTransaction(depositTx)
            console.log('Deposit transaction hash:', result.hash)

            const receipt = await waitForConfirmation(provider, result.hash)
            expect(receipt.status).toBe(1)

            // Verify balances
            const finalWethBalance = await account0.getTokenBalance(TEST_TOKEN_ADDRESS)
            expect(finalWethBalance).toBe(initialWethBalance + wrapAmount)

            console.log('Final WETH Balance:', finalWethBalance)
        }, CONFIG.timeout)

        test('should transfer WETH between accounts', async () => {
            const transferAmount = 500_000_000_000_000n // 0.0005 ETH worth of WETH

            // Get initial balances
            const initialBalance0 = await account0.getTokenBalance(TEST_TOKEN_ADDRESS)
            const initialBalance1 = await account1.getTokenBalance(TEST_TOKEN_ADDRESS)

            console.log('Initial WETH Balances:', {
                account0: initialBalance0,
                account1: initialBalance1
            })

            // Transfer WETH
            const transfer = {
                token: TEST_TOKEN_ADDRESS,
                recipient: await account1.getAddress(),
                amount: transferAmount
            }

            const result = await account0.transfer(transfer)
            console.log('Transfer transaction hash:', result.hash)

            const receipt = await waitForConfirmation(provider, result.hash)
            expect(receipt.status).toBe(1)

            // Verify balances
            const finalBalance0 = await account0.getTokenBalance(TEST_TOKEN_ADDRESS)
            const finalBalance1 = await account1.getTokenBalance(TEST_TOKEN_ADDRESS)

            expect(finalBalance0).toBe(initialBalance0 - transferAmount)
            expect(finalBalance1).toBe(initialBalance1 + transferAmount)

            console.log('Final WETH Balances:', {
                account0: finalBalance0,
                account1: finalBalance1
            })
        }, CONFIG.timeout)

        test('should unwrap WETH to ETH', async () => {
            const unwrapAmount = 100_000_000_000_000n // 0.0001 ETH

            // Get initial balances
            const initialEthBalance = await account0.getBalance()
            const initialWethBalance = await account0.getTokenBalance(TEST_TOKEN_ADDRESS)

            console.log('Initial Balances:', {
                ETH: initialEthBalance,
                WETH: initialWethBalance
            })

            // Unwrap WETH using withdraw()
            const withdrawTx = {
                to: TEST_TOKEN_ADDRESS,
                data: wethContract.interface.encodeFunctionData('withdraw', [unwrapAmount])
            }

            const result = await account0.sendTransaction(withdrawTx)
            console.log('Withdraw transaction hash:', result.hash)

            const receipt = await waitForConfirmation(provider, result.hash)
            expect(receipt.status).toBe(1)

            // Verify balances
            const finalEthBalance = await account0.getBalance()
            const finalWethBalance = await account0.getTokenBalance(TEST_TOKEN_ADDRESS)

            expect(finalWethBalance).toBe(initialWethBalance - unwrapAmount)
            expect(finalEthBalance).toBeGreaterThan(initialEthBalance - result.fee)

            console.log('Final Balances:', {
                ETH: finalEthBalance,
                WETH: finalWethBalance,
                gasUsed: result.fee
            })
        }, CONFIG.timeout)

        test('should handle WETH approval and transferFrom', async () => {
            const approveAmount = 1_000_000_000_000_000n // 0.001 ETH worth of WETH

            // Approve account1 to spend account0's WETH
            const approveTx = {
                to: TEST_TOKEN_ADDRESS,
                data: wethContract.interface.encodeFunctionData('approve', [
                    await account1.getAddress(),
                    approveAmount
                ])
            }

            console.log('Approving WETH transfer...')
            const approveResult = await account0.sendTransaction(approveTx)
            await waitForConfirmation(provider, approveResult.hash)

            // Check allowance
            const allowance = await wethContract.allowance(
                await account0.getAddress(),
                await account1.getAddress()
            )
            expect(allowance).toBe(approveAmount)

            // Get initial balances
            const initialBalance0 = await account0.getTokenBalance(TEST_TOKEN_ADDRESS)
            const initialBalance1 = await account1.getTokenBalance(TEST_TOKEN_ADDRESS)

            // Determine actual transfer amount (must not exceed balance or allowance)
            const desiredAmount = 500_000_000_000_000n // 0.0005 ETH worth of WETH
            const maxAllowed = allowance < initialBalance0 ? allowance : initialBalance0
            const transferAmount = desiredAmount <= maxAllowed ? desiredAmount : maxAllowed

            if (transferAmount === 0n) {
                throw new Error('No transferable WETH available for transferFrom test (balance or allowance is zero).')
            }

            const transferFromTx = {
                to: TEST_TOKEN_ADDRESS,
                data: wethContract.interface.encodeFunctionData('transferFrom', [
                    await account0.getAddress(),
                    await account1.getAddress(),
                    transferAmount
                ])
            }

            // Gas estimation and fee quoting (optimization)
            const fromAddress = await account1.getAddress()
            const gasEstimate = await provider.estimateGas({ from: fromAddress, ...transferFromTx })
            console.log('Gas estimate for transferFrom:', gasEstimate.toString())

            const feeEstimate = await account1.quoteSendTransaction(transferFromTx)
            console.log('Fee estimate for transferFrom (wei):', feeEstimate.fee)

            // Ensure account1 has ETH to pay for gas; top up from account0 if needed
            const account1BalanceBefore = await account1.getBalance()
            if (account1BalanceBefore < feeEstimate.fee * 2n) {
                const topUpAmount = feeEstimate.fee * 3n // small safety margin
                console.log('Topping up account1 with', topUpAmount, 'wei for gas')
                const topUpTx = { to: await account1.getAddress(), value: topUpAmount }
                const topUpResult = await account0.sendTransaction(topUpTx)
                // Wait for the top-up to be mined but use a shorter timeout and single confirmation to avoid long test delays
                try {
                    await provider.waitForTransaction(topUpResult.hash, 1, 60000) // 60s
                } catch (err) {
                    // If the quick wait fails, fall back to the normal confirmation helper (with retries)
                    console.log('Quick wait for top-up failed, falling back to waitForConfirmation:', err.message)
                    await waitForConfirmation(provider, topUpResult.hash, 1)
                }
            }

            console.log('Executing transferFrom...')
            // Execute transferFrom from account1 (the spender)
            const transferResult = await account1.sendTransaction(transferFromTx)
            await waitForConfirmation(provider, transferResult.hash)

            // Verify final balances
            const finalBalance0 = await account0.getTokenBalance(TEST_TOKEN_ADDRESS)
            const finalBalance1 = await account1.getTokenBalance(TEST_TOKEN_ADDRESS)

            expect(finalBalance0).toBe(initialBalance0 - transferAmount)
            expect(finalBalance1).toBe(initialBalance1 + transferAmount)

            console.log('Transfer completed successfully:', {
                fromBalance: finalBalance0,
                toBalance: finalBalance1,
                amount: transferAmount
            })
        }, CONFIG.timeout)

        test('should reject transfer if configured transferMaxFee too low (simulate insufficient gas cap)', async () => {
            // Create a wallet that enforces a very low max fee so transfers fail before sending
            const lowFeeWallet = new WalletManagerEvm(TESTNET_SEED_PHRASE, {
                provider: TESTNET_RPC_URL,
                transferMaxFee: 1n // unrealistically low
            })

            const lowFeeAccount = await lowFeeWallet.getAccount(0)

            // Ensure account has WETH; if none, skip
            const wethBal = await lowFeeAccount.getTokenBalance(TEST_TOKEN_ADDRESS)
            if (wethBal === 0n) {
                console.log('Skipping low-fee transfer test: account has no WETH')
                return
            }

            const transfer = {
                token: TEST_TOKEN_ADDRESS,
                recipient: await account1.getAddress(),
                amount: 1n
            }

            await expect(lowFeeAccount.transfer(transfer)).rejects.toThrow(/Exceeded maximum fee|max fee/i)
        }, CONFIG.timeout)

        test('should revert withdraw when amount exceeds WETH balance', async () => {
            // Use account1 for this negative test
            const bal = await account1.getTokenBalance(TEST_TOKEN_ADDRESS)
            const overdraw = bal + 1n

            const withdrawTx = {
                to: TEST_TOKEN_ADDRESS,
                data: wethContract.interface.encodeFunctionData('withdraw', [overdraw])
            }

            // Expect estimateGas to fail with a CALL_EXCEPTION for an over-withdraw
            await expect(provider.estimateGas({ from: await account1.getAddress(), ...withdrawTx }))
                .rejects.toMatchObject({ code: 'CALL_EXCEPTION' })

            // Sending the transaction should also reject; assert the error mentions a revert or CALL_EXCEPTION
            await expect(account1.sendTransaction(withdrawTx)).rejects.toThrow(/revert|CALL_EXCEPTION/i)
        }, CONFIG.timeout)

        test('should fail transferFrom when allowance insufficient', async () => {
            // Ensure allowance is zero for this negative test
            const zeroApproveTx = {
                to: TEST_TOKEN_ADDRESS,
                data: wethContract.interface.encodeFunctionData('approve', [
                    await account1.getAddress(),
                    0n
                ])
            }

            const zeroApproveResult = await account0.sendTransaction(zeroApproveTx)
            await waitForConfirmation(provider, zeroApproveResult.hash)

            const allowanceAfter = await wethContract.allowance(
                await account0.getAddress(),
                await account1.getAddress()
            )
            expect(allowanceAfter).toBe(0n)

            // Ensure account1 has ETH to attempt transferFrom (so we test allowance rejection, not lack of gas)
            const account1Bal = await account1.getBalance()
            if (account1Bal === 0n) {
                const fundTx = { to: await account1.getAddress(), value: 1000000000000000n } // 0.001 ETH
                const fundResult = await account0.sendTransaction(fundTx)
                await waitForConfirmation(provider, fundResult.hash)
            }

            // Try transferFrom and expect revert due to insufficient allowance
            const transferFromTx = {
                to: TEST_TOKEN_ADDRESS,
                data: wethContract.interface.encodeFunctionData('transferFrom', [
                    await account0.getAddress(),
                    await account1.getAddress(),
                    1n
                ])
            }

            await expect(account1.sendTransaction(transferFromTx)).rejects.toThrow()
        }, CONFIG.timeout)
    })

    afterAll(async () => {
        // Remove any provider listeners to avoid "logging after tests are done" errors.
        try {
            if (provider && typeof provider.removeAllListeners === 'function') provider.removeAllListeners()
            if (wallet && wallet._provider && typeof wallet._provider.removeAllListeners === 'function') wallet._provider.removeAllListeners()
            if (account0 && account0._provider && typeof account0._provider.removeAllListeners === 'function') account0._provider.removeAllListeners()
            if (account1 && account1._provider && typeof account1._provider.removeAllListeners === 'function') account1._provider.removeAllListeners()
        } catch (e) {
            // Best-effort cleanup — don't fail tests for teardown errors.
            console.log('Teardown cleanup error (ignored):', e && e.message)
        }
    })
})