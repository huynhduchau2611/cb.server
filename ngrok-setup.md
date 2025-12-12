# Hướng dẫn Setup Ngrok cho PayOS Webhook

## Cách 1: Dùng Ngrok NPM Package (Khuyến nghị) ⭐

### Bước 1: Lấy Ngrok Authtoken

1. Truy cập: https://dashboard.ngrok.com/signup
2. Đăng ký tài khoản miễn phí
3. Lấy Authtoken từ dashboard: https://dashboard.ngrok.com/get-started/your-authtoken

### Bước 2: Cấu hình .env

Thêm vào file `.env`:

```env
# Ngrok authtoken (required)
NGROK_AUTHTOKEN=your_authtoken_here
```

### Bước 3: Chạy Server (Terminal 1)

```bash
npm run dev
```

### Bước 4: Chạy Ngrok (Terminal 2)

Mở terminal mới và chạy:

```bash
npm run ngrok
```

Ngrok sẽ start và hiển thị URL:
```
✅ Ngrok tunnel started successfully!
📡 Public URL: https://abc123.ngrok-free.app
🔗 Webhook URL: https://abc123.ngrok-free.app/api/payments/webhook
```

### Bước 5: Copy Webhook URL

Copy webhook URL từ console và cấu hình trong PayOS dashboard.

---

## Cách 2: Dùng Ngrok Binary (Manual)

### Bước 1: Cài đặt Ngrok

### macOS (với Homebrew):
```bash
brew install ngrok/ngrok/ngrok
```

### Hoặc download từ:
https://ngrok.com/download

### Bước 2: Đăng ký tài khoản Ngrok (miễn phí)

1. Truy cập: https://dashboard.ngrok.com/signup
2. Đăng ký tài khoản miễn phí
3. Lấy Authtoken từ dashboard: https://dashboard.ngrok.com/get-started/your-authtoken

### Bước 3: Cấu hình Ngrok

```bash
# Authenticate với ngrok
ngrok config add-authtoken YOUR_AUTHTOKEN_HERE
```

### Bước 4: Chạy Ngrok Tunnel

```bash
# Expose local server port 4000
ngrok http 4000
```

Sau khi chạy, bạn sẽ nhận được URL công khai như:
```
Forwarding: https://abc123.ngrok-free.app -> http://localhost:4000
```

## Bước 5: Cấu hình Webhook URL trong PayOS

1. Đăng nhập vào PayOS Dashboard: https://pay.payos.vn/
2. Vào mục **Cấu hình** → **Webhook**
3. Nhập Webhook URL: `https://YOUR_NGROK_URL.ngrok-free.app/api/payments/webhook`
   - Ví dụ: `https://abc123.ngrok-free.app/api/payments/webhook`
4. Lưu cấu hình

## Bước 6: Cập nhật .env (Optional)

Nếu muốn dùng ngrok URL cố định, thêm vào `.env`:

```env
PAYOS_WEBHOOK_URL=https://YOUR_NGROK_URL.ngrok-free.app/api/payments/webhook
```

**Lưu ý:** URL ngrok miễn phí sẽ thay đổi mỗi lần restart. Để có URL cố định, cần upgrade lên plan trả phí.

## Bước 7: Test Webhook

1. Tạo payment link từ frontend
2. Quét QR code và thanh toán
3. Kiểm tra logs trong terminal để xem webhook có được gọi không
4. Kiểm tra database xem company plan đã được update chưa

## Troubleshooting

### Webhook không được gọi:
- Kiểm tra ngrok đang chạy: `curl http://localhost:4040/api/tunnels`
- Kiểm tra webhook URL trong PayOS dashboard
- Kiểm tra firewall/antivirus có chặn không

### Webhook bị lỗi:
- Kiểm tra logs trong server console
- Đảm bảo server đang chạy trên port 4000
- Kiểm tra database connection

### Ngrok URL thay đổi:
- URL miễn phí sẽ thay đổi mỗi lần restart ngrok
- Cần update lại webhook URL trong PayOS dashboard
- Hoặc upgrade lên plan trả phí để có domain cố định

