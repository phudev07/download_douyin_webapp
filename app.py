from flask import Flask, render_template, request, jsonify, Response, stream_with_context
import requests
import re
from datetime import datetime
import os
from dotenv import load_dotenv
from PIL import Image
from io import BytesIO

load_dotenv()

app = Flask(__name__)

# --- CẤU HÌNH TOKEN (Lấy từ .env) ---
TIKHUB_TOKEN = os.getenv("TIKHUB_TOKEN")

# Các Endpoint API của Tikhub
API_SINGLE = "https://api.tikhub.io/api/v1/douyin/app/v3/fetch_one_video_by_share_url"
API_USER_ID = "https://api.tikhub.io/api/v1/douyin/web/get_sec_user_id"
API_USER_VIDEOS = "https://api.tikhub.io/api/v1/douyin/app/v3/fetch_user_post_videos"
API_USER_INFO = "https://api.tikhub.io/api/v1/tikhub/user/get_user_info"

def get_headers():
    return {
        "Authorization": f"Bearer {TIKHUB_TOKEN}",
        "User-Agent": "TikHub Downloader App/1.0.0",
        "Content-Type": "application/json"
    }

def clean_video_data(data_raw):
    """Làm sạch dữ liệu & Lọc bỏ ảnh HEIC để tránh lỗi hiển thị"""
    try:
        item = data_raw
        if 'aweme_detail' in data_raw: item = data_raw['aweme_detail']
        
        vid_id = item.get("aweme_id")
        desc = item.get("desc", "Không tiêu đề")
        author = item.get("author", {}).get("nickname", "Unknown")
        
        # --- LOGIC TÌM ẢNH KHÔNG PHẢI HEIC ---
        cover = ""
        video_obj = item.get("video", {})
        
        # Các nguồn ảnh ưu tiên: Ảnh thường -> Ảnh động -> Ảnh gốc
        source_keys = ["cover", "dynamic_cover", "origin_cover"]
        
        # Nếu là album ảnh, thêm ảnh đầu tiên vào danh sách ưu tiên
        if item.get("images"):
            source_keys.insert(0, item["images"][0])

        found_valid_img = False
        
        for key in source_keys:
            if found_valid_img: break
            
            # Xử lý nếu key là object ảnh trực tiếp hoặc là string key
            img_obj = video_obj.get(key) if isinstance(key, str) else key
            
            if not img_obj or not img_obj.get("url_list"): continue
            
            # Duyệt qua từng link để tìm cái nào KHÔNG PHẢI HEIC
            for url in img_obj.get("url_list", []):
                if ".heic" not in url.lower() and ".heif" not in url.lower():
                    cover = url
                    found_valid_img = True
                    break
        
        # Fallback: Nếu không tìm được, dùng ảnh giữ chỗ
        if not cover:
            cover = "https://placehold.co/300x400/png?text=No+Preview"
        # -------------------------------------

        # Link tải
        video_url = ""
        if "play_addr" in video_obj and video_obj["play_addr"].get("url_list"): 
            video_url = video_obj["play_addr"]["url_list"][0]
        
        # Nếu là Album ảnh (không có video_url), đánh dấu
        if not video_url and item.get("images"):
            video_url = "IMAGE_SLIDER"

        music_url = ""
        if "play_url" in item.get("music", {}) and item["music"]["play_url"].get("url_list"): 
            music_url = item["music"]["play_url"]["url_list"][0]

        # Ngày đăng
        create_time = item.get("create_time", 0)
        date_str = datetime.fromtimestamp(create_time).strftime('%Y-%m-%d')

        # Thống kê (Statistics)
        statistics = item.get("statistics", {})
        likes = statistics.get("digg_count", 0)
        comments = statistics.get("comment_count", 0)
        shares = statistics.get("share_count", 0)

        return {
            "id": vid_id,
            "desc": desc,
            "author": author,
            "cover": cover,
            "video_url": video_url,
            "music_url": music_url,
            "date": date_str,
            "share_url": item.get("share_url", ""),
            "likes": likes,
            "comments": comments,
            "shares": shares
        }
    except Exception as e:
        print(f"Error cleaning data: {e}")
        return None

@app.route('/')
def index(): return render_template('index.html')

@app.route('/get-info', methods=['POST'])
def get_video_info():
    url = request.json.get('url', '')
    try:
        res = requests.get(API_SINGLE, headers=get_headers(), params={"share_url": url}, timeout=30)
        if not res.ok: return jsonify({'success': False, 'error': 'Lỗi API'}), 400
        cleaned = clean_video_data(res.json().get('data', {}))
        return jsonify({'success': True, 'data': cleaned}) if cleaned else (jsonify({'success': False, 'error': 'Không tìm thấy dữ liệu'}), 404)
    except Exception as e: return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/get-user-id', methods=['POST'])
def get_user_id():
    user_url = request.json.get('url', '')
    try:
        res = requests.get(API_USER_ID, headers=get_headers(), params={"url": user_url}, timeout=30)
        sec_id = res.json().get('data')
        if sec_id: return jsonify({'success': True, 'sec_user_id': sec_id})
        return jsonify({'success': False, 'error': 'Không lấy được ID User. Link sai hoặc bị chặn.'})
    except Exception as e: return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/fetch-user-page', methods=['POST'])
