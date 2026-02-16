import { NextRequest, NextResponse } from "next/server";
import { isPinAuthorized, unauthorizedPinResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createObservationSchema,
  observationFiltersSchema,
  parseDateRange,
} from "@/lib/validation";

export async function GET(request: NextRequest) {
  if (!isPinAuthorized(request)) {
    return unauthorizedPinResponse();
  }

  try {
    const parsed = observationFiltersSchema.parse({
      role: request.nextUrl.searchParams.get("role") || undefined,
      belt: request.nextUrl.searchParams.get("belt") || undefined,
      shiftWindow:
        request.nextUrl.searchParams.get("shiftWindow") ||
        request.nextUrl.searchParams.get("shift_window") ||
        undefined,
      flowCondition:
        request.nextUrl.searchParams.get("flowCondition") ||
        request.nextUrl.searchParams.get("flow_condition") ||
        undefined,
      limit: request.nextUrl.searchParams.get("limit") || undefined,
      start: request.nextUrl.searchParams.get("start") || undefined,
      end: request.nextUrl.searchParams.get("end") || undefined,
    });

    const dateFilter =
      parsed.start && parsed.end
        ? (() => {
            const { startDate, endDate } = parseDateRange(parsed.start, parsed.end);
            return { gte: startDate, lte: endDate };
          })()
        : undefined;

    const observations = await prisma.observation.findMany({
      where: {
        role: parsed.role,
        belt: parsed.belt,
        shiftWindow: parsed.shiftWindow,
        flowCondition: parsed.flowCondition,
        createdAt: dateFilter,
      },
      include: {
        person: true,
      },
      orderBy: { createdAt: "desc" },
      take: parsed.limit,
    });

    return NextResponse.json(observations);
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Unable to fetch observations." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isPinAuthorized(request)) {
    return unauthorizedPinResponse();
  }

  try {
    const payload = await request.json();
    const parsed = createObservationSchema.parse(payload);
    const avgSecondsPerBag = Number(
      (parsed.totalSeconds / parsed.bagsTimed).toFixed(2),
    );

    const observation = await prisma.observation.create({
      data: {
        personId: parsed.personId,
        role: parsed.role,
        belt: parsed.belt,
        shiftWindow: parsed.shiftWindow,
        bagsTimed: parsed.bagsTimed,
        totalSeconds: parsed.totalSeconds,
        avgSecondsPerBag,
        flowCondition: parsed.flowCondition,
        qualityIssue: parsed.qualityIssue,
        safetyIssue: parsed.safetyIssue,
        notes: parsed.notes || null,
      },
      include: {
        person: true,
      },
    });

    return NextResponse.json(observation, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Unable to create observation." },
      { status: 500 },
    );
  }
}
