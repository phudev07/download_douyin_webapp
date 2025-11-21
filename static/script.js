// === VARIABLES ===
let stopFlag = false;
let userVideos = [];
let batchData = [];

// --- THEME LOGIC ---
function toggleTheme() {
    const body = document.body;
    const current = body.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    body.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    updateThemeIcon(next);
}

function updateThemeIcon(theme) {
    const icon = document.getElementById('themeIcon');
    if(icon) icon.className = theme === 'dark' ? 'ri-sun-line' : 'ri-moon-line';
}

// Load Theme
(function() {
    const saved = localStorage.getItem('theme') || 'light';
    document.body.setAttribute('data-theme', saved);
    updateThemeIcon(saved);
})();

function switchTab(id) {
    document.querySelectorAll('.tab-pane').forEach(e => e.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(e => e.classList.remove('active'));
    document.getElementById('tab-'+id).classList.add('active');
    event.currentTarget.classList.add('active');
    
    // Load API key when switching to Settings tab
    if(id === 'settings') {
        loadCurrentApiKey();
    }
}

// Load current API key from backend
async function loadCurrentApiKey() {
    try {
        const res = await fetch('/api/get-current-key');
        const json = await res.json();
        if(json.success && json.api_key) {
            document.getElementById('tikhubKey').value = json.api_key;
        }
    } catch(e) {
        console.error("Error loading API key:", e);
    }
}
function toggleUserMode() {
    const mode = document.getElementById('userMode').value;
    document.getElementById('limitGroup').style.visibility = mode === 'all' ? 'hidden' : 'visible';
}
function updateBatchCount() {
    document.getElementById('linkCount').innerText = document.getElementById('batchInput').value.split('\n').filter(l => l.trim()).length;
}

// --- DRAG SELECT ---
let isDragging = false;
let dragTargetState = true;

// Global Event Listeners
document.addEventListener('mouseup', () => { isDragging = false; });
document.addEventListener('mousedown', (e) => {
    const row = e.target.closest('.custom-table tbody tr');
    if (!row || e.target.tagName === 'A') return;

    isDragging = true;
    const cb = row.querySelector('input[type="checkbox"]');
    
    if (e.target.tagName === 'INPUT') {
        // Checkbox click: Browser toggles it. We sync target state.
        dragTargetState = !cb.checked; 
    } else {
        // Row click: We toggle manually.
        e.preventDefault();
        dragTargetState = !cb.checked;
        toggleRow(row, dragTargetState);
    }
});

function handleMouseEnter(row) { 
    if(isDragging) toggleRow(row, dragTargetState); 
}

function toggleRow(row, forceState=null) {
    const cb = row.querySelector('input[type="checkbox"]');
    if(forceState !== null) cb.checked = forceState; 
    else cb.checked = !cb.checked;
    
    if(cb.checked) row.classList.add('selected'); 
    else row.classList.remove('selected');
}

function toggleAll(source, tableId) {
    document.querySelectorAll(`#${tableId} tbody tr`).forEach(row => toggleRow(row, source.checked));
}

// --- CHANNEL SCAN ---
async function scanUser() {
    const url = document.getElementById('urlUser').value;
    if(!url) return alert("Thiếu link!");
    
    resetUserUI(true);
    try {
        const resId = await fetch('/get-user-id', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({url})});
        const jsonId = await resId.json();
        if(!jsonId.success) throw new Error(jsonId.error);
        const sec_id = jsonId.sec_user_id;

        let max_cursor = "0";
        let has_more = true;
        const mode = document.getElementById('userMode').value;
        const limit = parseInt(document.getElementById('limitUser').value);

        while(has_more && !stopFlag) {
            if(mode === 'limit' && userVideos.length >= limit) break;
            const resPage = await fetch('/fetch-user-page', {
                method:'POST', headers:{'Content-Type':'application/json'},
                body:JSON.stringify({sec_user_id: sec_id, max_cursor: max_cursor})
            });
            const jsonPage = await resPage.json();
            if(jsonPage.success) {
                const newVideos = jsonPage.data;
                userVideos = userVideos.concat(newVideos);
                renderUserRows(newVideos);
                document.getElementById('userCount').innerText = userVideos.length;
                max_cursor = jsonPage.max_cursor;
                has_more = jsonPage.has_more;
                if (newVideos.length === 0 && has_more) break;
            } else break;
        }
    } catch(e) { alert(e.message); }
    finally { resetUserUI(false); }
}

function resetUserUI(isStart) {
    if(isStart) {
        document.querySelector('#channelTable tbody').innerHTML = '';
        userVideos = []; stopFlag = false;
        document.getElementById('btnScanUser').style.display = 'none';
        document.getElementById('btnStopUser').style.display = 'inline-flex';
        document.getElementById('userStatus').style.display = 'block';
        document.getElementById('btnUserDl').style.display = 'none';
        document.getElementById('btnCopyLink').style.display = 'none'; // Ẩn
    } else {
        document.getElementById('btnScanUser').style.display = 'inline-flex';
        document.getElementById('btnStopUser').style.display = 'none';
        if(userVideos.length > 0) {
            document.getElementById('btnUserDl').style.display = 'inline-flex';
            document.getElementById('btnCopyLink').style.display = 'inline-flex'; // Hiện
        }
    }
}
function stopScan() { stopFlag = true; }

