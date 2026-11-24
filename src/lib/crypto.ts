// All encryption uses the browser's WebCrypto. A random 256-bit data key (DEK) encrypts entries;
// the DEK is stored only "wrapped" (encrypted) by a key derived from the password, and again by
// a key derived from the recovery code. Nothing readable ever touches storage.

const te = new TextEncoder()
const td = new TextDecoder()

export const PBKDF2_ITERATIONS = 600_000

export function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(n))
}

export function toB64(u: Uint8Array): string {
  let s = ''
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000))
  return btoa(s)
}

export function fromB64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s)
  const u = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i)
  return u
}

export interface Sealed { iv: string; ct: string }
export interface WrappedKey extends Sealed { salt: string; iterations: number }

async function deriveKek(secret: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', te.encode(secret.normalize('NFC')), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

async function sealBytes(key: CryptoKey, data: Uint8Array<ArrayBuffer>): Promise<Sealed> {
  const iv = randomBytes(12)
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data))
  return { iv: toB64(iv), ct: toB64(ct) }
}

async function openBytes(key: CryptoKey, s: Sealed): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(s.iv) }, key, fromB64(s.ct)))
}

export async function wrapDek(raw: Uint8Array<ArrayBuffer>, secret: string, iterations = PBKDF2_ITERATIONS): Promise<WrappedKey> {
  const salt = randomBytes(16)
  const kek = await deriveKek(secret, salt, iterations)
  return { salt: toB64(salt), iterations, ...(await sealBytes(kek, raw)) }
}

/** Returns the raw DEK, or throws if the secret is wrong (AES-GCM auth fails). */
export async function unwrapDek(w: WrappedKey, secret: string): Promise<Uint8Array<ArrayBuffer>> {
  const kek = await deriveKek(secret, fromB64(w.salt), w.iterations)
  return openBytes(kek, w)
}

export function importDek(raw: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export async function sealJson(key: CryptoKey, value: unknown): Promise<Sealed> {
  return sealBytes(key, te.encode(JSON.stringify(value)))
}

export async function openJson<T>(key: CryptoKey, s: Sealed): Promise<T> {
  return JSON.parse(td.decode(await openBytes(key, s))) as T
}

/** Human-friendly recovery code: 20 chars of Crockford base32 in groups of 4 (100 bits). */
export function makeRecoveryCode(): string {
  const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
  const bytes = randomBytes(20)
  const chars = Array.from(bytes, (b) => alphabet[b & 31])
  return chars.join('').match(/.{4}/g)!.join('-')
}

export function normalizeRecoveryCode(s: string): string {
  const clean = s.toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1')
  return clean.match(/.{1,4}/g)?.join('-') ?? ''
}
