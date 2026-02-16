import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { isPinAuthorized, unauthorizedPinResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createPersonSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!isPinAuthorized(request)) {
    return unauthorizedPinResponse();
  }

  const people = await prisma.person.findMany({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(people);
}

export async function POST(request: NextRequest) {
  if (!isPinAuthorized(request)) {
    return unauthorizedPinResponse();
  }

  try {
    const payload = await request.json();
    const parsed = createPersonSchema.parse(payload);

    const person = await prisma.person.create({
      data: {
        name: parsed.name?.trim() || null,
        employeeCode: parsed.employeeCode?.trim() || null,
        active: parsed.active,
      },
    });

    return NextResponse.json(person, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "Employee code already exists." },
        { status: 409 },
      );
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Unable to create person." }, { status: 500 });
  }
}
