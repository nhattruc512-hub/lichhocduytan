import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DTU Class Finder | Tra cứu lớp học phần",
  description: "Công cụ hỗ trợ tìm lớp học phần, xem chỗ trống và kiểm tra trùng lịch cho sinh viên Duy Tân.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
