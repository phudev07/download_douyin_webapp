# Douyin Video Downloader

Ứng dụng web để tải video và thông tin từ Douyin (TikTok Trung Quốc) sử dụng TikHub API.

## ✨ Tính năng

- 🎬 Tải video đơn lẻ từ link chia sẻ
- 👤 Quét toàn bộ video từ kênh người dùng
- 📊 Hiển thị thống kê (lượt thích, bình luận, chia sẻ)
- 🎵 Tải nhạc nền từ video
- 🖼️ Hỗ trợ album ảnh
- ⚙️ Quản lý API key trong Settings

## 🚀 Cài đặt

### 1. Clone repository

```bash
git clone https://github.com/your-username/douyin-downloader.git
cd douyin-downloader
```

### 2. Cài đặt dependencies

```bash
pip install -r requirements.txt
```

### 3. Cấu hình API Key

- Copy file `.env.example` thành `.env`:
  ```bash
  cp .env.example .env
  ```
- Mở file `.env` và điền TikHub API token của bạn:
  ```
  TIKHUB_TOKEN=your_api_token_here
  ```

### 4. Chạy ứng dụng

```bash
python app.py
```

Truy cập: `http://localhost:5000`

## 🔑 Lấy TikHub API Key

1. Truy cập [TikHub.io](https://tikhub.io)
2. Đăng ký tài khoản
3. Lấy API token từ dashboard
4. Paste vào file `.env`

## 📁 Cấu trúc dự án

```
douyin-downloader/
├── app.py              # Flask backend
├── static/
│   ├── script.js       # JavaScript frontend
│   └── style.css       # Styling
├── templates/
│   └── index.html      # Giao diện chính
├── .env                # API key (không commit)
├── .env.example        # Template cho .env
├── requirements.txt    # Python dependencies
└── README.md           # File này
```

## 🛠️ Công nghệ sử dụng

- **Backend**: Flask (Python)
- **Frontend**: HTML, CSS, JavaScript
- **API**: TikHub API

## ⚠️ Lưu ý

- File `.env` chứa API key nhạy cảm, **KHÔNG** được commit lên GitHub
- API key có giới hạn số lượng request, kiểm tra quota tại TikHub dashboard
- Ứng dụng chỉ hoạt động với link Douyin hợp lệ

## 📝 License

MIT License - Tự do sử dụng cho mục đích cá nhân và thương mại.

## 🤝 Đóng góp

Pull requests được chào đón! Đối với thay đổi lớn, vui lòng mở issue trước để thảo luận.
