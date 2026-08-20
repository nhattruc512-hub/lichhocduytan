import type { CourseClass, Meeting } from "@/lib/types";

const DTU_BASE = "https://courses.duytan.edu.vn";
const DTU_HOST = "courses.duytan.edu.vn";
const DTU_USER_AGENT = "lichhocduytan/0.2 (+public course lookup helper)";

export type DtuSemesterInfo = {
  yearValue: string;
  yearLabel: string;
  semesterId: string;
  semesterLabel: string;
};

export type DtuCourseHit = {
  courseId: string;
  courseCode: string;
  courseName: string;
  sourceUrl: string;
};

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
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCharCode(Number.parseInt(code, 16)))
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

function normalizeLoose(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeCourseCode(value: string) {
  const compact = value.toUpperCase().replace(/\s+/g, " ").trim();
  const match = compact.match(/^([A-Z][A-Z-]*)\s*(\d+[A-Z]?)$/);
  return match ? `${match[1]} ${match[2]}` : compact;
}

function firstMatch(text: string, pattern: RegExp, fallback = "") {
  return text.match(pattern)?.[1]?.trim() ?? fallback;
}

type HtmlCell = {
  attrs: string;
  html: string;
  text: string;
};

function extractRows(html: string) {
  const rows: Array<{ attrs: string; html: string }> = [];
  const pattern = /<tr\b([^>]*)>([\s\S]*?)<\/tr>/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    rows.push({ attrs: match[1], html: match[2] });
  }

  return rows;
}

function extractCells(rowHtml: string): HtmlCell[] {
  const cells: HtmlCell[] = [];
  const pattern = /<td\b([^>]*)>([\s\S]*?)<\/td>/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(rowHtml)) !== null) {
    cells.push({
      attrs: match[1],
      html: match[2],
      text: htmlToText(match[2])
    });
  }

  return cells;
}

function extractFirstAnchor(html: string) {
  const match = html.match(/<a\b([^>]*)>([\s\S]*?)<\/a>/i);
  if (!match) return null;

  const href =
    match[1].match(/\bhref\s*=\s*"([^"]+)"/i)?.[1] ??
    match[1].match(/\bhref\s*=\s*'([^']+)'/i)?.[1] ??
    match[1].match(/\bhref\s*=\s*([^\s>]+)/i)?.[1];

  if (!href) return null;

  return {
    href: decodeHtml(href),
    text: htmlToText(match[2])
  };
}

function parseOptions(html: string) {
  const options: Array<{ value: string; label: string }> = [];
  const pattern = /<option\b([^>]*)>([\s\S]*?)<\/option>/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    const attrs = match[1];
    const value =
      attrs.match(/\bvalue\s*=\s*"([^"]*)"/i)?.[1] ??
      attrs.match(/\bvalue\s*=\s*'([^']*)'/i)?.[1] ??
      attrs.match(/\bvalue\s*=\s*([^\s>]+)/i)?.[1] ??
      "";

    const label = htmlToText(match[2]);
    if (value.trim() && label) {
      options.push({ value: decodeHtml(value.trim()), label });
    }
  }

  return options;
}

async function fetchDtuHtml(url: string, revalidate: number) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": DTU_USER_AGENT,
      Accept: "text/html,application/xhtml+xml"
    },
    next: { revalidate },
    signal: AbortSignal.timeout(12_000)
  });

  if (!response.ok) {
    throw new Error(`DTU trả về HTTP ${response.status}.`);
  }

  return response.text();
}

export async function getDtuCurrentSemester(): Promise<DtuSemesterInfo> {
  const yearUrl = `${DTU_BASE}/Modules/academicprogram/ajax/LoadNamHoc.aspx?namhocname=cboNamHoc2&id=2`;
  const yearHtml = await fetchDtuHtml(yearUrl, 3600);
  const yearOptions = parseOptions(yearHtml);

  if (!yearOptions.length) {
    throw new Error("Không đọc được danh sách năm học từ DTU.");
  }

  const now = new Date();
  const academicStartYear = now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  const expectedYear = `${academicStartYear}-${academicStartYear + 1}`;
  const year =
    [...yearOptions].reverse().find((option) => normalizeLoose(option.label).includes(expectedYear)) ??
    yearOptions.at(-1);

  if (!year) {
    throw new Error("Không xác định được năm học hiện tại.");
  }

  const semesterUrl = `${DTU_BASE}/Modules/academicprogram/ajax/LoadHocKy.aspx?hockyname=cboHocKy1&namhoc=${encodeURIComponent(year.value)}`;
  const semesterHtml = await fetchDtuHtml(semesterUrl, 1800);
  const semesterOptions = parseOptions(semesterHtml);
  const semester = semesterOptions.at(-1);

  if (!semester) {
    throw new Error("Không đọc được học kỳ hiện tại từ DTU.");
  }

  return {
    yearValue: year.value,
    yearLabel: year.label,
    semesterId: semester.value,
    semesterLabel: semester.label
  };
}

