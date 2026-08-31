// ==========================================
// 1. ระบบ Dark / Light Mode
// ==========================================
(function applyInitialTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark-mode');
        if (document.body) document.body.classList.add('dark-mode');
    }
})();

document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
    }

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
            localStorage.setItem('theme', isDarkNow ? 'dark' : 'light');
            
            btn.innerHTML = isDarkNow ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
        }
    });

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
    // 3. ฟังก์ชันสลับปุ่ม เข้าสู่ระบบ / ออกจากระบบ บน Navbar
    // ==========================================
    async function checkGlobalAuthNavbar() {
        if (!supabaseClient) return;
        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            const loginBtns = document.querySelectorAll('.header-right a[href="login.html"], .header-right #global-logout-btn');
            
            loginBtns.forEach(btn => {
                if (session && session.user) {
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
        } catch (err) {
            console.log('Navbar Auth Check:', err);
        }
    }

    checkGlobalAuthNavbar();

    // ==========================================
    // 4. ข้อมูล Mock Data สำรอง
    // ==========================================
    const mockPlaces = [
        {
            id: 1,
            name: 'The Quad Coffee',
            category: 'คาเฟ่และพื้นที่อ่านหนังสือ',
            rating: 4.8,
            distance_km: 0.2,
            is_open: true,
            discount: 'ส่วนลดนักศึกษา 15%',
            image_url: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&q=80&w=500'
        },
        {
            id: 2,
            name: 'ศูนย์อาหาร SC (Green Canteen)',
            category: 'อาหารและเครื่องดื่ม',
            rating: 4.5,
            distance_km: 0.5,
            is_open: true,
            discount: '',
            image_url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=500'
        },
        {
            id: 3,
            name: 'เดอะ เดลี่ แกรนด์ คาเฟ่',
            category: 'คาเฟ่และอาหารว่าง',
            rating: 4.6,
            distance_km: 0.8,
            is_open: true,
            discount: 'เมนูใหม่โปรแรง',
            image_url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=500'
        }
    ];

    // ==========================================
    // 5. ระบบ บันทึกร้านค้า (Bookmarks / Saved Places)
    // ==========================================
    const getSavedPlaces = () => {
        return JSON.parse(localStorage.getItem('saved_places_ids')) || [];
    };

    const toggleSavePlace = (placeId) => {
        let saved = getSavedPlaces();
        const strId = String(placeId);
        if (saved.includes(strId)) {
            saved = saved.filter(id => id !== strId);
        } else {
            saved.push(strId);
        }
        localStorage.setItem('saved_places_ids', JSON.stringify(saved));
        return saved.includes(strId);
    };

    function createCardHTML(place) {
        const savedPlaces = getSavedPlaces();
        const isSaved = savedPlaces.includes(String(place.id));
        const heartClass = isSaved ? 'fa-solid fa-heart saved' : 'fa-regular fa-heart';
        const badgeDiscountHTML = place.discount 
            ? `<span class="badge badge-discount">${place.discount}</span>` 
            : '';

        return `
            <div class="card-link" style="position: relative;">
                <button class="bookmark-btn" data-id="${place.id}" title="บันทึกร้านนี้" style="position: absolute; top: 10px; right: 10px; z-index: 10; background: rgba(255,255,255,0.85); border: none; border-radius: 50%; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; cursor: pointer; backdrop-filter: blur(4px); transition: all 0.2s;">
                    <i class="${heartClass}" style="color: ${isSaved ? '#e63946' : '#666'}; font-size: 16px;"></i>
                </button>
                <a href="detail.html?id=${place.id}" style="text-decoration: none; color: inherit;">
                    <div class="card">
                        <div class="card-image">
                            <img src="${place.image_url || 'https://images.unsplash.com/photo-1554118811-1e0d58224f24'}" alt="${place.name}">
                            <span class="badge badge-rating">★ ${place.rating || '0'}</span>
                            ${badgeDiscountHTML}
                        </div>
                        <div class="card-info">
                            <h3>${place.name}</h3>
                            <p class="desc">${place.category || 'ร้านอาหาร'}</p>
                            <div class="card-footer">
                                <span>📍 ${place.distance_km !== undefined ? 'ใกล้ ' + place.distance_km + ' กม.' : ''}</span>
                                <span class="price">$$</span>
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
            } else {
                icon.className = 'fa-regular fa-heart';
                icon.style.color = '#666';
                
                const savedContainer = document.getElementById('saved-cards-grid');
                if (savedContainer) {
                    bookmarkBtn.closest('.card-link').remove();
                    if (savedContainer.children.length === 0) {
                        savedContainer.innerHTML = '<p style="grid-column: span 3; text-align: center; color: var(--text-muted); padding: 40px 0;">ยังไม่มีรายการที่บันทึกไว้</p>';
                    }
                }
            }
        }
    });

    // ==========================================
    // 6. ตัวกรองและแสดงผลการ์ดร้านค้า
    // ==========================================
    const filterOpen = document.getElementById('filter-open');
    const filterDistance = document.getElementById('filter-distance');
    const filterRating = document.getElementById('filter-rating');
    const cardGrid = document.querySelector('.card-grid');

    if (cardGrid && !document.getElementById('saved-cards-grid')) {
        const fetchFilteredPlaces = async () => {
            let placesToRender = [];

            if (supabaseClient) {
                try {
                    let query = supabaseClient.from('places').select('*');
                    if (filterOpen && filterOpen.checked) query = query.eq('is_open', true);
                    if (filterDistance && filterDistance.checked) query = query.lte('distance_km', 1.0);
                    if (filterRating && filterRating.checked) query = query.gte('rating', 4.0);

                    const { data, error } = await query;
                    if (!error && data && data.length > 0) {
                        placesToRender = data;
                    }
                } catch (err) {
                    console.error('Supabase fetch error:', err);
                }
            }

            if (placesToRender.length === 0) {
                placesToRender = mockPlaces.filter(place => {
                    if (filterOpen && filterOpen.checked && !place.is_open) return false;
                    if (filterDistance && filterDistance.checked && place.distance_km > 1.0) return false;
                    if (filterRating && filterRating.checked && place.rating < 4.0) return false;
                    return true;
                });
            }

            renderPlaces(placesToRender);
        };

        function renderPlaces(placesData) {
            cardGrid.innerHTML = ''; 
            if (placesData.length === 0) {
                cardGrid.innerHTML = '<p style="grid-column: span 3; text-align: center; color: var(--text-muted); padding: 40px 0;">ไม่พบร้านค้าที่ตรงกับเงื่อนไข</p>';
                return;
            }

            placesData.forEach(place => {
                cardGrid.innerHTML += createCardHTML(place);
            });
        }

        if (filterOpen) filterOpen.addEventListener('change', fetchFilteredPlaces);
        if (filterDistance) filterDistance.addEventListener('change', fetchFilteredPlaces);
        if (filterRating) filterRating.addEventListener('change', fetchFilteredPlaces);

        fetchFilteredPlaces();
    }

    // ==========================================
    // 7. แสดงผลร้านค้าในหน้า "รายการที่บันทึก" (profile.html)
    // ==========================================
    const savedCardsGrid = document.getElementById('saved-cards-grid');
    if (savedCardsGrid) {
        const loadSavedPlaces = async () => {
            const savedIds = getSavedPlaces();
            if (savedIds.length === 0) {
                savedCardsGrid.innerHTML = '<p style="grid-column: span 3; text-align: center; color: var(--text-muted); padding: 40px 0;">ยังไม่มีรายการที่บันทึกไว้</p>';
                return;
            }

            let savedPlacesData = [];
            if (supabaseClient) {
                try {
                    const { data, error } = await supabaseClient
                        .from('places')
                        .select('*')
                        .in('id', savedIds);
                    if (!error && data) savedPlacesData = data;
                } catch (err) {
                    console.error(err);
                }
            }

            if (savedPlacesData.length === 0) {
                savedPlacesData = mockPlaces.filter(place => savedIds.includes(String(place.id)));
            }

            savedCardsGrid.innerHTML = '';
            if (savedPlacesData.length === 0) {
                savedCardsGrid.innerHTML = '<p style="grid-column: span 3; text-align: center; color: var(--text-muted); padding: 40px 0;">ยังไม่มีรายการที่บันทึกไว้</p>';
                return;
            }

            savedPlacesData.forEach(place => {
                savedCardsGrid.innerHTML += createCardHTML(place);
            });
        };

        loadSavedPlaces();
    }

    // ==========================================
    // 8. จัดการข้อมูลโปรไฟล์ & ดึงอีเมลมาแสดงอัตโนมัติ
    // ==========================================
    const editProfileBtn = document.getElementById('edit-profile-btn');
    const editProfileForm = document.getElementById('edit-profile-form');
    const logoutBtn = document.getElementById('logout-btn');
    const unauthView = document.getElementById('unauthenticated-view');
    const authView = document.getElementById('authenticated-view');
    
    const profileNameEl = document.getElementById('profile-name');
    const profileAvatarEl = document.getElementById('profile-avatar');
    const profileUsernameEl = document.getElementById('edit-username'); 
    const profileFacultyEl = document.getElementById('edit-faculty');   
    const profileEmailDisplay = document.getElementById('profile-email-display');

    const editFullnameInput = document.getElementById('edit-fullname');
    const editUsernameInput = document.getElementById('edit-username');
    const editFacultyInput = document.getElementById('edit-faculty');

    // โหลดข้อมูลโปรไฟล์และอีเมลจาก Supabase Session
    if (authView && unauthView && supabaseClient) {
        supabaseClient.auth.getSession().then(({ data: { session } }) => {
            if (!session || !session.user) {
                unauthView.style.display = 'block';
                authView.style.display = 'none';
            } else {
                unauthView.style.display = 'none';
                authView.style.display = 'flex';

                const user = session.user;
                const name = user.user_metadata?.full_name || user.email.split('@')[0];
                const email = user.email; // อีเมลจริงของผู้ใช้

                const username = user.user_metadata?.username || email.split('@')[0];
                const faculty = user.user_metadata?.faculty || '';

                // นำค่าไปใส่ในฟอร์มและส่วนแสดงผล
                if (editFullnameInput) editFullnameInput.value = name;
                if (editUsernameInput) editUsernameInput.value = username;
                if (editFacultyInput) editFacultyInput.value = faculty;
                
                if (profileEmailDisplay) {
                    profileEmailDisplay.textContent = email; // แสดงอีเมลจริงทันที
                }
                
                if (profileAvatarEl) {
                    if (user.user_metadata?.avatar_url) {
                        profileAvatarEl.innerHTML = `<img src="${user.user_metadata.avatar_url}" alt="Avatar" style="width:100%; height:100%; object-fit:cover;">`;
                    } else {
                        profileAvatarEl.textContent = name.charAt(0).toUpperCase();
                    }
                }

                const savedPlaces = getSavedPlaces();
                const savedCountEl = document.getElementById('saved-count');
                if (savedCountEl) savedCountEl.textContent = savedPlaces.length;
            }
        });
    }

    if (editProfileForm && supabaseClient) {
        editProfileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newName = editFullnameInput ? editFullnameInput.value.trim() : '';
            const newUsername = editUsernameInput ? editUsernameInput.value.trim() : '';
            const newFaculty = editFacultyInput ? editFacultyInput.value.trim() : '';

            if (newName && profileAvatarEl) {
                profileAvatarEl.textContent = newName.charAt(0).toUpperCase();
            }

            try {
                await supabaseClient.auth.updateUser({
                    data: {
                        full_name: newName,
                        username: newUsername,
                        faculty: newFaculty
                    }
                });
                alert('บันทึกข้อมูลเรียบร้อยแล้ว!');
            } catch (err) {
                console.error('Update metadata error:', err);
                alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
            }
        });
    }

    if (logoutBtn && supabaseClient) {
        logoutBtn.addEventListener('click', async () => {
            await supabaseClient.auth.signOut();
            window.location.reload();
        });
    }

    // ==========================================
    // 9. ดึงข้อมูลและแสดงผลรีวิว (review.html / detail.html)
    // ==========================================
    const reviewsContentArea = document.getElementById('reviews-content-area');
    
    const loadReviews = async () => {
        if (!reviewsContentArea || !supabaseClient) return;

        try {
            const urlParams = new URLSearchParams(window.location.search);
            const placeId = urlParams.get('id') || 1; 

            const { data: reviews, error } = await supabaseClient
                .from('reviews')
                .select('*')
                .eq('place_id', placeId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            reviewsContentArea.innerHTML = ''; 

            if (!reviews || reviews.length === 0) {
                reviewsContentArea.innerHTML = '<p style="color:var(--text-muted); font-size:14px; text-align:center;">ยังไม่มีรีวิว เป็นคนแรกที่ให้คะแนนสิ!</p>';
                return;
            }

            reviews.forEach(review => {
                const dateStr = new Date(review.created_at).toLocaleDateString('th-TH');
                const stars = '⭐'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
                
                let imagesHTML = '';
                if (review.image_urls && review.image_urls.length > 0) {
                    imagesHTML = '<div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:10px;">';
                    review.image_urls.forEach(url => {
                        imagesHTML += `<img src="${url}" style="width:80px; height:80px; object-fit:cover; border-radius:8px; border:1px solid var(--border-color);">`;
                    });
                    imagesHTML += '</div>';
                }
                
                const reviewHTML = `
                    <div class="review-item">
                        <div class="review-header">
                            <div class="review-user">
                                <div class="review-avatar">${review.user_avatar || 'U'}</div>
                                <span>${review.user_name || 'ผู้ใช้งาน'}</span>
                            </div>
                            <span class="review-date">${dateStr}</span>
                        </div>
                        <div class="review-stars">${stars}</div>
                        <p class="review-text">${review.comment}</p>
                        ${imagesHTML}
                    </div>
                `;
                reviewsContentArea.insertAdjacentHTML('beforeend', reviewHTML);
            });
        } catch (err) { 
            console.error('Error loading reviews:', err); 
        }
    };

    loadReviews();

    // ==========================================
    // 10. ส่งฟอร์มรีวิว + อัปโหลดรูปภาพ
    // ==========================================
    const reviewForm = document.getElementById('review-form');
    const fileInput = document.getElementById('review-photo');
    const previewContainer = document.getElementById('image-preview-container');
    const submitBtn = document.getElementById('submit-review-btn');
    let selectedFiles = [];

    if (fileInput && previewContainer) {
        fileInput.addEventListener('change', (e) => {
            selectedFiles = selectedFiles.concat(Array.from(e.target.files));
            renderPreviews();
            fileInput.value = '';
        });
    }

    function renderPreviews() {
        if (!previewContainer) return;
        previewContainer.innerHTML = '';
        selectedFiles.forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const imgWrapper = document.createElement('div');
                imgWrapper.style.position = 'relative';
                
                const img = document.createElement('img');
                img.src = e.target.result;
                img.style.cssText = 'width:70px; height:70px; object-fit:cover; border-radius:8px;';

                const delBtn = document.createElement('button');
                delBtn.innerHTML = '×';
                delBtn.style.cssText = 'position:absolute; top:-5px; right:-5px; background:var(--primary-red); color:white; border:none; border-radius:50%; width:20px; height:20px; cursor:pointer;';
                
                delBtn.onclick = (event) => {
                    event.preventDefault();
                    selectedFiles.splice(index, 1);
                    renderPreviews();
                };

                imgWrapper.appendChild(img);
                imgWrapper.appendChild(delBtn);
                previewContainer.appendChild(imgWrapper);
            };
            reader.readAsDataURL(file);
        });
    }

    if (reviewForm) {
        reviewForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (!supabaseClient) {
                alert('ระบบ Supabase ไม่พร้อมใช้งานในขณะนี้');
                return;
            }

            const { data: { session } } = await supabaseClient.auth.getSession();
            if (!session || !session.user) {
                alert('กรุณาเข้าสู่ระบบก่อนทำการเขียนรีวิวนะครับ!');
                window.location.href = 'login.html';
                return;
            }

            const ratingInput = document.querySelector('input[name="rating"]:checked');
            const commentInput = document.getElementById('review-comment').value;

            if (!ratingInput) return alert('กรุณาให้คะแนนดาวก่อนส่งรีวิวนะครับ!');
            if (!commentInput.trim()) return alert('กรุณากรอกความคิดเห็นของคุณ');

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = 'กำลังส่งข้อมูล...';
            }

            try {
                const userName = session.user.user_metadata?.full_name || session.user.email.split('@')[0];
                const userAvatar = userName.charAt(0).toUpperCase();

                const urlParams = new URLSearchParams(window.location.search);
                const placeId = urlParams.get('id') || 1; 

                let uploadedImageUrls = [];
                for (let file of selectedFiles) {
                    const fileExt = file.name.split('.').pop();
                    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
                    const filePath = `reviews_place_${placeId}/${fileName}`;

                    const { error: uploadError } = await supabaseClient.storage
                        .from('review-images')
                        .upload(filePath, file);

                    if (uploadError) throw uploadError;

                    const { data: { publicUrl } } = supabaseClient.storage
                        .from('review-images')
                        .getPublicUrl(filePath);

                    uploadedImageUrls.push(publicUrl);
                }

                const { error: insertError } = await supabaseClient
                    .from('reviews')
                    .insert([{
                        place_id: placeId,
                        user_name: userName,
                        user_avatar: userAvatar,
                        rating: parseInt(ratingInput.value),
                        comment: commentInput,
                        image_urls: uploadedImageUrls
                    }]);

                if (insertError) throw insertError;

                alert('ส่งรีวิวเรียบร้อยแล้ว!');
                reviewForm.reset();
                document.querySelectorAll('input[name="rating"]').forEach(el => el.checked = false);
                selectedFiles = [];
                renderPreviews();
                loadReviews();

            } catch (err) {
                console.error('Submit error:', err);
                alert('เกิดข้อผิดพลาดในการส่งรีวิว กรุณาลองใหม่อีกครั้ง');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = 'ส่งรีวิว';
                }
            }
        });
    }
});

// ==========================================
// 11. ระบบ Map UI และ แผนที่วิทยาเขต (Leaflet.js)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const mapElement = document.getElementById('map');
    if (!mapElement) return; // หากหน้าเว็บไม่มี element #map จะข้ามการทำงานส่วนนี้ทันที

    // ค่าพิกัดเริ่มต้นศูนย์กลาง มหาวิทยาลัยธรรมศาสตร์ ศูนย์รังสิต
    const defaultCenter = [14.0677, 100.6014]; 
    const map = L.map('map').setView(defaultCenter, 15);

    // เพิ่ม Tile Layer (แผนที่ฐาน OpenStreetMap)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    let isAddMode = false;
    let tempMarker = null;

    // สร้างปุ่มควบคุมและแบนเนอร์บนแผนที่แบบ Dynamic หากยังไม่มีใน HTML
    const mapWrapper = mapElement.closest('.map-wrapper') || mapElement.parentElement;
    
    // Banner แจ้งเตือนโหมดปักหมุด
    let banner = mapWrapper.querySelector('.pin-mode-banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.className = 'pin-mode-banner';
        banner.innerHTML = '<i class="fa-solid fa-location-dot"></i> กรุณาคลิกบนแผนที่เพื่อเลือกตำแหน่งร้านค้าใหม่';
        mapWrapper.appendChild(banner);
    }

    // แถบปุ่มควบคุมมุมขวาล่าง
    let controlsGroup = mapWrapper.querySelector('.map-controls-group');
    if (!controlsGroup) {
        controlsGroup = document.createElement('div');
        controlsGroup.className = 'map-controls-group';
        
        // ปุ่มสลับโหมดปักหมุด
        const addModeBtn = document.createElement('button');
        addModeBtn.className = 'map-control-btn add-mode-btn';
        addModeBtn.innerHTML = '<i class="fa-solid fa-plus"></i> เพิ่มร้านค้าบนแผนที่';
        
        // ปุ่มรีเซ็ตตำแหน่งแผนที่
        const resetLocBtn = document.createElement('button');
        resetLocBtn.className = 'map-control-btn';
        resetLocBtn.innerHTML = '<i class="fa-solid fa-crosshairs"></i> ตำแหน่งของฉัน';
        
        controlsGroup.appendChild(addModeBtn);
        controlsGroup.appendChild(resetLocBtn);
        mapWrapper.appendChild(controlsGroup);
    }

    const addModeBtn = controlsGroup.querySelector('.add-mode-btn');
    const resetLocBtn = controlsGroup.querySelector('.map-control-btn:not(.add-mode-btn)');

    // สลับโหมดปักหมุดเมื่อคลิกปุ่ม
    if (addModeBtn) {
        addModeBtn.addEventListener('click', () => {
            isAddMode = !isAddMode;
            if (isAddMode) {
                addModeBtn.classList.add('active');
                addModeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i> ยกเลิกการปักหมุด';
                banner.style.display = 'block';
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
        banner.style.display = 'none';
        mapElement.style.cursor = '';
        if (tempMarker) {
            map.removeLayer(tempMarker);
            tempMarker = null;
        }
    }

    // ฟังก์ชันระบุตำแหน่งปัจจุบันของผู้ใช้จริง (Geolocation API)
    if (resetLocBtn) {
        resetLocBtn.addEventListener('click', () => {
            if (!navigator.geolocation) {
                alert('เบราว์เซอร์ของคุณไม่รองรับการระบุตำแหน่ง (Geolocation)');
                map.setView(defaultCenter, 15);
                return;
            }

            // แสดงสถานะกำลังค้นหา
            resetLocBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังค้นหา...';

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const userLat = position.coords.latitude;
                    const userLng = position.coords.longitude;
                    const userLatLng = [userLat, userLng];

                    // ย้ายแผนที่ไปที่ตำแหน่งผู้ใช้จริง (ซูมระดับ 16)
                    map.setView(userLatLng, 16);

                    // สร้างหรืออัปเดตหมุดแสดงตำแหน่งปัจจุบัน
                    let userMarker = window.currentUserMarker;
                    if (userMarker) {
                        userMarker.setLatLng(userLatLng);
                    } else {
                        userMarker = L.marker(userLatLng, {
                            icon: L.divIcon({
                                className: 'user-location-pin',
                                html: '<div style="background-color: #3b82f6; width: 14px; height: 14px; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 8px rgba(0,0,0,0.4);"></div>',
                                iconSize: [14, 14]
                            })
                        }).addTo(map);
                        window.currentUserMarker = userMarker;
                    }
                    userMarker.bindPopup('<b>ตำแหน่งของคุณในขณะนี้</b>').openPopup();

                    // คืนค่าปุ่มเดิม
                    resetLocBtn.innerHTML = '<i class="fa-solid fa-crosshairs"></i> ตำแหน่งของฉัน';
                },
                (error) => {
                    console.error('Geolocation error:', error);
                    alert('ไม่สามารถเข้าถึงตำแหน่งของคุณได้ กรุณาตรวจสอบการอนุญาตสิทธิ์การเข้าถึงตำแหน่งในเบราว์เซอร์');
                    resetLocBtn.innerHTML = '<i class="fa-solid fa-crosshairs"></i> ตำแหน่งของฉัน';
                    // Fallback กลับไปที่ศูนย์กลาง มธ. รังสิต
                    map.setView(defaultCenter, 15);
                },
                { timeout: 10000, enableHighAccuracy: true }
            );
        });
    }

    // ข้อมูลร้านค้าตัวแสดงบนแผนที่ (ปรับพิกัดตัวอย่างให้อยู่ภายใน มธ. รังสิต)
    const campusPlaces = [
        { id: 1, name: 'The Quad Coffee', lat: 14.0725, lng: 100.6060, category: 'คาเฟ่และพื้นที่อ่านหนังสือ' },
        { id: 2, name: 'ศูนย์อาหาร SC (Green Canteen)', lat: 14.0700, lng: 100.6080, category: 'อาหารและเครื่องดื่ม' },
        { id: 3, name: 'เดอะ เดลี่ แกรนด์ คาเฟ่', lat: 14.0650, lng: 100.6030, category: 'คาเฟ่และอาหารว่าง' }
    ];

    // ฟังก์ชันเรนเดอร์หมุดร้านค้าเดิมลงบนแผนที่
    campusPlaces.forEach(place => {
        const marker = L.marker([place.lat, place.lng]).addTo(map);
        marker.bindPopup(`
            <div style="font-family: inherit; padding: 4px;">
                <h4 style="margin: 0 0 5px 0; color: var(--primary-red); font-size: 14px;">${place.name}</h4>
                <p style="margin: 0 0 8px 0; font-size: 12px; color: #666;">${place.category}</p>
                <a href="detail.html?id=${place.id}" style="font-size: 11px; color: #e63946; font-weight: bold; text-decoration: underline;">ดูรายละเอียดร้าน</a>
            </div>
        `);
    });

    // ตรวจจับเหตุการณ์คลิกบนแผนที่เพื่อเพิ่มร้านใหม่ (เมื่ออยู่ใน Add Mode)
    map.on('click', (e) => {
        if (!isAddMode) return;

        const { lat, lng } = e.latlng;

        // ลบหมุดชั่วคراวก่อนหน้าถ้ามี
        if (tempMarker) {
            map.removeLayer(tempMarker);
        }

        // สร้าง Popup ฟอร์มกรอกข้อมูลร้านค้าใหม่
        const popupContent = `
            <div class="add-place-popup">
                <h4><i class="fa-solid fa-store"></i> เพิ่มร้านค้าใหม่</h4>
                <form id="quick-add-place-form">
                    <label>ชื่อร้านค้า</label>
                    <input type="text" id="new-place-name" placeholder="ระบุชื่อร้าน..." required />
                    
                    <label>หมวดหมู่</label>
                    <select id="new-place-category">
                        <option value="คาเฟ่และพื้นที่อ่านหนังสือ">คาเฟ่และพื้นที่อ่านหนังสือ</option>
                        <option value="อาหารและเครื่องดื่ม">อาหารและเครื่องดื่ม</option>
                        <option value="คาเฟ่และอาหารว่าง">คาเฟ่และอาหารว่าง</option>
                    </select>

                    <div class="add-place-popup-actions">
                        <button type="submit" class="btn-pop-save">บันทึก</button>
                        <button type="button" id="btn-pop-cancel" class="btn-pop-cancel">ยกเลิก</button>
                    </div>
                </form>
            </div>
        `;

        tempMarker = L.marker([lat, lng], { draggable: true }).addTo(map);
        tempMarker.bindPopup(popupContent, { maxWidth: 250 }).openPopup();

        // จัดการเหตุการณ์ในฟอร์ม Popup
        setTimeout(() => {
            const form = document.getElementById('quick-add-place-form');
            const cancelBtn = document.getElementById('btn-pop-cancel');

            if (form) {
                form.addEventListener('submit', async (ev) => {
                    ev.preventDefault();
                    const name = document.getElementById('new-place-name').value.trim();
                    const category = document.getElementById('new-place-category').value;

                    if (!name) return alert('กรุณากรอกชื่อร้านค้า');

                    // ตรวจสอบ Supabase Client หากต้องการบันทึกลง Database จริง
                    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
                        try {
                            const { error } = await supabaseClient.from('places').insert([{
                                name: name,
                                category: category,
                                lat: lat,
                                lng: lng,
                                rating: 5.0,
                                is_open: true
                            }]);
                            if (error) throw error;
                            alert('เพิ่มร้านค้าลงในระบบสำเร็จ!');
                        } catch (err) {
                            console.error('Insert place error:', err);
                            alert('บันทึกข้อมูลลงฐานข้อมูลไม่สำเร็จ แต่ระบบจำลองการทำงานเรียบร้อย');
                        }
                    } else {
                        alert(`เพิ่มร้าน "${name}" (${category}) เรียบร้อยแล้ว!`);
                    }

                    tempMarker.closePopup();
                    exitAddMode();
                });
            }

            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => {
                    if (tempMarker) {
                        map.removeLayer(tempMarker);
                        tempMarker = null;
                    }
                    exitAddMode();
                });
            }
        }, 100);
    });
});