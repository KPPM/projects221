// ==========================================
// 1. ระบบ Dark / Light Mode
// ==========================================
(function applyInitialTheme() {
    try {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            document.documentElement.classList.add('dark-mode');
            if (document.body) document.body.classList.add('dark-mode');
        }
    } catch (_) {}
})();

document.addEventListener('DOMContentLoaded', () => {
    try {
        if (localStorage.getItem('theme') === 'dark') {
            document.body.classList.add('dark-mode');
        }
    } catch (_) {}

    const setupThemeButton = () => {
        let themeBtn = document.getElementById('darkModeToggle');
        if (!themeBtn) {
            const headerRight = document.querySelector('.header-right');
            if (headerRight) {
                themeBtn = document.createElement('button');
                themeBtn.id = 'darkModeToggle';
                themeBtn.className = 'theme-toggle-btn';
                themeBtn.setAttribute('title', 'สลับโหมดสว่าง/มืด');
                headerRight.prepend(themeBtn);
            }
        }
        if (themeBtn) {
            const isDark = document.body.classList.contains('dark-mode');
            themeBtn.innerHTML = isDark ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
        }
    };

    setupThemeButton();

    document.addEventListener('click', (e) => {
        const btn = e.target.closest('#darkModeToggle');
        if (btn) {
            document.body.classList.toggle('dark-mode');
            document.documentElement.classList.toggle('dark-mode');
            const isDarkNow = document.body.classList.contains('dark-mode');
            try { localStorage.setItem('theme', isDarkNow ? 'dark' : 'light'); } catch (_) {}
            btn.innerHTML = isDarkNow ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
        }
    });

    // ==========================================
    // ฟังก์ชันแจ้งเตือน Toast บนหน้าเว็บ (ไม่บล็อกหน้าจอ)
    // ==========================================
    function showToast(message, icon = 'fa-circle-check') {
        const existing = document.querySelector('.toast-notification');
        if (existing) existing.remove();
        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.innerHTML = `<i class="fa-solid ${icon}" style="color: var(--primary-red); font-size: 16px;"></i><span>${escapeHTML(message)}</span>`;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            setTimeout(() => toast.remove(), 300);
        }, 3200);
    }

    // ==========================================
    // 2. ตั้งค่า Supabase Client
    // ==========================================
    const SUPABASE_URL = 'https://lcmqqovjgdkcbwyxxfwa.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_ljqn7Kr_anpQJ2k7PvHSig_zRSS5o-8';
    let supabaseClient;

    if (typeof supabase !== 'undefined') {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }

    // ==========================================
    // ฟังก์ชันช่วยดึงข้อมูล Google Account จาก Supabase User
    // (S2-03: ดึงรูปและชื่อจาก Google Account)
    // ==========================================
    function extractGoogleUserProfile(user) {
        if (!user) return null;
        const meta = user.user_metadata || {};
        const googleIdentity = Array.isArray(user.identities)
            ? (user.identities.find(id => id.provider === 'google') || user.identities[0])
            : null;
        const idData = (googleIdentity && googleIdentity.identity_data) || {};

        const fullName = meta.full_name || meta.name || idData.full_name || idData.name || (user.email ? user.email.split('@')[0] : 'นักศึกษา มธ.');
        const avatarUrl = meta.avatar_url || meta.picture || idData.avatar_url || idData.picture || null;
        const username = meta.username || (user.email ? user.email.split('@')[0] : 'tu_student');
        const faculty = meta.faculty || '';
        const email = user.email || '';
        const provider = (googleIdentity && googleIdentity.provider) || (user.app_metadata && user.app_metadata.provider) || 'google';

        return {
            id: user.id,
            fullName,
            avatarUrl,
            username,
            faculty,
            email,
            provider
        };
    }

    // ==========================================
    // 3. ฟังก์ชันสลับปุ่ม เข้าสู่ระบบ / ออกจากระบบ บน Navbar
    // ==========================================
    async function checkGlobalAuthNavbar() {
        if (!supabaseClient) {
            updateGlobalNotificationBell(null);
            return;
        }
        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            const user = session && session.user;
            updateGlobalNotificationBell(user);

            const loginBtns = document.querySelectorAll('.header-right a[href="login.html"], .header-right #global-logout-btn');
            loginBtns.forEach(btn => {
                if (user) {
                    btn.textContent = 'ออกจากระบบ';
                    btn.href = '#';
                    btn.id = 'global-logout-btn';
                    btn.onclick = async (e) => {
                        e.preventDefault();
                        await supabaseClient.auth.signOut();
                        window.location.href = 'login.html';
                    };
                }
            });

            // แสดงรูปโปรไฟล์ Google บนไอคอนโปรไฟล์ Navbar หากมี
            if (user) {
                const googleProfile = extractGoogleUserProfile(user);
                const navProfileLinks = document.querySelectorAll('.header-right a[href="profile.html"]');
                navProfileLinks.forEach(link => {
                    if (googleProfile && googleProfile.avatarUrl) {
                        link.title = `${googleProfile.fullName} (${googleProfile.email})`;
                        link.innerHTML = `<img src="${googleProfile.avatarUrl}" alt="${googleProfile.fullName}" referrerpolicy="no-referrer" style="width:28px; height:28px; border-radius:50%; object-fit:cover; border:2px solid var(--primary-red); vertical-align:middle;" onerror="this.outerHTML='<i class=\\'fa-regular fa-user icon-btn\\'></i>'">`;
                    }
                });
            }
        } catch (err) {
            console.log('Navbar Auth Check:', err);
            updateGlobalNotificationBell(null);
        }
    }

    checkGlobalAuthNavbar();

    // ==========================================
    // 4. Shared display helpers (database data is the only restaurant source)
    // ==========================================

    function cleanTextValue(val) {
        if (val === null || val === undefined) return '';
        let s = String(val).trim();
        s = s.replace(/^"+|"+$/g, '').replace(/"""/g, '').trim();
        if (s === '·' || s === '.' || s === '0' || s === '[merged]' || s === 'เปิดอยู่') return '';
        return s;
    }

    function escapeHTML(value) {
        return String(value ?? '').replace(/[&<>"']/g, character => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[character]);
    }

    const bangkokClock = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    });

    function normalizeStoreTime(value) {
        const match = cleanTextValue(value).match(/^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/);
        return match ? `${match[1].padStart(2, '0')}:${match[2]}` : '';
    }

    function getStoreHours(place) {
        const opens = normalizeStoreTime(place.open || place.open_time || place.opening_time);
        const closes = normalizeStoreTime(place.close || place.close_time || place.closing_time);
        const times = [opens ? `เปิด ${opens}` : 'ไม่ทราบเวลาเปิด', closes ? `ปิด ${closes}` : 'ไม่ทราบเวลาปิด'];
        return {
            opens, closes,
            label: opens || closes
                ? times.join(' · ')
                : cleanTextValue(place.open_close || place['open-close']) || 'ยังไม่มีข้อมูลเวลา'
        };
    }

    function getLiveStoreStatus(place, now = new Date()) {
        const declaredStatus = String(place.status ?? '').trim();
        if (/ปิดถาวร|ปิดไปแล้ว|permanently closed/i.test(place.name || '')
            || /^(ปิด|ปิดอยู่|ปิดแล้ว|ปิดถาวร|closed|permanently closed)$/i.test(declaredStatus)) return false;
        if (/^(เปิด|เปิดอยู่|open)$/i.test(declaredStatus)) return true;
        const { opens, closes } = getStoreHours(place);
        if (opens && closes && opens !== closes) {
            const currentTime = bangkokClock.format(now);
            return closes > opens ? currentTime >= opens && currentTime < closes
                : currentTime >= opens || currentTime < closes;
        }
        return typeof place.is_open === 'boolean' ? place.is_open : null;
    }

    function httpUrl(value) {
        const candidate = cleanTextValue(value);
        return /^https?:\/\//i.test(candidate) ? candidate : '';
    }

    function getPlaceImage(place) {
        return [place.image_url, place.image, place.photo_url, place['รูป']]
            .map(httpUrl)
            .find(url => url && !/default_user\.png|(?:instagram|tiktok|facebook)\.com\/|wongnai\.com\/restaurants\//i.test(url)) || '';
    }

    function placeImageHTML(url, alt) {
        const placeholder = '<span class="place-image-missing"';
        if (!url) return `${placeholder}>ยังไม่มีรูปภาพ</span>`;
        return `<img src="${escapeHTML(url)}" alt="${escapeHTML(alt)}" loading="lazy" referrerpolicy="no-referrer"
            onerror="this.hidden=true; this.nextElementSibling.hidden=false;">${placeholder} hidden>โหลดรูปภาพไม่ได้</span>`;
    }

    function setPlaceImage(image, url, alt, mapsUrl = '') {
        if (!image) return;
        let placeholder = image.nextElementSibling;
        if (!placeholder?.classList.contains('place-image-missing')) {
            placeholder = document.createElement('span');
            placeholder.className = 'place-image-missing';
            image.insertAdjacentElement('afterend', placeholder);
        }
        image.alt = alt || 'รูปสถานที่';
        image.hidden = !url;
        placeholder.hidden = Boolean(url);
        const message = url ? 'โหลดรูปภาพไม่ได้' : 'ยังไม่มีรูปภาพ';
        if (mapsUrl) {
            const description = document.createElement('span');
            description.textContent = message;
            const source = document.createElement('a');
            source.href = mapsUrl;
            source.target = '_blank';
            source.rel = 'noopener noreferrer';
            source.textContent = 'ดูรูปและข้อมูลร้านบน Google Maps';
            placeholder.replaceChildren(description, source);
        } else {
            placeholder.textContent = message;
        }
        image.onerror = () => {
            image.hidden = true;
            placeholder.hidden = false;
        };
        if (url) image.src = url;
        else image.removeAttribute('src');
    }

    // คำนวณสัญลักษณ์ช่วงราคา ($ / $$ / $$$) และข้อความช่วงราคาบาท (S2-01)
    function getPlacePriceTiers(priceText) {
        if (!priceText) return ['$$'];
        const str = String(priceText).replace(/,/g, '').trim();
        if (str === '$$$') return ['$$$'];
        if (str === '$$') return ['$$'];
        if (str === '$') return ['$'];

        const nums = str.match(/\d+/g);
        if (nums && nums.length > 0) {
            const numbers = nums.map(Number);
            const minPrice = Math.min(...numbers);
            const maxPrice = Math.max(...numbers);
            const avgPrice = (minPrice + maxPrice) / 2;
            if (avgPrice <= 100 && maxPrice <= 120) return ['$'];
            if (avgPrice <= 220 && maxPrice <= 300) return ['$$'];
            return ['$$$'];
        }
        return ['$$'];
    }

    function getPriceDisplayInfo(place) {
        const validPrice = value => /^(?:[$]{1,3}|฿?\s*\d[\d,]*(?:\s*[-–]\s*฿?\s*\d[\d,]*)?\s*\+?\s*(?:บาท)?)$/.test(value);
        const value = [place.price_range, place.price].map(cleanTextValue).find(validPrice);
        return {
            symbol: value ? getPlacePriceTiers(value)[0] : '',
            fullLabel: value || 'ยังไม่มีข้อมูลราคา'
        };
    }

    function getPlacePhone(place) {
        return cleanTextValue(place.phone || place.phone_number || place.tel) || 'ยังไม่มีข้อมูลเบอร์โทรศัพท์';
    }

    function getPlaceAddress(place) {
        return cleanTextValue(place.address || place.location) || 'ยังไม่มีข้อมูลที่อยู่';
    }

    function getPlaceRecommendedMenus(place) {
        if (!Array.isArray(place.popular_menus)) return [];
        return place.popular_menus.map(item => typeof item === 'string' ? { name: item } : item)
            .filter(item => item && typeof item.name === 'string' && item.name.trim());
    }

    function getPlaceSummaryText(place) {
        const snippet = cleanTextValue(place.review_snippet);
        const comment = cleanTextValue(place.review_comment);
        const features = cleanTextValue(place.features);

        const parts = [snippet, features, comment].filter(
            p => p && !/^฿\d+/.test(p) && p !== 'ร้าน' && p !== 'กาแฟ' && p !== 'คาเฟ่'
        );
        if (parts.length > 0) {
            return parts.join(' • ').replace(/\s+/g, ' ').trim();
        }
        return 'ยังไม่มีข้อมูลรายละเอียดร้าน';
    }

    function getEffectivePlaceRatingAndCount(place) {
        const rating = String(place.rating ?? '').trim();
        const count = String(place.review_count ?? '').trim().replace(/,/g, '');
        return {
            rating: rating && Number.isFinite(Number(rating)) && Number(rating) >= 0 && Number(rating) <= 5 ? Number(rating) : null,
            reviewCount: /^\d+$/.test(count) ? Number(count) : null
        };
    }

    function placeRatingText(rating, reviewCount) {
        if (rating === null) return reviewCount === null ? 'ยังไม่มีข้อมูลคะแนน' : `ยังไม่มีข้อมูลคะแนน (${reviewCount} รีวิว)`;
        return `★ ${rating}${reviewCount === null ? '' : ` (${reviewCount} รีวิว)`}`;
    }

    // ==========================================
    // 5. ระบบ บันทึกร้านค้า (Bookmarks / Saved Places)
    // ==========================================
    const getSavedPlaces = () => {
        try {
            return JSON.parse(localStorage.getItem('saved_places_ids')) || [];
        } catch (_) {
            return [];
        }
    };

    const toggleSavePlace = (placeId) => {
        let saved = getSavedPlaces();
        const strId = String(placeId);
        if (saved.includes(strId)) {
            saved = saved.filter(id => id !== strId);
        } else {
            saved.push(strId);
        }
        try { localStorage.setItem('saved_places_ids', JSON.stringify(saved)); } catch (_) {}
        return saved.includes(strId);
    };

    // ==========================================
    // ระบบบันทึกประวัติการสุ่มร้านค้าย้อนหลัง (S2-03)
    // ==========================================
    const RANDOM_HISTORY_KEY = 'tu_aroi_random_history';

    const getRandomHistory = () => {
        try {
            const raw = localStorage.getItem(RANDOM_HISTORY_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch (_) {
            return [];
        }
    };

    const addRandomHistory = async (place) => {
        if (!place || !place.id) return;
        const entry = { id: place.id, randomized_at: new Date().toISOString() };

        let history = getRandomHistory();
        // ลบรายการซ้ำของร้านเดิมก่อนแทรกไว้บนสุดเพื่อแสดงเวลาสุ่มล่าสุด
        history = history.filter(item => String(item.id) !== String(place.id));
        history.unshift(entry);
        history = history.slice(0, 20);

        try {
            localStorage.setItem(RANDOM_HISTORY_KEY, JSON.stringify(history));
        } catch (_) {}

        // ซิงค์ประวัติการสุ่มขึ้น Supabase user_metadata หากผู้ใช้ล็อกอินอยู่
        if (supabaseClient) {
            try {
                const { data: { session } } = await supabaseClient.auth.getSession();
                if (session && session.user) {
                    await supabaseClient.auth.updateUser({
                        data: { random_history: history.slice(0, 10) }
                    });
                }
            } catch (_) {}
        }

        // อัปเดตตัวเลขประวัติในหน้า random.html หรือ profile.html ทันที
        const randomPageCount = document.getElementById('random-page-history-count');
        if (randomPageCount) randomPageCount.textContent = history.length;
    };

    const clearRandomHistory = async () => {
        try { localStorage.removeItem(RANDOM_HISTORY_KEY); } catch (_) {}
        if (supabaseClient) {
            try {
                const { data: { session } } = await supabaseClient.auth.getSession();
                if (session && session.user) {
                    await supabaseClient.auth.updateUser({ data: { random_history: [] } });
                }
            } catch (_) {}
        }
    };

    // ==========================================
    // 5.1 Global authenticated notification bell
    // ==========================================
    function updateGlobalNotificationBell(user) {
        const headerRight = document.querySelector('.header-right');
        const existingBell = headerRight && headerRight.querySelector('.notification-bell-wrap');

        if (!user || !headerRight) {
            if (existingBell) existingBell.remove();
            return;
        }
        if (existingBell) return;

        const bellWrap = document.createElement('div');
        bellWrap.className = 'notification-bell-wrap';
        bellWrap.innerHTML = `
            <button class="notification-bell icon-btn" type="button" aria-label="การแจ้งเตือน" aria-expanded="false">
                <i class="fa-regular fa-bell" aria-hidden="true"></i>
            </button>
            <section class="notification-dropdown" aria-label="การแจ้งเตือนล่าสุด" hidden>
                <div class="notification-dropdown-header"><span>การแจ้งเตือน</span><i class="fa-regular fa-bell" aria-hidden="true"></i></div>
                <div class="notification-list" aria-live="polite"></div>
            </section>`;

        const themeButton = headerRight.querySelector('#darkModeToggle');
        if (themeButton) themeButton.insertAdjacentElement('afterend', bellWrap);
        else headerRight.prepend(bellWrap);

        const notificationBell = bellWrap.querySelector('.notification-bell');
        const notificationDropdown = bellWrap.querySelector('.notification-dropdown');
        const notificationList = bellWrap.querySelector('.notification-list');

        const renderEmpty = () => {
            notificationList.replaceChildren();
            const empty = document.createElement('div');
            empty.className = 'notification-empty';
            empty.textContent = 'ไม่มีการแจ้งเตือนใดๆ';
            notificationList.appendChild(empty);
        };

        const appendNotification = ({ message, timestamp, icon = 'fa-store' }) => {
            const item = document.createElement('article');
            item.className = 'notification-item';
            const iconContainer = document.createElement('span');
            iconContainer.className = 'notification-item-icon';
            iconContainer.innerHTML = `<i class="fa-solid ${icon}" aria-hidden="true"></i>`;
            const content = document.createElement('div');
            const text = document.createElement('p');
            text.textContent = message;
            content.appendChild(text);
            if (timestamp) {
                const date = new Date(timestamp);
                if (!Number.isNaN(date.getTime())) {
                    const time = document.createElement('small');
                    time.textContent = date.toLocaleString('th-TH');
                    content.appendChild(time);
                }
            }
            item.append(iconContainer, content);
            notificationList.appendChild(item);
        };

        const readActivityNotifications = () => {
            try {
                const notices = JSON.parse(localStorage.getItem('tu_aroi_activity_notifications') || '[]');
                return Array.isArray(notices) ? notices : [];
            } catch (_) {
                return [];
            }
        };

        const renderNotifications = async () => {
            const activityNotices = readActivityNotifications()
                .filter(notice => !notice.user_id || notice.user_id === user.id)
                .slice(0, 5);
            const savedIds = getSavedPlaces();
            let savedPlaces = [];
            if (savedIds.length && supabaseClient) {
                try {
                    const { data, error } = await supabaseClient.from('places').select('*').in('id', savedIds);
                    if (!error && data) savedPlaces = data;
                } catch (error) {
                    console.warn('Notification fetch error:', error);
                }
            }
            const savedPlaceUpdates = savedPlaces
                .filter(place => place.discount || place.updated_at)
                .slice(0, 5)
                .map(place => ({
                    message: place.discount
                        ? `${place.name || 'ร้านที่บันทึกไว้'}: ${place.discount}`
                        : `${place.name || 'ร้านที่บันทึกไว้'} มีข้อมูลอัปเดตล่าสุด`,
                    timestamp: place.updated_at,
                    icon: 'fa-store'
                }));
            const activityUpdates = activityNotices.map(notice => ({
                message: notice.message || notice.title || 'มีกิจกรรมใหม่สำหรับคุณ',
                timestamp: notice.updated_at || notice.created_at || notice.date,
                icon: 'fa-calendar-day'
            }));
            const updates = [...activityUpdates, ...savedPlaceUpdates].slice(0, 5);

            if (!updates.length) {
                renderEmpty();
                return;
            }
            notificationList.replaceChildren();
            updates.forEach(appendNotification);
        };

        const setOpen = (isOpen) => {
            notificationDropdown.hidden = !isOpen;
            notificationBell.setAttribute('aria-expanded', String(isOpen));
        };

        notificationBell.addEventListener('click', async event => {
            event.stopPropagation();
            const willOpen = notificationDropdown.hidden;
            setOpen(willOpen);
            if (willOpen) await renderNotifications();
        });
        document.addEventListener('click', event => {
            if (!notificationDropdown.hidden && !event.target.closest('.notification-bell-wrap')) setOpen(false);
        });
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') setOpen(false);
        });
    }

    // ==========================================
    // สร้าง HTML การ์ดร้านค้า (S2-01: เพิ่มความละเอียดเมนูแนะนำ, ช่วงราคา $/$$/$$$, เบอร์โทร และที่อยู่)
    // ==========================================
    function createCardHTML(place, extraMeta = {}) {
        const savedPlaces = getSavedPlaces();
        const isSaved = savedPlaces.includes(String(place.id));
        const heartClass = isSaved ? 'fa-solid fa-heart saved' : 'fa-regular fa-heart';
        const badgeDiscountHTML = place.discount ? `<span class="badge badge-discount">${escapeHTML(place.discount)}</span>` : '';

        const priceInfo = getPriceDisplayInfo(place);
        const { rating, reviewCount } = getEffectivePlaceRatingAndCount(place);
        const imgUrl = getPlaceImage(place);
        const openStatus = place.currently_open ?? getLiveStoreStatus(place);
        const hoursLabel = escapeHTML(getStoreHours(place).label);
        const addressText = getPlaceAddress(place);
        const phoneText = getPlacePhone(place);
        const menus = getPlaceRecommendedMenus(place);
        const topMenuNames = menus.slice(0, 2).map(m => m.name).join(', ') || 'ยังไม่มีข้อมูลเมนู';

        const historyBadgeHTML = extraMeta.randomizedAt
            ? `<div class="history-time-badge"><i class="fa-solid fa-dice" style="color: var(--primary-red);"></i> สุ่มเมื่อ: ${new Date(extraMeta.randomizedAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}</div>`
            : '';

        return `
            <div class="card-link" style="position: relative;">
                <button class="bookmark-btn" data-id="${place.id}" title="บันทึกร้านนี้" style="position: absolute; top: 10px; right: 10px; z-index: 10; background: rgba(255,255,255,0.9); border: none; border-radius: 50%; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; cursor: pointer; backdrop-filter: blur(4px); transition: all 0.2s;">
                    <i class="${heartClass}" style="color: ${isSaved ? '#e63946' : '#666'}; font-size: 16px;"></i>
                </button>
                <a href="detail.html?id=${place.id}" style="text-decoration: none; color: inherit;">
                    <div class="card">
                        <div class="card-image">
                            ${placeImageHTML(imgUrl, place.name)}
                            <span class="badge badge-rating">${placeRatingText(rating, reviewCount)}</span>
                            ${badgeDiscountHTML}
                        </div>
                        <div class="card-info">
                            ${historyBadgeHTML}
                            <div class="card-info-header">
                                <h3 style="margin-bottom: 2px;">${escapeHTML(place.name || 'ยังไม่มีข้อมูลชื่อร้าน')}</h3>
                            </div>
                            <span class="store-status ${openStatus === null ? '' : openStatus ? 'is-open' : 'is-closed'}">${openStatus === null ? 'ยังไม่ทราบสถานะ' : openStatus ? 'Open Now' : 'Closed'}</span>
                            <p class="desc" style="margin-bottom: 6px;">${escapeHTML(place.category || 'ยังไม่มีข้อมูลหมวดหมู่')}</p>
                            
                            <div class="card-meta-list">
                                <div class="card-meta-item" title="เมนูแนะนำ: ${escapeHTML(topMenuNames)}">
                                    <i class="fa-solid fa-utensils"></i>
                                    <span><strong>เมนูแนะนำ:</strong> ${escapeHTML(topMenuNames)}</span>
                                </div>
                                <div class="card-meta-item" title="เบอร์โทรศัพท์: ${escapeHTML(phoneText)}">
                                    <i class="fa-solid fa-phone"></i>
                                    <span>${escapeHTML(phoneText)}</span>
                                </div>
                                <div class="card-meta-item" title="ที่อยู่: ${escapeHTML(addressText)}">
                                    <i class="fa-solid fa-location-dot"></i>
                                    <span>${escapeHTML(addressText)}</span>
                                </div>
                            </div>

                            <div class="card-footer">
                                <span title="${hoursLabel}"><i class="fa-regular fa-clock"></i> ${hoursLabel}</span>
                                <span class="price">${escapeHTML(priceInfo.fullLabel)}</span>
                            </div>
                        </div>
                    </div>
                </a>
            </div>`;
    }

    document.addEventListener('click', (e) => {
        const bookmarkBtn = e.target.closest('.bookmark-btn');
        if (bookmarkBtn) {
            e.preventDefault();
            e.stopPropagation();
            const placeId = bookmarkBtn.getAttribute('data-id');
            const isNowSaved = toggleSavePlace(placeId);

            const icon = bookmarkBtn.querySelector('i');
            if (isNowSaved) {
                icon.className = 'fa-solid fa-heart saved';
                icon.style.color = '#e63946';
                showToast('บันทึกร้านค้าไว้ในรายการโปรดแล้ว', 'fa-heart');
            } else {
                icon.className = 'fa-regular fa-heart';
                icon.style.color = '#666';
                showToast('นำร้านค้าออกจากรายการโปรดแล้ว', 'fa-heart-crack');

                const savedContainer = document.getElementById('saved-cards-grid');
                if (savedContainer && savedContainer.contains(bookmarkBtn)) {
                    bookmarkBtn.closest('.card-link').remove();
                    const savedCountEl = document.getElementById('saved-count');
                    if (savedCountEl) savedCountEl.textContent = getSavedPlaces().length;
                    if (savedContainer.children.length === 0) {
                        savedContainer.innerHTML = '<p style="grid-column: span 3; text-align: center; color: var(--text-muted); padding: 40px 0;">ยังไม่มีรายการที่บันทึกไว้</p>';
                    }
                }
            }
        }
    });

    // ==========================================
    // ฟังก์ชันช่วยแยกพิกัด Lat/Lng จาก URL หรือที่อยู่ (รองรับทุกรูปแบบใน Supabase)
    // ==========================================
    function parseLatLngFromPlace(place) {
        const url = String(place.google_map || place['google map'] || '').replace(/%2C/gi, ',');
        const address = String(place.address || '');
        const pin = url.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
        const query = url.match(/(?:[?&](?:query|q)=)(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)(?=[&#]|$)/);
        const addressPoint = address.match(/\((-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\)/);
        const candidates = [[place.lat, place.lng], pin?.slice(1), query?.slice(1), addressPoint?.slice(1)];
        for (const pair of candidates) {
            if (!pair || pair.some(value => value == null || String(value).trim() === '')) continue;
            const [lat, lng] = pair.map(Number);
            if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
                return { lat, lng };
            }
        }
        return null;
    }

    // ==========================================
    // เชื่อมระบบค้นหาจากหน้าแรก (index.html -> search.html)
    // ==========================================
    const indexContainer = document.querySelector('.container h1');
    if (indexContainer && !document.querySelector('.card-grid')) {
        const homeInput = document.querySelector('.container input[type="text"]');
        const homeBtn = document.querySelector('.container .btn-primary-red');
        const goSearch = () => {
            const q = homeInput ? homeInput.value.trim() : '';
            window.location.href = q ? `search.html?q=${encodeURIComponent(q)}` : 'search.html';
        };
        if (homeBtn) homeBtn.addEventListener('click', goSearch);
        if (homeInput) homeInput.addEventListener('keydown', e => { if (e.key === 'Enter') goSearch(); });
    }

    // ==========================================
    // 6. ตัวกรองและการแสดงผลการ์ดร้านค้า (search.html)
    // ==========================================
    const cardGrid = document.querySelector('.card-grid');
    if (cardGrid && !document.getElementById('saved-cards-grid')) {
        let displayLimit = 6;
        let currentFilteredPlaces = [];
        let userLocation = null;

        const filterOpen = document.getElementById('filter-open');
        const filterDistance = document.getElementById('filter-distance');
        const filterRating = document.getElementById('filter-rating');
        const distanceStatus = document.getElementById('distance-filter-status');
        const filterCategory = document.getElementById('filter-category');
        const discoveryRandomButton = document.getElementById('discovery-random-btn');
        const discoveryRandomCard = document.getElementById('discovery-random-card');
        const discoveryRandomStage = document.getElementById('discovery-random-stage');
        const discoveryRandomStatus = document.getElementById('discovery-random-status');
        const discoveryCelebration = document.getElementById('discovery-celebration');
        let discoveryDrawDeck = [];
        let discoveryDeckSignature = '';
        let discoveryLastDrawKey = null;
        let isDiscoveryDrawing = false;

        const getDiscoveryCategory = (place) => String(place.category || '').trim();
        const getDiscoveryPlaceKey = (place) => String(place.id || place.name || '');

        const populateDiscoveryCategories = (places) => {
            if (!filterCategory) return;
            const currentValue = filterCategory.value;
            const categories = [...new Set(places.map(getDiscoveryCategory).filter(Boolean))]
                .sort((first, second) => first.localeCompare(second, 'th'));
            filterCategory.replaceChildren(new Option('ทุกประเภทร้าน', 'all'));
            categories.forEach((category) => filterCategory.add(new Option(category, category)));
            filterCategory.value = categories.includes(currentValue) ? currentValue : 'all';
            filterCategory.disabled = false;
        };

        const shuffleDiscoveryDeck = (places) => {
            const shuffled = [...places];
            for (let index = shuffled.length - 1; index > 0; index--) {
                const randomIndex = Math.floor(Math.random() * (index + 1));
                [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
            }
            return shuffled;
        };

        const prepareDiscoveryDeck = (places, signature) => {
            discoveryDrawDeck = shuffleDiscoveryDeck(places);
            if (discoveryDrawDeck.length > 1 && getDiscoveryPlaceKey(discoveryDrawDeck[discoveryDrawDeck.length - 1]) === discoveryLastDrawKey) {
                const swapIndex = Math.floor(Math.random() * (discoveryDrawDeck.length - 1));
                [discoveryDrawDeck[discoveryDrawDeck.length - 1], discoveryDrawDeck[swapIndex]] = [discoveryDrawDeck[swapIndex], discoveryDrawDeck[discoveryDrawDeck.length - 1]];
            }
            discoveryDeckSignature = signature;
        };

        const updateDiscoveryRandomizerAvailability = () => {
            if (!discoveryRandomButton || isDiscoveryDrawing) return;
            const hasChoices = currentFilteredPlaces.length > 0;
            discoveryRandomButton.disabled = !hasChoices;
            if (!hasChoices && discoveryRandomStatus) discoveryRandomStatus.textContent = 'ยังไม่มีร้านที่ตรงกับตัวกรองนี้';
        };

        // รองรับพารามิเตอร์ ?q= จากหน้าแรก
        const initParams = new URLSearchParams(window.location.search);
        const initialQ = initParams.get('q');
        if (initialQ) {
            document.querySelectorAll('.search-box input').forEach(inp => { inp.value = initialQ; });
        }

        const getHaversineDistance = (coords1, coords2) => {
            const toRad = x => (x * Math.PI) / 180;
            const R = 6371;
            const dLat = toRad(coords2.lat - coords1.lat);
            const dLon = toRad(coords2.lng - coords1.lng);
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(coords1.lat)) * Math.cos(toRad(coords2.lat)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
            return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        };

        const getUserLocation = () => {
            return new Promise((resolve) => {
                const TU_CENTER = { lat: 14.0722, lng: 100.6067 };
                if (!navigator.geolocation) {
                    userLocation = TU_CENTER;
                    if (distanceStatus) distanceStatus.textContent = '📍 อ้างอิงศูนย์กลาง มธ. (ไม่มี GPS)';
                    resolve(userLocation);
                    return;
                }
                if (distanceStatus) distanceStatus.textContent = 'กำลังระบุตำแหน่งของคุณ...';
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                        if (distanceStatus) distanceStatus.textContent = '📍 อ้างอิงตำแหน่งปัจจุบันของคุณ';
                        resolve(userLocation);
                    },
                    (err) => {
                        console.warn('Geolocation failed:', err);
                        userLocation = TU_CENTER;
                        if (distanceStatus) distanceStatus.textContent = '📍 อ้างอิงศูนย์กลาง มธ. (ไม่ได้เปิด GPS)';
                        resolve(userLocation);
                    },
                    { enableHighAccuracy: true, timeout: 4000, maximumAge: 60000 }
                );
            });
        };

        const getSelectedPriceTiers = () => Array.from(document.querySelectorAll('.price-btn-group .price-btn.active')).map(b => b.dataset.price || b.textContent.trim());

        const fetchFilteredPlaces = async () => {
            let searchQuery = '';
            document.querySelectorAll('.search-box input').forEach(input => {
                if (input.value.trim()) searchQuery = input.value.trim().toLowerCase();
            });

            const activeCatBtn = document.querySelector('.category-list .cat-btn.active');
            const catText = activeCatBtn ? activeCatBtn.textContent.trim() : 'ร้านทั้งหมด';

            const isOpenChecked = filterOpen && filterOpen.checked;
            const maxDistanceVal = filterDistance ? filterDistance.value : 'all';
            const isRatingChecked = filterRating && filterRating.checked;
            const selectedPriceTiers = getSelectedPriceTiers();

            const sortSelect = document.querySelector('.sort-dropdown select');
            const sortVal = sortSelect ? sortSelect.value : 'recommended';

            let rawPlaces = [];
            try {
                if (!supabaseClient) throw new Error('ไม่สามารถเชื่อมต่อฐานข้อมูลได้');
                const { data, error } = await supabaseClient.from('places').select('*');
                if (error) throw error;
                rawPlaces = Array.isArray(data) ? data : [];
            } catch (err) {
                console.error('Supabase fetch error:', err);
                currentFilteredPlaces = [];
                cardGrid.innerHTML = `<p class="data-state data-state-error">ไม่สามารถโหลดข้อมูลร้านค้าได้ กรุณาลองใหม่อีกครั้ง</p>`;
                const loadBtn = document.querySelector('.load-more-btn');
                if (loadBtn) loadBtn.style.display = 'none';
                if (discoveryRandomButton) discoveryRandomButton.disabled = true;
                if (discoveryRandomStatus) discoveryRandomStatus.textContent = 'ยังสุ่มร้านไม่ได้เนื่องจากโหลดข้อมูลไม่สำเร็จ';
                return;
            }

            rawPlaces = rawPlaces.map(place => {
                const coords = parseLatLngFromPlace(place);
                let computedDistance = place.distance_km;
                if (userLocation && coords) {
                    computedDistance = parseFloat(getHaversineDistance(userLocation, coords).toFixed(2));
                }
                const { rating, reviewCount } = getEffectivePlaceRatingAndCount(place);

                return {
                    ...place,
                    rating,
                    review_count: reviewCount,
                    computed_distance: Number.isFinite(computedDistance) ? computedDistance : null,
                    currently_open: getLiveStoreStatus(place)
                };
            });

            populateDiscoveryCategories(rawPlaces);
            const selectedDiscoveryCategory = filterCategory ? filterCategory.value : 'all';

            currentFilteredPlaces = rawPlaces.filter(place => {
                if (searchQuery) {
                    const matchName = place.name ? place.name.toLowerCase().includes(searchQuery) : false;
                    const matchCat = place.category ? place.category.toLowerCase().includes(searchQuery) : false;
                    const matchAddr = cleanTextValue(place.address || place.location).toLowerCase().includes(searchQuery);
                    const matchMenu = getPlaceRecommendedMenus(place).some(m => m.name.toLowerCase().includes(searchQuery));
                    if (!matchName && !matchCat && !matchAddr && !matchMenu) return false;
                }

                if (catText !== 'ร้านทั้งหมด' && !catText.includes('ร้านทั้งหมด')) {
                    const pCat = (place.category || '').toLowerCase();
                    const pName = (place.name || '').toLowerCase();
                    if (catText.includes('อาหาร') && !(pCat.includes('อาหาร') || pCat.includes('เครื่องดื่ม') || pCat.includes('คาเฟ่') || pCat.includes('บาร์'))) return false;
                    if (catText.includes('อ่านหนังสือ') && !(pCat.includes('อ่านหนังสือ') || pCat.includes('คาเฟ่'))) return false;
                    if (catText.includes('เกม') && !(pCat.includes('เกม') || pName.includes('board') || pName.includes('game'))) return false;
                }

                if (selectedDiscoveryCategory !== 'all' && getDiscoveryCategory(place) !== selectedDiscoveryCategory) return false;

                if (isOpenChecked && !place.currently_open) return false;

                if (maxDistanceVal !== 'all') {
                    const limit = parseFloat(maxDistanceVal);
                    if (place.computed_distance === null || place.computed_distance > limit) return false;
                }

                if (isRatingChecked && (place.rating === undefined || place.rating < 4.0)) return false;

                if (selectedPriceTiers.length > 0) {
                    const priceInfo = getPriceDisplayInfo(place);
                    if (!selectedPriceTiers.includes(priceInfo.symbol)) return false;
                }

                return true;
            });

            if (sortVal === 'rating' || sortVal === 'คะแนนสูงสุด') {
                currentFilteredPlaces.sort((a, b) => (b.rating || 0) - (a.rating || 0));
            } else if (sortVal === 'distance' || sortVal === 'ระยะทางใกล้ที่สุด') {
                currentFilteredPlaces.sort((a, b) => (a.computed_distance ?? Infinity) - (b.computed_distance ?? Infinity));
            } else {
                currentFilteredPlaces.sort((a, b) => Number(b.currently_open) - Number(a.currently_open));
            }

            const subtitleEl = document.getElementById('search-result-subtitle');
            if (subtitleEl) {
                subtitleEl.textContent = `พบร้านค้าและสถานที่รอบ มธ. รังสิต ทั้งหมด ${currentFilteredPlaces.length} แห่ง`;
            }

            renderPlaces();
            updateDiscoveryRandomizerAvailability();
        };

        function renderPlaces() {
            cardGrid.innerHTML = '';
            if (currentFilteredPlaces.length === 0) {
                cardGrid.innerHTML = '<p style="grid-column: span 3; text-align: center; color: var(--text-muted); padding: 40px 0;">ไม่พบร้านค้าที่ตรงกับเงื่อนไข</p>';
                const loadBtn = document.querySelector('.load-more-btn');
                if (loadBtn) loadBtn.style.display = 'none';
                return;
            }

            const placesToShow = currentFilteredPlaces.slice(0, displayLimit);
            placesToShow.forEach(place => {
                cardGrid.innerHTML += createCardHTML(place);
            });

            const loadBtn = document.querySelector('.load-more-btn');
            if (loadBtn) loadBtn.style.display = (displayLimit >= currentFilteredPlaces.length) ? 'none' : 'block';
        }

        const celebrateDiscoveryDraw = () => {
            if (!discoveryCelebration || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
            const colors = ['var(--accent-gold)', 'var(--primary-red)', 'var(--text-muted)'];
            const particles = Array.from({ length: 16 }, (_, index) => {
                const particle = document.createElement(index % 4 === 0 ? 'span' : 'i');
                const angle = (Math.PI * 2 * index) / 16;
                const distance = 46 + Math.random() * 82;
                particle.className = particle.tagName === 'SPAN' ? 'discovery-sparkle' : 'discovery-confetti';
                if (particle.tagName === 'SPAN') particle.textContent = '✦';
                else particle.style.setProperty('--particle-color', colors[index % colors.length]);
                particle.style.setProperty('--particle-x', `${Math.cos(angle) * distance}px`);
                particle.style.setProperty('--particle-y', `${Math.sin(angle) * distance}px`);
                particle.style.setProperty('--particle-rotation', `${Math.floor(Math.random() * 300 - 150)}deg`);
                discoveryCelebration.appendChild(particle);
                return particle;
            });
            window.setTimeout(() => particles.forEach((particle) => particle.remove()), 1000);
        };

        const drawDiscoveryPlace = () => {
            if (isDiscoveryDrawing || currentFilteredPlaces.length === 0) return;
            const signature = currentFilteredPlaces.map(getDiscoveryPlaceKey).sort().join('|');
            if (discoveryDeckSignature !== signature || discoveryDrawDeck.length === 0) prepareDiscoveryDeck(currentFilteredPlaces, signature);
            const selected = discoveryDrawDeck.pop();
            const priceInfo = getPriceDisplayInfo(selected);
            const { rating } = getEffectivePlaceRatingAndCount(selected);

            isDiscoveryDrawing = true;
            if (discoveryRandomButton) {
                discoveryRandomButton.disabled = true;
                discoveryRandomButton.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> กำลังสับไพ่...';
            }
            discoveryRandomCard?.classList.remove('is-flipped');
            discoveryRandomStage?.classList.add('is-shuffling');
            discoveryRandomCard?.classList.add('is-shuffling');
            if (discoveryRandomStatus) discoveryRandomStatus.textContent = 'กำลังสับไพ่จากร้านที่ตรงกับตัวกรอง...';

            window.setTimeout(() => {
                const image = document.getElementById('discovery-random-image');
                setPlaceImage(image, getPlaceImage(selected), selected.name);
                const title = document.getElementById('discovery-random-title');
                const meta = document.getElementById('discovery-random-meta');
                const link = document.getElementById('discovery-random-link');
                if (title) title.textContent = selected.name || 'ยังไม่มีข้อมูลชื่อร้าน';
                if (meta) meta.textContent = `${selected.category || 'ยังไม่มีข้อมูลหมวดหมู่'} · ${placeRatingText(rating, null)} · ${priceInfo.fullLabel}`;
                if (link) link.href = `detail.html?id=${selected.id}`;

                discoveryRandomStage?.classList.remove('is-shuffling');
                discoveryRandomCard?.classList.remove('is-shuffling');
                discoveryRandomCard?.classList.add('is-flipped', 'is-revealing');
                celebrateDiscoveryDraw();
                if (discoveryRandomStatus) discoveryRandomStatus.textContent = `วันนี้ลอง ${selected.name || 'ร้านนี้'} ดูไหม?`;
                window.setTimeout(() => discoveryRandomCard?.classList.remove('is-revealing'), 720);
                discoveryLastDrawKey = getDiscoveryPlaceKey(selected);
                isDiscoveryDrawing = false;
                if (discoveryRandomButton) discoveryRandomButton.innerHTML = '<i class="fa-solid fa-dice"></i> สุ่มร้านแนะนำอีกครั้ง';
                updateDiscoveryRandomizerAvailability();
            }, 900);
        };

        if (filterOpen) filterOpen.addEventListener('change', () => { displayLimit = 6; fetchFilteredPlaces(); });
        if (filterDistance) {
            filterDistance.addEventListener('change', async () => {
                if (!userLocation) await getUserLocation();
                displayLimit = 6;
                fetchFilteredPlaces();
            });
        }
        if (filterRating) filterRating.addEventListener('change', () => { displayLimit = 6; fetchFilteredPlaces(); });
        if (filterCategory) filterCategory.addEventListener('change', () => { displayLimit = 6; fetchFilteredPlaces(); });

        document.querySelectorAll('.category-list .cat-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.category-list .cat-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                displayLimit = 6;
                fetchFilteredPlaces();
            });
        });

        document.querySelectorAll('.price-btn-group .price-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const willBeActive = !btn.classList.contains('active');
                btn.classList.toggle('active', willBeActive);
                btn.setAttribute('aria-pressed', String(willBeActive));
                displayLimit = 6;
                fetchFilteredPlaces();
            });
        });

        document.querySelectorAll('.search-box input').forEach(input => {
            input.addEventListener('input', (e) => {
                const val = e.target.value;
                document.querySelectorAll('.search-box input').forEach(other => {
                    if (other !== e.target) other.value = val;
                });
                displayLimit = 6;
                fetchFilteredPlaces();
            });
        });

        const sortSelect = document.querySelector('.sort-dropdown select');
        if (sortSelect) {
            sortSelect.addEventListener('change', async () => {
                if (sortSelect.value === 'distance' && !userLocation) await getUserLocation();
                displayLimit = 6;
                fetchFilteredPlaces();
            });
        }

        const resetBtn = document.querySelector('.reset-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                document.querySelectorAll('.category-list .cat-btn').forEach((b, idx) => {
                    if (idx === 0) b.classList.add('active');
                    else b.classList.remove('active');
                });
                if (filterOpen) filterOpen.checked = false;
                if (filterDistance) filterDistance.value = 'all';
                if (filterRating) filterRating.checked = false;
                if (filterCategory) filterCategory.value = 'all';
                if (distanceStatus) distanceStatus.textContent = '';
                document.querySelectorAll('.price-btn-group .price-btn').forEach(b => {
                    b.classList.remove('active');
                    b.setAttribute('aria-pressed', 'false');
                });
                document.querySelectorAll('.search-box input').forEach(input => input.value = '');
                if (sortSelect) sortSelect.value = 'recommended';
                displayLimit = 6;
                fetchFilteredPlaces();
            });
        }

        const loadBtn = document.querySelector('.load-more-btn');
        if (loadBtn) loadBtn.addEventListener('click', () => { displayLimit += 6; renderPlaces(); });

        if (discoveryRandomButton) discoveryRandomButton.addEventListener('click', drawDiscoveryPlace);
        if (discoveryRandomCard) {
            discoveryRandomCard.addEventListener('click', (event) => {
                if (!event.target.closest('#discovery-random-link')) drawDiscoveryPlace();
            });
            discoveryRandomCard.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    drawDiscoveryPlace();
                }
            });
        }

        getUserLocation().then(() => fetchFilteredPlaces());

        // Refresh at every minute boundary to keep cards, filters, and ordering
        // current without a full page refresh.
        const scheduleStoreStatusRefresh = () => {
            const millisecondsToNextMinute = 60000 - (Date.now() % 60000) + 20;
            setTimeout(() => {
                fetchFilteredPlaces();
                setInterval(fetchFilteredPlaces, 60000);
            }, millisecondsToNextMinute);
        };
        scheduleStoreStatusRefresh();
    }

    // ==========================================
    // 7. จัดการข้อมูลโปรไฟล์, Google Account, และประวัติการสุ่ม (profile.html - S2-03)
    // ==========================================
    const savedCardsGrid = document.getElementById('saved-cards-grid');
    if (savedCardsGrid) {
        const loadSavedPlaces = async () => {
            const savedIds = getSavedPlaces();
            const savedCountEl = document.getElementById('saved-count');
            if (savedCountEl) savedCountEl.textContent = savedIds.length;

            if (savedIds.length === 0) {
                savedCardsGrid.innerHTML = '<p style="grid-column: span 3; text-align: center; color: var(--text-muted); padding: 40px 0;">ยังไม่มีรายการที่บันทึกไว้</p>';
                return;
            }

            let savedPlacesData = [];
            try {
                if (!supabaseClient) throw new Error('ไม่สามารถเชื่อมต่อฐานข้อมูลได้');
                const { data, error } = await supabaseClient.from('places').select('*').in('id', savedIds);
                if (error) throw error;
                savedPlacesData = Array.isArray(data) ? data : [];
            } catch (err) {
                console.error('Saved places fetch error:', err);
                savedCardsGrid.innerHTML = '<p class="data-state data-state-error">ไม่สามารถโหลดรายการที่บันทึกไว้ได้ กรุณาลองใหม่อีกครั้ง</p>';
                return;
            }

            savedCardsGrid.innerHTML = '';
            if (savedPlacesData.length === 0) {
                savedCardsGrid.innerHTML = '<p style="grid-column: span 3; text-align: center; color: var(--text-muted); padding: 40px 0;">ยังไม่มีรายการที่บันทึกไว้</p>';
                return;
            }
            savedPlacesData.forEach(place => { savedCardsGrid.innerHTML += createCardHTML(place); });
        };
        loadSavedPlaces();
    }

    // S2-03: แสดงประวัติการสุ่มร้านค้าย้อนหลังในหน้า profile.html
    const randomHistoryGrid = document.getElementById('random-history-grid');
    const randomHistoryCountEl = document.getElementById('random-history-count');
    const clearRandomHistoryBtn = document.getElementById('clear-random-history-btn');

    let historyRequest = 0;
    const renderRandomHistorySection = async () => {
        if (!randomHistoryGrid) return;
        const request = ++historyRequest;
        const history = getRandomHistory();
        if (randomHistoryCountEl) randomHistoryCountEl.textContent = history.length;

        if (history.length === 0) {
            randomHistoryGrid.innerHTML = '<p style="grid-column: span 3; text-align: center; color: var(--text-muted); padding: 36px 0;">ยังไม่มีประวัติการสุ่มร้านค้า ลองไปเปิดไพ่สุ่มร้านที่หน้า <a href="random.html" style="color: var(--primary-red); font-weight: bold; text-decoration: underline;">สุ่มดวง</a> กันเลย!</p>';
            return;
        }

        randomHistoryGrid.innerHTML = '<p class="data-state">กำลังโหลดประวัติ...</p>';
        try {
            if (!supabaseClient) throw new Error('Supabase unavailable');
            const { data, error } = await supabaseClient.from('places').select('*').in('id', history.map(item => item.id));
            if (error) throw error;
            if (request !== historyRequest) return;
            const places = new Map((data || []).map(place => [String(place.id), place]));
            const cards = history.map(item => {
                const place = places.get(String(item.id));
                return place ? createCardHTML(place, { randomizedAt: item.randomized_at }) : '';
            }).join('');
            randomHistoryGrid.innerHTML = cards || '<p class="data-state">ไม่พบร้านในประวัติที่ยังแสดงได้</p>';
        } catch (error) {
            if (request === historyRequest) {
                randomHistoryGrid.innerHTML = '<p class="data-state data-state-error">โหลดประวัติร้านจากฐานข้อมูลไม่ได้</p>';
            }
        }
    };

    if (randomHistoryGrid) {
        renderRandomHistorySection();
    }

    if (clearRandomHistoryBtn) {
        clearRandomHistoryBtn.addEventListener('click', async () => {
            await clearRandomHistory();
            renderRandomHistorySection();
            showToast('ล้างประวัติการสุ่มร้านค้าเรียบร้อยแล้ว', 'fa-trash-can');
        });
    }

    const editProfileForm = document.getElementById('edit-profile-form');
    const unauthView = document.getElementById('unauthenticated-view');
    const authView = document.getElementById('authenticated-view');
    const profileAvatarEl = document.getElementById('profile-avatar');
    const profileDisplayNameEl = document.getElementById('profile-display-name');
    const profileGoogleStatusEl = document.getElementById('profile-google-status');
    const profileEmailDisplay = document.getElementById('profile-email-display');
    const editFullnameInput = document.getElementById('edit-fullname');
    const editUsernameInput = document.getElementById('edit-username');
    const editFacultyInput = document.getElementById('edit-faculty');
    const avatarContainer = document.getElementById('avatar-container');
    const avatarFileInput = document.getElementById('avatar-file-input');
    const logoutBtn = document.getElementById('logout-btn');
    let selectedAvatarFile = null;

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (supabaseClient) {
                try { await supabaseClient.auth.signOut(); } catch (_) {}
            }
            window.location.href = 'login.html';
        });
    }

    if (avatarContainer && avatarFileInput) {
        avatarContainer.addEventListener('click', () => avatarFileInput.click());
        avatarFileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                const file = e.target.files[0];
                if (file.size > 5 * 1024 * 1024) {
                    showToast('ขนาดไฟล์ต้องไม่เกิน 5MB ครับ', 'fa-triangle-exclamation');
                    return;
                }
                selectedAvatarFile = file;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    if (profileAvatarEl) {
                        profileAvatarEl.innerHTML = `<img src="${ev.target.result}" alt="Avatar" style="width:100%; height:100%; object-fit:cover;">`;
                    }
                };
                reader.readAsDataURL(selectedAvatarFile);
            }
        });
    }

    // S2-03: ดึงรูปและชื่อจาก Google Account มาแสดงใน Profile
    if (authView && typeof supabaseClient !== 'undefined' && supabaseClient) {
        supabaseClient.auth.getSession().then(({ data: { session } }) => {
            if (!session || !session.user) {
                if (unauthView) unauthView.style.display = 'block';
                authView.style.display = 'flex';
                // กรณีทดสอบโดยยังไม่ได้ล็อกอิน แสดงข้อมูลที่เคยบันทึกในเครื่อง (ถ้ามี)
                try {
                    const localProfile = JSON.parse(localStorage.getItem('tu_aroi_local_profile') || 'null');
                    if (localProfile) {
                        if (editFullnameInput) editFullnameInput.value = localProfile.full_name || '';
                        if (editUsernameInput) editUsernameInput.value = localProfile.username || '';
                        if (editFacultyInput) editFacultyInput.value = localProfile.faculty || '';
                        if (profileDisplayNameEl && localProfile.full_name) profileDisplayNameEl.textContent = localProfile.full_name;
                        if (profileAvatarEl && localProfile.avatar_url) {
                            profileAvatarEl.innerHTML = `<img src="${localProfile.avatar_url}" alt="${localProfile.full_name}" referrerpolicy="no-referrer" style="width:100%; height:100%; object-fit:cover;">`;
                        }
                    }
                } catch (_) {}
            } else {
                if (unauthView) unauthView.style.display = 'none';
                authView.style.display = 'flex';
                const googleProfile = extractGoogleUserProfile(session.user);

                if (profileDisplayNameEl) profileDisplayNameEl.textContent = googleProfile.fullName;
                if (profileGoogleStatusEl) profileGoogleStatusEl.textContent = `เชื่อมต่อกับ Google Account (${googleProfile.email})`;
                if (editFullnameInput) editFullnameInput.value = googleProfile.fullName;
                if (editUsernameInput) editUsernameInput.value = googleProfile.username;
                if (editFacultyInput) editFacultyInput.value = googleProfile.faculty;
                if (profileEmailDisplay) profileEmailDisplay.textContent = googleProfile.email;

                if (profileAvatarEl) {
                    if (googleProfile.avatarUrl) {
                        profileAvatarEl.innerHTML = `<img src="${googleProfile.avatarUrl}" alt="${googleProfile.fullName}" referrerpolicy="no-referrer" style="width:100%; height:100%; object-fit:cover;" onerror="this.parentElement.textContent='${googleProfile.fullName.charAt(0).toUpperCase()}'">`;
                    } else {
                        profileAvatarEl.textContent = googleProfile.fullName.charAt(0).toUpperCase();
                    }
                }

                // ซิงค์ประวัติการสุ่มจาก Google Account metadata หากในเครื่องยังว่างอยู่
                const remoteHistory = session.user.user_metadata && session.user.user_metadata.random_history;
                if (Array.isArray(remoteHistory) && remoteHistory.length > 0 && getRandomHistory().length === 0) {
                    try {
                        localStorage.setItem(RANDOM_HISTORY_KEY, JSON.stringify(remoteHistory));
                        renderRandomHistorySection();
                    } catch (_) {}
                }

                const savedCountEl = document.getElementById('saved-count');
                if (savedCountEl) savedCountEl.textContent = getSavedPlaces().length;
            }
        });
    }

    if (editProfileForm) {
        editProfileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = editProfileForm.querySelector('button[type="submit"]');
            if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'กำลังบันทึกข้อมูล...'; }

            try {
                const newFullName = editFullnameInput ? editFullnameInput.value.trim() : '';
                const newUsername = editUsernameInput ? editUsernameInput.value.trim() : '';
                const newFaculty = editFacultyInput ? editFacultyInput.value.trim() : '';

                const { data: { session } } = supabaseClient ? await supabaseClient.auth.getSession() : { data: { session: null } };

                let finalAvatarUrl = session?.user ? extractGoogleUserProfile(session.user).avatarUrl : null;
                const currentImg = profileAvatarEl ? profileAvatarEl.querySelector('img') : null;
                if (currentImg && currentImg.src) finalAvatarUrl = currentImg.src;

                if (session && session.user && supabaseClient) {
                    if (selectedAvatarFile) {
                        const fileExt = selectedAvatarFile.name.split('.').pop();
                        const filePath = `avatars/${session.user.id}_${Date.now()}.${fileExt}`;
                        const { error: uploadError } = await supabaseClient.storage.from('avatars').upload(filePath, selectedAvatarFile, { upsert: true });
                        if (!uploadError) {
                            finalAvatarUrl = supabaseClient.storage.from('avatars').getPublicUrl(filePath).data.publicUrl;
                        }
                    }

                    const { error: updateError } = await supabaseClient.auth.updateUser({
                        data: {
                            full_name: newFullName,
                            username: newUsername,
                            faculty: newFaculty,
                            avatar_url: finalAvatarUrl
                        }
                    });
                    if (updateError) throw updateError;
                }

                try {
                    localStorage.setItem('tu_aroi_local_profile', JSON.stringify({
                        full_name: newFullName,
                        username: newUsername,
                        faculty: newFaculty,
                        avatar_url: finalAvatarUrl
                    }));
                } catch (_) {}

                if (profileDisplayNameEl && newFullName) profileDisplayNameEl.textContent = newFullName;
                showToast('บันทึกข้อมูลโปรไฟล์และอัปเดตรูปภาพเรียบร้อยแล้ว!');
                selectedAvatarFile = null;
            } catch (err) {
                showToast('เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + err.message, 'fa-triangle-exclamation');
            } finally {
                if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'บันทึกข้อมูลโปรไฟล์'; }
            }
        });
    }

    // ==========================================
    // 8. ระบบดึงข้อมูลร้าน (detail.html - S2-01) และ ระบบรีวิว Real-time (review.html & detail.html - S2-02)
    // ==========================================
    const urlParams = new URLSearchParams(window.location.search);
    const globalPlaceId = urlParams.get('id');

    // สร้าง HTML ของแต่ละรายการรีวิว (รองรับทั้งรูปโปรไฟล์ Google และตัวอักษรย่อ)
    function buildReviewItemHTML(review, isNewHighlight = false) {
        const dateObj = new Date(review.created_at || '');
        const dateStr = !Number.isNaN(dateObj.getTime())
            ? dateObj.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
            : 'ยังไม่มีข้อมูลวันที่';
        const score = Number(review.rating);
        const hasScore = Number.isInteger(score) && score >= 1 && score <= 5;
        const stars = hasScore ? '⭐'.repeat(score) + '☆'.repeat(5 - score) : 'ยังไม่มีข้อมูลคะแนน';

        let avatarHTML = `<div class="review-avatar">${escapeHTML((review.user_avatar || review.user_name || 'U').charAt(0).toUpperCase())}</div>`;
        if (review.user_avatar && (String(review.user_avatar).startsWith('http') || String(review.user_avatar).startsWith('data:'))) {
            avatarHTML = `<img src="${escapeHTML(review.user_avatar)}" alt="${escapeHTML(review.user_name || 'User')}" referrerpolicy="no-referrer" style="width:32px; height:32px; border-radius:50%; object-fit:cover; border:1px solid var(--border-color);">`;
        }

        let imagesHTML = '';
        if (Array.isArray(review.image_urls) && review.image_urls.length > 0) {
            imagesHTML = '<div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:10px;">';
            review.image_urls.forEach(url => {
                imagesHTML += `<img src="${escapeHTML(url)}" alt="Review photo" style="width:84px; height:84px; object-fit:cover; border-radius:8px; border:1px solid var(--border-color);">`;
            });
            imagesHTML += '</div>';
        }

        return `
            <div class="review-item ${isNewHighlight ? 'new-review-highlight' : ''}">
                <div class="review-header">
                    <div class="review-user">${avatarHTML}<span>${escapeHTML(review.user_name || 'ยังไม่มีข้อมูลชื่อผู้รีวิว')}</span></div>
                    <span class="review-date" style="font-size: 12px; color: var(--text-muted);">${dateStr}</span>
                </div>
                <div class="review-stars">${stars}</div>
                <p class="review-text" style="margin-top: 6px;">${escapeHTML(review.comment || 'ยังไม่มีข้อความรีวิว')}</p>
                ${imagesHTML}
            </div>`;
    }

    // Reviews are authoritative only when returned by the database.
    async function fetchCombinedPlaceReviews(place) {
        const placeId = place ? place.id : globalPlaceId;
        if (!supabaseClient) throw new Error('ไม่สามารถเชื่อมต่อฐานข้อมูลรีวิวได้');
        const { data, error } = await supabaseClient.from('reviews').select('*')
            .eq('place_id', placeId).order('created_at', { ascending: false });
        if (error) throw error;
        return Array.isArray(data) ? data : [];
    }

    // PostgreSQL updates the aggregate in the same transaction as the review.
    async function refreshPlaceReviewStats(place) {
        const { data, error } = await supabaseClient.from('places')
            .select('rating, review_count').eq('id', place.id).single();
        if (error) throw error;
        const { rating: newAvg, reviewCount: newCount } = getEffectivePlaceRatingAndCount(data);

        if (newAvg === null || newCount === null) throw new Error('Missing review summary');
        place.rating = newAvg;
        place.review_count = String(newCount);

        // อัปเดต DOM บนหน้า detail.html (ถ้าเปิดอยู่)
        const detailRatingBadge = document.getElementById('detail-rating-badge');
        if (detailRatingBadge) detailRatingBadge.textContent = `⭐ ${newAvg.toFixed(1)} (${newCount} รีวิว)`;

        const detailReviewsAvg = document.getElementById('detail-reviews-avg');
        if (detailReviewsAvg) detailReviewsAvg.textContent = newAvg.toFixed(1);

        const detailReviewsStars = document.getElementById('detail-reviews-stars');
        if (detailReviewsStars) {
            const fullStars = Math.round(newAvg);
            detailReviewsStars.textContent = '⭐'.repeat(fullStars) + '☆'.repeat(Math.max(0, 5 - fullStars));
        }

        const detailReviewsCountLabel = document.getElementById('detail-reviews-count-label');
        if (detailReviewsCountLabel) detailReviewsCountLabel.textContent = `จากทั้งหมด ${newCount} รีวิว`;

        const detailReviewsTotalLink = document.getElementById('detail-reviews-total-link');
        if (detailReviewsTotalLink) detailReviewsTotalLink.textContent = `ดูรีวิวทั้งหมดและให้คะแนน (${newCount}) →`;

        // อัปเดต DOM บนหน้า review.html (ถ้าเปิดอยู่)
        const reviewPageRating = document.getElementById('review-page-rating');
        if (reviewPageRating) reviewPageRating.innerHTML = `⭐ ${newAvg.toFixed(1)}`;

        const reviewPageCount = document.getElementById('review-page-count');
        if (reviewPageCount) reviewPageCount.textContent = `(${newCount} รีวิว)`;

        return { newAvg, newCount };
    }

    async function showSavedReviewStatus(place) {
        try {
            const { newAvg, newCount } = await refreshPlaceReviewStats(place);
            showToast(`ส่งรีวิวสำเร็จ! คะแนนเฉลี่ย ⭐ ${newAvg.toFixed(1)} (${newCount} รีวิว)`);
        } catch (error) {
            console.error('Review saved, but rating refresh failed:', error);
            showToast('บันทึกรีวิวแล้ว แต่โหลดคะแนนล่าสุดไม่ได้ กรุณารีเฟรชหน้า');
        }
    }

    // ---------------------------------------------------------
    // 8.1 ฟังก์ชันสำหรับหน้า detail.html (S2-01 & S2-02)
    // ---------------------------------------------------------
    function getGoogleOpeningStatus(data, now = Date.now()) {
        const businessStatus = {
            CLOSED_TEMPORARILY: 'ปิดชั่วคราว',
            CLOSED_PERMANENTLY: 'ปิดถาวร',
            FUTURE_OPENING: 'ยังไม่เปิดให้บริการ',
        }[data?.businessStatus];
        if (businessStatus) return { isOpen: false, label: businessStatus };
        if (typeof data?.openNow !== 'boolean') return null;

        const nextChange = Date.parse(data.openNow ? data.nextCloseTime : data.nextOpenTime);
        const fetchedAt = Date.parse(data.fetchedAt);
        const freshUntil = fetchedAt + 15 * 60 * 1000;
        const expires = Number.isFinite(nextChange) ? Math.min(nextChange, freshUntil) : freshUntil;
        if (!Number.isFinite(expires) || now >= expires) {
            return { isOpen: null, label: 'กดอัปเดตเพื่อตรวจสถานะล่าสุด' };
        }
        return { isOpen: data.openNow, label: data.openNow ? 'เปิดอยู่' : 'ปิดอยู่' };
    }

    function appendGoogleCredit(parent, mapsUrl, authors = []) {
        const brand = document.createElement(mapsUrl ? 'a' : 'span');
        brand.className = 'google-maps-attribution';
        brand.translate = false;
        brand.textContent = 'Google Maps';
        if (mapsUrl) {
            brand.href = mapsUrl;
            brand.target = '_blank';
            brand.rel = 'noopener noreferrer';
        }
        parent.append(brand);
        authors.forEach(author => {
            const name = author?.displayName || author?.provider;
            const url = httpUrl(author?.uri || author?.providerUri);
            if (!name && !url) return;
            const credit = document.createElement(url ? 'a' : 'span');
            credit.textContent = name || 'ผู้ให้ข้อมูล';
            if (url) {
                credit.href = url;
                credit.target = '_blank';
                credit.rel = 'noopener noreferrer';
            }
            parent.append(document.createTextNode(' · '), credit);
        });
    }

    function bindGooglePlaceDetails(place, mapsUrl, onDetails) {
        const button = document.getElementById('google-place-load');
        const message = document.getElementById('google-place-message');
        if (!button || !message || !supabaseClient) return;
        let verifiedId = place.google_place_id?.trim();
        if (!verifiedId && mapsUrl) {
            try { verifiedId = new URL(mapsUrl).searchParams.get('query_place_id'); }
            catch { return; }
        }
        if (!verifiedId) return;

        const messages = {
            quota: 'ถึงเพดานคำขอ Google Maps แล้ว',
            disabled: 'ระบบดึงข้อมูลจาก Google Maps ยังไม่ได้เปิดใช้งาน',
            no_place_id: 'ยังไม่มีรหัสสาขาที่ตรวจสอบแล้ว',
            login: 'กรุณาเข้าสู่ระบบก่อนอัปเดตข้อมูล Google Maps',
        };
        const load = async () => {
            if (button.disabled) return;
            button.disabled = true;
            try {
                const { data: sessionData } = await supabaseClient.auth.getSession();
                if (!sessionData?.session) throw new Error(messages.login);

                message.hidden = false;
                message.textContent = 'กำลังโหลดข้อมูลจาก Google Maps…';
                const { data, error } = await supabaseClient.functions.invoke('google-place', { body: { id: place.id } });
                if (error || !data) {
                    const failure = await error?.context?.json?.().catch(() => null);
                    throw new Error(messages[failure?.code] || 'โหลดข้อมูลจาก Google Maps ไม่สำเร็จ');
                }
                onDetails(data);
                message.hidden = true;
            } catch (error) {
                message.hidden = false;
                message.textContent = error.message || 'โหลดข้อมูลจาก Google Maps ไม่สำเร็จ';
            } finally {
                button.disabled = false;
            }
        };

        button.hidden = false;
        button.addEventListener('click', load);
        load();
    }

    const loadPlaceDetail = async () => {
        const detailPage = document.getElementById('detail-page');
        if (!detailPage) return;

        let place = null;
        try {
            if (supabaseClient && globalPlaceId) {
                const { data, error } = await supabaseClient.from('places').select('*').eq('id', globalPlaceId).single();
                if (!error && data) place = data;
            }
        } catch (err) { console.warn(err); }

        if (!place) {
            document.getElementById('detail-name').textContent = 'ไม่พบข้อมูลสถานที่';
            const summary = document.getElementById('detail-summary');
            if (summary) summary.textContent = 'ไม่สามารถโหลดข้อมูลจากฐานข้อมูลได้ กรุณากลับไปลองใหม่อีกครั้ง';
            return;
        }

        const pageTitle = document.getElementById('detail-page-title');
        if (pageTitle) pageTitle.textContent = `${place.name} - TU Aroi`;

        const coords = parseLatLngFromPlace(place);
        const mapsUrl = httpUrl(place.google_map || place['google map'])
            || (coords ? `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}` : '');
        const coverImgUrl = getPlaceImage(place);
        const coverImgEl = document.getElementById('detail-cover-image');
        setPlaceImage(coverImgEl, coverImgUrl, place.name, mapsUrl);

        const { rating, reviewCount } = getEffectivePlaceRatingAndCount(place);
        const priceInfo = getPriceDisplayInfo(place);
        const addressText = getPlaceAddress(place);
        const phoneText = getPlacePhone(place);
        const summaryText = getPlaceSummaryText(place);

        document.getElementById('detail-category').textContent = place.category || 'ยังไม่มีข้อมูลหมวดหมู่';
        document.getElementById('detail-name').textContent = place.name || 'ยังไม่มีข้อมูลชื่อร้าน';
        document.getElementById('detail-summary').textContent = summaryText;

        const ratingBadge = document.getElementById('detail-rating-badge');
        if (ratingBadge) ratingBadge.textContent = placeRatingText(rating, reviewCount);

        const priceBadge = document.getElementById('detail-price-badge');
        if (priceBadge) priceBadge.textContent = priceInfo.fullLabel;

        // Real-time open/closed indicator. The shared helper supports overnight
        // hours and is refreshed at each local minute boundary below.
        const hours = getStoreHours(place);
        const openBadge = document.getElementById('detail-open-badge');
        let googleDetails = null;
        const updateDetailStoreStatus = () => {
            const googleStatus = getGoogleOpeningStatus(googleDetails);
            const status = googleStatus ? googleStatus.isOpen : getLiveStoreStatus(place);
            const statusText = googleStatus?.label || (status === null ? 'ยังไม่ทราบสถานะ' : status ? 'เปิดอยู่' : 'ปิดอยู่');
            const displayStatus = googleStatus ? `${statusText} · Google Maps` : statusText;
            if (openBadge) {
                openBadge.textContent = `● ${displayStatus}`;
                openBadge.className = `detail-meta-pill ${status === null ? '' : status ? 'status-open' : 'status-closed'}`;
                openBadge.setAttribute('aria-label', `สถานะร้าน ${displayStatus}`);
            }
            const liveStatusRow = document.getElementById('detail-live-store-status');
            if (liveStatusRow) {
                liveStatusRow.innerHTML = `<span>สถานะปัจจุบัน</span><span class="detail-live-status ${status === null ? '' : status ? 'is-open' : 'is-closed'}">${escapeHTML(displayStatus)}</span>`;
            }
        };

        // S2-01: ข้อมูลที่อยู่ เบอร์โทรศัพท์ และช่วงราคา ($/$$/$$$)
        const locElement = document.getElementById('detail-location');
        if (locElement) locElement.textContent = addressText;

        const phoneElement = document.getElementById('detail-phone');
        if (phoneElement) {
            const dialable = phoneText.match(/0\d{1,2}[-\s]?\d{3}[-\s]?\d{3,4}/);
            if (dialable) {
                phoneElement.innerHTML = `<a href="tel:${dialable[0].replace(/[-\s]/g, '')}" style="color: var(--primary-red); font-weight: 600; text-decoration: underline;">${escapeHTML(phoneText)}</a>`;
            } else {
                phoneElement.textContent = phoneText;
            }
        }

        const priceElement = document.getElementById('detail-price-info');
        if (priceElement) priceElement.textContent = priceInfo.fullLabel;

        const gmapLink = document.getElementById('detail-gmap-link');
        if (gmapLink) {
            if (mapsUrl) {
                gmapLink.href = mapsUrl;
            } else {
                gmapLink.removeAttribute('href');
                gmapLink.textContent = 'ยังไม่มีข้อมูลพิกัด';
            }
        }

        // เวลาทำการและรายละเอียดเพิ่มเติม
        const hoursContainer = document.getElementById('detail-hours');
        if (hoursContainer) {
            let hoursHTML = '<div id="detail-live-store-status" class="hours-row detail-live-store-status" aria-live="polite"></div>';
            hoursHTML += `<div class="hours-row"><span>เวลาทำการ</span><span id="detail-hours-value">${escapeHTML(hours.label)}</span></div>`;
            hoursHTML += `<div class="hours-row"><span>ช่วงราคา</span><span style="font-weight: bold; color: var(--accent-gold);">${escapeHTML(priceInfo.fullLabel)}</span></div>`;
            hoursHTML += `<div class="hours-row"><span>เบอร์ติดต่อร้านค้า</span><span id="detail-hours-phone" style="font-weight: bold; color: var(--text-main);">${escapeHTML(phoneText)}</span></div>`;
            hoursContainer.innerHTML = hoursHTML;
        }
        updateDetailStoreStatus();
        const millisecondsToNextMinute = 60000 - (Date.now() % 60000) + 20;
        setTimeout(() => {
            updateDetailStoreStatus();
            setInterval(updateDetailStoreStatus, 60000);
        }, millisecondsToNextMinute);

        const photoCredit = document.getElementById('google-place-photo-credit');
        const mapPanel = document.getElementById('detail-map-panel');
        const timeFormat = new Intl.DateTimeFormat('th-TH', {
            timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short',
        });
        let usingGooglePhoto = false;
        const showCoverPhoto = (url, sourceUrl, authors = null) => {
            usingGooglePhoto = Boolean(authors);
            setPlaceImage(coverImgEl, url, place.name, sourceUrl);
            if (!photoCredit || !coverImgEl) return;
            photoCredit.replaceChildren();
            photoCredit.hidden = !usingGooglePhoto;
            if (!usingGooglePhoto) return;
            appendGoogleCredit(photoCredit, sourceUrl, authors);
            const onError = coverImgEl.onerror;
            coverImgEl.onerror = event => {
                onError?.call(coverImgEl, event);
                photoCredit.hidden = true;
            };
        };

        bindGooglePlaceDetails(place, mapsUrl, data => {
            googleDetails = data;
            const sourceUrl = httpUrl(data.mapsUrl) || mapsUrl;
            const attributions = Array.isArray(data.attributions) ? data.attributions : [];
            const photoUrl = httpUrl(data.photo?.uri);

            if (photoUrl && coverImgEl) {
                const authors = Array.isArray(data.photo.authors) ? data.photo.authors : [];
                if (!coverImgUrl || coverImgEl.hidden || usingGooglePhoto) {
                    showCoverPhoto(photoUrl, sourceUrl, authors);
                } else if (coverImgEl.getAttribute('src') === coverImgUrl) {
                    coverImgEl.onerror = () => {
                        showCoverPhoto(photoUrl, sourceUrl, authors);
                        if (mapPanel) mapPanel.hidden = true;
                    };
                }
            }
            updateDetailStoreStatus();
            const hoursValue = document.getElementById('detail-hours-value');
            const hasHours = Array.isArray(data.hours) && data.hours.length > 0;
            const nextChange = Date.parse(data.openNow === true ? data.nextCloseTime : data.nextOpenTime);
            const fetchedAt = Date.parse(data.fetchedAt);
            const hasStatus = getGoogleOpeningStatus(data) !== null;
            if (hoursValue && (hasHours || Number.isFinite(nextChange) || hasStatus)) {
                hoursValue.replaceChildren();
                if (Number.isFinite(nextChange)) {
                    const next = document.createElement('div');
                    next.textContent = `${data.openNow ? 'ปิดครั้งถัดไป' : 'เปิดครั้งถัดไป'} ${timeFormat.format(nextChange)}`;
                    hoursValue.append(next);
                }
                if (hasHours) {
                    const schedule = document.createElement('details');
                    schedule.open = true;
                    const heading = document.createElement('summary');
                    heading.textContent = data.hoursType === 'current' ? 'ดูเวลารายวัน' : 'ดูเวลาปกติรายวัน';
                    const days = document.createElement('ul');
                    data.hours.forEach(day => {
                        const item = document.createElement('li');
                        item.textContent = day;
                        days.append(item);
                    });
                    schedule.append(heading, days);
                    hoursValue.append(schedule);
                } else {
                    const known = document.createElement('div');
                    known.textContent = hours.label;
                    hoursValue.append(known);
                }
                const source = document.createElement('small');
                appendGoogleCredit(source, sourceUrl, attributions);
                if (Number.isFinite(fetchedAt)) source.append(` · ข้อมูล ณ ${timeFormat.format(fetchedAt)}`);
                hoursValue.append(source);
            }
            if (data.phone) {
                for (const id of ['detail-phone', 'detail-hours-phone']) {
                    const phone = document.getElementById(id);
                    if (!phone) continue;
                    phone.textContent = `${data.phone} · `;
                    appendGoogleCredit(phone, sourceUrl, attributions);
                }
            }
            if (hasHours || hasStatus || usingGooglePhoto || data.phone) {
                const terms = document.getElementById('google-place-terms');
                if (terms) terms.hidden = false;
                if (mapPanel) mapPanel.hidden = true;
                if (gmapLink && sourceUrl) {
                    gmapLink.href = sourceUrl;
                    gmapLink.textContent = 'เปิดร้านนี้บน Google Maps';
                }
            }
        });

        // จุดเด่นและสิ่งอำนวยความสะดวก (Features Tags)
        const featuresContainer = document.getElementById('detail-features');
        if (featuresContainer) {
            const tags = cleanTextValue(place.features).split(',').map(tag => tag.trim())
                .filter(tag => tag && !/^฿/.test(tag));
            featuresContainer.innerHTML = tags.map(tag => `<span class="feature-tag-chip">${escapeHTML(tag)}</span>`).join('')
                || '<p class="data-state">ยังไม่มีข้อมูลจุดเด่นของร้าน</p>';
        }

        // S2-01: เมนูแนะนำและรูปภาพแกลเลอรี
        const descEl = document.getElementById('detail-description');
        if (descEl) descEl.textContent = summaryText;

        const recommendedMenus = getPlaceRecommendedMenus(place);
        const menuContainer = document.getElementById('detail-menu');
        if (menuContainer) {
            menuContainer.innerHTML = recommendedMenus.map(menu => `
                <div class="menu-item">
                    ${placeImageHTML(httpUrl(menu.image), menu.name)}
                    <p>${escapeHTML(menu.name)}</p>
                    <span>${escapeHTML(cleanTextValue(menu.price) || (menu.price === 0 ? 0 : 'ยังไม่มีข้อมูลราคา'))}</span>
                </div>
            `).join('') || '<p class="data-state">ยังไม่มีข้อมูลเมนู</p>';
        }

        // สร้างแกลเลอรีรูปภาพใต้ภาพปก (คลิกเพื่อดูรูปใหญ่ได้ทันที)
        const galleryContainer = document.getElementById('detail-gallery');
        const renderGallery = () => {
            if (!galleryContainer) return;
            const galleryUrls = [
                coverImgUrl,
                ...recommendedMenus.map(m => httpUrl(m.image))
            ].filter((u, idx, arr) => u && arr.indexOf(u) === idx).slice(0, 8);

            galleryContainer.innerHTML = galleryUrls.map((url, idx) => `
                <img src="${escapeHTML(url)}" alt="ภาพร้าน ${idx + 1}" referrerpolicy="no-referrer" class="detail-gallery-thumb ${idx === 0 ? 'active' : ''}" onerror="this.hidden=true;">
            `).join('');

            galleryContainer.querySelectorAll('.detail-gallery-thumb').forEach(thumb => {
                thumb.addEventListener('click', () => {
                    galleryContainer.querySelectorAll('.detail-gallery-thumb').forEach(t => t.classList.remove('active'));
                    thumb.classList.add('active');
                    showCoverPhoto(thumb.src, mapsUrl);
                });
            });
        };
        renderGallery();

        // แผนที่ Leaflet เฉพาะร้าน
        const mapIframe = document.getElementById('detail-map');
        if (mapIframe && (!coords || typeof L === 'undefined')) {
            const message = document.createElement('p');
            message.className = 'data-state';
            message.textContent = coords ? 'โหลดแผนที่ไม่ได้' : 'ยังไม่มีข้อมูลพิกัดร้าน';
            mapIframe.replaceWith(message);
        } else if (mapIframe && coords) {
            const mapContainer = document.createElement('div');
            mapContainer.id = 'detail-leaflet-map';
            mapContainer.style.width = '100%';
            mapContainer.style.height = '100%';
            mapContainer.style.borderRadius = '8px';
            mapIframe.replaceWith(mapContainer);

            const map = L.map('detail-leaflet-map').setView([coords.lat, coords.lng], 16);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
            const redIcon = L.icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
                iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34]
            });
            L.marker([coords.lat, coords.lng], { icon: redIcon })
                .addTo(map)
                .bindPopup(`<b style="font-family:'Kanit',sans-serif;">${escapeHTML(place.name)}</b><br><small>${escapeHTML(addressText)}</small>`)
                .openPopup();
        }

        // S2-02: แสดงผลรีวิว คะแนนดาวเฉลี่ย และระบบส่งรีวิวแบบ Real-time บนหน้า detail.html
        const reviewContainer = document.getElementById('detail-reviews-content');
        const detailReviewsAvg = document.getElementById('detail-reviews-avg');
        const detailReviewsStars = document.getElementById('detail-reviews-stars');
        const detailReviewsCountLabel = document.getElementById('detail-reviews-count-label');
        const detailReviewsTotalLink = document.getElementById('detail-reviews-total-link');

        if (detailReviewsAvg) detailReviewsAvg.textContent = rating?.toFixed(1) ?? '—';
        if (detailReviewsStars && rating !== null) {
            const full = Math.round(rating);
            detailReviewsStars.textContent = '⭐'.repeat(full) + '☆'.repeat(Math.max(0, 5 - full));
        }
        if (detailReviewsCountLabel) detailReviewsCountLabel.textContent = reviewCount === null ? 'ยังไม่มีข้อมูลจำนวนรีวิว' : `จากทั้งหมด ${reviewCount} รีวิว`;
        if (detailReviewsTotalLink) detailReviewsTotalLink.textContent = `ดูรีวิวทั้งหมดและให้คะแนน${reviewCount === null ? '' : ` (${reviewCount})`} →`;

        const renderDetailReviews = async () => {
            if (!reviewContainer) return;
            let reviews;
            try { reviews = await fetchCombinedPlaceReviews(place); }
            catch (_) {
                reviewContainer.innerHTML = '<p class="data-state data-state-error">ไม่สามารถโหลดรีวิวได้ กรุณาลองใหม่อีกครั้ง</p>';
                return;
            }
            if (reviews.length === 0) {
                reviewContainer.innerHTML = '<p style="font-size: 13px; color: var(--text-muted); padding-top: 10px;">ยังไม่มีรีวิวสำหรับร้านนี้ ร่วมเป็นคนแรกที่รีวิวได้เลย!</p>';
                return;
            }
            reviewContainer.innerHTML = reviews.slice(0, 5).map(r => buildReviewItemHTML(r)).join('');


        };

        await renderDetailReviews();

        // ดึงชื่อจาก Google Account มาใส่ในช่องชื่อผู้รีวิวอัตโนมัติ (ถ้าล็อกอินอยู่)
        const quickReviewerInput = document.getElementById('detail-quick-reviewer');
        let currentGoogleUser = null;
        if (supabaseClient) {
            try {
                const { data: { session } } = await supabaseClient.auth.getSession();
                if (session && session.user) {
                    currentGoogleUser = extractGoogleUserProfile(session.user);
                    if (quickReviewerInput) quickReviewerInput.value = currentGoogleUser.fullName;
                }
            } catch (_) {}
        }

        // ฟอร์มส่งรีวิวด่วนบนหน้า detail.html (DOM Update ทันที + คำนวณดาวเฉลี่ยใหม่ทันที)
        const quickForm = document.getElementById('detail-quick-review-form');
        if (quickForm) {
            quickForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const checkedStar = quickForm.querySelector('input[name="qrating"]:checked');
                const commentInput = document.getElementById('detail-quick-comment');
                const commentText = commentInput ? commentInput.value.trim() : '';

                if (!checkedStar) {
                    showToast('กรุณาเลือกคะแนนดาว (1-5 ดาว) ก่อนส่งรีวิวครับ', 'fa-star');
                    return;
                }
                if (!commentText) {
                    showToast('กรุณาพิมพ์ความคิดเห็นรีวิวครับ', 'fa-comment-dots');
                    return;
                }

                const submitBtn = document.getElementById('detail-quick-submit-btn');
                if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'กำลังส่ง...'; }

                const starVal = parseInt(checkedStar.value, 10);
                const reviewerName = (quickReviewerInput && quickReviewerInput.value.trim())
                    || (currentGoogleUser && currentGoogleUser.fullName)
                    || 'นักศึกษา มธ.';
                const reviewerAvatar = (currentGoogleUser && currentGoogleUser.avatarUrl)
                    || reviewerName.charAt(0).toUpperCase();

                const newReview = {
                    place_id: place.id,
                    user_name: reviewerName,
                    user_avatar: reviewerAvatar,
                    rating: starVal,
                    comment: commentText,
                    image_urls: null,
                    created_at: new Date().toISOString()
                };

                try {
                    if (!supabaseClient) throw new Error('ไม่สามารถเชื่อมต่อฐานข้อมูลได้');
                    const { error: insertError } = await supabaseClient.from('reviews').insert([{
                        place_id: place.id, user_name: newReview.user_name,
                        user_avatar: String(newReview.user_avatar).slice(0, 250), rating: newReview.rating,
                        comment: newReview.comment, image_urls: null
                    }]);
                    if (insertError) throw insertError;
                    await renderDetailReviews();

                    quickForm.reset();
                    if (currentGoogleUser && quickReviewerInput) quickReviewerInput.value = currentGoogleUser.fullName;
                    await showSavedReviewStatus(place);
                } catch (err) {
                    showToast(`ส่งรีวิวไม่สำเร็จ: ${err.message}`, 'fa-triangle-exclamation');
                } finally {
                    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'ส่งรีวิว'; }
                }
            });
        }

        // เปิดรับข้อมูล Realtime จาก Supabase
        if (supabaseClient) {
            supabaseClient.channel(`public:reviews:detail:${place.id}`)
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reviews', filter: `place_id=eq.${place.id}` }, () => {
                    renderDetailReviews();
                })
                .subscribe();
        }

        // เปลี่ยนลิงก์ปุ่ม "เขียนรีวิว" ทุกปุ่มในหน้านี้ให้แนบ ?id= ไปด้วยเสมอ
        document.querySelectorAll('a[href="review.html"], a[href="review.html#"]').forEach(link => {
            link.href = `review.html?id=${place.id}`;
        });
    };

    // ---------------------------------------------------------
    // 8.2 ฟังก์ชันสำหรับหน้า review.html (S2-02: ส่งรีวิวแล้วแสดงผลทันทีโดยไม่ต้องกด Refresh & คำนวณคะแนนดาวเฉลี่ยใหม่ทันที)
    // ---------------------------------------------------------
    const initReviewSystem = async () => {
        const reviewForm = document.getElementById('review-form');
        if (!reviewForm) return;

        // อัปเดตปุ่มกลับไปหน้าร้าน
        const backLink = document.querySelector('.back-link');
        if (backLink) backLink.href = globalPlaceId ? `detail.html?id=${encodeURIComponent(globalPlaceId)}` : 'search.html';

        let currentPlace = null;
        if (supabaseClient && globalPlaceId) {
            try {
                const { data } = await supabaseClient.from('places').select('*').eq('id', globalPlaceId).single();
                if (data) currentPlace = data;
            } catch (err) { console.error(err); }
        }
        if (!currentPlace) {
            const title = document.getElementById('review-place-title');
            if (title) title.textContent = 'ไม่สามารถโหลดข้อมูลร้านค้าได้';
            const area = document.getElementById('reviews-content-area');
            if (area) area.innerHTML = '<p class="data-state data-state-error">กรุณากลับไปหน้าค้นหาแล้วลองเปิดร้านค้าอีกครั้ง</p>';
            reviewForm.querySelectorAll('input, textarea, button').forEach(el => { el.disabled = true; });
            return;
        }

        const titleH1 = document.getElementById('review-place-title') || document.querySelector('.detail-container h1');
        const ratingSpan = document.getElementById('review-page-rating') || document.querySelector('.detail-container p span');
        const countSpan = document.getElementById('review-page-count');
        const priceSpan = document.getElementById('review-page-price');

        const { rating: initRating, reviewCount: initCount } = getEffectivePlaceRatingAndCount(currentPlace);
        const priceInfo = getPriceDisplayInfo(currentPlace);

        if (titleH1) titleH1.textContent = currentPlace.name;
        if (ratingSpan) ratingSpan.textContent = placeRatingText(initRating, null);
        if (countSpan) countSpan.textContent = initCount === null ? 'ยังไม่มีข้อมูลจำนวนรีวิว' : `(${initCount} รีวิว)`;
        if (priceSpan) priceSpan.textContent = `• ช่วงราคา ${priceInfo.fullLabel}`;

        // ดึงชื่อผู้ใช้จาก Google Account มาใส่ในช่องชื่อผู้รีวิวอัตโนมัติ (ถ้าล็อกอินอยู่)
        const reviewerNameInput = document.getElementById('reviewer-name');
        let loggedInGoogleProfile = null;
        if (supabaseClient) {
            try {
                const { data: { session } } = await supabaseClient.auth.getSession();
                if (session && session.user) {
                    loggedInGoogleProfile = extractGoogleUserProfile(session.user);
                    if (reviewerNameInput) reviewerNameInput.value = loggedInGoogleProfile.fullName;
                }
            } catch (_) {}
        }

        const reviewsContainer = document.getElementById('reviews-content-area');

        const loadAllReviews = async () => {
            if (!reviewsContainer) return;
            let reviews;
            try { reviews = await fetchCombinedPlaceReviews(currentPlace); }
            catch (_) {
                reviewsContainer.innerHTML = '<p class="data-state data-state-error">ไม่สามารถโหลดรีวิวได้ กรุณาลองใหม่อีกครั้ง</p>';
                return;
            }
            reviewsContainer.innerHTML = '';

            if (!reviews || reviews.length === 0) {
                reviewsContainer.innerHTML = '<p class="empty-reviews-msg" style="color:var(--text-muted); font-size:14px; text-align:center; padding: 20px 0;">ยังไม่มีรีวิว เป็นคนแรกที่ให้คะแนนสิ!</p>';
                return;
            }

            reviews.forEach(review => {
                reviewsContainer.insertAdjacentHTML('beforeend', buildReviewItemHTML(review, false));
            });
        };

        await loadAllReviews();

        // จัดการอัปโหลดรูปและแปลงเป็น Data URL สำหรับแสดงผลแบบ Real-time ทันที
        const fileInput = document.getElementById('review-photo');
        const previewContainer = document.getElementById('image-preview-container');
        let selectedFiles = [];
        let selectedDataUrls = [];

        if (fileInput && previewContainer) {
            fileInput.addEventListener('change', (e) => {
                const newFiles = Array.from(e.target.files || []);
                newFiles.forEach((file) => {
                    selectedFiles.push(file);
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        const dataUrl = ev.target.result;
                        selectedDataUrls.push(dataUrl);
                        const div = document.createElement('div');
                        div.style.position = 'relative';
                        div.innerHTML = `<img src="${dataUrl}" style="width:70px; height:70px; object-fit:cover; border-radius:8px; border:1px solid var(--border-color);">
                                         <button type="button" style="position:absolute; top:-5px; right:-5px; background:var(--primary-red); color:white; border:none; border-radius:50%; width:20px; height:20px; cursor:pointer; font-size:12px; display:flex; align-items:center; justify-content:center;">×</button>`;
                        div.querySelector('button').onclick = (evClick) => {
                            evClick.preventDefault();
                            const idx = selectedDataUrls.indexOf(dataUrl);
                            if (idx > -1) {
                                selectedDataUrls.splice(idx, 1);
                                selectedFiles.splice(idx, 1);
                            }
                            div.remove();
                        };
                        previewContainer.appendChild(div);
                    };
                    reader.readAsDataURL(file);
                });
                fileInput.value = '';
            });
        }

        // S2-02: กดส่งรีวิว -> แสดงผลทันทีบนหน้าเว็บโดยไม่ต้องกด Refresh (DOM Update) + คำนวณคะแนนดาวเฉลี่ยใหม่ทันที
        reviewForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const ratingRadio = document.querySelector('input[name="rating"]:checked');
            const commentInput = document.getElementById('review-comment');
            const comment = commentInput ? commentInput.value.trim() : '';

            if (!ratingRadio) {
                showToast('กรุณาเลือกคะแนนดาว (1-5 ดาว) ก่อนส่งรีวิวครับ!', 'fa-star');
                return;
            }
            if (!comment) {
                showToast('กรุณากรอกความคิดเห็นรีวิวครับ!', 'fa-comment-dots');
                return;
            }

            const submitBtn = document.getElementById('submit-review-btn');
            if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'กำลังส่งข้อมูล...'; }

            const starValue = parseInt(ratingRadio.value, 10);
            const reviewerName = (reviewerNameInput && reviewerNameInput.value.trim())
                || (loggedInGoogleProfile && loggedInGoogleProfile.fullName)
                || 'นักศึกษา มธ.';
            const reviewerAvatar = (loggedInGoogleProfile && loggedInGoogleProfile.avatarUrl)
                || reviewerName.charAt(0).toUpperCase();

            try {
                let uploadedImageUrls = [...selectedDataUrls];

                if (supabaseClient && selectedFiles.length > 0) {
                    const remoteUrls = [];
                    for (let file of selectedFiles) {
                        try {
                            const filePath = `${currentPlace.id}_${Date.now()}_${file.name}`;
                            const { error: uploadError } = await supabaseClient.storage.from('review-images').upload(filePath, file);
                            if (!uploadError) {
                                const { data: publicUrlData } = supabaseClient.storage.from('review-images').getPublicUrl(filePath);
                                if (publicUrlData && publicUrlData.publicUrl) remoteUrls.push(publicUrlData.publicUrl);
                            }
                        } catch (_) {}
                    }
                    if (remoteUrls.length > 0) uploadedImageUrls = remoteUrls;
                }

                const newReviewObj = {
                    place_id: currentPlace.id,
                    user_name: reviewerName,
                    user_avatar: reviewerAvatar,
                    rating: starValue,
                    comment: comment,
                    image_urls: uploadedImageUrls.length > 0 ? uploadedImageUrls : null,
                    created_at: new Date().toISOString()
                };

                if (!supabaseClient) throw new Error('ไม่สามารถเชื่อมต่อฐานข้อมูลได้');
                const { error: insertError } = await supabaseClient.from('reviews').insert([{
                    place_id: currentPlace.id, user_name: newReviewObj.user_name,
                    user_avatar: String(newReviewObj.user_avatar).slice(0, 250), rating: newReviewObj.rating,
                    comment: newReviewObj.comment, image_urls: newReviewObj.image_urls
                }]);
                if (insertError) throw insertError;
                await loadAllReviews();

                reviewForm.reset();
                if (loggedInGoogleProfile && reviewerNameInput) reviewerNameInput.value = loggedInGoogleProfile.fullName;
                selectedFiles = [];
                selectedDataUrls = [];
                if (previewContainer) previewContainer.innerHTML = '';

                await showSavedReviewStatus(currentPlace);
            } catch (err) {
                showToast('เกิดข้อผิดพลาด: ' + err.message, 'fa-triangle-exclamation');
            } finally {
                if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'ส่งรีวิว'; }
            }
        });

        // เปิดรับข้อมูล Realtime จาก Supabase
        if (supabaseClient) {
            supabaseClient.channel(`public:reviews:page:${currentPlace.id}`)
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reviews', filter: `place_id=eq.${currentPlace.id}` }, payload => {
                    if (payload && payload.new && reviewsContainer) {
                        const alreadyShown = Array.from(reviewsContainer.querySelectorAll('.review-text')).some(el => el.textContent === payload.new.comment);
                        if (!alreadyShown) {
                            reviewsContainer.insertAdjacentHTML('afterbegin', buildReviewItemHTML(payload.new, true));
                        }
                    }
                })
                .subscribe();
        }
    };

    if (document.getElementById('detail-page')) {
        loadPlaceDetail();
    } else if (document.getElementById('review-form')) {
        initReviewSystem();
    }

    // ==========================================
    // 9. ระบบ Map UI แบบใหม่ (ดึง Lat/Lng จาก URL Google Maps)
    // ==========================================
    const mapElement = document.getElementById('map');
    if (mapElement && typeof L !== 'undefined') {
        const defaultCenter = [14.0728, 100.6015];
        const map = L.map('map').setView(defaultCenter, 15);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        const redIcon = L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
            iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34]
        });

        let userLocationMarker = null;
        let userLocationAccuracy = null;

        function showUserLocation(position, shouldCenter = true) {
            const { latitude, longitude, accuracy } = position.coords;
            const latLng = [latitude, longitude];

            if (userLocationMarker) map.removeLayer(userLocationMarker);
            if (userLocationAccuracy) map.removeLayer(userLocationAccuracy);

            userLocationAccuracy = Number.isFinite(accuracy) ? L.circle(latLng, {
                radius: accuracy,
                color: '#2563eb',
                fillColor: '#60a5fa',
                fillOpacity: 0.2,
                weight: 1
            }).addTo(map) : null;

            userLocationMarker = L.circleMarker(latLng, {
                radius: 9,
                color: '#ffffff',
                fillColor: '#2563eb',
                fillOpacity: 1,
                weight: 3
            }).addTo(map).bindPopup('📍 ตำแหน่งของคุณปัจจุบัน');

            if (shouldCenter) {
                map.setView(latLng, 16);
            }
        }

        function locateUser(shouldCenter = true, onSuccess = null, onError = null) {
            if (!navigator.geolocation) {
                if (onError) onError();
                return;
            }

            navigator.geolocation.getCurrentPosition(
                position => {
                    showUserLocation(position, shouldCenter);
                    if (onSuccess) onSuccess();
                },
                error => {
                    console.warn('Geolocation error:', error.message);
                    if (onError) onError();
                },
                { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
            );
        }

        locateUser(false);

        async function fetchAndRenderMapData() {
            let places = [];
            let loadError = null;
            if (typeof supabaseClient !== 'undefined' && supabaseClient) {
                try {
                    const { data, error } = await supabaseClient.from('places').select('*');
                    if (error) throw error;
                    places = Array.isArray(data) ? data : [];
                } catch (err) { loadError = err; console.error('เกิดข้อผิดพลาดในการโหลดข้อมูลแผนที่:', err); }
            } else {
                loadError = new Error('ไม่สามารถเชื่อมต่อฐานข้อมูลได้');
            }
            if (places.length === 0) {
                mapElement.insertAdjacentHTML('afterend', loadError
                    ? '<p class="data-state data-state-error">ไม่สามารถโหลดข้อมูลร้านค้าบนแผนที่ได้</p>'
                    : '<p class="data-state">ยังไม่มีร้านค้าที่มีพิกัดสำหรับแสดงบนแผนที่</p>');
                return;
            }

            places.forEach(place => {
                const mapUrl = httpUrl(place.google_map || place['google map']);
                const coords = parseLatLngFromPlace(place);

                if (coords && !Number.isNaN(coords.lat) && !Number.isNaN(coords.lng)) {
                    const marker = L.marker([coords.lat, coords.lng], { icon: redIcon }).addTo(map);
                    const imageUrl = getPlaceImage(place);
                    const priceInfo = getPriceDisplayInfo(place);
                    const { rating } = getEffectivePlaceRatingAndCount(place);

                    const popupContent = `
                        <div style="font-family: 'Kanit', sans-serif; padding: 0px; width: 220px;">
                            ${placeImageHTML(imageUrl, place.name)}
                            <h4 style="margin: 0 0 4px 0; color: var(--primary-red, #e63946); font-size: 15px;">${escapeHTML(place.name)}</h4>
                            <p style="margin: 0 0 4px 0; font-size: 12px; color: #666;"><i class="fa-solid fa-tag"></i> ${escapeHTML(place.category || 'ยังไม่มีข้อมูลหมวดหมู่')} • ${escapeHTML(priceInfo.fullLabel)}</p>
                            <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 500;">${placeRatingText(rating, null)}</p>
                            <div style="display: flex; gap: 5px; margin-top: 10px;">
                                <a href="detail.html?id=${place.id}" style="flex: 1; text-align: center; background: #eee; color: #333; padding: 6px; border-radius: 6px; text-decoration: none; font-size: 12px; font-weight: 500;">ดูรายละเอียด</a>
                                <a href="${escapeHTML(mapUrl || `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`)}" target="_blank" style="flex: 1; text-align: center; background: var(--primary-red, #e63946); color: white; padding: 6px; border-radius: 6px; text-decoration: none; font-size: 12px; font-weight: 500;"><i class="fa-solid fa-location-arrow"></i> นำทาง</a>
                            </div>
                        </div>`;
                    marker.bindPopup(popupContent);
                    marker.on('mouseover', function () { this.openPopup(); });
                }
            });
        }
        fetchAndRenderMapData();

        let isAddMode = false;
        let tempMarker = null;
        const addModeBtn = document.querySelector('.add-mode-btn');
        const banner = document.querySelector('.pin-mode-banner');
        const resetLocBtn = document.querySelector('.map-control-btn:not(.add-mode-btn)');

        if (addModeBtn) {
            addModeBtn.addEventListener('click', () => {
                isAddMode = !isAddMode;
                if (isAddMode) {
                    addModeBtn.classList.add('active');
                    addModeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i> ยกเลิกการปักหมุด';
                    if (banner) banner.style.display = 'block';
                    mapElement.style.cursor = 'crosshair';
                } else {
                    exitAddMode();
                }
            });
        }

        function exitAddMode() {
            isAddMode = false;
            if (addModeBtn) {
                addModeBtn.classList.remove('active');
                addModeBtn.innerHTML = '<i class="fa-solid fa-plus"></i> เพิ่มร้านค้าบนแผนที่';
            }
            if (banner) banner.style.display = 'none';
            mapElement.style.cursor = '';
            if (tempMarker) { map.removeLayer(tempMarker); tempMarker = null; }
        }

        if (resetLocBtn) {
            resetLocBtn.addEventListener('click', () => {
                resetLocBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
                locateUser(true,
                    () => { resetLocBtn.innerHTML = '<i class="fa-solid fa-crosshairs"></i> ตำแหน่งของฉัน'; },
                    () => { resetLocBtn.innerHTML = '<i class="fa-solid fa-crosshairs"></i> ตำแหน่งของฉัน'; }
                );
            });
        }

        map.on('click', (e) => {
            if (!isAddMode) return;
            const { lat, lng } = e.latlng;
            if (tempMarker) map.removeLayer(tempMarker);

            const popupContent = `
                <div class="add-place-popup">
                    <h4><i class="fa-solid fa-store"></i> เพิ่มร้านค้าใหม่</h4>
                    <form id="quick-add-place-form">
                        <label>ชื่อร้านค้า</label>
                        <input type="text" id="new-place-name" placeholder="ระบุชื่อร้าน..." required />
                        <label>หมวดหมู่</label>
                        <select id="new-place-category">
                            <option value="คาเฟ่">คาเฟ่</option>
                            <option value="ร้านอาหาร">ร้านอาหาร</option>
                            <option value="ของหวาน">ของหวาน</option>
                        </select>
                        <div class="add-place-popup-actions" style="margin-top:10px; display:flex; gap:5px;">
                            <button type="submit" style="flex:1; background:var(--primary-red); color:white; border:none; padding:5px; border-radius:4px;">บันทึก</button>
                            <button type="button" id="btn-pop-cancel" style="flex:1; background:#ccc; border:none; padding:5px; border-radius:4px;">ยกเลิก</button>
                        </div>
                    </form>
                </div>`;
            tempMarker = L.marker([lat, lng], { icon: redIcon, draggable: true }).addTo(map);
            tempMarker.bindPopup(popupContent, { maxWidth: 250 }).openPopup();

            setTimeout(() => {
                const form = document.getElementById('quick-add-place-form');
                if (form) form.addEventListener('submit', async (ev) => {
                    ev.preventDefault();
                    const name = document.getElementById('new-place-name').value;
                    const cat = document.getElementById('new-place-category').value;
                    if (supabaseClient) {
                        try {
                            const position = tempMarker.getLatLng().wrap();
                            const { error } = await supabaseClient.from('places').insert([{
                                name: name,
                                category: cat,
                                'google map': `https://www.google.com/maps/search/?api=1&query=${position.lat.toFixed(7)},${position.lng.toFixed(7)}`
                            }]);
                            if (error) throw error;
                            showToast('เพิ่มร้านค้าลงบนแผนที่สำเร็จ!');
                            fetchAndRenderMapData();
                        } catch (err) { showToast('ข้อผิดพลาด: ' + err.message, 'fa-triangle-exclamation'); }
                    }
                    exitAddMode();
                });
                const cancelBtn = document.getElementById('btn-pop-cancel');
                if (cancelBtn) cancelBtn.addEventListener('click', exitAddMode);
            }, 100);
        });
    }

    // ==========================================
    // 10. ระบบการสุ่มไพ่ร้านค้า และบันทึกประวัติการสุ่มอัตโนมัติ (random.html - S2-03)
    // ==========================================
    const tarotCard = document.getElementById('tarotCard');
    const btnRandom = document.getElementById('btnRandom');

    if (tarotCard && btnRandom) {
        const randomizerStage = document.getElementById('randomizerStage');
        const categorySelect = document.getElementById('random-category');
        const randomPageCount = document.getElementById('random-page-history-count');
        const randomStatus = document.getElementById('random-status');
        const celebrationLayer = document.getElementById('celebrationLayer');
        let drawDeck = [];
        let deckSignature = '';
        let lastDrawnId = null;
        let isDrawing = false;
        if (randomPageCount) randomPageCount.textContent = getRandomHistory().length;

        const getAvailableShops = async () => {
            if (!supabaseClient) throw new Error('ไม่สามารถเชื่อมต่อฐานข้อมูลได้');
            const { data, error } = await supabaseClient.from('places').select('*');
            if (error) throw error;
            return Array.isArray(data) ? data : [];
        };

        const getShopCategory = (shop) => String(shop.category || '').trim();

        const populateCategoryFilter = (shops) => {
            if (!categorySelect) return;
            const selectedValue = categorySelect.value;
            const categories = [...new Set(shops.map(getShopCategory).filter(Boolean))]
                .sort((first, second) => first.localeCompare(second, 'th'));
            categorySelect.replaceChildren();

            const allOption = new Option('ทุกประเภทร้าน', 'all');
            categorySelect.add(allOption);
            categories.forEach((category) => categorySelect.add(new Option(category, category)));
            categorySelect.value = categories.includes(selectedValue) ? selectedValue : 'all';
            categorySelect.disabled = false;
        };

        // Categories are read from the same shop collection used by the randomizer,
        // avoiding a second, hard-coded category list that can drift from real data.
        getAvailableShops().then(populateCategoryFilter).catch(() => {
            if (randomStatus) randomStatus.textContent = 'ไม่สามารถโหลดร้านค้าสำหรับการสุ่มได้';
            btnRandom.disabled = true;
        });

        // A Fisher-Yates deck guarantees one equally likely pass through every eligible shop
        // before a shop can appear again. Keeping the last card out of the next deck's first
        // draw also avoids the disappointing immediate repeat when a new pass begins.
        const shuffle = (items) => {
            const shuffled = [...items];
            for (let index = shuffled.length - 1; index > 0; index--) {
                const randomIndex = Math.floor(Math.random() * (index + 1));
                [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
            }
            return shuffled;
        };

        const createDeck = (shops, signature) => {
            drawDeck = shuffle(shops);
            if (drawDeck.length > 1 && drawDeck[drawDeck.length - 1].id === lastDrawnId) {
                const swapIndex = Math.floor(Math.random() * (drawDeck.length - 1));
                [drawDeck[drawDeck.length - 1], drawDeck[swapIndex]] = [drawDeck[swapIndex], drawDeck[drawDeck.length - 1]];
            }
            deckSignature = signature;
        };

        const celebrateReveal = () => {
            if (!celebrationLayer || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
            const colors = ['var(--accent-gold)', 'var(--primary-red)', 'var(--text-muted)'];
            const particles = Array.from({ length: 22 }, (_, index) => {
                const particle = document.createElement(index % 4 === 0 ? 'span' : 'i');
                const angle = (Math.PI * 2 * index) / 22;
                const distance = 80 + Math.random() * 155;
                if (particle.tagName === 'SPAN') {
                    particle.className = 'sparkle';
                    particle.textContent = '✦';
                    particle.style.setProperty('--sparkle-x', `${Math.cos(angle) * distance}px`);
                    particle.style.setProperty('--sparkle-y', `${Math.sin(angle) * distance}px`);
                } else {
                    particle.className = 'confetti';
                    particle.style.setProperty('--confetti-color', colors[index % colors.length]);
                    particle.style.setProperty('--confetti-x', `${Math.cos(angle) * distance}px`);
                    particle.style.setProperty('--confetti-y', `${Math.sin(angle) * distance}px`);
                    particle.style.setProperty('--confetti-rotate', `${Math.floor(Math.random() * 540 - 270)}deg`);
                }
                celebrationLayer.appendChild(particle);
                return particle;
            });
            window.setTimeout(() => particles.forEach(particle => particle.remove()), 1100);
        };

        const pickRandomShop = async () => {
            if (isDrawing) return;
            isDrawing = true;
            const catFilter = categorySelect?.value || 'all';
            const priceFilter = document.getElementById('random-price').value;
            let availableShops;
            try { availableShops = await getAvailableShops(); }
            catch (error) {
                showToast('ไม่สามารถโหลดร้านค้าสำหรับการสุ่มได้', 'fa-triangle-exclamation');
                isDrawing = false;
                return;
            }
            populateCategoryFilter(availableShops);

            let filtered = availableShops.filter(shop => {
                const matchCat = catFilter === 'all' || getShopCategory(shop) === catFilter;

                const priceInfo = getPriceDisplayInfo(shop);
                const matchPrice = (priceFilter === 'all' || priceInfo.symbol === priceFilter);
                return matchCat && matchPrice;
            });

            if (filtered.length === 0) {
                showToast('ไม่พบร้านตามเงื่อนไขที่เลือก ลองเปลี่ยนตัวกรองดูนะครับ!', 'fa-circle-info');
                isDrawing = false;
                return;
            }

            const signature = `${catFilter}|${priceFilter}|${filtered.map(shop => shop.id).sort().join('|')}`;
            if (deckSignature !== signature || drawDeck.length === 0) createDeck(filtered, signature);
            const selected = drawDeck.pop();
            const priceInfo = getPriceDisplayInfo(selected);
            const { rating } = getEffectivePlaceRatingAndCount(selected);

            const updateCardData = () => {
                document.getElementById('res-title').textContent = selected.name || 'ยังไม่มีข้อมูลชื่อร้าน';
                const resImg = document.getElementById('res-img');
                resImg.referrerPolicy = 'no-referrer';
                setPlaceImage(resImg, getPlaceImage(selected), selected.name);
                document.getElementById('res-rating').textContent = rating ?? 'ยังไม่มีข้อมูลคะแนน';
                document.getElementById('res-cat').textContent = selected.category || 'ยังไม่มีข้อมูลหมวดหมู่';
                document.getElementById('res-price').textContent = priceInfo.fullLabel;
                document.getElementById('res-desc').textContent = getPlaceSummaryText(selected);
                document.getElementById('res-link').href = `detail.html?id=${selected.id}`;
            };

            btnRandom.disabled = true;
            btnRandom.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> กำลังสับไพ่...';
            tarotCard.classList.remove('flipped');
            randomizerStage?.classList.add('is-shuffling');
            tarotCard.classList.add('is-shuffling');
            if (randomStatus) randomStatus.textContent = 'กำลังสับไพ่ให้คุณ...';

            await new Promise(resolve => window.setTimeout(resolve, 900));
            updateCardData();
            randomizerStage?.classList.remove('is-shuffling');
            tarotCard.classList.remove('is-shuffling');
            tarotCard.classList.add('flipped');
            tarotCard.classList.add('is-revealing');
            celebrateReveal();
            window.setTimeout(() => tarotCard.classList.remove('is-revealing'), 750);
            if (randomStatus) randomStatus.textContent = `ได้แล้ว! ${selected.name} คือคำตอบของคุณวันนี้`;

            // S2-03: บันทึกร้านค้าที่สุ่มได้ลงประวัติการสุ่มร้านค้าย้อนหลังทันที
            await addRandomHistory(selected);
            showToast(`สุ่มได้ร้าน "${selected.name}" (บันทึกเข้าประวัติในโปรไฟล์แล้ว)`, 'fa-dice');
            lastDrawnId = selected.id;
            btnRandom.disabled = false;
            btnRandom.innerHTML = '<i class="fa-solid fa-dice"></i> สุ่มอีกครั้ง!';
            isDrawing = false;
        };
        btnRandom.addEventListener('click', pickRandomShop);
        tarotCard.addEventListener('click', (event) => {
            if (!event.target.closest('#res-link')) pickRandomShop();
        });
        tarotCard.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                pickRandomShop();
            }
        });
    }

    // ==========================================
    // 11. ระบบกิจกรรม: สิทธิ์เพิ่มกิจกรรมและตัวกรองระยะทาง (events.html)
    // ==========================================
    const eventsPage = document.getElementById('events-page');
    if (eventsPage) {
        const eventsGrid = document.querySelector('.events-grid');
        const filterPills = document.querySelectorAll('.tag-pill');
        const distanceSelect = document.getElementById('event-distance-range');
        const locateEventsBtn = document.getElementById('event-use-location');
        const locationStatus = document.getElementById('event-location-status');
        const activityForm = document.getElementById('add-activity-form');
        const activityDialog = document.getElementById('add-activity-dialog');
        const addActivityBtn = document.getElementById('add-activity-btn');
        const closeActivityDialog = document.getElementById('close-activity-dialog');
        let selectedCategory = 'all';
        let userCoordinates = null;

        const eventStatuses = {
            upcoming: { text: '⏳ เร็วๆ นี้', className: 'status-upcoming' },
            ongoing: { text: '🔥 กำลังจัดอยู่', className: 'status-ongoing' },
            pending: { text: 'กำหนดการรอยืนยัน', className: 'status-upcoming' }
        };
        const eventDateFormat = new Intl.DateTimeFormat('th-TH', {
            timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short'
        });

        const loadRealEvents = async () => {
            if (!eventsGrid) return;
            eventsGrid.innerHTML = '<p class="data-state">กำลังโหลดกิจกรรม...</p>';
            try {
                if (!supabaseClient) throw new Error('ไม่สามารถเชื่อมต่อฐานข้อมูลได้');
                const { data: events, error } = await supabaseClient.from('events').select('*,event_status').order('created_at', { ascending: false });
                if (error) throw error;

                eventsGrid.innerHTML = '';
                const categoryNames = { food: 'อาหาร & ตลาดนัด', sports: 'กีฬา & กิจกรรม', promo: 'โปรโมชันส่วนลด', concert: 'คอนเสิร์ต & ดนตรี' };

                const activeEvents = (events || []).filter(item => item.event_status !== 'expired');
                if (!activeEvents.length) {
                    eventsGrid.innerHTML = '<p class="data-state">ยังไม่มีกิจกรรมที่กำลังจะมาถึง</p>';
                    return;
                }
                activeEvents.forEach(item => {
                    const status = eventStatuses[item.event_status] || eventStatuses.pending;
                    const dateLabel = item.event_status !== 'pending' && item.start_at && item.end_at
                        ? `${eventDateFormat.format(new Date(item.start_at))} – ${eventDateFormat.format(new Date(item.end_at))}`
                        : item.dateTime || '';
                    const card = document.createElement('div');
                    card.className = 'event-card';
                    card.dataset.category = `${item.category || 'food'} ${item.event_status === 'pending' ? 'upcoming' : item.event_status}`;
                    if (item.lat && item.lng) { card.dataset.lat = item.lat; card.dataset.lng = item.lng; }

                    card.innerHTML = `
                        <div class="event-img-wrapper">
                            <img src="${escapeHTML(item.image_url)}" alt="${escapeHTML(item.title || 'กิจกรรม')}" onerror="this.closest('.event-img-wrapper').classList.add('image-unavailable'); this.remove();">
                            <span class="event-status-badge ${status.className}">${status.text}</span>
                            <span class="event-cat-badge">${categoryNames[item.category] || 'กิจกรรม'}</span>
                        </div>
                        <div class="event-body">
                            <h3>${escapeHTML(item.title)}</h3>
                            <p>${escapeHTML(item.description)}</p>
                            <div class="event-meta-info">
                                <div class="event-meta-item"><i class="fa-regular fa-calendar"></i> ${escapeHTML(dateLabel)}</div>
                                <div class="event-meta-item"><i class="fa-solid fa-location-dot"></i> ${escapeHTML(item.location)}</div>
                            </div>
                        </div>`;
                    eventsGrid.appendChild(card);
                });
                applyEventFilters();
            } catch (error) {
                console.error('Events fetch error:', error);
                eventsGrid.innerHTML = '<p class="data-state data-state-error">ไม่สามารถโหลดกิจกรรมได้ กรุณาลองใหม่อีกครั้ง</p>';
            }
        };

        const distanceInKm = (a, b) => {
            const toRad = deg => deg * Math.PI / 180;
            const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
            const val = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
            return 6371 * 2 * Math.atan2(Math.sqrt(val), Math.sqrt(1 - val));
        };

        function applyEventFilters() {
            const maxDistance = (!distanceSelect || distanceSelect.value === 'all') ? null : Number(distanceSelect.value);
            document.querySelectorAll('.event-card').forEach(card => {
                const matchCat = selectedCategory === 'all' || (card.dataset.category || '').split(' ').includes(selectedCategory);
                const lat = Number(card.dataset.lat), lng = Number(card.dataset.lng);
                const hasCoords = !Number.isNaN(lat) && !Number.isNaN(lng);
                const matchDist = !maxDistance || !hasCoords || (userCoordinates && distanceInKm(userCoordinates, { lat, lng }) <= maxDistance);
                const visible = matchCat && matchDist;
                card.style.display = visible ? 'flex' : 'none';
            });
        }

        function requestEventLocation() {
            const TU_CENTER = { lat: 14.0722, lng: 100.6067 };
            if (!navigator.geolocation) {
                if (locationStatus) locationStatus.textContent = '📍 อ้างอิงศูนย์กลาง มธ. (ไม่มี GPS)';
                userCoordinates = TU_CENTER;
                applyEventFilters();
                return;
            }
            if (locateEventsBtn) locateEventsBtn.disabled = true;
            if (locationStatus) locationStatus.textContent = 'กำลังหาตำแหน่ง...';
            navigator.geolocation.getCurrentPosition(
                pos => {
                    userCoordinates = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                    if (locationStatus) locationStatus.textContent = '📍 กรองตามตำแหน่งของคุณ';
                    if (locateEventsBtn) locateEventsBtn.disabled = false;
                    applyEventFilters();
                },
                () => {
                    if (locationStatus) locationStatus.textContent = '📍 อ้างอิงศูนย์กลาง มธ. (ไม่ได้เปิด GPS)';
                    userCoordinates = TU_CENTER;
                    if (locateEventsBtn) locateEventsBtn.disabled = false;
                    applyEventFilters();
                },
                { enableHighAccuracy: true, timeout: 4000 }
            );
        }

        if (activityForm) {
            activityForm.addEventListener('submit', async event => {
                event.preventDefault();
                if (!supabaseClient) return;
                const { data: { session } } = await supabaseClient.auth.getSession();
                if (!session) {
                    showToast('กรุณาเข้าสู่ระบบก่อนเพิ่มกิจกรรม', 'fa-lock');
                    return;
                }

                const formData = new FormData(activityForm);
                const startAt = new Date(`${formData.get('dateTime')}+07:00`);
                const endAt = new Date(`${formData.get('endDateTime')}+07:00`);
                if (!(endAt > startAt)) {
                    showToast('วันและเวลาสิ้นสุดต้องอยู่หลังเวลาเริ่มต้น', 'fa-triangle-exclamation');
                    return;
                }

                const btn = activityForm.querySelector('button[type="submit"]');
                if (btn) { btn.disabled = true; btn.textContent = 'กำลังบันทึก...'; }

                try {
                    const { error } = await supabaseClient.from('events').insert([{
                        title: formData.get('title'),
                        description: formData.get('description'),
                        location: formData.get('location'),
                        category: formData.get('category'),
                        dateTime: formData.get('dateTime'),
                        start_at: startAt.toISOString(),
                        end_at: endAt.toISOString(),
                        user_id: session.user.id
                    }]);
                    if (error) throw error;
                    activityForm.reset();
                    if (activityDialog) activityDialog.close();
                    loadRealEvents();
                    showToast('บันทึกกิจกรรมเรียบร้อย!');
                } catch (err) {
                    showToast('เกิดข้อผิดพลาด: ' + err.message, 'fa-triangle-exclamation');
                } finally {
                    if (btn) { btn.disabled = false; btn.textContent = 'บันทึกกิจกรรม'; }
                }
            });
        }

        filterPills.forEach(p => p.addEventListener('click', () => {
            filterPills.forEach(b => b.classList.remove('active'));
            p.classList.add('active');
            selectedCategory = p.dataset.category;
            applyEventFilters();
        }));

        if (locateEventsBtn) locateEventsBtn.addEventListener('click', requestEventLocation);
        if (distanceSelect) distanceSelect.addEventListener('change', () => {
            if (distanceSelect.value !== 'all' && !userCoordinates) requestEventLocation();
            else applyEventFilters();
        });
        if (addActivityBtn && activityDialog) addActivityBtn.addEventListener('click', () => activityDialog.showModal());
        if (closeActivityDialog && activityDialog) closeActivityDialog.addEventListener('click', () => activityDialog.close());

        loadRealEvents();

        if (supabaseClient) {
            supabaseClient.auth.getSession().then(({ data: { session } }) => {
                if (addActivityBtn) addActivityBtn.hidden = !session;
            });
        }
    }
});