function parseCourseHits(html: string): DtuCourseHit[] {
  const hits: DtuCourseHit[] = [];

  for (const row of extractRows(html)) {
    if (!/\bclass\s*=\s*["'][^"']*\blop\b/i.test(row.attrs)) continue;

    const cells = extractCells(row.html);
    if (cells.length < 2) continue;

    const anchor = extractFirstAnchor(cells[0].html);
    if (!anchor) continue;

    let url: URL;
    try {
      url = new URL(anchor.href, `${DTU_BASE}/Sites/`);
    } catch {
      continue;
    }

    const courseId = url.searchParams.get("courseid");
    if (!courseId || !/^\d+$/.test(courseId)) continue;

    hits.push({
      courseId,
      courseCode: normalizeCourseCode(anchor.text),
      courseName: cells[1].text,
      sourceUrl: url.toString().replace(/^http:/, "https:")
    });
  }

  const seen = new Set<string>();
  return hits.filter((hit) => {
    const key = `${hit.courseId}:${hit.courseCode}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchCourseHits(query: string, semesterId: string) {
  const hourBucket = Math.floor(Date.now() / 3_600_000);
  const url =
    `${DTU_BASE}/Modules/academicprogram/CourseResultSearch.aspx` +
    `?keyword2=${encodeURIComponent(query)}&scope=1&hocky=${encodeURIComponent(semesterId)}&t=${hourBucket}`;
  const html = await fetchDtuHtml(url, 3600);
  return parseCourseHits(html);
}

function normalizeDtuTime(raw: string, meridiem?: string) {
  const [hoursText, minutesText] = raw.split(":");
  let hours = Number(hoursText);
  const minutes = Number(minutesText);

  if (meridiem?.toUpperCase() === "PM" && hours < 12) hours += 12;
  if (meridiem?.toUpperCase() === "AM" && hours === 12) hours = 0;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function splitCellLines(cell: HtmlCell) {
  return htmlToText(
    cell.html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(?:div|p|li)>/gi, "\n")
  )
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseScheduleCell(scheduleCell: HtmlCell, roomCell: HtmlCell, locationCell: HtmlCell): Meeting[] {
  const scheduleText = htmlToText(scheduleCell.html.replace(/<br\s*\/?>/gi, "\n"));
  const rooms = splitCellLines(roomCell);
  const locations = splitCellLines(locationCell);
  const meetings: Meeting[] = [];
  const pattern =
    /(?:Thứ\s*(\d)|Chủ\s*Nhật|CN)\s*(?:-|–)?\s*(?:Giờ\s*)?(\d{1,2}:\d{2})\s*(AM|PM)?\s*(?:-|–)\s*(\d{1,2}:\d{2})\s*(AM|PM)?/gi;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = pattern.exec(scheduleText)) !== null) {
    const day = match[1] ? Number(match[1]) : 8;
    const room = rooms[index] ?? rooms[0] ?? "Chưa rõ phòng";
    const location = locations[index] ?? locations[0] ?? "";
    const roomLabel = location && !normalizeLoose(room).includes(normalizeLoose(location))
      ? `${room} · ${location}`
      : room;

    meetings.push({
      day,
      start: normalizeDtuTime(match[2], match[3]),
      end: normalizeDtuTime(match[4], match[5]),
      room: roomLabel
    });
    index += 1;
  }

  return meetings;
}

function normalizeSourceUrl(rawHref: string | undefined, semesterId: string) {
  if (!rawHref) return undefined;

  try {
    const url = new URL(decodeHtml(rawHref), `${DTU_BASE}/Sites/`);
    url.protocol = "https:";
    if (!url.searchParams.get("timespan")) {
      url.searchParams.set("timespan", semesterId);
    }
    return url.toString();
  } catch {
    return undefined;
  }
}

function parseClassRows(
  html: string,
  course: DtuCourseHit,
  semester: DtuSemesterInfo
): CourseClass[] {
  const classes: CourseClass[] = [];

  for (const row of extractRows(html)) {
    const cells = extractCells(row.html);
    if (cells.length < 12) continue;

    const classAnchor = extractFirstAnchor(cells[0].html);
    const registrationAnchor = extractFirstAnchor(cells[1].html);
    const className = classAnchor?.text ?? cells[0].text;
    const registrationCode = registrationAnchor?.text ?? cells[1].text;

    if (!className || !registrationCode) continue;

    const availableText = cells[3].text;
    const available =
      /het\s*cho/i.test(normalizeLoose(availableText))
        ? 0
        : Number(availableText.match(/\d+/)?.[0] ?? "0");

    const registrationDates = cells[4].text.match(/\d{1,2}\/\d{1,2}\/\d{4}/g) ?? [];
    const sourceUrl = normalizeSourceUrl(classAnchor?.href, semester.semesterId);
    const classId = sourceUrl ? new URL(sourceUrl).searchParams.get("classid") : null;
    const classType = cells[2].text || "N/A";

    classes.push({
      id: `dtu-${classId ?? registrationCode ?? className}`,
      courseCode: course.courseCode,
      courseName: course.courseName,
      classType,
      registrationCode,
      semester: `${semester.semesterLabel} · ${semester.yearLabel}`,
      credits: 0,
      lecturer: cells[9].text || "Chưa rõ giảng viên",
      capacity: 0,
      registered: 0,
      available,
      registrationStatus: cells[10].text || "Chưa rõ trạng thái",
      startDate: registrationDates[0] ?? "Chưa rõ",
      endDate: registrationDates[1] ?? "Chưa rõ",
      meetings: parseScheduleCell(cells[6], cells[7], cells[8]),
      source: "dtu",
      sourceUrl
    });
  }

  return classes;
}

async function fetchCourseClasses(course: DtuCourseHit, semester: DtuSemesterInfo) {
  const url =
    `${DTU_BASE}/Modules/academicprogram/CourseClassResult.aspx` +
    `?courseid=${encodeURIComponent(course.courseId)}` +
    `&semesterid=${encodeURIComponent(semester.semesterId)}` +
    `&timespan=${encodeURIComponent(semester.semesterId)}`;

  const html = await fetchDtuHtml(url, 30);
  return parseClassRows(html, course, semester);
}

export async function searchDtuCourseClasses(rawQuery: string, semesterOverride?: string) {
  const query = normalizeCourseCode(rawQuery);

  if (query.length < 2 || query.length > 40) {
    throw new Error("Mã môn cần từ 2 đến 40 ký tự.");
  }

  if (query.includes("*")) {
    throw new Error("Không hỗ trợ ký tự * để tránh tải quá nhiều dữ liệu từ DTU.");
  }

  if (!/^[A-Z0-9 -]+$/i.test(query)) {
    throw new Error("Hiện tại tra cứu trực tiếp hỗ trợ mã môn, ví dụ CS 211 hoặc CMU-CS 246.");
  }

  const currentSemester = await getDtuCurrentSemester();
  const semester = semesterOverride && /^\d+$/.test(semesterOverride)
    ? { ...currentSemester, semesterId: semesterOverride }
    : currentSemester;

  let hits = await fetchCourseHits(query, semester.semesterId);

  if (!hits.length) {
    hits = await fetchCourseHits(`*${query}*`, semester.semesterId);
  }

  const exactQuery = normalizeLoose(query);
  const exactHits = hits.filter((hit) => normalizeLoose(hit.courseCode) === exactQuery);
  const selectedHits = (exactHits.length ? exactHits : hits).slice(0, 8);

  if (!selectedHits.length) {
    return { semester, courses: [], classes: [] };
  }

  const classGroups = await Promise.all(
    selectedHits.map((course) => fetchCourseClasses(course, semester))
  );

  return {
    semester,
    courses: selectedHits,
    classes: classGroups.flat()
  };
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
  const pattern = /Thứ\s*(\d)\s*-\s*Giờ\s*(\d{1,2}:\d{2})\s*(AM|PM)?\s*-\s*(\d{1,2}:\d{2})\s*(AM|PM)?/gi;
  const roomIndexes = new Map<number, number>();
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(scheduleSection)) !== null) {
    const day = Number(match[1]);
    const roomIndex = roomIndexes.get(day) ?? 0;
    const roomList = rooms.get(day) ?? [];
    meetings.push({
      day,
      start: normalizeDtuTime(match[2], match[3]),
      end: normalizeDtuTime(match[4], match[5]),
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
