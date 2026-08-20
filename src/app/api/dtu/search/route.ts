import { NextRequest, NextResponse } from "next/server";
import { searchDtuCourseClasses } from "@/lib/dtu";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const semester = request.nextUrl.searchParams.get("semester")?.trim();

  if (!query) {
    return NextResponse.json(
      { error: "Nhập mã môn cần tra cứu, ví dụ CS 211." },
      { status: 400 }
    );
  }

  try {
    const result = await searchDtuCourseClasses(query, semester || undefined);

    return NextResponse.json({
      data: result.classes,
      courses: result.courses,
      semester: result.semester
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không thể tra cứu dữ liệu DTU.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
