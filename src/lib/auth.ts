import { NextRequest, NextResponse } from "next/server";

export function getConfiguredPin() {
  const pin = process.env.APP_PIN?.trim();
  return pin ? pin : null;
}

export function isPinAuthorized(request: NextRequest) {
  const configured = getConfiguredPin();
  if (!configured) {
    return true;
  }

  const supplied = request.headers.get("x-app-pin")?.trim();
  return supplied === configured;
}

export function unauthorizedPinResponse() {
  return NextResponse.json(
    { error: "Unauthorized. Invalid app PIN." },
    { status: 401 },
  );
}
