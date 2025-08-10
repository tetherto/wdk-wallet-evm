import { secp256k1 } from '@noble/curves/secp256k1.js'
import { Wallet, Transaction } from 'ethers'

const PATH_HEX = '058000002c8000003c800000000000000000000000'

export function getAddressApdu (account) {
  const apdu = []

  // Request
  apdu.push(`=> e002000015${PATH_HEX}`)

  // Response
  const uncompressedPublicKey = secp256k1.getPublicKey(account.keyPair.privateKey, false)
  const uncompressedPublicKeyHex = Buffer.from(uncompressedPublicKey).toString('hex')
  const uncompressedPublicKeyLength = '41'

  const wallet = new Wallet(account.keyPair.privateKey)
  const addressHex = Buffer.from(wallet.address.slice(2), 'ascii').toString('hex')
  const addressLength = '28'

  apdu.push(`<= ${uncompressedPublicKeyLength}${uncompressedPublicKeyHex}${addressLength}${addressHex}9000`)

  return apdu.join('\n')
}

export function getSignMessageAdpu (account, message) {
  const apdu = []

  // Request
  const messageHex = Buffer.from(message, 'ascii').toString('hex')
  const messageLength = BigInt(Buffer.from(message, 'ascii').length).toString(16).padStart(8, '0')

  const payloadHex = `${PATH_HEX}${messageLength}${messageHex}`
  const payloadLength = BigInt(Buffer.from(payloadHex, 'hex').length).toString(16)

  apdu.push(`=> e0080000${payloadLength}${payloadHex}`)

  // Response
  const wallet = new Wallet(account.keyPair.privateKey)
  const signature = wallet.signMessageSync(message).substring(2)
  const r = signature.substring(0, 64)
  const s = signature.substring(64, 128)
  const v = signature.substring(128)

  apdu.push(`<= ${v}${r}${s}9000`)
  return [getAddressApdu(account), ...apdu].join('\n')
}

export async function getSignTransactionAdpu (account, populatedTransacion, numOfGetAddressApdus) {
  const apdu = []
  const wallet = new Wallet(`0x${account.keyPair.privateKey}`)

  // Request
  const { unsignedSerialized } = Transaction.from(populatedTransacion)
  const messageHex = unsignedSerialized.substring(2)

  const payloadHex = `${PATH_HEX}${messageHex}`
  const payloadLength = BigInt(Buffer.from(payloadHex, 'hex').length).toString(16)

  apdu.push(`=> e0040000${payloadLength}${payloadHex}`)

  // Response
  const { signature: { serialized, yParity } } = Transaction.from(await wallet.signTransaction(populatedTransacion))

  const signature = serialized.substring(2)
  const r = signature.substring(0, 64)
  const s = signature.substring(64, 128)
  const v = BigInt(yParity).toString(16).padStart(2, '0')

  apdu.push(`<= ${v}${r}${s}9000`)

  const getAddressApdus = Array.from({ length: numOfGetAddressApdus }).map(() => getAddressApdu(account))

  return [...getAddressApdus, ...apdu].join('\n')
}
