import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LEN = 32;
const IV_LEN = 16;
const TAG_LEN = 16;

function getMasterKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) throw new Error('ENCRYPTION_SECRET env var is required');
  return crypto.scryptSync(secret, 'botville-salt-v1', KEY_LEN);
}

export function encryptKey(plaintext: string): { encrypted: Buffer; iv: Buffer } {
  const iv = crypto.randomBytes(IV_LEN);
  const masterKey = getMasterKey();
  const cipher = crypto.createCipheriv(ALGORITHM, masterKey, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { encrypted: Buffer.concat([encrypted, tag]), iv };
}

export function decryptKey(encrypted: Buffer, iv: Buffer): string {
  const masterKey = getMasterKey();
  const tag = encrypted.subarray(encrypted.length - TAG_LEN);
  const data = encrypted.subarray(0, encrypted.length - TAG_LEN);
  const decipher = crypto.createDecipheriv(ALGORITHM, masterKey, iv);
  decipher.setAuthTag(tag);
  return decipher.update(data) + decipher.final('utf8');
}
