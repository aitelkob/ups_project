import { NextRequest, NextResponse } from "next/server";
import {
  isSessionAuthenticated,
  unauthorizedSessionResponse,
} from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const DEFAULT_BUCKET = "debag-docs";

export async function GET(request: NextRequest) {
  if (!isSessionAuthenticated(request)) {
    return unauthorizedSessionResponse();
  }

  const result = {
    ok: false,
    timestamp: new Date().toISOString(),
    checks: {
      database: { ok: false, message: "" },
      storage: { ok: false, message: "" },
    },
  };

  try {
    await prisma.document.findFirst({
      select: { id: true },
    });
    result.checks.database = { ok: true, message: "Database reachable." };
  } catch (error) {
    result.checks.database = {
      ok: false,
      message: error instanceof Error ? error.message : "Database check failed.",
    };
  }

  try {
    const { error } = await getSupabaseAdmin().storage.from(DEFAULT_BUCKET).list("", {
      limit: 1,
    });
    if (error) {
      result.checks.storage = { ok: false, message: error.message };
    } else {
      result.checks.storage = { ok: true, message: "Storage bucket reachable." };
    }
  } catch (error) {
    result.checks.storage = {
      ok: false,
      message: error instanceof Error ? error.message : "Storage check failed.",
    };
  }

  result.ok = result.checks.database.ok && result.checks.storage.ok;

  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}
