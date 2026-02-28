import { NextRequest, NextResponse } from "next/server";
import {
  isSessionAuthenticated,
  unauthorizedSessionResponse,
} from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { updateDocumentSchema } from "@/lib/validation";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!isSessionAuthenticated(request)) {
    return unauthorizedSessionResponse();
  }

  try {
    const { id } = await context.params;
    const payload = await request.json();
    const parsed = updateDocumentSchema.parse(payload);

    const existing = await prisma.document.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    const updated = await prisma.document.update({
      where: { id },
      data: {
        title: parsed.title?.trim(),
        fileType: parsed.fileType,
        tags: parsed.tags?.trim() || (parsed.tags === "" ? null : undefined),
        notes: parsed.notes?.trim() || (parsed.notes === "" ? null : undefined),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to update document." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  if (!isSessionAuthenticated(_request)) {
    return unauthorizedSessionResponse();
  }

  try {
    const { id } = await context.params;
    const existing = await prisma.document.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    const { error: storageError } = await getSupabaseAdmin().storage
      .from(existing.storageBucket)
      .remove([existing.storagePath]);

    if (storageError) {
      return NextResponse.json(
        { error: `Storage delete failed: ${storageError.message}` },
        { status: 500 },
      );
    }

    await prisma.document.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Unable to delete document." }, { status: 500 });
  }
}
