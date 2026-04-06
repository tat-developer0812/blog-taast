import { SignJWT, jwtVerify } from "jose";

const encoder = new TextEncoder();

export async function createSession(secret: string): Promise<string> {
  return new SignJWT({ admin: true })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("24h")
    .sign(encoder.encode(secret));
}

export async function verifySession(
  token: string,
  secret: string
): Promise<boolean> {
  try {
    await jwtVerify(token, encoder.encode(secret));
    return true;
  } catch {
    return false;
  }
}
