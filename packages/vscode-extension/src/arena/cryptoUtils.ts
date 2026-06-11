import * as crypto from "crypto";

const ENCRYPTION_KEY = "leetcode-city-arena-secret-key-32ch";

export function decryptHiddenTests(encryptedData: string, ivHex: string): any[] {
  try {
    const algorithm = "aes-256-cbc";
    // Generate identical 256-bit key by hashing the same secret key
    const key = crypto.createHash("sha256").update(ENCRYPTION_KEY).digest();
    const iv = Buffer.from(ivHex, "hex");
    
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encryptedData, "hex", "utf8");
    decrypted += decipher.final("utf8");
    
    return JSON.parse(decrypted);
  } catch (err: any) {
    console.error("[cryptoUtils] Decryption failed:", err.message);
    return [];
  }
}
