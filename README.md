# DTU Class Finder

Web cộng đồng hỗ trợ sinh viên Duy Tân tra cứu lớp học phần còn chỗ, xem lịch/phòng/giảng viên và kiểm tra trùng lịch trước khi đăng ký tín chỉ.

> Đây **không phải website chính thức của Đại học Duy Tân**. Dữ liệu được đọc từ các trang tra cứu công khai của DTU và có thể thay đổi. Luôn kiểm tra lại trên hệ thống chính thức trước khi đăng ký.

## Tính năng hiện có

- Nhập mã môn như `CS 211` hoặc `CMU-CS 246` để tra cứu dữ liệu thật.
- Tự xác định năm học và học kỳ từ nguồn công khai DTU.
- Tự tìm `courseid` của môn, không cần người dùng biết ID nội bộ.
- Tải toàn bộ lớp học phần của môn trong học kỳ đang tra cứu.
- Hiển thị mã đăng ký, loại lớp, số chỗ còn lại, lịch học, phòng/cơ sở, giảng viên và trạng thái đăng ký.
- Lọc chỉ lớp còn chỗ, lọc theo thứ và lọc tiếp theo giảng viên/mã đăng ký.
- Chọn nhiều lớp để dựng lịch dự kiến và tự động cảnh báo trùng giờ.
- Lưu các lớp đã chọn trong `localStorage` để không mất lịch khi tải lại trang.
- Có công cụ nhập trực tiếp URL chi tiết một lớp DTU để đối chiếu.
- Responsive/mobile-first.

## Luồng dữ liệu công khai DTU

Ứng dụng không đăng nhập MyDTU và không yêu cầu mật khẩu sinh viên.

```text
LoadNamHoc.aspx
  ↓
LoadHocKy.aspx
  ↓
CourseResultSearch.aspx
  ↓
Mã môn → courseid
  ↓
CourseClassResult.aspx
  ↓
Danh sách lớp + chỗ trống + lịch + phòng + giảng viên
```

### API tra cứu theo mã môn

```text
GET /api/dtu/search?q=CS%20211
```

Response gồm:

- `data`: danh sách lớp học phần.
- `courses`: các môn/courseid khớp truy vấn.
- `semester`: học kỳ và năm học được DTU trả về.

Ứng dụng giới hạn truy vấn theo mã môn và không cho phép người dùng dùng wildcard `*` để tránh vô tình tải toàn bộ danh mục môn từ máy chủ DTU.

### API đọc một trang chi tiết lớp

```text
GET /api/dtu/class-detail?url=<URL chi tiết lớp trên courses.duytan.edu.vn>
```

Route chỉ chấp nhận HTTPS + hostname `courses.duytan.edu.vn` + trang `p=home_listclassdetail` có `classid`, nhằm tránh biến endpoint thành proxy tùy ý.

## Công nghệ

- Next.js 16 App Router
- React 19
- TypeScript
- CSS thuần

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
    api/dtu/
      search/route.ts          # tra mã môn → danh sách lớp thật
      class-detail/route.ts    # đọc một URL chi tiết lớp
    globals.css
    live-search.css
    layout.tsx
    page.tsx
  components/
    class-finder.tsx           # tìm kiếm + lọc + lịch dự kiến
  lib/
    dtu.ts                     # DTU provider + HTML parser + allowlist
    types.ts
```

## Nguyên tắc an toàn và vận hành

- Không yêu cầu hoặc lưu mật khẩu MyDTU.
- Không tự động đăng ký/hủy tín chỉ thay sinh viên.
- Chỉ dùng dữ liệu công khai để hỗ trợ tìm kiếm và so sánh.
- Cache các endpoint ít thay đổi như năm học/danh mục môn.
- Cache danh sách lớp trong thời gian ngắn vì số chỗ có thể thay đổi nhanh.
- Giới hạn số môn khớp được tải trong một truy vấn để giảm tải cho DTU.
- Luôn dẫn người dùng về MyDTU để thực hiện đăng ký chính thức.
