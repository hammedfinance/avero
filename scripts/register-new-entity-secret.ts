import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { registerEntitySecretCiphertext, initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets'
import dotenv from 'dotenv'

dotenv.config({ path: path.join(process.cwd(), '.env') })

const apiKey = process.env.CIRCLE_API_KEY
if (!apiKey) throw new Error('CIRCLE_API_KEY not set in .env')

const entitySecret = crypto.randomBytes(32).toString('hex')

const recoveryDir = '/home/user/app/.circle'
fs.mkdirSync(recoveryDir, { recursive: true })

console.log('[register] Registering entity secret with Circle...')
const response = await registerEntitySecretCiphertext({
  apiKey,
  entitySecret,
  recoveryFileDownloadPath: recoveryDir,
})

const recoveryPath = path.join(recoveryDir, 'recovery_file_new.dat')
if (response.data?.recoveryFile) {
  fs.writeFileSync(recoveryPath, response.data.recoveryFile)
  console.log('[register] Recovery file written to', recoveryPath)
}

// Persist to .env
const envPath = path.join(process.cwd(), '.env')
const envContent = fs.readFileSync(envPath, 'utf-8')
const updated = envContent.replace(/^CIRCLE_ENTITY_SECRET=.*$/m, `CIRCLE_ENTITY_SECRET=${entitySecret}`)
if (updated === envContent) {
  fs.appendFileSync(envPath, `\nCIRCLE_ENTITY_SECRET=${entitySecret}\n`)
} else {
  fs.writeFileSync(envPath, updated)
}
console.log('[register] Entity secret written to .env')

// Verify
console.log('[register] Verifying registration...')
const client = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret })
await client.listWalletSets({ pageSize: 1 })
console.log('[register] SUCCESS — entity secret registered and verified')
console.log('[register] Recovery file path:', recoveryPath)
