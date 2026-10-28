# Báo cáo mốc M3 — Sa bàn 3D và robot chạy theo chương trình

*Ngày 28/10/2026 · Tiếp nối commit `2cd9f6d` (Hoàn thành M2)*

## Tóm tắt

M3 đã đạt tiêu chí của mốc: **robot ảo đi đúng theo chương trình học sinh viết**, hiển thị trên sa bàn 3D.

Ngoài phạm vi M3, đợt này còn:

- sửa một lỗi khiến cùng một chương trình chạy ở tốc độ Nhanh và tốc độ Vừa ra hai quỹ đạo khác nhau;
- thêm 4 khối lệnh theo quãng đường và góc ("đi thẳng 20 cm", "quay trái 90 độ");
- làm rõ các khối chuyển động liên tục, và nhắc học sinh khi dùng nhầm.

| Hạng mục | Kết quả |
|---|---|
| Sa bàn 3D (Three.js r186 + React Three Fiber 9 + drei 10) | ✅ |
| Mô hình robot INO Bot dựng bằng code, khoảng 3.400 tam giác | ✅ |
| Chuyển động vi sai, bước thời gian cố định, chạy như nhau ở mọi tốc độ | ✅ |
| Ảnh thu nhỏ thật trên thẻ bài làm | ✅ |
| Kiểm thử | 99 unit test đạt; đã chạy thử trên trình duyệt |

---

## 1. Những gì người dùng thấy

### Khung mô phỏng (cột phải màn hình soạn thảo)

- Sa bàn đặt trên mặt bàn có viền, kẻ ô 10 cm, có thước đo mỗi 50 cm dọc hai mép.
- Ô xuất phát có mũi tên chỉ hướng. Vòng đích có cờ và "thở" nhẹ khi đang chạy.
- Vật cản là khối bo góc, lấy từ file JSON của kịch bản.
- Robot có bánh quay đúng tốc độ, tạm dừng thì đứng yên. Dưới gầm có mũi tên chỉ hướng đầu robot, tự cong khi rẽ.
- **Vệt đường đi**: tự xoá khi chạy lại hoặc bấm Dừng, có nút bật/tắt.
- Ba góc nhìn, chuyển mượt: **Toàn cảnh**, **Bám theo robot**, **Nhìn từ trên**.
- Nút **Đẹp / Nhanh**. Mặc định tự hạ chất lượng khi máy yếu, lựa chọn tay được nhớ lại.
- Dải số liệu ở góc dưới: vị trí X, Z, góc, tốc độ hai bánh, thời gian mô phỏng.
- Máy không hỗ trợ WebGL thì hiện thông báo; chương trình và số liệu vẫn chạy.
- Phần 3D được tách thành file tải riêng (khoảng 284 KB sau khi nén gzip), chỉ tải khi mở khung mô phỏng.

### Ảnh thu nhỏ bài làm

Ảnh được chụp từ sa bàn lúc chương trình chạy xong hoặc khi bấm Dừng. Ảnh có kích thước 320×180, định dạng JPEG, khoảng 6–8 KB, và được lưu vào trường `thumbnail` đã có sẵn. Bài chưa chạy lần nào vẫn dùng hình vẽ sẵn.

### Khối lệnh Chuyển động (42 khối, trước là 38)

Ngăn kéo được sắp lại theo mức độ quen thuộc với học sinh:

| Nhóm | Khối | Ghi chú |
|---|---|---|
| Theo quãng đường / góc **(mới)** | đi thẳng … cm, đi lùi … cm, quay trái … độ, quay phải … độ | Robot tự tính thời gian từ tốc độ |
| Theo thời gian | đi thẳng / đi lùi / rẽ trái / rẽ phải … trong … giây | Không đổi |
| Liên tục | **bắt đầu** chạy thẳng / chạy lùi / rẽ trái / rẽ phải / chạy động cơ | Đổi chữ trên khối; `type` giữ nguyên nên bài đã lưu vẫn mở được |

**Nhắc lỗi dùng nhầm khối liên tục.** Khi một khối "bắt đầu …" cả lần chạy không được chạy giây nào, Bảng thông báo sẽ nhắc. Lỗi hay gặp là đặt khối đó ngay trước một lệnh chuyển động khác. Kiểu viết tránh vật cản hợp lệ (lặp mãi: bắt đầu chạy thẳng; nếu gần vật cản thì bắt đầu rẽ trái) **không** bị nhắc nhầm.

> Lý do giữ khối liên tục thay vì bỏ: bài dò line ở M4 cần robot đổi hướng ngay khi cảm biến thay đổi. Khối "… trong N giây" sẽ khiến robot mù trong N giây đó.

---

## 2. Thay đổi kỹ thuật cần biết

### 2.1 Một hệ toạ độ duy nhất cho cả dự án ⚠️ lệch PTTK-02 mục 7

`sim-core` nay dùng chung hệ trục với Three.js: Y hướng lên, sàn là mặt phẳng XZ, tâm sàn ở gốc toạ độ, bên trái robot là −Z.

