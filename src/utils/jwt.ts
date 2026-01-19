type JwtPayload = {
  sub?: string;
  role?: string;
  exp?: number;
};

function decodeBase64Url(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(input.length / 4) * 4, '=');
  return atob(padded);
}

export function decodeJwt(token: string): JwtPayload | null {
  try {
    const [, payload] = token.split('.');
    if (!payload) {
      return null;
    }
    const json = decodeBase64Url(payload);
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

export function isTokenExpired(payload?: JwtPayload | null): boolean {
  if (!payload?.exp) {
    return false;
  }
  return Date.now() >= payload.exp * 1000;
}
