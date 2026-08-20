"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { CourseClass, Meeting } from "@/lib/types";

const STORAGE_KEY = "dtu-class-finder:selected:v1";
const DAY_LABELS: Record<number, string> = {
  2: "Thứ 2",
  3: "Thứ 3",
  4: "Thứ 4",
  5: "Thứ 5",
  6: "Thứ 6",
  7: "Thứ 7",
  8: "CN"
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
  return a.day === b.day && toMinutes(a.start) < toMinutes(b.end) && toMinutes(b.start) < toMinutes(a.end);
}

function classesConflict(a: CourseClass, b: CourseClass) {
  return a.meetings.some((meetingA) => b.meetings.some((meetingB) => meetingsOverlap(meetingA, meetingB)));
}

function getConflictPairs(classes: CourseClass[]) {
  const pairs: Array<[CourseClass, CourseClass]> = [];
  for (let i = 0; i < classes.length; i += 1) {
    for (let j = i + 1; j < classes.length; j += 1) {
      if (classesConflict(classes[i], classes[j])) {
        pairs.push([classes[i], classes[j]]);
      }
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

function Availability({ courseClass }: { courseClass: CourseClass }) {
  const isOpen = courseClass.available > 0;
  return (
    <div className={`availability ${isOpen ? "is-open" : "is-full"}`}>
      <span className="availability-dot" />
      <strong>{isOpen ? `${courseClass.available} chỗ trống` : "Đã đủ chỗ"}</strong>
      <span>{courseClass.registered}/{courseClass.capacity}</span>
    </div>
  );
}

function CourseCard({
  courseClass,
  selected,
  onToggle
}: {
  courseClass: CourseClass;
  selected: boolean;
  onToggle: (courseClass: CourseClass) => void;
}) {
  return (
    <article className="course-card">
      <div className="course-card-top">
        <div>
          <div className="eyebrow-row">
            <span className="course-code">{courseClass.courseCode}</span>
            <span className="type-pill">{courseClass.classType}</span>
            {courseClass.source === "dtu" ? <span className="live-pill">DTU live</span> : <span className="demo-pill">Demo</span>}
          </div>
          <h3>{courseClass.courseName}</h3>
          <p className="registration-code">Mã đăng ký: <b>{courseClass.registrationCode}</b></p>
        </div>
        <Availability courseClass={courseClass} />
      </div>

      <div className="course-meta-grid">
        <div>
          <span>Giảng viên</span>
          <strong>{courseClass.lecturer}</strong>
        </div>
        <div>
          <span>Số tín chỉ</span>
          <strong>{courseClass.credits || "—"}</strong>
        </div>
        <div>
          <span>Học kỳ</span>
          <strong>{courseClass.semester}</strong>
        </div>
        <div>
          <span>Thời gian môn</span>
          <strong>{courseClass.startDate} → {courseClass.endDate}</strong>
        </div>
      </div>

      <div className="meeting-list">
        {courseClass.meetings.length > 0 ? courseClass.meetings.map((meeting, index) => (
          <div className="meeting-chip" key={`${courseClass.id}-${meeting.day}-${meeting.start}-${index}`}>
            <CalendarIcon />
            <span>{meetingLabel(meeting)}</span>
            <b>{meeting.room}</b>
          </div>
        )) : <p className="muted">Chưa đọc được lịch học từ nguồn.</p>}
      </div>

      <div className="course-actions">
        <button className={`select-button ${selected ? "selected" : ""}`} onClick={() => onToggle(courseClass)} type="button">
          {selected ? "✓ Đã thêm vào lịch" : "+ Thêm vào lịch dự kiến"}
        </button>
        {courseClass.sourceUrl ? (
          <a className="text-link" href={courseClass.sourceUrl} target="_blank" rel="noreferrer">
            Xem nguồn DTU <ExternalIcon />
          </a>
        ) : null}
      </div>
    </article>
  );
}

function SchedulePanel({ selected, onRemove }: { selected: CourseClass[]; onRemove: (id: string) => void }) {
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

      {conflicts.length > 0 ? (
        <div className="conflict-box" role="alert">
          <strong>Phát hiện lịch bị trùng</strong>
          {conflicts.map(([a, b]) => (
            <p key={`${a.id}-${b.id}`}>{a.courseCode} ↔ {b.courseCode}</p>
          ))}
        </div>
      ) : null}

      {selected.length === 0 ? (
        <div className="empty-schedule">
          <CalendarIcon />
          <strong>Chưa có lớp nào</strong>
          <p>Thêm lớp từ kết quả tra cứu để kiểm tra trùng lịch tự động.</p>
        </div>
      ) : (
        <div className="selected-list">
          {selected.map((courseClass) => (
            <div className="selected-item" key={courseClass.id}>
              <div>
                <strong>{courseClass.courseCode} · {courseClass.classType}</strong>
                <span>{courseClass.meetings.map(meetingLabel).join(" / ") || "Chưa rõ lịch"}</span>
              </div>
              <button type="button" onClick={() => onRemove(courseClass.id)} aria-label={`Xóa ${courseClass.courseCode} khỏi lịch`}>×</button>
            </div>
          ))}
        </div>
      )}

      <div className="week-grid" aria-label="Lịch học theo tuần">
        {[2, 3, 4, 5, 6, 7].map((day) => {
          const classesForDay = selected.flatMap((courseClass) =>
            courseClass.meetings.filter((meeting) => meeting.day === day).map((meeting) => ({ courseClass, meeting }))
          );

          return (
            <div className="day-column" key={day}>
              <span>{DAY_LABELS[day]}</span>
              {classesForDay.length ? classesForDay.map(({ courseClass, meeting }) => (
                <div className="calendar-block" key={`${courseClass.id}-${meeting.start}`}>
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
  const [classes, setClasses] = useState(initialClasses);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [query, setQuery] = useState("");
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [dayFilter, setDayFilter] = useState("all");
  const [sort, setSort] = useState("available");
  const [dtuUrl, setDtuUrl] = useState("");
  const [importState, setImportState] = useState<{ loading: boolean; error: string }>({ loading: false, error: "" });

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { version: 1; selectedIds: string[] };
        if (parsed.version === 1 && Array.isArray(parsed.selectedIds)) {
          setSelectedIds(parsed.selectedIds);
        }
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setStorageReady(true);
    }
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, selectedIds }));
  }, [selectedIds, storageReady]);

  const selected = useMemo(
    () => classes.filter((courseClass) => selectedIds.includes(courseClass.id)),
    [classes, selectedIds]
  );

  const filteredClasses = useMemo(() => {
    const normalizedQuery = normalize(query);
    const day = dayFilter === "all" ? null : Number(dayFilter);
    const result = classes.filter((courseClass) => {
      const haystack = normalize(`${courseClass.courseCode} ${courseClass.courseName} ${courseClass.lecturer} ${courseClass.registrationCode}`);
      const matchesQuery = !normalizedQuery || haystack.includes(normalizedQuery);
      const matchesOpen = !onlyOpen || courseClass.available > 0;
      const matchesDay = day === null || courseClass.meetings.some((meeting) => meeting.day === day);
      return matchesQuery && matchesOpen && matchesDay;
    });

    return result.toSorted((a, b) => {
      if (sort === "available") return b.available - a.available;
      if (sort === "course") return a.courseCode.localeCompare(b.courseCode);
      return a.registered / Math.max(a.capacity, 1) - b.registered / Math.max(b.capacity, 1);
    });
  }, [classes, dayFilter, onlyOpen, query, sort]);

  function toggleClass(courseClass: CourseClass) {
    setSelectedIds((current) => current.includes(courseClass.id)
      ? current.filter((id) => id !== courseClass.id)
      : [...current, courseClass.id]
    );
  }

  async function importDtuClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dtuUrl.trim()) return;

    setImportState({ loading: true, error: "" });
    try {
      const response = await fetch(`/api/dtu/class-detail?url=${encodeURIComponent(dtuUrl.trim())}`);
      const payload = await response.json() as { data?: CourseClass; error?: string };
      if (!response.ok || !payload.data) {
        throw new Error(payload.error ?? "Không thể nhập lớp từ DTU.");
      }

      setClasses((current) => {
        const withoutOld = current.filter((item) => item.id !== payload.data?.id);
        return payload.data ? [payload.data, ...withoutOld] : current;
      });
      setDtuUrl("");
      setQuery(payload.data.courseCode);
    } catch (error) {
      setImportState({ loading: false, error: error instanceof Error ? error.message : "Không thể nhập lớp." });
      return;
    }
    setImportState({ loading: false, error: "" });
  }

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="DTU Class Finder - về đầu trang">
          <span className="brand-mark">D</span>
          <span><b>DTU Class Finder</b><small>Tra cứu tín chỉ nhanh hơn</small></span>
        </a>
        <a className="official-link" href="https://courses.duytan.edu.vn/Sites/Home_ChuongTrinhDaoTao.aspx?p=home_coursesearch" target="_blank" rel="noreferrer">
          Trang tra cứu DTU <ExternalIcon />
        </a>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <span className="hero-badge">MVP · Không cần tài khoản MyDTU</span>
          <h1>Tìm lớp còn chỗ.<br /><span>Ghép lịch không bị trùng.</span></h1>
          <p>Tìm theo mã môn, tên môn hoặc giảng viên. Chọn các lớp bạn muốn và hệ thống sẽ kiểm tra xung đột thời gian ngay lập tức.</p>
          <div className="search-box">
            <SearchIcon />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ví dụ: CS 211, Cơ sở dữ liệu, tên giảng viên..."
              aria-label="Tìm lớp học phần"
            />
            {query ? <button type="button" onClick={() => setQuery("")} aria-label="Xóa nội dung tìm kiếm">×</button> : null}
          </div>
          <div className="trust-row">
            <span>✓ Không lưu mật khẩu MyDTU</span>
            <span>✓ Kiểm tra trùng lịch</span>
            <span>✓ Mobile-first</span>
          </div>
        </div>
        <div className="hero-stat-card">
          <span>Đang hiển thị</span>
          <strong>{filteredClasses.length}</strong>
          <b>lớp phù hợp</b>
          <div className="mini-stat-row">
            <div><span>Còn chỗ</span><strong>{classes.filter((item) => item.available > 0).length}</strong></div>
            <div><span>Đã chọn</span><strong>{selected.length}</strong></div>
          </div>
          <p>Dữ liệu gắn nhãn <b>Demo</b> chỉ để thử giao diện. Lớp nhập từ link công khai DTU được gắn <b>DTU live</b>.</p>
        </div>
      </section>

      <section className="live-import-section" aria-labelledby="live-import-title">
        <div>
          <span className="section-kicker">Kết nối nguồn công khai</span>
          <h2 id="live-import-title">Nạp một lớp trực tiếp từ DTU</h2>
          <p>Dán URL trang “Chi tiết Lớp theo Môn học” trên <b>courses.duytan.edu.vn</b>. Server chỉ chấp nhận đúng tên miền này.</p>
        </div>
        <form className="import-form" onSubmit={importDtuClass}>
          <input
            type="url"
            value={dtuUrl}
            onChange={(event) => setDtuUrl(event.target.value)}
            placeholder="https://courses.duytan.edu.vn/...classid=..."
            aria-label="Link chi tiết lớp DTU"
          />
          <button type="submit" disabled={importState.loading}>{importState.loading ? "Đang đọc..." : "Nạp lớp"}</button>
          {importState.error ? <p className="form-error" role="alert">{importState.error}</p> : null}
        </form>
      </section>

      <section className="workspace">
        <div className="results-column">
          <div className="toolbar">
            <div className="toolbar-title">
              <span className="section-kicker">Kết quả</span>
              <h2>{filteredClasses.length} lớp học phần</h2>
            </div>
            <div className="filters">
              <label className="switch-filter">
                <input type="checkbox" checked={onlyOpen} onChange={(event) => setOnlyOpen(event.target.checked)} />
                <span />
                Chỉ lớp còn chỗ
              </label>
              <label>
                <span className="sr-only">Lọc theo ngày</span>
                <select value={dayFilter} onChange={(event) => setDayFilter(event.target.value)}>
                  <option value="all">Tất cả các ngày</option>
                  {[2, 3, 4, 5, 6, 7].map((day) => <option value={day} key={day}>{DAY_LABELS[day]}</option>)}
                </select>
              </label>
              <label>
                <span className="sr-only">Sắp xếp</span>
                <select value={sort} onChange={(event) => setSort(event.target.value)}>
                  <option value="available">Còn chỗ nhiều nhất</option>
                  <option value="fill">Ít đầy nhất</option>
                  <option value="course">Theo mã môn</option>
                </select>
              </label>
            </div>
          </div>

          <div className="demo-warning">
            <strong>Bản MVP:</strong> tìm kiếm danh sách hiện dùng dữ liệu minh hoạ. Tính năng nhập URL chi tiết lớp DTU phía trên đã được tách thành API để kết nối dữ liệu công khai thật mà không cần MyDTU.
          </div>

          <div className="course-list">
            {filteredClasses.length ? filteredClasses.map((courseClass) => (
              <CourseCard
                key={courseClass.id}
                courseClass={courseClass}
                selected={selectedIds.includes(courseClass.id)}
                onToggle={toggleClass}
              />
            )) : (
              <div className="empty-results">
                <SearchIcon />
                <h3>Không tìm thấy lớp phù hợp</h3>
                <p>Thử bỏ bớt bộ lọc hoặc tìm bằng mã môn khác.</p>
              </div>
            )}
          </div>
        </div>

        <SchedulePanel selected={selected} onRemove={(id) => setSelectedIds((current) => current.filter((item) => item !== id))} />
      </section>

      <footer>
        <div>
          <strong>DTU Class Finder</strong>
          <p>Dự án cộng đồng, không phải website chính thức của Đại học Duy Tân. Luôn kiểm tra lại thông tin trên hệ thống chính thức trước khi đăng ký.</p>
        </div>
        <a href="https://mydtu.duytan.edu.vn/sites/index.aspx?p=home_semester&functionid=35" target="_blank" rel="noreferrer">Mở MyDTU để đăng ký <ExternalIcon /></a>
      </footer>
    </main>
  );
}
