import { NextRequest, NextResponse } from "next/server";
import {
  isSessionAuthenticated,
  unauthorizedSessionResponse,
} from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { createDocumentSchema, updateDocumentSchema } from "@/lib/validation";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function cleanOptional(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

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

    const candidate = {
      title: parsed.title ?? existing.title,
      fileType: parsed.fileType ?? existing.fileType,
      externalUrl:
        parsed.externalUrl !== undefined
          ? cleanOptional(parsed.externalUrl)
          : (existing.externalUrl ?? ""),
      localPathNote:
        parsed.localPathNote !== undefined
          ? cleanOptional(parsed.localPathNote)
          : (existing.localPathNote ?? ""),
      tags: parsed.tags !== undefined ? cleanOptional(parsed.tags) : (existing.tags ?? ""),
      notes: parsed.notes !== undefined ? cleanOptional(parsed.notes) : (existing.notes ?? ""),
      sizeMb: parsed.sizeMb !== undefined ? parsed.sizeMb : (existing.sizeMb ?? undefined),
    };

    const validated = createDocumentSchema.parse(candidate);

    const updated = await prisma.document.update({
      where: { id },
      data: {
        title: validated.title.trim(),
        fileType: validated.fileType,
        externalUrl: cleanOptional(validated.externalUrl),
        localPathNote: cleanOptional(validated.localPathNote),
        tags: cleanOptional(validated.tags),
        notes: cleanOptional(validated.notes),
        sizeMb: validated.sizeMb ?? null,
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
    await prisma.document.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }
}