function renderUserRows(data) {
    const tbody = document.querySelector('#channelTable tbody');
    const startIndex = userVideos.length - data.length;
    data.forEach((d, i) => {
        const tr = document.createElement('tr');
        tr.className = 'data-row';
        tr.onmouseenter = function() { handleMouseEnter(this); };
        
        tr.innerHTML = `
            <td><input type="checkbox" value="${startIndex + i}"></td>
            <td><img src="${d.cover}" class="thumb-img" referrerpolicy="no-referrer" onerror="this.src='https://placehold.co/70x70?text=Err'"></td>
            <td class="col-date"><span class="info-tag">${d.date}</span></td>
            <td class="col-desc" title="${d.desc}">${d.desc}</td>
            <td class="col-id">${d.id}</td>
            <td class="col-link"><a href="${d.share_url}" target="_blank" class="link-txt">Xem Link</a></td>
        `;
        tbody.appendChild(tr);
    });
    filterByDate();
}

function filterByDate() {
    const start = document.getElementById('dateStart').value;
    const end = document.getElementById('dateEnd').value;
    const rows = document.querySelectorAll('#channelTable tbody tr');
    const sDate = start ? new Date(start) : null;
    const eDate = end ? new Date(end) : null;
    userVideos.forEach((v, i) => {
        const vDate = new Date(v.date);
        let show = true;
        if(sDate && vDate < sDate) show = false;
        if(eDate && vDate > eDate) show = false;
        if(rows[i]) rows[i].style.display = show ? '' : 'none';
    });
}

// --- BATCH SCAN ---
async function scanBatch() {
    const urls = document.getElementById('batchInput').value.split('\n').filter(l => l.trim());
    if(!urls.length) return alert("Vui lòng nhập link!");
    const tbody = document.querySelector('#batchTable tbody');
    tbody.innerHTML = ''; batchData = [];
    document.getElementById('batchLoader').style.display = 'block';
    
    for(const url of urls) {
        try {
            const res = await fetch('/get-info', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({url})});
            const json = await res.json();
            const tr = document.createElement('tr'); tr.className = 'data-row'; tr.onmouseenter = function(){handleMouseEnter(this)};
            if(json.success) {
                const d = json.data; batchData.push(d);
                tr.innerHTML = `<td><input type="checkbox" value="${batchData.length-1}" checked></td><td><img src="${d.cover}" class="thumb-img" referrerpolicy="no-referrer"></td><td>${d.desc.substring(0,50)}...</td><td style="color:green">✅ OK</td>`;
                toggleRow(tr, true);
            } else { tr.innerHTML = `<td colspan="4" style="color:red">❌ Lỗi: ${url.substring(0,30)}</td>`; }
            tbody.appendChild(tr);
        } catch(e){
            console.error("Error fetching:", url, e);
        }
    }
    document.getElementById('batchLoader').style.display = 'none';
    document.getElementById('btnBatchDl').style.display = 'inline-flex';
}

// --- DOWNLOAD SYSTEM ---
function downloadChecked(type) {
    const tableId = type === 'batch' ? 'batchTable' : 'channelTable';
    const source = type === 'batch' ? batchData : userVideos;
    let threads = 3;
    if(type==='batch') threads = parseInt(document.getElementById('batchThreads').value)||3;
    else threads = parseInt(document.getElementById('channelThreads').value)||3;

    const checkboxes = document.querySelectorAll(`#${tableId} tbody tr:not([style*="display: none"]) input:checked`);
    if(!checkboxes.length) return alert("Chưa chọn video!");
    if(!confirm(`Tải ${checkboxes.length} mục (Threads: ${threads})?`)) return;

    const queue = Array.from(checkboxes).map(cb => source[cb.value]);
    let active = 0;
    function process() {
        while(active < threads && queue.length > 0) {
            const item = queue.shift();
            if(item.video_url === "IMAGE_SLIDER") { console.log("Skip album"); continue; }
            active++;
            const name = `video_${item.id}.mp4`;
            const link = `/proxy-download?url=${encodeURIComponent(item.video_url)}&name=${name}`;
            const iframe = document.createElement('iframe'); iframe.style.display='none'; iframe.src=link; document.body.appendChild(iframe);
            setTimeout(() => { document.body.removeChild(iframe); active--; process(); }, 1500);
        }
    }
    process();
}

