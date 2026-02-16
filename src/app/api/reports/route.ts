import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { isPinAuthorized, unauthorizedPinResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseDateRange, reportRangeSchema } from "@/lib/validation";

function percentage(count: number, total: number) {
  if (total === 0) return 0;
  return Number(((count / total) * 100).toFixed(2));
}

function average(numbers: number[]) {
  if (numbers.length === 0) return 0;
  const total = numbers.reduce((acc, current) => acc + current, 0);
  return Number((total / numbers.length).toFixed(2));
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

    const perPersonMap = new Map<
      number,
      {
        personId: number;
        personName: string;
        observations: number;
        avgValues: number[];
        qualityCount: number;
        safetyCount: number;
      }
    >();

    for (const item of observations) {
      const personName = item.person.name || item.person.employeeCode || `ID ${item.personId}`;
      const current = perPersonMap.get(item.personId) ?? {
        personId: item.personId,
        personName,
        observations: 0,
        avgValues: [],
        qualityCount: 0,
        safetyCount: 0,
      };

      current.observations += 1;
      current.avgValues.push(item.avgSecondsPerBag);
      current.qualityCount += item.qualityIssue ? 1 : 0;
      current.safetyCount += item.safetyIssue ? 1 : 0;
      perPersonMap.set(item.personId, current);
    }

    const perPerson = Array.from(perPersonMap.values())
      .map((entry) => ({
        personId: entry.personId,
        personName: entry.personName,
        observations: entry.observations,
        avgSecondsPerBag: average(entry.avgValues),
        qualityIssueRate: percentage(entry.qualityCount, entry.observations),
        safetyIssueRate: percentage(entry.safetyCount, entry.observations),
      }))
      .sort((a, b) => a.personName.localeCompare(b.personName));

    const roleSummary = (role: Role) => {
      const items = observations.filter((item) => item.role === role);
      return {
        role,
        observations: items.length,
        avgSecondsPerBag: average(items.map((item) => item.avgSecondsPerBag)),
        qualityIssueRate: percentage(
          items.filter((item) => item.qualityIssue).length,
          items.length,
        ),
        safetyIssueRate: percentage(
          items.filter((item) => item.safetyIssue).length,
          items.length,
        ),
      };
    };

    return NextResponse.json({
      range: parsed,
      totals: { observations: observations.length },
      perPerson,
      byRole: [roleSummary("DUMPER"), roleSummary("UNZIPPER")],
    });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to build report." }, { status: 500 });
  }
}
