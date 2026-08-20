import { mkdir, writeFile } from "node:fs/promises";

const DTU_BASE = "https://courses.duytan.edu.vn";
const USER_AGENT = "lichhocduytan-github-pages-sync/1.0";

function decodeHtml(value = "") {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function htmlToText(html = "") {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(?:p|div|li|td|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[\t\r ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function normalize(value = "") {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeCourseCode(value = "") {
  const compact = value.toUpperCase().replace(/\s+/g, " ").trim();
  const match = compact.match(/^([A-Z][A-Z-]*)\s*(\d+[A-Z]?)$/);
  return match ? `${match[1]} ${match[2]}` : compact;
}

function parseOptions(html) {
  const options = [];
  const pattern = /<option\b([^>]*)>([\s\S]*?)<\/option>/gi;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    const attrs = match[1];
    const value =
      attrs.match(/\bvalue\s*=\s*"([^"]*)"/i)?.[1] ??
      attrs.match(/\bvalue\s*=\s*'([^']*)'/i)?.[1] ??
      attrs.match(/\bvalue\s*=\s*([^\s>]+)/i)?.[1] ??
      "";
    const label = htmlToText(match[2]);
    if (value.trim() && label) {
      options.push({
        value: decodeHtml(value.trim()),
        label,
        selected: /\bselected\b/i.test(attrs)
      });
    }
  }
  return options;
}

function extractRows(html) {
  const rows = [];
  const pattern = /<tr\b([^>]*)>([\s\S]*?)<\/tr>/gi;
  let match;
  while ((match = pattern.exec(html)) !== null) rows.push({ attrs: match[1], html: match[2] });
  return rows;
}

function extractCells(rowHtml) {
  const cells = [];
  const pattern = /<td\b([^>]*)>([\s\S]*?)<\/td>/gi;
  let match;
  while ((match = pattern.exec(rowHtml)) !== null) {
    cells.push({ attrs: match[1], html: match[2], text: htmlToText(match[2]) });
  }
  return cells;
}

function firstAnchor(html) {
  const match = html.match(/<a\b([^>]*)>([\s\S]*?)<\/a>/i);
  if (!match) return null;
  const href =
    match[1].match(/\bhref\s*=\s*"([^"]+)"/i)?.[1] ??
    match[1].match(/\bhref\s*=\s*'([^']+)'/i)?.[1] ??
    match[1].match(/\bhref\s*=\s*([^\s>]+)/i)?.[1];
  if (!href) return null;
  return { href: decodeHtml(href), text: htmlToText(match[2]) };
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" },
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) throw new Error(`${url} -> HTTP ${response.status}`);
  return response.text();
}

async function getCurrentSemester() {
  const yearHtml = await fetchText(`${DTU_BASE}/Modules/academicprogram/ajax/LoadNamHoc.aspx?namhocname=cboNamHoc2&id=2`);
  const years = parseOptions(yearHtml);
  if (!years.length) throw new Error("Không đọc được năm học DTU");

  const now = new Date();
  const startYear = now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  const expectedYear = `${startYear}-${startYear + 1}`;
  const year = years.find((item) => item.selected) ?? [...years].reverse().find((item) => normalize(item.label).includes(expectedYear)) ?? years.at(-1);

  const semesterHtml = await fetchText(`${DTU_BASE}/Modules/academicprogram/ajax/LoadHocKy.aspx?hockyname=cboHocKy1&namhoc=${encodeURIComponent(year.value)}`);
  const semesters = parseOptions(semesterHtml);
  const semester = semesters.find((item) => item.selected) ?? semesters.at(-1);
  if (!semester) throw new Error("Không đọc được học kỳ DTU");

  return { yearValue: year.value, yearLabel: year.label, semesterId: semester.value, semesterLabel: semester.label };
}

