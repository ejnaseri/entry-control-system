import type { CookieOptions, Request, Response } from "express";
import { env, isProduction } from "../../config/env";

function parseCookieHeader(header: string | undefined) {
  const cookies: Record<string, string> = {};
  if (!header) {
    return cookies;
  }

  for (const part of header.split(";")) {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex < 0) {
      continue;
    }
    const key = part.slice(0, separatorIndex).trim();
    const rawValue = part.slice(separatorIndex + 1).trim();
    if (!key) {
      continue;
    }
    cookies[key] = decodeURIComponent(rawValue);
  }

  return cookies;
}

function authCookieOptions(expiresAt: Date): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
    expires: expiresAt,
  };
}

export function getAuthSessionToken(req: Request) {
  return getAuthSessionTokenFromCookieHeader(req.headers.cookie);
}

export function getAuthSessionTokenFromCookieHeader(header: string | undefined) {
  return parseCookieHeader(header)[env.AUTH_COOKIE_NAME];
}

export function setAuthSessionCookie(res: Response, token: string, expiresAt: Date) {
  res.cookie(env.AUTH_COOKIE_NAME, token, authCookieOptions(expiresAt));
}

export function clearAuthSessionCookie(res: Response) {
  res.clearCookie(env.AUTH_COOKIE_NAME, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
  });
}
