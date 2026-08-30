document.addEventListener('DOMContentLoaded', () => {

    // ... (โค้ดเดิมส่วนที่ 1, 2, 3 ยังคงอยู่เหมือนเดิม) ...

    // 4. ระบบ API คัดกรองข้อมูล (Backend Data Processing)
    const filterOpen = document.getElementById('filter-open');
    const filterDistance = document.getElementById('filter-distance');
    const filterRating = document.getElementById('filter-rating');

    // ตรวจสอบว่าอยู่ในหน้าค้นหาและมีตัวกรองหรือไม่
    if (filterOpen && filterDistance && filterRating) {
        
        const fetchFilteredPlaces = async () => {
            // ดึงค่าจาก Checkbox
            const isOpen = filterOpen.checked;
            const isNear = filterDistance.checked;
            const isHighRating = filterRating.checked;

            try {
                // สร้าง Query จำลองผ่าน Supabase (Table: places)
                // สมมติว่ามี Table ชื่อ 'places' อยู่ในฐานข้อมูล
                let query = supabaseClient.from('places').select('*');

                if (isOpen) {
                    query = query.eq('is_open', true); // กรองร้านที่เปิดอยู่
                }
                if (isNear) {
                    query = query.lte('distance_km', 1.0); // กรองระยะทางน้อยกว่าหรือเท่ากับ 1 กม.
                }
                if (isHighRating) {
                    query = query.gte('rating', 4.0); // กรองคะแนน 4 ดาวขึ้นไป
                }

                const { data, error } = await query;

                if (error) throw error;

                // นำ Data ที่ผ่านการคัดกรองจาก API มา Render ใน DOM ใหม่
                renderPlaces(data);

            } catch (err) {
                console.error("API Filter Error:", err.message);
            }
        };

        // ผูก Event Listener เมื่อมีการติ๊ก Checkbox
        [filterOpen, filterDistance, filterRating].forEach(checkbox => {
            checkbox.addEventListener('change', fetchFilteredPlaces);
        });
    }

    // ฟังก์ชันสร้าง UI การ์ดสถานที่จากข้อมูล API
    function renderPlaces(placesData) {
        const cardGrid = document.querySelector('.card-grid');
        if (!cardGrid) return;
        
        cardGrid.innerHTML = ''; // ล้างข้อมูลเดิมออก
        
        if(placesData.length === 0) {
            cardGrid.innerHTML = '<p>ไม่พบร้านค้าที่ตรงกับเงื่อนไข</p>';
            return;
        }

        placesData.forEach(place => {
            const cardHTML = `
                <a href="detail.html?id=${place.id}" class="card-link">
                    <div class="card">
                        <div class="card-image">
                            <img src="${place.image_url}" alt="${place.name}">
                            <span class="badge badge-rating">★ ${place.rating}</span>
                        </div>
                        <div class="card-info">
                            <h3>${place.name}</h3>
                            <p class="desc">${place.category}</p>
                            <div class="card-footer">
                                <span>📍 ${place.location_desc} ${place.distance_km} กม.</span>
                            </div>
                        </div>
                    </div>
                </a>
            `;
            cardGrid.innerHTML += cardHTML;
        });
    }
});