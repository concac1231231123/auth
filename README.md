# BR.MODS CUSTOM AUTH SERVER & KEY SYSTEM

Hệ thống Auth Server giả lập theo đúng protocol của `minduin.dll` (`https://brmods.net/auth/auth.php?request=login`), tích hợp Discord Bot cho Owner quản lý và hỗ trợ Get-Link (rút gọn link).

---

## 🚀 TÍNH NĂNG CHÍNH

1. **Chuẩn Payload Client Mod**:
   - Nhận payload từ mod: `{"username":"...", "password":"...", "token":"...", "hwid":"...", "version":"3"}`.
   - Tự động ghim HWID thiết bị ở lần đăng nhập đầu tiên.
   - Trả response đúng chuẩn client mong đợi (`status: "success"`, `token`, `expire`, `mensagem`).

2. **Bảng Điều Khiển Owner (Admin Panel)**:
   - Truy cập tại `/admin.html`.
   - Bảo vệ bằng mã `ADMIN_SECRET`.
   - Tạo key VIP (24h, 3 ngày, 1 tuần, 1 tháng, Vĩnh viễn).
   - Reset HWID để chuyển máy, Khóa/Mở key, Xóa key.

3. **Cổng Vượt Link Lấy Key (Get-Link)**:
   - Truy cập tại `/index.html`.
   - **Internal Checkpoint**: Người dùng làm nhiệm vụ/đợi timer để nhận key 24h miễn phí.
   - **Đấu API Rút gọn link (LootLabs / Linkvertise)**:
     - URL Webhook LootLabs: `https://<domain>/api/getlink/webhook/lootlabs`
     - URL Webhook Linkvertise: `https://<domain>/api/getlink/webhook/linkvertise`
     - Tự động sinh key và trả về ngay khi vượt link thành công.

4. **Discord Bot (Owner Only)**:
   - `/genkey <hours> [note] [custom_key]` — Tạo key trực tiếp từ Discord.
   - `/checkkey <key>` — Xem thông tin, thời hạn, HWID của key.
   - `/resetkey <key>` — Reset HWID nhanh.
   - `/delkey <key>` — Xóa key.
   - `/stats` — Xem tổng quan hệ thống.

---

## 🛠️ HƯỚNG DẪN CÀI ĐẶT & CHẠY LOCAL

```bash
cd auth-server

# 1. Cài đặt thư viện
npm install

# 2. Tạo file cấu hình .env từ .env.example
cp .env.example .env
# (Chỉnh sửa ADMIN_SECRET và Token Discord trong .env)

# 3. Khởi động Web Server
npm start

# 4. Khởi động Discord Bot (chạy ở terminal riêng)
npm run bot
```

* **Web Get-Link**: `http://localhost:3000/index.html`
* **Owner Dashboard**: `http://localhost:3000/admin.html`
* **Auth Endpoint**: `http://localhost:3000/auth/auth.php?request=login`

---

## ☁️ HƯỚNG DẪN DEPLOY LÊN NETLIFY (MIỄN PHÍ)

1. Đẩy thư mục `auth-server` lên một Github Repository.
2. Đăng nhập vào [Netlify](https://www.netlify.com/) -> **Add new site** -> **Import an existing project**.
3. Cấu hình build trên Netlify:
   - **Base directory**: `auth-server` (hoặc để trống nếu repo ở thư mục gốc)
   - **Publish directory**: `public`
   - **Functions directory**: `netlify/functions`
4. Vào **Site configuration** -> **Environment variables**, thêm:
   - `ADMIN_SECRET`: `<mật khẩu bí mật của Đại ca>`
5. Nhấn **Deploy site**.
   Netlify sẽ cấp cho bạn 1 domain miễn phí dạng `https://your-app.netlify.app`.

*Lưu ý về Discord Bot*: Netlify là nền tảng Serverless (không duy trì tiến trình chạy ngầm 24/7). Discord Bot có thể chạy trên máy tính cá nhân, VPS, hoặc các nền tảng miễn phí 24/7 như **Render.com / Koyeb / Glitch** chỉ với lệnh `npm run bot` và trỏ Database đồng bộ.
"# auth"  