```ts
// trước (PTTK-02 mục 7)          // nay
z += v * Math.sin(theta) * dt;     z -= v * Math.sin(theta) * dt;
```

Nhờ vậy `heading` dùng thẳng làm `rotation.y` của mô hình, không phải đổi dấu ở đâu. Phần cảm biến ở M4 tính trong Three.js cũng sẽ khớp luôn. **Cần cập nhật PTTK-02 mục 7 theo.**

Kéo theo đó:

- Toạ độ cảm biến trong `config/robots/ino-bot-v1.json` được sửa theo hệ "đầu robot là +X, bên trái là −Z". File cũ ngầm coi đầu robot là +Z, nên `lineL` thực ra nằm bên phải.
- `robotStart.rotation` của kịch bản được quy ước tính bằng **độ**, dương là quay trái.
- `config/scenarios/line-follow.json`: đích cũ ở (1,5; 1,5) nằm **ngoài** sàn 2×2 m. Tạm đặt lại xuất phát ở (−0,7; 0) và đích ở (0,7; 0). Khi vẽ vạch thật ở M4 thì đặt lại cho khớp.
- Quy ước được ghi trong `packages/shared/src/index.ts`.

### 2.2 Bước thời gian cố định theo thời gian thật (PTTK-02 mục 7)

Ở M2, mỗi khung hình chạy một số bước mô phỏng cố định. Hệ quả là màn hình 144 Hz chạy nhanh gấp khoảng 2,4 lần màn 60 Hz. Nay đã có bộ tích luỹ thời gian (accumulator), với `MAX_CATCH_UP = 5` bước mỗi khung hình (nhân theo tốc độ Nhanh). Khung hình dài quá 0,25 s chỉ được tính 0,25 s. Thời gian tạm dừng không bị tính vào mô phỏng.

### 2.3 Sửa lỗi: chạy nhanh và chạy chậm ra hai quỹ đạo khác nhau

**Triệu chứng.** Mỗi lệnh robot chậm mất một nhịp, vì kết quả trả về qua Promise, mà Promise chỉ báo xong sau khi khung hình đã chạy xong. Trong lúc chờ, mô phỏng vẫn chạy thêm 1 bước ở tốc độ Vừa và 4 bước ở tốc độ Nhanh với động cơ cũ. Lỗi này ảnh hưởng thẳng tới M4: một chương trình dò line có thể đúng ở tốc độ này mà trượt vạch ở tốc độ khác.

**Cách sửa:**

- `SimRobot.execute(command, args, done)` gọi `done` **đồng bộ**, ngay trong bước mô phỏng hết giờ.
- `ProgramRunner` chạy **xen kẽ**: chạy chương trình tới khi nó phải chờ, tiến một bước mô phỏng, rồi lặp lại.
- Một lệnh hết giờ giữa chừng bước mô phỏng thì dừng đúng thời điểm đó. Trước đây robot có thể quay lố tới 2,4° mỗi lần "quay 90 độ".

**Kiểm chứng.** Cùng một chương trình chạy ở tốc độ Chậm, Vừa, Nhanh, và ở màn 60 Hz hay 144 Hz, đều ra cùng vị trí cuối, khớp tới 9 chữ số thập phân. Bài đi hình vuông khép kín với sai số dưới 10⁻⁹ m.

### 2.4 Robot thật cần thêm hàm trong thư viện INO

4 khối mới sinh ra mã C++ gọi các hàm sau. Cũng như các hàm `ino.*` hiện có, thư viện điều khiển robot của INO phải cung cấp chúng:

```cpp
ino.driveForwardCm(speed, cm);
ino.driveBackwardCm(speed, cm);
ino.turnLeftDeg(speed, degrees);
ino.turnRightDeg(speed, degrees);
```

Nếu robot không có encoder hoặc gyro, các hàm này chỉ ước lượng theo thời gian, nên trên robot thật sẽ lệch vài cm hoặc vài độ. Cần hỏi INO cấu hình phần cứng của robot.

### 2.5 Môi trường phát triển

- **Postgres đổi sang cổng 5434** (`docker-compose.yml`, `apps/api/.env.example`) để không trùng với dự án khác dùng 5433. Ai đã có file `apps/api/.env` cũ thì sửa `DATABASE_URL` sang cổng 5434.
- `pnpm db:seed` tạo thêm tài khoản quản trị để thử trên máy dev: `admin@gmail.com` / `123456a`. Vai trò ADMIN hiện **chưa có chức năng riêng**. **Phải đổi mật khẩu trước khi triển khai thật.**
- `.gitignore` chặn mọi file tài liệu phân tích thiết kế bắt đầu bằng `PTTK`/`pttk`, có gạch hay không.

---

## 3. Cấu trúc code mới