function parseCourses(html) {
  const courses = [];
  for (const row of extractRows(html)) {
    if (!/\bclass\s*=\s*["'][^"']*\blop\b/i.test(row.attrs)) continue;
    const cells = extractCells(row.html);
    if (cells.length < 2) continue;
    const anchor = firstAnchor(cells[0].html);
    if (!anchor) continue;
    let url;
    try { url = new URL(anchor.href, `${DTU_BASE}/Sites/`); } catch { continue; }
    const courseId = url.searchParams.get("courseid");
    if (!courseId || !/^\d+$/.test(courseId)) continue;
    courses.push({ courseId, courseCode: normalizeCourseCode(anchor.text), courseName: cells[1].text });
  }
  const seen = new Set();
  return courses.filter((item) => {
    const key = `${item.courseId}:${item.courseCode}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseClasses(html, course, semester) {
  const classes = [];
  for (const row of extractRows(html)) {
    const cells = extractCells(row.html);
    if (cells.length < 12) continue;

    const classAnchor = firstAnchor(cells[0].html);
    const registrationAnchor = firstAnchor(cells[1].html);
    const className = classAnchor?.text ?? cells[0].text;
    const registrationCode = registrationAnchor?.text ?? cells[1].text;
    if (!className) continue;

    const availableText = cells[3].text;
    const available = /het\s*cho/i.test(normalize(availableText)) ? 0 : Number(availableText.match(/\d+/)?.[0] ?? "0");
    if (available <= 0) continue;

    const dates = cells[4].text.match(/\d{1,2}\/\d{1,2}\/\d{4}/g) ?? [];
    let sourceUrl = "";
    if (classAnchor?.href) {
      try {
        const url = new URL(classAnchor.href, `${DTU_BASE}/Sites/`);
        url.protocol = "https:";
        if (!url.searchParams.get("timespan")) url.searchParams.set("timespan", semester.semesterId);
        sourceUrl = url.toString();
      } catch {}
    }

    classes.push({
      courseId: course.courseId,
      courseCode: course.courseCode,
      courseName: course.courseName,
      className,
      registrationCode: registrationCode || "—",
      classType: cells[2].text || "—",
      available,
      registrationWindow: cells[4].text || "—",
      studyWeeks: cells[5].text || "—",
      schedule: cells[6].text || "—",
      room: cells[7].text || "—",
      location: cells[8].text || "—",
      lecturer: cells[9].text || "Chưa rõ giảng viên",
      registrationStatus: cells[10].text || "—",
      implementationStatus: cells[11].text || "—",
      sourceUrl,
      semester: `${semester.semesterLabel} · ${semester.yearLabel}`,
      registrationStart: dates[0] ?? "",
      registrationEnd: dates[1] ?? ""
    });
  }
  return classes;
}

async function main() {
  const semester = await getCurrentSemester();
  console.log(`Semester: ${semester.semesterLabel} / ${semester.yearLabel} (${semester.semesterId})`);

  const courseSearchUrl = `${DTU_BASE}/Modules/academicprogram/CourseResultSearch.aspx?keyword2=*&scope=1&hocky=${encodeURIComponent(semester.semesterId)}&t=${Date.now()}`;
  const courseHtml = await fetchText(courseSearchUrl);
  const courses = parseCourses(courseHtml);
  console.log(`Courses found: ${courses.length}`);

  const allClasses = [];
  const concurrency = 4;
  for (let i = 0; i < courses.length; i += concurrency) {
    const batch = courses.slice(i, i + concurrency);
    const results = await Promise.all(batch.map(async (course) => {
      try {
        const url = `${DTU_BASE}/Modules/academicprogram/CourseClassResult.aspx?courseid=${encodeURIComponent(course.courseId)}&semesterid=${encodeURIComponent(semester.semesterId)}&timespan=${encodeURIComponent(semester.semesterId)}`;
        const html = await fetchText(url);
        return parseClasses(html, course, semester);
      } catch (error) {
        console.warn(`Skip ${course.courseCode}: ${error instanceof Error ? error.message : error}`);
        return [];
      }
    }));
    for (const items of results) allClasses.push(...items);
    if (i + concurrency < courses.length) await new Promise((resolve) => setTimeout(resolve, 150));
  }

  allClasses.sort((a, b) => a.courseCode.localeCompare(b.courseCode) || b.available - a.available);
  const payload = {
    generatedAt: new Date().toISOString(),
    source: "courses.duytan.edu.vn",
    semester,
    courseCount: courses.length,
    openClassCount: allClasses.length,
    classes: allClasses
  };

  await mkdir("data", { recursive: true });
  await writeFile("data/classes.json", JSON.stringify(payload), "utf8");
  console.log(`Open classes written: ${allClasses.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