def fetch_user_page():
    sec_user_id = request.json.get('sec_user_id')
    max_cursor = request.json.get('max_cursor', 0)
    try:
        params = {"sec_user_id": sec_user_id, "count": 20, "max_cursor": max_cursor}
        res = requests.get(API_USER_VIDEOS, headers=get_headers(), params=params, timeout=30)
        data = res.json().get('data', {})
        raw_list = data.get('aweme_list', [])
        results = []
        for item in raw_list:
            clean = clean_video_data(item)
            if clean: results.append(clean)
            
        # Trả về max_cursor dạng String để tránh lỗi làm tròn JS
        next_cursor = str(data.get('max_cursor', 0))
        
        return jsonify({
            'success': True, 
            'data': results, 
            'has_more': data.get('has_more', False),
            'max_cursor': next_cursor
        })
    except Exception as e: return jsonify({'success': False, 'error': str(e)}), 500
@app.route('/api/get-current-key', methods=['GET'])
def get_current_key():
    if TIKHUB_TOKEN:
        return jsonify({'success': True, 'api_key': TIKHUB_TOKEN})
    return jsonify({'success': False, 'api_key': ''})
@app.route('/proxy-download')
def proxy_download():
    file_url = request.args.get('url')
    file_name = request.args.get('name', 'file.mp4')
    
    if file_url == "IMAGE_SLIDER": return "Đây là Album ảnh, chưa hỗ trợ tải.", 400

    dest_type = "video"
    if any(ext in file_name.lower() for ext in ['.jpg', '.jpeg', '.png', '.webp']):
        dest_type = "image"
    elif '.mp3' in file_name.lower():
        dest_type = "audio"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://www.douyin.com/",
        "Sec-Fetch-Dest": dest_type,
        "Sec-Fetch-Mode": "cors"
    }
    try:
        req = requests.get(file_url, headers=headers, stream=True, timeout=20)
        return Response(stream_with_context(req.iter_content(chunk_size=4096)), content_type=req.headers.get('content-type'), headers={"Content-Disposition": f"attachment; filename={file_name}"})
    except: return "Error", 500

@app.route('/download-thumbnail')
def download_thumbnail():
    """Tải thumbnail và tự động chuyển sang PNG"""
    file_url = request.args.get('url')
    file_name = request.args.get('name', 'thumbnail.png')
    
    # Đảm bảo tên file có đuôi .png
    if not file_name.endswith('.png'):
        file_name = file_name.rsplit('.', 1)[0] + '.png'
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://www.douyin.com/",
        "Sec-Fetch-Dest": "image",
        "Sec-Fetch-Mode": "cors"
    }
    
    try:
        # Tải ảnh từ URL
        response = requests.get(file_url, headers=headers, timeout=20)
        
        # Mở ảnh bằng PIL
        img = Image.open(BytesIO(response.content))
        
        # Chuyển sang RGB nếu cần (để tránh lỗi với RGBA)
        if img.mode in ('RGBA', 'LA', 'P'):
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
            img = background
        elif img.mode != 'RGB':
            img = img.convert('RGB')
        
        # Lưu vào BytesIO dưới dạng PNG
        img_io = BytesIO()
        img.save(img_io, 'PNG', optimize=True)
        img_io.seek(0)
        
        return Response(
            img_io.getvalue(),
            mimetype='image/png',
            headers={"Content-Disposition": f"attachment; filename={file_name}"}
        )
    except Exception as e:
        print(f"Error converting image: {e}")
        return "Error converting image", 500

@app.route('/api/check-key', methods=['POST'])
def check_key():
    api_key = request.json.get('api_key', '')
    if not api_key: return jsonify({'success': False, 'error': 'Chưa nhập API Key'}), 400
    
    try:
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        res = requests.get(API_USER_INFO, headers=headers, timeout=10)
        
        if res.status_code == 200:
            data = res.json()
            # TikHub API trả về trực tiếp object chứa user_data và api_key_data
            return jsonify({'success': True, 'data': data})
        else:
            # Nếu status code không phải 200, parse error message
            try:
                error_data = res.json()
                error_msg = error_data.get('msg', error_data.get('message', 'Key không hợp lệ'))
            except:
                error_msg = f'HTTP {res.status_code}: Key không hợp lệ'
            return jsonify({'success': False, 'error': error_msg})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/save-settings', methods=['POST'])
def save_settings():
    global TIKHUB_TOKEN
    new_key = request.json.get('api_key', '').strip()
    
    if new_key:
        TIKHUB_TOKEN = new_key
        # Save to .env
        try:
            with open('.env', 'w') as f:
                f.write(f"TIKHUB_TOKEN={new_key}\n")
            return jsonify({'success': True, 'message': 'Đã lưu cài đặt thành công!'})
        except Exception as e:
            return jsonify({'success': False, 'error': f"Lỗi lưu file: {e}"}), 500
    return jsonify({'success': False, 'error': 'API Key trống'}), 400

if __name__ == '__main__':
    app.run(debug=True, port=5000, threaded=True)