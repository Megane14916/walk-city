const VERSION = "v1";

function secret(): string {
  const value = Deno.env.get("HEALTH_TOKEN_ENCRYPTION_KEY")?.trim();
  if (!value || value.length < 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY_UNAVAILABLE");
  }
  return value;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/") +
    "=".repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function encryptionKey(): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(secret()),
  );
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptRefreshToken(refreshToken: string): Promise<string> {
  if (!refreshToken.trim()) throw new Error("EMPTY_REFRESH_TOKEN");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await encryptionKey(),
    new TextEncoder().encode(refreshToken),
  );
  return `${VERSION}.${bytesToBase64Url(iv)}.${bytesToBase64Url(new Uint8Array(ciphertext))}`;
}

export async function decryptRefreshToken(value: string): Promise<string> {
  const [version, ivText, ciphertextText, extra] = value.split(".");
  if (version !== VERSION || !ivText || !ciphertextText || extra !== undefined) {
    throw new Error("INVALID_ENCRYPTED_TOKEN");
  }
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64UrlToBytes(ivText) },
    await encryptionKey(),
    base64UrlToBytes(ciphertextText),
  );
  const token = new TextDecoder().decode(plaintext);
  if (!token) throw new Error("EMPTY_REFRESH_TOKEN");
  return token;
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function randomState(): string {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

