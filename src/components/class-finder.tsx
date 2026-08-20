"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { CourseClass, Meeting } from "@/lib/types";

const STORAGE_KEY = "dtu-class-finder:selected:v3";
const DAY_LABELS: Record<number, string> = {
  2: "Thứ 2",
  3: "Thứ 3",
  4: "Thứ 4",
  5: "Thứ 5",
  6: "Thứ 6",
  7: "Thứ 7",
  8: "CN"
};

type SemesterInfo = {
  yearLabel: string;
  semesterLabel: string;
  semesterId: string;
};

type CourseHit = {
  courseId: string;
  courseCode: string;
  courseName: string;
};

type LookupState = {
  loading: boolean;
  error: string;
  hasSearched: boolean;
  semester: SemesterInfo | null;
  courseCount: number;
};

type HealthState = {
  loading: boolean;
  ok: boolean | null;
  latencyMs?: number;
  error?: string;
  semester?: SemesterInfo;
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function toMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function meetingsOverlap(a: Meeting, b: Meeting) {
  return (
    a.day === b.day &&
    toMinutes(a.start) < toMinutes(b.end) &&
    toMinutes(b.start) < toMinutes(a.end)
  );
}

function classesConflict(a: CourseClass, b: CourseClass) {
  return a.meetings.some((meetingA) =>
    b.meetings.some((meetingB) => meetingsOverlap(meetingA, meetingB))
  );
}

function getConflictPairs(classes: CourseClass[]) {
  const pairs: Array<[CourseClass, CourseClass]> = [];
  for (let i = 0; i < classes.length; i += 1) {
    for (let j = i + 1; j < classes.length; j += 1) {
      if (classesConflict(classes[i], classes[j])) pairs.push([classes[i], classes[j]]);
    }
  }
  return pairs;
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m21 21-4.35-4.35m2.35-5.65a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14 5h5v5m0-5-9 9M19 13v6H5V5h6" />
    </svg>
  );
}

function meetingLabel(meeting: Meeting) {
  return `${DAY_LABELS[meeting.day] ?? `Thứ ${meeting.day}`} · ${meeting.start}–${meeting.end}`;
}

