import { NextRequest, NextResponse } from "next/server";
import { normalizeDtuDetailUrl, parseDtuClassDetail } from "@/lib/dtu";

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get("url");

  if (!rawUrl) {
    return NextResponse.json({ error: "Thiếu tham số url." }, { status: 400 });
  }

  try {
    const url = normalizeDtuDetailUrl(rawUrl);
    const response = await fetch(url, {
      headers: {
        "User-Agent": "lichhocduytan/0.3 (+public course lookup helper)",
        Accept: "text/html,application/xhtml+xml"
      },
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(12_000)
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `DTU trả về HTTP ${response.status}.` },
        { status: 502 }
      );
    }

    const html = await response.text();
    const courseClass = parseDtuClassDetail(html, url.toString());

    return NextResponse.json({ data: courseClass });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không thể đọc dữ liệu DTU.";
    const isTimeout = error instanceof Error && error.name === "TimeoutError";
    return NextResponse.json(
      { error: isTimeout ? "Nguồn DTU phản hồi quá chậm. Vui lòng thử lại." : message },
      { status: isTimeout ? 504 : 400 }
    );
  }
}