```
apps/web/src/features/simulator/
  SimViewport.tsx       khung 3D: Canvas, nút góc nhìn, chất lượng, chụp ảnh thu nhỏ
  SceneEnvironment.tsx  ánh sáng, mặt bàn, sàn, thước đo, xuất phát, đích, vật cản, mũi tên dưới gầm
  CameraRig.tsx         3 chế độ camera, chuyển mượt
  Trail.tsx             vệt đường đi
  inoBot.ts             mô hình robot dựng bằng code (three.js thuần, không phụ thuộc React)
  scenario.ts           đổi cấu hình kịch bản/robot sang tham số mô phỏng
```

Nguyên tắc giữ nguyên từ PTTK: **khung 3D chỉ vẽ**. Mọi chuyển động do `sim-core` tính. Mỗi khung hình, khung 3D chỉ đọc trạng thái mới nhất (`liveState`, một ref của React, không qua state) rồi đặt mô hình vào đúng chỗ. Khi robot đứng yên, khung 3D chỉ vẽ lại lúc có thay đổi (`frameloop="demand"`) để đỡ tốn máy.

Mô hình robot và cảnh 3D được tạo nháp bằng Gemini, sau đó rà soát và sửa các lỗi sau:

- chi tiết robot đâm xuyên nhau;
- góc nhìn từ trên bị xoay ngược 180°;
- chế độ chất lượng tự động hạ nhầm lúc cảnh đứng yên;
- khung 3D không vẽ lại khi bấm Dừng sau lúc chương trình đã chạy xong.

---

## 4. Kiểm thử

| Gói | Số test | Nội dung mới |
|---|---|---|
| `sim-core` | 45 | chạy như nhau ở mọi tốc độ và tần số màn hình; bộ tích luỹ thời gian; máy đơ; tạm dừng; vị trí xuất phát; rẽ trái đi về −Z; nhắc khối liên tục; quãng đường/góc chính xác; hình vuông khép kín |
| `blocks` | 44 | 4 khối mới tự động nằm trong ca "mọi khối sinh được cả JS lẫn C++, đủ tham số" |
| `shared` | 10 | không đổi |

`pnpm typecheck` đạt 5/5 gói. `pnpm --filter @ino/web build` đạt.

**Chạy thử trên trình duyệt** (Edge tự động hoá bằng Playwright):

- **Đã kiểm tra:** robot đi đúng quỹ đạo tính tay; 3 góc nhìn; vệt đường đi; chế độ Đẹp và Nhanh; bấm Dừng lúc đang chạy và lúc đã chạy xong; ảnh thu nhỏ hiện trên trang danh sách; lời nhắc khối liên tục.
- **Số draw call mỗi khung hình:** khoảng 236 ở chế độ Đẹp, 125 ở chế độ Nhanh.
- **Chưa đo tốc độ khung hình trên máy thật.** Trình duyệt kiểm thử vẽ bằng CPU nên con số đo được không đại diện.

---

## 5. Việc còn lại và rủi ro

| Việc | Mốc | Ghi chú |
|---|---|---|
| Cảm biến line và siêu âm đọc từ sa bàn | M4 | Hiện vẫn trả giá trị cố định, kèm cảnh báo |
| Ảnh vạch kẻ sa bàn `line-follow.png` | M4 | Khung 3D đã sẵn sàng dán ảnh, đúng quy ước toạ độ cho cảm biến |
| Va chạm vật cản, chặn mép sàn | M4 | Robot hiện đi xuyên vật cản và ra ngoài sàn được |
| Phát hiện về đích | M4 | Hiệu ứng pháo giấy đã có (`goalReached`), chỉ chờ nối dữ liệu |
| Chọn kịch bản khi tạo bài làm | M4 | Như README |
| **Đo tốc độ khung hình trên máy cấu hình như ở trường** | trước M5 | Nếu chậm: gộp các chi tiết tĩnh của robot (36 gân lốp đang là 36 draw call), có thể giảm khoảng một nửa |
| **Thống nhất thước đo và dải số liệu** | nhỏ | Thước ghi 0–2 m tính từ mép sàn, dải số liệu dùng toạ độ có tâm sàn là 0 (−1…+1 m). Học sinh có thể bị rối |
| Cảnh báo `THREE.Clock` trong console | — | Đến từ bên trong React Three Fiber, không ảnh hưởng gì |
| Cập nhật PTTK-02 mục 7 | — | Theo mục 2.1 |

---

## 6. Chạy thử nhanh

```bash
pnpm install
cp apps/api/.env.example apps/api/.env   # hoặc sửa cổng sang 5434 nếu đã có file .env
pnpm db:up && pnpm db:migrate && pnpm db:seed
pnpm dev                                  # http://localhost:5173
```

Đăng nhập `demo@ino.vn` / `demo1234`, tạo bài làm, rồi kéo các khối sau:

> khi bấm vào nút Chạy → lặp lại 4 lần { đi thẳng 40 cm · quay trái 90 độ }

Bấm **Chạy**, rồi chọn **Nhìn từ trên**. Robot sẽ đi một hình vuông và về đúng ô xuất phát.