function escapeCsv(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function downloadSelectedSchedule(classes: CourseClass[]) {
  if (!classes.length) return;
  const header = ["Mã môn", "Tên môn", "Mã đăng ký", "Giảng viên", "Lịch", "Phòng", "Còn chỗ", "Trạng thái"];
  const rows = classes.map((item) => [
    item.courseCode,
    item.courseName,
    item.registrationCode,
    item.lecturer,
    item.meetings.map(meetingLabel).join(" | "),
    item.meetings.map((meeting) => meeting.room).join(" | "),
    item.available,
    item.registrationStatus
  ]);
  const csv = `\uFEFF${[header, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n")}`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "lich-du-kien-dtu.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

function Availability({ courseClass }: { courseClass: CourseClass }) {
  const isOpen = courseClass.available > 0;
  const detail = courseClass.capacity > 0
    ? `${courseClass.registered}/${courseClass.capacity}`
    : courseClass.registrationStatus;

  return (
    <div className={`availability ${isOpen ? "is-open" : "is-full"}`}>
      <span className="availability-dot" />
      <strong>{isOpen ? `${courseClass.available} chỗ trống` : "Hết chỗ"}</strong>
      <span>{detail || "Theo DTU"}</span>
    </div>
  );
}

function SourceHealth({ health, onRetry }: { health: HealthState; onRetry: () => void }) {
  const label = health.loading
    ? "Đang kiểm tra DTU"
    : health.ok
      ? `DTU hoạt động${typeof health.latencyMs === "number" ? ` · ${health.latencyMs}ms` : ""}`
      : "Nguồn DTU đang lỗi";

  return (
    <button
      className={`source-health ${health.ok === true ? "is-ok" : health.ok === false ? "is-error" : "is-loading"}`}
      type="button"
      onClick={onRetry}
      title={health.error || "Bấm để kiểm tra lại nguồn dữ liệu DTU"}
    >
      <span className="source-health-dot" />
      {label}
    </button>
  );
}

function CourseCard({
  courseClass,
  selected,
  enriching,
  copied,
  onToggle,
  onEnrich,
  onCopy
}: {
  courseClass: CourseClass;
  selected: boolean;
  enriching: boolean;
  copied: boolean;
  onToggle: (courseClass: CourseClass) => void;
  onEnrich: (courseClass: CourseClass) => void;
  onCopy: (courseClass: CourseClass) => void;
}) {
  return (
    <article className="course-card">
      <div className="course-card-top">
        <div>
          <div className="eyebrow-row">
            <span className="course-code">{courseClass.courseCode}</span>
            <span className="type-pill">{courseClass.classType}</span>
            <span className="live-pill">DTU live</span>
          </div>
          <h3>{courseClass.courseName}</h3>
          <div className="registration-row">
            <p className="registration-code">Mã đăng ký: <b>{courseClass.registrationCode}</b></p>
            <button className="copy-button" type="button" onClick={() => onCopy(courseClass)}>
              {copied ? "Đã copy" : "Copy mã"}
            </button>
          </div>
        </div>
        <Availability courseClass={courseClass} />
      </div>

      <div className="course-meta-grid">
        <div><span>Giảng viên</span><strong>{courseClass.lecturer}</strong></div>
        <div><span>Số tín chỉ</span><strong>{courseClass.credits || "—"}</strong></div>
        <div><span>Học kỳ</span><strong>{courseClass.semester}</strong></div>
        <div><span>Hạn đăng ký</span><strong>{courseClass.startDate} → {courseClass.endDate}</strong></div>
      </div>

      <div className="meeting-list">
        {courseClass.meetings.length > 0 ? (
          courseClass.meetings.map((meeting, index) => (
            <div className="meeting-chip" key={`${courseClass.id}-${meeting.day}-${meeting.start}-${index}`}>
              <CalendarIcon />
              <span>{meetingLabel(meeting)}</span>
              <b>{meeting.room}</b>
            </div>
          ))
        ) : (
          <p className="muted">DTU chưa trả về lịch học rõ ràng cho lớp này.</p>
        )}
      </div>

      <div className="course-actions">
        <button className={`select-button ${selected ? "selected" : ""}`} onClick={() => onToggle(courseClass)} type="button">
          {selected ? "✓ Đã thêm vào lịch" : "+ Thêm vào lịch dự kiến"}
        </button>
        <div className="secondary-actions">
          {courseClass.sourceUrl && courseClass.capacity === 0 ? (
            <button className="detail-button" type="button" disabled={enriching} onClick={() => onEnrich(courseClass)}>
              {enriching ? "Đang lấy..." : "Lấy chi tiết sĩ số"}
            </button>
          ) : null}
          {courseClass.sourceUrl ? (
            <a className="text-link" href={courseClass.sourceUrl} target="_blank" rel="noreferrer">
              Nguồn DTU <ExternalIcon />
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function SchedulePanel({ selected, onRemove, onClear }: { selected: CourseClass[]; onRemove: (id: string) => void; onClear: () => void }) {
  const conflicts = useMemo(() => getConflictPairs(selected), [selected]);

  return (
    <aside className="schedule-panel">
      <div className="panel-heading">
        <div>
          <span className="section-kicker">Lịch dự kiến</span>
          <h2>{selected.length} lớp đã chọn</h2>
        </div>
        <span className={`conflict-badge ${conflicts.length ? "has-conflict" : "is-safe"}`}>
          {conflicts.length ? `${conflicts.length} xung đột` : "Không trùng lịch"}
        </span>
      </div>

      {selected.length > 0 ? (
        <div className="schedule-actions">
          <button type="button" onClick={() => downloadSelectedSchedule(selected)}>Xuất CSV</button>
          <button type="button" className="danger-light" onClick={onClear}>Xoá lịch</button>
        </div>
      ) : null}

      {conflicts.length > 0 ? (
        <div className="conflict-box" role="alert">
          <strong>Phát hiện lịch bị trùng</strong>
          {conflicts.map(([a, b]) => (
            <p key={`${a.id}-${b.id}`}>{a.courseCode} ({a.registrationCode}) ↔ {b.courseCode} ({b.registrationCode})</p>
          ))}
        </div>
      ) : null}

      {selected.length === 0 ? (
        <div className="empty-schedule">
          <CalendarIcon />
          <strong>Chưa có lớp nào</strong>
          <p>Tra cứu từng môn và thêm lớp vào đây. Danh sách vẫn được giữ khi bạn tìm môn khác.</p>
        </div>
      ) : (
        <div className="selected-list">
          {selected.map((courseClass) => (
            <div className="selected-item" key={courseClass.id}>
              <div>
                <strong>{courseClass.courseCode} · {courseClass.registrationCode}</strong>
                <span>{courseClass.meetings.map(meetingLabel).join(" / ") || "Chưa rõ lịch"}</span>
              </div>
              <button type="button" onClick={() => onRemove(courseClass.id)} aria-label={`Xóa ${courseClass.courseCode} khỏi lịch`}>×</button>
            </div>
          ))}
        </div>
      )}

      <div className="week-grid" aria-label="Lịch học theo tuần">
        {[2, 3, 4, 5, 6, 7, 8].map((day) => {
          const classesForDay = selected.flatMap((courseClass) =>
            courseClass.meetings.filter((meeting) => meeting.day === day).map((meeting) => ({ courseClass, meeting }))
          );
          return (
            <div className="day-column" key={day}>
              <span>{DAY_LABELS[day]}</span>
              {classesForDay.length ? classesForDay.map(({ courseClass, meeting }, index) => (
                <div className="calendar-block" key={`${courseClass.id}-${meeting.start}-${index}`}>
                  <b>{courseClass.courseCode}</b>
                  <small>{meeting.start}–{meeting.end}</small>
                </div>
              )) : <small className="day-empty">—</small>}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

export function ClassFinder({ initialClasses }: { initialClasses: CourseClass[] }) {
  const [classes, setClasses] = useState<CourseClass[]>(initialClasses);
  const [selected, setSelected] = useState<CourseClass[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [query, setQuery] = useState("");
  const [resultFilter, setResultFilter] = useState("");
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [dayFilter, setDayFilter] = useState("all");
  const [sort, setSort] = useState("available");
  const [dtuUrl, setDtuUrl] = useState("");
  const [importState, setImportState] = useState({ loading: false, error: "" });
  const [enrichingIds, setEnrichingIds] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState("");
  const [health, setHealth] = useState<HealthState>({ loading: true, ok: null });
  const [lookup, setLookup] = useState<LookupState>({
    loading: false,
    error: "",
    hasSearched: false,
    semester: null,
    courseCount: 0
  });

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { version: 3; selected: CourseClass[] };
        if (parsed.version === 3 && Array.isArray(parsed.selected)) setSelected(parsed.selected);
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setStorageReady(true);
    }
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 3, selected }));
  }, [selected, storageReady]);

  async function checkHealth() {
    setHealth((current) => ({ ...current, loading: true }));
    try {
      const response = await fetch("/api/dtu/health", { cache: "no-store" });
      const payload = await response.json() as { ok?: boolean; latencyMs?: number; error?: string; semester?: SemesterInfo };
      setHealth({
        loading: false,
        ok: response.ok && payload.ok === true,
        latencyMs: payload.latencyMs,
        error: payload.error,
        semester: payload.semester
      });
    } catch {
      setHealth({ loading: false, ok: false, error: "Không thể gọi API kiểm tra nguồn DTU." });
    }
  }

  useEffect(() => {
    void checkHealth();
  }, []);

  const selectedIds = useMemo(() => new Set(selected.map((item) => item.id)), [selected]);
  const conflicts = useMemo(() => getConflictPairs(selected), [selected]);

  const filteredClasses = useMemo(() => {
    const normalizedFilter = normalize(resultFilter);
    const day = dayFilter === "all" ? null : Number(dayFilter);
    const result = classes.filter((courseClass) => {
      const haystack = normalize(`${courseClass.courseCode} ${courseClass.courseName} ${courseClass.lecturer} ${courseClass.registrationCode}`);
      return (
        (!normalizedFilter || haystack.includes(normalizedFilter)) &&
        (!onlyOpen || courseClass.available > 0) &&
        (day === null || courseClass.meetings.some((meeting) => meeting.day === day))
      );
    });
    return result.toSorted((a, b) => {
      if (sort === "available") return b.available - a.available;
      if (sort === "registration") return a.registrationCode.localeCompare(b.registrationCode);
      return a.courseCode.localeCompare(b.courseCode);
    });
  }, [classes, dayFilter, onlyOpen, resultFilter, sort]);

  function toggleClass(courseClass: CourseClass) {
    setSelected((current) => current.some((item) => item.id === courseClass.id)
      ? current.filter((item) => item.id !== courseClass.id)
      : [...current, courseClass]
    );
  }

  async function copyRegistrationCode(courseClass: CourseClass) {
    try {
      await navigator.clipboard.writeText(courseClass.registrationCode);
      setCopiedId(courseClass.id);
      window.setTimeout(() => setCopiedId(""), 1400);
    } catch {
      setCopiedId("");
    }
  }

  async function enrichClass(courseClass: CourseClass) {
    if (!courseClass.sourceUrl || enrichingIds.includes(courseClass.id)) return;
    setEnrichingIds((current) => [...current, courseClass.id]);
    try {
      const response = await fetch(`/api/dtu/class-detail?url=${encodeURIComponent(courseClass.sourceUrl)}`);
      const payload = await response.json() as { data?: CourseClass; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error || "Không lấy được chi tiết lớp.");
      const merged = { ...courseClass, ...payload.data, id: courseClass.id, sourceUrl: courseClass.sourceUrl };
      setClasses((current) => current.map((item) => item.id === courseClass.id ? merged : item));
      setSelected((current) => current.map((item) => item.id === courseClass.id ? merged : item));
    } catch (error) {
      setLookup((current) => ({ ...current, error: error instanceof Error ? error.message : "Không lấy được chi tiết lớp." }));
    } finally {
      setEnrichingIds((current) => current.filter((id) => id !== courseClass.id));
    }
  }

  async function searchLiveClasses(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    setLookup((current) => ({ ...current, loading: true, error: "" }));
    setResultFilter("");
    try {
      const response = await fetch(`/api/dtu/search?q=${encodeURIComponent(trimmed)}`);
      const payload = await response.json() as { data?: CourseClass[]; courses?: CourseHit[]; semester?: SemesterInfo; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error ?? "Không thể tra cứu dữ liệu DTU.");
      setClasses(payload.data);
      setLookup({
        loading: false,
        error: "",
        hasSearched: true,
        semester: payload.semester ?? null,
        courseCount: payload.courses?.length ?? 0
      });
    } catch (error) {
      setClasses([]);
      setLookup((current) => ({
        ...current,
        loading: false,
        hasSearched: true,
        error: error instanceof Error ? error.message : "Không thể tra cứu DTU."
      }));
    }
  }

  async function importDtuClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dtuUrl.trim()) return;
    setImportState({ loading: true, error: "" });
    try {
      const response = await fetch(`/api/dtu/class-detail?url=${encodeURIComponent(dtuUrl.trim())}`);
      const payload = await response.json() as { data?: CourseClass; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error ?? "Không thể nhập lớp từ DTU.");
      setClasses((current) => [payload.data!, ...current.filter((item) => item.id !== payload.data!.id)]);
      setDtuUrl("");
      setImportState({ loading: false, error: "" });
    } catch (error) {
      setImportState({ loading: false, error: error instanceof Error ? error.message : "Không thể nhập lớp." });
    }
  }

  const openCount = classes.filter((item) => item.available > 0).length;

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="DTU Class Finder - về đầu trang">
          <span className="brand-mark">D</span>
          <span><b>DTU Class Finder</b><small>Tra cứu tín chỉ nhanh hơn</small></span>
        </a>
        <div className="header-actions">
          <SourceHealth health={health} onRetry={() => void checkHealth()} />
          <a className="official-link" href="https://courses.duytan.edu.vn/Sites/Home_ChuongTrinhDaoTao.aspx?p=home_coursesearch" target="_blank" rel="noreferrer">
            Trang tra cứu DTU <ExternalIcon />
          </a>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <span className="hero-badge">Dữ liệu công khai DTU · Không cần MyDTU</span>
          <h1>Tìm lớp còn chỗ.<br /><span>Ghép lịch không bị trùng.</span></h1>
          <p>Nhập mã môn như <b>CS 211</b> hoặc <b>CMU-CS 246</b>. Web tự tìm học kỳ hiện tại và tải danh sách lớp từ nguồn công khai của DTU.</p>
          <form className="search-box" onSubmit={searchLiveClasses}>
            <SearchIcon />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nhập mã môn, ví dụ CS 211" aria-label="Mã môn cần tra cứu" autoComplete="off" />
            <button className="search-submit" type="submit" disabled={lookup.loading || !query.trim()}>{lookup.loading ? "Đang tìm..." : "Tra cứu"}</button>
          </form>
          {lookup.error ? <p className="lookup-error" role="alert">{lookup.error}</p> : null}
          <div className="trust-row">
            <span>✓ Không lưu mật khẩu MyDTU</span>
            <span>✓ Đọc số chỗ công khai</span>
            <span>✓ Kiểm tra trùng lịch</span>
          </div>
        </div>

        <div className="hero-stat-card">
          <span>Kết quả hiện tại</span>
          <strong>{filteredClasses.length}</strong>
          <b>lớp phù hợp</b>
          <div className="mini-stat-row">
            <div><span>Còn chỗ</span><strong>{openCount}</strong></div>
            <div><span>Đã chọn</span><strong>{selected.length}</strong></div>
          </div>
          <p>{lookup.semester ? `${lookup.semester.semesterLabel} · ${lookup.semester.yearLabel}` : health.semester ? `${health.semester.semesterLabel} · ${health.semester.yearLabel}` : "Tra cứu một mã môn để bắt đầu."}</p>
        </div>
      </section>

      <section className="quick-summary" aria-label="Tổng quan lịch dự kiến">
        <div><span>Lớp đã chọn</span><strong>{selected.length}</strong></div>
        <div><span>Môn khác nhau</span><strong>{new Set(selected.map((item) => item.courseCode)).size}</strong></div>
        <div><span>Xung đột lịch</span><strong className={conflicts.length ? "danger-text" : "success-text"}>{conflicts.length}</strong></div>
        <div><span>Nguồn dữ liệu</span><strong>{health.ok ? "DTU online" : health.loading ? "Đang kiểm tra" : "Cần kiểm tra"}</strong></div>
      </section>

      <section className="live-import-section" aria-labelledby="live-import-title">
        <div>
          <span className="section-kicker">Công cụ đối chiếu</span>
          <h2 id="live-import-title">Nạp trực tiếp một URL chi tiết lớp</h2>
          <p>Dùng khi bạn đã có link <b>home_listclassdetail</b> từ courses.duytan.edu.vn. Server chỉ chấp nhận đúng tên miền DTU.</p>
        </div>
        <form className="import-form" onSubmit={importDtuClass}>
          <input type="url" value={dtuUrl} onChange={(event) => setDtuUrl(event.target.value)} placeholder="https://courses.duytan.edu.vn/...classid=..." aria-label="Link chi tiết lớp DTU" />
          <button type="submit" disabled={importState.loading}>{importState.loading ? "Đang đọc..." : "Nạp lớp"}</button>
          {importState.error ? <p className="form-error" role="alert">{importState.error}</p> : null}
        </form>
      </section>

      <section className="workspace">
        <div className="results-column">
          <div className="toolbar">
            <div className="toolbar-title"><span className="section-kicker">Kết quả DTU</span><h2>{filteredClasses.length} lớp học phần</h2></div>
            <div className="filters">
              <label className="switch-filter"><input type="checkbox" checked={onlyOpen} onChange={(event) => setOnlyOpen(event.target.checked)} /><span />Chỉ lớp còn chỗ</label>
              <label><span className="sr-only">Lọc theo ngày</span><select value={dayFilter} onChange={(event) => setDayFilter(event.target.value)}><option value="all">Tất cả các ngày</option>{[2, 3, 4, 5, 6, 7, 8].map((day) => <option value={day} key={day}>{DAY_LABELS[day]}</option>)}</select></label>
              <label><span className="sr-only">Sắp xếp</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="available">Còn chỗ nhiều nhất</option><option value="registration">Theo mã đăng ký</option><option value="course">Theo mã môn</option></select></label>
            </div>
          </div>

          {lookup.hasSearched && !lookup.error ? <div className="live-status"><strong>Dữ liệu trực tiếp:</strong> tìm thấy {classes.length} lớp từ {lookup.courseCount || 1} môn khớp{lookup.semester ? ` · ${lookup.semester.semesterLabel} · ${lookup.semester.yearLabel}` : ""}. Số chỗ có thể thay đổi, hãy kiểm tra lại trước khi đăng ký.</div> : null}

          {classes.length > 0 ? <div className="result-filter-row"><input value={resultFilter} onChange={(event) => setResultFilter(event.target.value)} placeholder="Lọc theo giảng viên, mã đăng ký, tên môn..." aria-label="Lọc trong kết quả" /></div> : null}

          <div className="course-list">
            {filteredClasses.length ? filteredClasses.map((courseClass) => (
              <CourseCard
                key={courseClass.id}
                courseClass={courseClass}
                selected={selectedIds.has(courseClass.id)}
                enriching={enrichingIds.includes(courseClass.id)}
                copied={copiedId === courseClass.id}
                onToggle={toggleClass}
                onEnrich={(item) => void enrichClass(item)}
                onCopy={(item) => void copyRegistrationCode(item)}
              />
            )) : (
              <div className="empty-results"><SearchIcon /><h3>{lookup.loading ? "Đang đọc dữ liệu DTU..." : lookup.hasSearched ? "Không có lớp phù hợp" : "Nhập mã môn để bắt đầu"}</h3><p>{lookup.hasSearched ? "Thử tắt bộ lọc “chỉ lớp còn chỗ” hoặc tra cứu mã môn khác." : "Ví dụ: CS 211, MTH 103 hoặc CMU-CS 246."}</p></div>
            )}
          </div>
        </div>

        <SchedulePanel selected={selected} onRemove={(id) => setSelected((current) => current.filter((item) => item.id !== id))} onClear={() => setSelected([])} />
      </section>

      <footer>
        <div><strong>DTU Class Finder</strong><p>Dự án cộng đồng, không phải website chính thức của Đại học Duy Tân. Dữ liệu được đọc từ nguồn công khai và có thể thay đổi; luôn kiểm tra lại trên hệ thống chính thức trước khi đăng ký.</p></div>
        <a href="https://mydtu.duytan.edu.vn/sites/index.aspx?p=home_semester&functionid=35" target="_blank" rel="noreferrer">Mở MyDTU để đăng ký <ExternalIcon /></a>
      </footer>
    </main>
  );
}
