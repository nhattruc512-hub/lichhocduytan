import type { CourseClass } from "@/lib/types";

export const demoClasses: CourseClass[] = [
  {
    id: "demo-cs211-01",
    courseCode: "CS 211",
    courseName: "Lập Trình Cơ Sở",
    classType: "LEC",
    registrationCode: "CS211-DEMO-01",
    semester: "Học kỳ I 2026-2027 (demo)",
    credits: 3,
    lecturer: "Giảng viên A",
    capacity: 50,
    registered: 43,
    available: 7,
    registrationStatus: "Dữ liệu minh hoạ",
    startDate: "24/08/2026",
    endDate: "13/12/2026",
    meetings: [
      { day: 2, start: "07:00", end: "09:00", room: "P.301" },
      { day: 5, start: "07:00", end: "09:00", room: "P.301" }
    ],
    source: "demo"
  },
  {
    id: "demo-cs211-02",
    courseCode: "CS 211",
    courseName: "Lập Trình Cơ Sở",
    classType: "LAB",
    registrationCode: "CS211-DEMO-02",
    semester: "Học kỳ I 2026-2027 (demo)",
    credits: 1,
    lecturer: "Giảng viên B",
    capacity: 40,
    registered: 40,
    available: 0,
    registrationStatus: "Dữ liệu minh hoạ",
    startDate: "24/08/2026",
    endDate: "13/12/2026",
    meetings: [
      { day: 3, start: "09:15", end: "11:15", room: "Lab 128" },
      { day: 6, start: "09:15", end: "11:15", room: "Lab 128" }
    ],
    source: "demo"
  },
  {
    id: "demo-cs311-01",
    courseCode: "CS 311",
    courseName: "Lập Trình Hướng Đối Tượng",
    classType: "LEC",
    registrationCode: "CS311-DEMO-01",
    semester: "Học kỳ I 2026-2027 (demo)",
    credits: 3,
    lecturer: "Giảng viên C",
    capacity: 48,
    registered: 44,
    available: 4,
    registrationStatus: "Dữ liệu minh hoạ",
    startDate: "24/08/2026",
    endDate: "13/12/2026",
    meetings: [
      { day: 4, start: "15:15", end: "17:15", room: "P.609" },
      { day: 7, start: "15:15", end: "17:15", room: "P.609" }
    ],
    source: "demo"
  },
  {
    id: "demo-mth103-01",
    courseCode: "MTH 103",
    courseName: "Toán Cao Cấp A1",
    classType: "LEC",
    registrationCode: "MTH103-DEMO-01",
    semester: "Học kỳ I 2026-2027 (demo)",
    credits: 3,
    lecturer: "Giảng viên D",
    capacity: 60,
    registered: 42,
    available: 18,
    registrationStatus: "Dữ liệu minh hoạ",
    startDate: "24/08/2026",
    endDate: "13/12/2026",
    meetings: [
      { day: 2, start: "09:15", end: "11:15", room: "P.408" },
      { day: 4, start: "09:15", end: "11:15", room: "P.408" }
    ],
    source: "demo"
  },
  {
    id: "demo-eng201-01",
    courseCode: "ENG 201",
    courseName: "Anh Ngữ Trung Cấp 1",
    classType: "LEC",
    registrationCode: "ENG201-DEMO-01",
    semester: "Học kỳ I 2026-2027 (demo)",
    credits: 2,
    lecturer: "Giảng viên E",
    capacity: 45,
    registered: 32,
    available: 13,
    registrationStatus: "Dữ liệu minh hoạ",
    startDate: "24/08/2026",
    endDate: "13/12/2026",
    meetings: [
      { day: 3, start: "13:00", end: "15:00", room: "P.502" },
      { day: 6, start: "13:00", end: "15:00", room: "P.502" }
    ],
    source: "demo"
  },
  {
    id: "demo-is301-01",
    courseCode: "IS 301",
    courseName: "Cơ Sở Dữ Liệu",
    classType: "LEC",
    registrationCode: "IS301-DEMO-01",
    semester: "Học kỳ I 2026-2027 (demo)",
    credits: 3,
    lecturer: "Giảng viên F",
    capacity: 55,
    registered: 53,
    available: 2,
    registrationStatus: "Dữ liệu minh hoạ",
    startDate: "24/08/2026",
    endDate: "13/12/2026",
    meetings: [
      { day: 2, start: "08:00", end: "10:00", room: "P.404" },
      { day: 5, start: "08:00", end: "10:00", room: "P.404" }
    ],
    source: "demo"
  }
];
