import * as jose from 'jose';
import type { JWTPayload } from '../types';

// JWT 토큰 생성
export async function createToken(
  payload: Omit<JWTPayload, 'exp' | 'iat'>,
  secret: string,
  expiresIn: string = '7d'
): Promise<string> {
  const secretKey = new TextEncoder().encode(secret);

  const jwt = await new jose.SignJWT(payload as unknown as jose.JWTPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secretKey);

  return jwt;
}

// JWT 토큰 검증
export async function verifyToken(
  token: string,
  secret: string
): Promise<JWTPayload | null> {
  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jose.jwtVerify(token, secretKey);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

// QR 코드용 토큰 생성 (24시간 유효)
export async function createQRToken(
  adminId: string,
  staffName: string,
  secret: string,
  expiresIn: string = '24h'
): Promise<string> {
  return createToken(
    {
      sub: `staff:${staffName}`,
      name: staffName,
      role: 'staff',
      adminId,
    },
    secret,
    expiresIn
  );
}

// Magic Link 토큰 생성 (15분 유효)
export async function createMagicLinkToken(
  email: string,
  secret: string
): Promise<string> {
  return createToken(
    {
      sub: `magic:${email}`,
      email,
      role: 'admin',
    },
    secret,
    '15m'
  );
}
