import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [hash, salt] = stored.split(".");
  if (!hash || !salt) return false;
  const hashBuf = Buffer.from(hash, "hex");
  const inputBuf = (await scryptAsync(password, salt, 64)) as Buffer;
  return timingSafeEqual(hashBuf, inputBuf);
}
