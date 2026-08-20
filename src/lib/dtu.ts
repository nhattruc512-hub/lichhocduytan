import type { CourseClass, Meeting } from "@/lib/types";

const DTU_HOST = "courses.duytan.edu.vn";

const entityMap: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&quot;": '"',
  "&#39;": "'",
  "&lt;": "<",
  "&gt;": ">"
};

function decodeHtml(value: string) {
  return value
    .replace(/&(nbsp|amp|quot|#39|lt|gt);/gi, (entity) => entityMap[entity.toLowerCase()] ?? entity)
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)));
}

function htmlToText(html: string) {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<(br|\/p|\/div|\/li|\/tr|\/td|\/h\d)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[\t\r ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function firstMatch(text: string, pattern: RegExp, fallback = "") {
  return text.match(pattern)?.[1]?.trim() ?? fallback;
}

function parseRooms(text: string) {
  const section = text.match(/Phòng học:\s*([\s\S]*?)\s*Giảng viên:/i)?.[1] ?? "";
  const rooms = new Map<number, string[]>();
  const roomPattern = /Thứ\s*(\d)\s*-\s*([^\n]+)/gi;
  let match: RegExpExecArray | null;

  while ((match = roomPattern.exec(section)) !== null) {
    const day = Number(match[1]);
    const current = rooms.get(day) ?? [];
    current.push(match[2].trim());
    rooms.set(day, current);
  }

  return rooms;
}

function parseMeetings(text: string): Meeting[] {
  const scheduleSection = text.match(/Ngày, giờ học:\s*([\s\S]*?)\s*Bắt đầu - Kết thúc:/i)?.[1] ?? "";
  const rooms = parseRooms(text);
  const meetings: Meeting[] = [];
  const pattern = /Thứ\s*(\d)\s*-\s*Giờ\s*(\d{1,2}:\d{2})\s*(?:AM|PM)?\s*-\s*(\d{1,2}:\d{2})\s*(?:AM|PM)?/gi;
  const roomIndexes = new Map<number, number>();
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(scheduleSection)) !== null) {
    const day = Number(match[1]);
    const roomIndex = roomIndexes.get(day) ?? 0;
    const roomList = rooms.get(day) ?? [];
    meetings.push({
      day,
      start: match[2],
      end: match[3],
      room: roomList[roomIndex] ?? "Chưa rõ phòng"
    });
    roomIndexes.set(day, roomIndex + 1);
  }

  return meetings;
}

export function normalizeDtuDetailUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || url.hostname.toLowerCase() !== DTU_HOST) {
    throw new Error("Chỉ chấp nhận liên kết HTTPS từ courses.duytan.edu.vn.");
  }

  if (!url.pathname.toLowerCase().endsWith("/sites/home_chuongtrinhdaotao.aspx")) {
    throw new Error("Liên kết DTU không đúng trang chi tiết lớp học.");
  }

  if (url.searchParams.get("p") !== "home_listclassdetail" || !url.searchParams.get("classid")) {
    throw new Error("Liên kết cần có classid và p=home_listclassdetail.");
  }

  return url;
}

export function parseDtuClassDetail(html: string, sourceUrl: string): CourseClass {
  const text = htmlToText(html);
  const courseLine = text.match(/([A-Z][A-Z-]*\s*\d{2,4})\s*[–-]\s*([^\n/]+)(?:\s*\/\s*Loại hình:\s*([^\n]+))?/i);
  const registrationCode = firstMatch(text, /Mã đăng ký:\s*([A-Z0-9-]+)/i, "Chưa công bố");
  const dateRange = text.match(/Bắt đầu - Kết thúc:\s*([^\n-]+?)\s*-\s*([^\n]+)/i);
  const capacity = Number(firstMatch(text, /Số chỗ đăng ký:\s*(\d+)/i, "0"));
  const registered = Number(firstMatch(text, /Số chỗ đã đăng ký:\s*(\d+)/i, "0"));
  const available = Number(firstMatch(text, /Còn trống:\s*(\d+)/i, String(Math.max(0, capacity - registered))));
  const source = new URL(sourceUrl);
  const classId = source.searchParams.get("classid") ?? registrationCode;

  if (!courseLine) {
    throw new Error("Không đọc được thông tin môn học từ trang DTU.");
  }

  return {
    id: `dtu-${classId}`,
    courseCode: courseLine[1].replace(/\s+/g, " ").trim().toUpperCase(),
    courseName: courseLine[2].trim(),
    classType: courseLine[3]?.trim() ?? "N/A",
    registrationCode,
    semester: firstMatch(text, /Học kỳ:\s*([^\n]+)/i, "Chưa rõ học kỳ"),
    credits: Number(firstMatch(text, /Số ĐVHT:\s*(\d+)/i, "0")),
    lecturer: firstMatch(text, /Giảng viên:\s*([\s\S]*?)\s*Thông tin Giảng viên/i, "Chưa rõ giảng viên"),
    capacity,
    registered,
    available,
    registrationStatus: firstMatch(text, /Tình trạng đăng ký:\s*([^\n]+)/i, "Chưa rõ trạng thái"),
    startDate: dateRange?.[1]?.trim() ?? "Chưa rõ",
    endDate: dateRange?.[2]?.trim() ?? "Chưa rõ",
    meetings: parseMeetings(text),
    source: "dtu",
    sourceUrl
  };
}
