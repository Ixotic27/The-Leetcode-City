import * as crypto from "crypto";
import * as vscode from "vscode";

function getEncryptionKey(): string {
  const cfg = vscode.workspace.getConfiguration("leetcodecity");
  const key = cfg.get<string>("cryptoKey", "");
  if (key && key.length >= 32) {
    return key;
  }
  const envKey = process.env.ARENA_CRYPTO_KEY;
  if (envKey && envKey.length >= 32) {
    return envKey;
  }
  throw new Error(
    "LeetCode City: Arena encryption key is not configured. " +
    "Set 'leetcodecity.cryptoKey' in VS Code settings or the ARENA_CRYPTO_KEY environment variable. " +
    "Generate one with: openssl rand -hex 32"
  );
}

export function decryptHiddenTests(encryptedData: string, ivHex: string): any[] {
  try {
    const algorithm = "aes-256-cbc";
    const encryptionKey = getEncryptionKey();
    const key = crypto.createHash("sha256").update(encryptionKey).digest();
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