// --- COPY LINK FUNCTION (MỚI) ---
function copyCheckedLinks() {
    // Lấy tất cả checkbox đã chọn (trừ những dòng bị ẩn do lọc)
    const checkboxes = document.querySelectorAll('#channelTable tbody tr:not([style*="display: none"]) input:checked');
    
    if (!checkboxes.length) return alert("Chưa chọn video nào!");
    
    const links = Array.from(checkboxes).map(cb => userVideos[cb.value].share_url).join('\n');
    
    navigator.clipboard.writeText(links).then(() => {
        alert(`✅ Đã copy ${checkboxes.length} link vào Clipboard!`);
    }).catch(err => {
        // Fallback cho trình duyệt cũ
        const textArea = document.createElement("textarea");
        textArea.value = links;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            alert(`✅ Đã copy ${checkboxes.length} link!`);
        } catch (err) {
            alert('❌ Lỗi copy: ' + err);
        }
        document.body.removeChild(textArea);
    });
}

async function getSingle() {
    const url = document.getElementById('urlSingle').value;
    const res = await fetch('/get-info', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({url})});
    const json = await res.json();
    if(json.success) {
        const d = json.data;
        document.getElementById('singleResult').style.display = 'block';
        document.getElementById('sThumb').src = d.cover;
        document.getElementById('sDesc').innerText = d.desc;
        document.getElementById('sAuthor').innerText = d.author;
        
        // Statistics
        document.getElementById('sLikes').innerText = formatNumber(d.likes || 0);
        document.getElementById('sComments').innerText = formatNumber(d.comments || 0);
        document.getElementById('sShares').innerText = formatNumber(d.shares || 0);
        
        // Download buttons
        document.getElementById('btnDlVideo').href = `/proxy-download?url=${encodeURIComponent(d.video_url)}&name=${d.id}.mp4`;
        
        // MP3 button - always visible, set href if music exists
        if(d.music_url) {
            document.getElementById('btnDlMusic').href = `/proxy-download?url=${encodeURIComponent(d.music_url)}&name=${d.id}.mp3`;
        }
    }
}

// Helper function to format large numbers
function formatNumber(num) {
    if(num >= 1000000) return (num/1000000).toFixed(1) + 'M';
    if(num >= 1000) return (num/1000).toFixed(1) + 'K';
    return num.toString();
}

// --- SETTINGS LOGIC ---
async function checkTikhubKey() {
    const key = document.getElementById('tikhubKey').value.trim();
    if(!key) return alert("Vui lòng nhập API Key!");
    
    const statusDiv = document.getElementById('keyStatus');
    statusDiv.innerHTML = '<span style="color:orange"><i class="ri-loader-4-line ri-spin"></i> Đang kiểm tra...</span>';
    
    try {
        const res = await fetch('/api/check-key', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({api_key: key})
        });
        const json = await res.json();
        
        if(json.success) {
            const u = json.data.user_data;
            const k = json.data.api_key_data;
            statusDiv.innerHTML = '<span style="color:green"><i class="ri-check-double-line"></i> Key hợp lệ!</span>';
            
            document.getElementById('userInfoDisplay').style.display = 'block';
            document.getElementById('uiEmail').innerText = u.email;
            document.getElementById('uiBalance').innerText = `${u.balance.toFixed(2)} Credits`;
            document.getElementById('uiStatus').innerText = u.is_active ? "Hoạt động" : "Bị khóa";
        } else {
            statusDiv.innerHTML = `<span style="color:red"><i class="ri-error-warning-line"></i> ${json.error}</span>`;
            document.getElementById('userInfoDisplay').style.display = 'none';
        }
    } catch(e) {
        statusDiv.innerHTML = `<span style="color:red">Lỗi kết nối: ${e.message}</span>`;
    }
}

async function saveTikhubKey() {
    const key = document.getElementById('tikhubKey').value.trim();
    if(!key) return alert("Vui lòng nhập API Key!");
    
    if(!confirm("Lưu Key mới vào hệ thống?")) return;
    
    try {
        const res = await fetch('/api/save-settings', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({api_key: key})
        });
        const json = await res.json();
        if(json.success) alert(json.message);
        else alert("Lỗi: " + json.error);
    } catch(e) { alert("Lỗi kết nối: " + e.message); }
}

function saveDefaultSettings() {
    const settings = {
        threads: document.getElementById('defThreads').value,
        mode: document.getElementById('defMode').value,
        limit: document.getElementById('defLimit').value
    };
    localStorage.setItem('appSettings', JSON.stringify(settings));
    alert("Đã lưu cấu hình mặc định! (Sẽ áp dụng cho lần mở sau)");
    applySettings(settings);
}

function loadSettings() {
    const saved = localStorage.getItem('appSettings');
    if(saved) {
        const s = JSON.parse(saved);
        // Apply to Settings Tab Inputs
        if(s.threads) document.getElementById('defThreads').value = s.threads;
        if(s.mode) document.getElementById('defMode').value = s.mode;
        if(s.limit) document.getElementById('defLimit').value = s.limit;
        
        applySettings(s);
    }
}

function applySettings(s) {
    // Apply to Main UI
    if(s.threads) {
        document.getElementById('batchThreads').value = s.threads;
        document.getElementById('channelThreads').value = s.threads;
    }
    if(s.mode) {
        document.getElementById('userMode').value = s.mode;
        toggleUserMode(); // Update visibility
    }
    if(s.limit) document.getElementById('limitUser').value = s.limit;
}

// Init
loadSettings();
