# DTU Class Finder

Web cộng đồng hỗ trợ sinh viên Duy Tân tra cứu lớp học phần còn chỗ, xem lịch/phòng/giảng viên và kiểm tra trùng lịch trước khi đăng ký tín chỉ.

> Đây **không phải website chính thức của Đại học Duy Tân**. Dữ liệu được đọc từ các trang tra cứu công khai của DTU và có thể thay đổi. Luôn kiểm tra lại trên hệ thống chính thức trước khi đăng ký.

## Tính năng

- Nhập mã môn như `CS 211` hoặc `CMU-CS 246` để tra cứu dữ liệu thật.
- Tự xác định năm học và học kỳ từ nguồn công khai DTU.
- Tự tìm `courseid` của môn, không cần người dùng biết ID nội bộ.
- Tải toàn bộ lớp học phần của môn trong học kỳ đang tra cứu.
- Hiển thị mã đăng ký, loại lớp, số chỗ còn lại, lịch học, phòng/cơ sở, giảng viên và trạng thái đăng ký.
- Lọc chỉ lớp còn chỗ, lọc theo thứ và lọc tiếp theo giảng viên/mã đăng ký/tên môn.
- Sắp xếp theo số chỗ còn lại hoặc mã đăng ký.
- Chọn nhiều lớp thuộc nhiều môn để dựng lịch dự kiến.
- Tự động cảnh báo các lớp bị trùng giờ.
- Giữ lịch đã chọn khi tra môn khác và lưu vào `localStorage`.
- Sao chép mã đăng ký bằng một nút.
- Nạp chi tiết một lớp theo yêu cầu để đọc thêm sĩ số từ trang chi tiết DTU.
- Xuất lịch dự kiến ra CSV.
- Hiển thị trạng thái kết nối nguồn DTU và học kỳ hiện tại.
- Có công cụ nhập trực tiếp URL chi tiết một lớp DTU để đối chiếu.
- Responsive/mobile-first, hỗ trợ lịch từ Thứ 2 đến Chủ nhật.

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

Ứng dụng giới hạn truy vấn theo mã môn và không cho người dùng dùng wildcard `*` để tránh vô tình tải toàn bộ danh mục môn từ máy chủ DTU.

### API đọc một trang chi tiết lớp

```text
GET /api/dtu/class-detail?url=<URL chi tiết lớp trên courses.duytan.edu.vn>
```

Route chỉ chấp nhận HTTPS + hostname `courses.duytan.edu.vn` + trang `p=home_listclassdetail` có `classid`, có timeout khi DTU phản hồi chậm và không hoạt động như proxy tùy ý.

### API kiểm tra nguồn dữ liệu

```text
GET /api/dtu/health
```

API trả trạng thái nguồn `courses.duytan.edu.vn`, học kỳ hiện tại, thời điểm kiểm tra và độ trễ. Giao diện dùng endpoint này để phân biệt lỗi nguồn DTU với trường hợp không tìm thấy lớp.

## Công nghệ

- Next.js 16 App Router
- React 19
- TypeScript
- CSS thuần
- GitHub Actions cho lint + production build

## Chạy local

```bash
npm install
npm run dev
```

Mở `http://localhost:3000`.

Kiểm tra chất lượng trước khi merge:

```bash
npm run lint
npm run build
```

GitHub Actions trong `.github/workflows/ci.yml` cũng tự chạy hai bước này khi có thay đổi trên branch.

## Cấu trúc chính

```text
src/
  app/
    api/dtu/
      search/route.ts          # tra mã môn → danh sách lớp thật
      class-detail/route.ts    # đọc một URL chi tiết lớp
      health/route.ts          # kiểm tra nguồn DTU + học kỳ
    globals.css
    live-search.css
    layout.tsx
    page.tsx
  components/
    class-finder.tsx           # tra cứu + lọc + lịch dự kiến + export
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
- Request đọc chi tiết lớp chỉ cho phép đúng hostname và đường dẫn DTU đã định.
- Có timeout cho request tới nguồn ngoài để tránh treo API.
- Thiết lập các security headers cơ bản trong `next.config.ts`.
- Luôn dẫn người dùng về MyDTU để thực hiện đăng ký chính thức.

## Trạng thái dự án

Bản hiện tại nằm trên branch `feat/mvp-class-finder`. Khi CI xanh và đã kiểm tra dữ liệu thật, branch có thể được merge vào `main` để trở thành bản chính thức của repo.
