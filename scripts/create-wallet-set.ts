import fs from 'node:fs'
import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets'

const apiKey = process.env.CIRCLE_API_KEY?.trim()
const entitySecret = process.env.CIRCLE_ENTITY_SECRET?.trim()

if (!apiKey || !entitySecret) {
  console.error('ERROR: CIRCLE_API_KEY or CIRCLE_ENTITY_SECRET missing from .env')
  process.exit(1)
}

const client = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret })

console.log('[1/2] Creating Avero wallet set on Circle...')

const response = await client.createWalletSet({ name: 'Avero Users' })
const walletSetId = response.data?.walletSet?.id

if (!walletSetId) {
  console.error('ERROR: No wallet set ID returned from Circle')
  console.error(JSON.stringify(response.data, null, 2))
  process.exit(1)
}

console.log(`[2/2] Wallet set created: ${walletSetId}`)

fs.appendFileSync('/home/user/app/.env', `\nCIRCLE_WALLET_SET_ID=${walletSetId}\n`, 'utf-8')
console.log('[OK] CIRCLE_WALLET_SET_ID written to .env')
