import { NextRequest, NextResponse } from "next/server";
import {
  isSessionAuthenticated,
  unauthorizedSessionResponse,
} from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  if (!isSessionAuthenticated(request)) {
    return unauthorizedSessionResponse();
  }

  try {
    const { id } = await context.params;
    const document = await prisma.document.findUnique({ where: { id } });
    if (!document) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    const { data, error } = await getSupabaseAdmin().storage
      .from(document.storageBucket)
      .createSignedUrl(document.storagePath, 300);

    if (error || !data?.signedUrl) {
      return NextResponse.json(
        { error: error?.message || "Unable to create signed URL." },
        { status: 500 },
      );
    }

    return NextResponse.json({ signedUrl: data.signedUrl });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Unable to create signed URL." }, { status: 500 });
  }
}
