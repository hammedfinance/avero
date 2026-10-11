import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { registerEntitySecretCiphertext, initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets'

const apiKey = process.env.CIRCLE_API_KEY?.trim()
if (!apiKey) {
  console.error('ERROR: CIRCLE_API_KEY is not set in .env')
  process.exit(1)
}

const entitySecret = crypto.randomBytes(32).toString('hex')

const recoveryDir = '/home/user/app/.circle'
fs.mkdirSync(recoveryDir, { recursive: true })

console.log('[1/4] Registering entity secret ciphertext with Circle...')

const response = await registerEntitySecretCiphertext({
  apiKey,
  entitySecret,
  recoveryFileDownloadPath: recoveryDir,
})

const recoveryPath = path.join(recoveryDir, 'recovery_file.dat')
if (response.data?.recoveryFile) {
  fs.writeFileSync(recoveryPath, response.data.recoveryFile)
}

console.log('[2/4] Recovery file written to .circle/recovery_file.dat')

// Persist to .env
const envPath = '/home/user/app/.env'
fs.appendFileSync(envPath, `\nCIRCLE_ENTITY_SECRET=${entitySecret}\n`, 'utf-8')
console.log('[3/4] CIRCLE_ENTITY_SECRET written to .env')

// Verify with a read call
console.log('[4/4] Verifying registration...')
const client = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret })
await client.listWalletSets({ pageSize: 1 })
console.log('[OK] Entity secret registered and verified successfully.')
