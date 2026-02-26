import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isPinValid, setAuthCookie } from "@/lib/auth-session";

const pinSchema = z.object({
  pin: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const parsed = pinSchema.parse(payload);

    if (!isPinValid(parsed.pin)) {
      return NextResponse.json({ error: "Invalid PIN." }, { status: 401 });
    }

    const response = NextResponse.json({ success: true });
    return setAuthCookie(response);
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
}
