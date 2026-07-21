import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "../config/env.js";

export interface EncryptedValue {
  keyVersion: string;
  ivBase64: string;
  authTagBase64: string;
  cipherTextBase64: string;
}

function getMasterKey(): Buffer {
  if (!env.SECRETS_MASTER_KEY_BASE64) {
    if (env.ENCRYPTION_KEY) {
      return Buffer.from(env.ENCRYPTION_KEY, "utf8").subarray(0, 32);
    }
    throw new Error("Alert secret encryption is not configured. Set ENCRYPTION_KEY to exactly 32 characters.");
  }

  const key = Buffer.from(env.SECRETS_MASTER_KEY_BASE64, "base64");
  if (key.byteLength !== 32) {
    throw new Error("SECRETS_MASTER_KEY_BASE64 must decode to exactly 32 bytes");
  }
  return key;
}

export function assertSecretsConfigured(): void {
  getMasterKey();
}

export class SecretsService {
  encrypt(plainText: string): EncryptedValue {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", getMasterKey(), iv);
    const cipherText = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
      keyVersion: "local-v1",
      ivBase64: iv.toString("base64"),
      authTagBase64: authTag.toString("base64"),
      cipherTextBase64: cipherText.toString("base64")
    };
  }

  decrypt(value: EncryptedValue): string {
    const decipher = createDecipheriv("aes-256-gcm", getMasterKey(), Buffer.from(value.ivBase64, "base64"));
    decipher.setAuthTag(Buffer.from(value.authTagBase64, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(value.cipherTextBase64, "base64")),
      decipher.final()
    ]).toString("utf8");
  }
}
