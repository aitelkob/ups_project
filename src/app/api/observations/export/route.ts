import { NextRequest, NextResponse } from "next/server";
import { isPinAuthorized, unauthorizedPinResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseDateRange, reportRangeSchema } from "@/lib/validation";

function csvEscape(value: string | number | boolean | null) {
  if (value === null) return "";
  const stringValue = String(value);
  if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }
  return stringValue;
}

export async function GET(request: NextRequest) {
  if (!isPinAuthorized(request)) {
    return unauthorizedPinResponse();
  }

  try {
    const parsed = reportRangeSchema.parse({
      start: request.nextUrl.searchParams.get("start"),
      end: request.nextUrl.searchParams.get("end"),
    });
    const { startDate, endDate } = parseDateRange(parsed.start, parsed.end);

    const observations = await prisma.observation.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: { person: true },
      orderBy: { createdAt: "desc" },
    });

    const rows = [
      [
        "created_at",
        "person",
        "employee_code",
        "role",
        "belt",
        "shift_window",
        "bags_timed",
        "total_seconds",
        "avg_seconds_per_bag",
        "flow_condition",
        "quality_issue",
        "safety_issue",
        "notes",
      ],
      ...observations.map((item) => [
        item.createdAt.toISOString(),
        item.person.name ?? "",
        item.person.employeeCode ?? "",
        item.role,
        item.belt,
        item.shiftWindow,
        item.bagsTimed,
        item.totalSeconds,
        item.avgSecondsPerBag,
        item.flowCondition,
        item.qualityIssue,
        item.safetyIssue,
        item.notes ?? "",
      ]),
    ];

    const csv = rows
      .map((row) => row.map((cell) => csvEscape(cell)).join(","))
      .join("\n");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="debags_${parsed.start}_to_${parsed.end}.csv"`,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Unable to export CSV." }, { status: 500 });
  }
}
