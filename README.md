# INO Robot Studio

Phần mềm lập trình và mô phỏng robot ảo cho giáo dục STEM.

- Phân tích hệ thống: [`PTTK-01-PHAN-TICH.md`](PTTK-01-PHAN-TICH.md)
- Thiết kế kỹ thuật: [`PTTK-02-THIET-KE-KY-THUAT.md`](PTTK-02-THIET-KE-KY-THUAT.md)
- Hồ sơ công nghệ, bản quyền: [`de-xuat/`](de-xuat/)

## Yêu cầu

| Phần mềm | Phiên bản |
|---|---|
| Node.js | 22 trở lên |
| pnpm | 12 trở lên (`npm i -g pnpm`) |
| Docker Desktop | để chạy PostgreSQL |

## Chạy lần đầu

```bash
pnpm install

# tạo file cấu hình
cp apps/api/.env.example apps/api/.env

# bật PostgreSQL (cổng 5433 để không đụng Postgres cài sẵn trên máy)
pnpm db:up

# tạo bảng trong database
pnpm db:migrate

# tạo tài khoản demo + bài mẫu
pnpm db:seed
```

## Chạy hằng ngày

```bash
pnpm db:up    # nếu Docker chưa chạy
pnpm dev      # chạy cả frontend và backend
```

| Địa chỉ | Nội dung |
|---|---|
| http://localhost:5173 | Giao diện web |
| http://localhost:3001 | API |
| http://localhost:3001/api/v1/health | Kiểm tra API còn sống |

**Tài khoản demo:** `demo@ino.vn` / `demo1234`

## Lệnh hay dùng

```bash
pnpm test         # chạy toàn bộ unit test
pnpm typecheck    # kiểm tra lỗi TypeScript toàn dự án
pnpm db:studio    # mở giao diện xem database
pnpm db:down      # tắt PostgreSQL
```

## Cấu trúc

```
apps/
  api/        Fastify + Prisma + PostgreSQL
  web/        React + Vite + Tailwind
packages/
  shared/     type và schema dùng chung cho cả hai
config/
  robots/     cấu hình mẫu robot   (thêm robot = thêm file JSON)
  scenarios/  cấu hình kịch bản    (thêm sa bàn = thêm file JSON)
```

### Quy tắc bắt buộc

1. **Code React chỉ dùng API của trình duyệt.** Không `import fs`, không `import path`.
   Đây là điều kiện để sau này bọc Electron ra bản cài đặt mà không phải viết lại.
2. **Schema kiểm tra dữ liệu khai ở `packages/shared`**, frontend và backend dùng chung
   một định nghĩa để không bao giờ lệch nhau.
3. **Không commit file `.env`.**

## Tiến độ

| Mốc | Nội dung | Trạng thái |
|---|---|---|
| M0 | Khung dự án, đăng nhập, CRUD bài làm | ✅ Xong |
| M1 | Blockly, 38 khối lệnh, tự động lưu, sinh mã C++ | ✅ Xong |
| M2 | Chạy chương trình từng bước, tô sáng khối | Chưa làm |
| M3 | Viewport 3D, robot di chuyển | Chưa làm |
| M4 | Cảm biến ảo, hai kịch bản | Chưa làm |
| M5 | Bài mẫu, hoàn thiện, triển khai | Chưa làm |

### Việc cố ý để lại

- **Chọn kịch bản khi tạo bài làm** — hiện mọi bài đều mặc định "Dò vạch kẻ" và
  không có chỗ nào đổi, nên thẻ bài làm nào cũng dùng chung một hình minh hoạ.
  Gộp vào **M4** cùng phần cảm biến và sa bàn.
- **Ảnh chụp thật trên thẻ bài làm** — trường `thumbnail` đã có trong database,
  chờ **M3** có mô phỏng rồi chụp màn hình workspace thay hình vẽ sẵn.
- **Màu phụ của thương hiệu** — cần hỏi INO đã có bộ màu chưa trước khi chọn.
