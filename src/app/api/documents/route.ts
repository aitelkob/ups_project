import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import {
  isSessionAuthenticated,
  unauthorizedSessionResponse,
} from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { createDocumentSchema, documentFiltersSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!isSessionAuthenticated(request)) {
    return unauthorizedSessionResponse();
  }

  try {
    const parsed = documentFiltersSchema.parse({
      query: request.nextUrl.searchParams.get("query") ?? undefined,
      type: request.nextUrl.searchParams.get("type") ?? undefined,
      sort: request.nextUrl.searchParams.get("sort") ?? "newest",
    });

    const query = parsed.query?.trim();
    const orderBy: Prisma.DocumentOrderByWithRelationInput =
      parsed.sort === "oldest"
        ? { createdAt: "asc" }
        : parsed.sort === "title"
          ? { title: "asc" }
          : { createdAt: "desc" };

    const documents = await prisma.document.findMany({
      where: {
        fileType: parsed.type,
        OR: query
          ? [
              { title: { contains: query, mode: "insensitive" } },
              { tags: { contains: query, mode: "insensitive" } },
              { notes: { contains: query, mode: "insensitive" } },
            ]
          : undefined,
      },
      orderBy,
    });

    return NextResponse.json(documents);
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to fetch documents." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isSessionAuthenticated(request)) {
    return unauthorizedSessionResponse();
  }

  try {
    const payload = await request.json();
    const parsed = createDocumentSchema.parse(payload);

    const document = await prisma.document.create({
      data: {
        title: parsed.title.trim(),
        fileType: parsed.fileType,
        storageBucket: parsed.storageBucket,
        storagePath: parsed.storagePath.trim(),
        originalFilename: parsed.originalFilename?.trim() || null,
        mimeType: parsed.mimeType?.trim() || null,
        sizeBytes: parsed.sizeBytes ?? null,
        tags: parsed.tags?.trim() || null,
        notes: parsed.notes?.trim() || null,
      },
    });

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to create document." }, { status: 500 });
  }
}
