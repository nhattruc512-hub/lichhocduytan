import { NextResponse } from "next/server";
import { getDtuCurrentSemester } from "@/lib/dtu";

export async function GET() {
  const startedAt = Date.now();

  try {
    const semester = await getDtuCurrentSemester();

    return NextResponse.json({
      ok: true,
      source: "courses.duytan.edu.vn",
      semester,
      latencyMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString()
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không thể kết nối nguồn DTU.";

    return NextResponse.json(
      {
        ok: false,
        source: "courses.duytan.edu.vn",
        error: message,
        latencyMs: Date.now() - startedAt,
        checkedAt: new Date().toISOString()
      },
      { status: 503 }
    );
  }
}
