import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    const userCount = await prisma.user.count();

    return NextResponse.json({
      status: "ok",
      database: "connected",
      userCount,
    });
  } catch (error) {
    console.error("Database health check failed:", error);

    return NextResponse.json(
      {
        status: "error",
        database: "disconnected",
        message: "Could not connect to the database.",
      },
      { status: 503 },
    );
  }
}
