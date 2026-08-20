# DTU Class Finder

MVP hỗ trợ sinh viên Duy Tân tra cứu lớp học phần, xem số chỗ còn trống và kiểm tra trùng lịch trước khi đăng ký tín chỉ.

> Đây là dự án cộng đồng, **không phải website chính thức của Đại học Duy Tân**. Luôn kiểm tra lại dữ liệu trên hệ thống chính thức trước khi đăng ký.

## Tính năng hiện có

- Tìm theo mã môn, tên môn, giảng viên hoặc mã đăng ký.
- Lọc chỉ lớp còn chỗ và lọc theo thứ.
- Sắp xếp theo số chỗ còn lại.
- Chọn nhiều lớp để dựng lịch dự kiến.
- Tự động cảnh báo các lớp bị trùng giờ.
- Lưu danh sách lớp đã chọn trong `localStorage`.
- Responsive/mobile-first.
- API nhập **một trang chi tiết lớp công khai** từ `courses.duytan.edu.vn` và đọc mã lớp, lịch, phòng, giảng viên, sĩ số, số chỗ còn trống.
- API nhập URL có allowlist hostname để tránh biến endpoint thành SSRF proxy.

## Trạng thái dữ liệu

Danh sách mặc định trong giao diện là **dữ liệu minh hoạ** để hoàn thiện UX. Không sử dụng các con số demo để đăng ký thật.

Tính năng **Nạp một lớp trực tiếp từ DTU** gọi route:

```text
GET /api/dtu/class-detail?url=<URL chi tiết lớp trên courses.duytan.edu.vn>
```

Route chỉ chấp nhận HTTPS + hostname `courses.duytan.edu.vn` + trang `p=home_listclassdetail` có `classid`.

Bước tiếp theo là bổ sung collector cho trang danh sách/tìm kiếm lớp công khai để người dùng chỉ cần nhập `CS 211` và nhận toàn bộ lớp thật của học kỳ hiện tại.

## Công nghệ

- Next.js 16 App Router
- React 19
- TypeScript
- CSS thuần, không phụ thuộc UI framework

## Chạy local

```bash
npm install
npm run dev
```

Mở `http://localhost:3000`.

Kiểm tra production build:

```bash
npm run build
```

## Cấu trúc chính

```text
src/
  app/
    api/dtu/class-detail/route.ts   # proxy + parser nguồn công khai DTU
    globals.css
    layout.tsx
    page.tsx
  components/
    class-finder.tsx                # UI tìm kiếm + lọc + lịch dự kiến
  lib/
    dtu.ts                          # allowlist URL + HTML parser
    mock-classes.ts                 # dữ liệu demo
    types.ts
```

## Nguyên tắc an toàn

- Không yêu cầu hoặc lưu mật khẩu MyDTU.
- Không tự động đăng ký tín chỉ thay sinh viên.
- Dùng dữ liệu công khai để hỗ trợ tìm kiếm/so sánh.
- Cache dữ liệu nguồn ở server để hạn chế request không cần thiết.
- Luôn dẫn người dùng về MyDTU để thực hiện đăng ký chính thức.
