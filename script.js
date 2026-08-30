// 1. ตั้งค่า Supabase
const SUPABASE_URL = 'https://lcmqqovjgdkcbwyxxfwa.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ljqn7Kr_anpQJ2k7PvHSig_zRSS5o-8';
let supabaseClient;

if (typeof supabase !== 'undefined') {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

document.addEventListener('DOMContentLoaded', () => {
    if (!supabaseClient) return;

    // ==========================================
    // ระบบที่ 1: คัดกรองข้อมูลร้านค้า (search.html)
    // ==========================================
    const filterOpen = document.getElementById('filter-open');
    const filterDistance = document.getElementById('filter-distance');
    const filterRating = document.getElementById('filter-rating');
    const cardGrid = document.querySelector('.card-grid');

    if (filterOpen && filterDistance && filterRating && cardGrid) {
        const fetchFilteredPlaces = async () => {
            const isOpen = filterOpen.checked;
            const isNear = filterDistance.checked;
            const isHighRating = filterRating.checked;

            try {
                let query = supabaseClient.from('places').select('*');
                if (isOpen) query = query.eq('is_open', true);
                if (isNear) query = query.lte('distance_km', 1.0);
                if (isHighRating) query = query.gte('rating', 4.0);

                const { data, error } = await query;
                if (!error) renderPlaces(data || []);
            } catch (err) { console.error(err); }
        };

        function renderPlaces(placesData) {
            cardGrid.innerHTML = ''; 
            if(placesData.length === 0) {
                cardGrid.innerHTML = '<p style="grid-column: span 3; text-align: center;">ไม่พบร้านค้าที่ตรงกับเงื่อนไข</p>';
                return;
            }
            placesData.forEach(place => {
                cardGrid.innerHTML += `
                    <a href="detail.html?id=${place.id}" class="card-link">
                        <div class="card">
                            <div class="card-image">
                                <img src="${place.image_url || 'https://images.unsplash.com/photo-1554118811-1e0d58224f24'}" alt="">
                                <span class="badge badge-rating">★ ${place.rating || '0'}</span>
                            </div>
                            <div class="card-info">
                                <h3>${place.name}</h3>
                                <p class="desc">${place.category || 'ร้านอาหาร'}</p>
                                <div class="card-footer">
                                    <span>📍 ${place.distance_km ? place.distance_km + ' กม.' : ''}</span>
                                </div>
                            </div>
                        </div>
                    </a>`;
            });
        }
        [filterOpen, filterDistance, filterRating].forEach(cb => cb.addEventListener('change', fetchFilteredPlaces));
        fetchFilteredPlaces();
    }

    // ==========================================
    // ระบบที่ 2: ดึงข้อมูลและแสดงผลรีวิว (review.html)
    // ==========================================
    const reviewsContentArea = document.getElementById('reviews-content-area');
    
    const loadReviews = async () => {
        if (!reviewsContentArea) return;

        try {
            const urlParams = new URLSearchParams(window.location.search);
            const placeId = urlParams.get('id') || 1; 

            const { data: reviews, error } = await supabaseClient
                .from('reviews')
                .select('*')
                .eq('place_id', placeId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            reviewsContentArea.innerHTML = ''; // ล้างข้อมูลเก่า

            if(reviews.length === 0) {
                reviewsContentArea.innerHTML = '<p style="color:#666; font-size:14px; text-align:center;">ยังไม่มีรีวิว เป็นคนแรกที่ให้คะแนนสิ!</p>';
                return;
            }

            reviews.forEach(review => {
                const dateStr = new Date(review.created_at).toLocaleDateString('th-TH');
                const stars = '⭐'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
                
                // เรนเดอร์รูปภาพถ้ามี
                let imagesHTML = '';
                if (review.image_urls && review.image_urls.length > 0) {
                    imagesHTML = '<div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:10px;">';
                    review.image_urls.forEach(url => {
                        imagesHTML += `<img src="${url}" style="width:80px; height:80px; object-fit:cover; border-radius:8px; border:1px solid #eee;">`;
                    });
                    imagesHTML += '</div>';
                }
                
                const reviewHTML = `
                    <div class="review-item" style="padding: 15px 0; border-bottom: 1px solid #f0f0f0;">
                        <div class="review-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                            <div class="review-user" style="font-weight:bold; font-size:14px; color:#333; display:flex; align-items:center; gap:8px;">
                                <div class="review-avatar" style="width:32px; height:32px; border-radius:50%; background:#eee; display:flex; align-items:center; justify-content:center; color:#666; font-size:12px;">${review.user_avatar}</div>
                                <span>${review.user_name}</span>
                            </div>
                            <span class="review-date" style="font-size:12px; color:#999;">${dateStr}</span>
                        </div>
                        <div class="review-stars" style="color:#fca511; font-size:13px; margin-bottom:6px;">${stars}</div>
                        <p class="review-text" style="font-size:14px; color:#555; line-height:1.6;">${review.comment}</p>
                        ${imagesHTML}
                    </div>
                `;
                reviewsContentArea.insertAdjacentHTML('beforeend', reviewHTML);
            });
        } catch (err) {
            console.error('Error loading reviews:', err);
        }
    };

    loadReviews(); // เรียกใช้งานทันทีเมื่อเปิดหน้า

    // ==========================================
    // ระบบที่ 3: จัดการฟอร์มส่งรีวิวและรูปภาพ (review.html)
    // ==========================================
    const reviewForm = document.getElementById('review-form');
    const fileInput = document.getElementById('review-photo');
    const previewContainer = document.getElementById('image-preview-container');
    const submitBtn = document.getElementById('submit-review-btn');
    let selectedFiles = [];

    // แสดง Preview ภาพก่อนอัปโหลด
    if (fileInput && previewContainer) {
        fileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            selectedFiles = selectedFiles.concat(files);
            renderPreviews();
            fileInput.value = ''; // รีเซ็ตเพื่อเลือกภาพเดิมซ้ำได้
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
                img.style.width = '70px';
                img.style.height = '70px';
                img.style.objectFit = 'cover';
                img.style.borderRadius = '8px';

                const delBtn = document.createElement('button');
                delBtn.innerHTML = '×';
                delBtn.style.position = 'absolute';
                delBtn.style.top = '-5px';
                delBtn.style.right = '-5px';
                delBtn.style.background = '#a80018';
                delBtn.style.color = 'white';
                delBtn.style.border = 'none';
                delBtn.style.borderRadius = '50%';
                delBtn.style.width = '20px';
                delBtn.style.height = '20px';
                delBtn.style.cursor = 'pointer';
                
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

    // กระบวนการส่งฟอร์ม
    if (reviewForm) {
        reviewForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const ratingInput = document.querySelector('input[name="rating"]:checked');
            const commentInput = document.getElementById('review-comment').value;

            if (!ratingInput) { alert('กรุณาให้คะแนนดาวก่อนส่งรีวิวนะครับ!'); return; }
            if (!commentInput.trim()) { alert('กรุณากรอกความคิดเห็นของคุณ'); return; }

            submitBtn.disabled = true;
            submitBtn.innerHTML = 'กำลังส่งข้อมูล...';

            try {
                let userName = 'นักศึกษา TU';
                let userAvatar = 'T';
                const { data: { session } } = await supabaseClient.auth.getSession();
                
                if (session && session.user) {
                    userName = session.user.user_metadata?.full_name || session.user.email.split('@')[0];
                    userAvatar = userName.charAt(0).toUpperCase();
                }

                const urlParams = new URLSearchParams(window.location.search);
                const placeId = urlParams.get('id') || 1; 

                // อัปโหลดรูปภาพ
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

                // บันทึกลงตาราง
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
                
                loadReviews(); // ดึงรีวิวมาแสดงผลใหม่ทันที

            } catch (err) {
                console.error('Submit error:', err);
                alert('เกิดข้อผิดพลาดในการส่งรีวิว กรุณาลองใหม่อีกครั้ง');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = 'ส่งรีวิว';
            }
        });
    }
});