import { NextRequest, NextResponse } from "next/server";
import { isPinAuthorized, unauthorizedPinResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(request: NextRequest, context: RouteContext) {
  if (!isPinAuthorized(request)) {
    return unauthorizedPinResponse();
  }

  const { id } = await context.params;
  const observationId = Number(id);
  if (!Number.isInteger(observationId) || observationId <= 0) {
    return NextResponse.json({ error: "Invalid observation id." }, { status: 400 });
  }

  try {
    await prisma.observation.delete({
      where: { id: observationId },
    });

    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Observation not found." }, { status: 404 });
  }
}
