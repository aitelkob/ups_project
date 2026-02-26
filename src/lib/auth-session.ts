import { NextRequest, NextResponse } from "next/server";

export const AUTH_COOKIE_NAME = "dm_auth";
const AUTH_COOKIE_VALUE = "1";
const AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export function getConfiguredPin() {
  const pin = process.env.APP_PIN?.trim();
  return pin ? pin : null;
}

export function isPinValid(pin: string) {
  const configured = getConfiguredPin();
  if (!configured) return true;
  return pin.trim() === configured;
}

export function isSessionAuthenticated(request: NextRequest) {
  const configured = getConfiguredPin();
  if (!configured) return true;
  return request.cookies.get(AUTH_COOKIE_NAME)?.value === AUTH_COOKIE_VALUE;
}

export function unauthorizedSessionResponse() {
  return NextResponse.json({ error: "Unauthorized. PIN required." }, { status: 401 });
}

export function setAuthCookie(response: NextResponse) {
  response.cookies.set(AUTH_COOKIE_NAME, AUTH_COOKIE_VALUE, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
    path: "/",
  });
  return response;
}

export function clearAuthCookie(response: NextResponse) {
  response.cookies.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    path: "/",
  });
  return response;
}
