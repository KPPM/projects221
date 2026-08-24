/* =========================================================
   UniDirectory — shared behaviors
   Works across all pages; every block checks the element
   exists before wiring up, so one file can be reused site-wide.
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {

  /* ---------- Mobile nav toggle ---------- */
  const navToggle = document.querySelector('.nav-toggle');
  const mainNav = document.querySelector('.main-nav');
  if (navToggle && mainNav) {
    navToggle.addEventListener('click', () => {
      const open = mainNav.classList.toggle('open');
      mainNav.style.display = open ? 'flex' : '';
    });
  }

  /* ---------- Sidebar category filter list ---------- */
  document.querySelectorAll('.filter-list').forEach(list => {
    list.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        list.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  });

  /* ---------- Price range selector ---------- */
  document.querySelectorAll('.price-row').forEach(row => {
    row.querySelectorAll('.price-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        row.querySelectorAll('.price-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
    });
  });

  /* ---------- Clear filters ---------- */
  const clearBtn = document.querySelector('.clear-filters');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      document.querySelectorAll('.filter-list button').forEach((b, i) => b.classList.toggle('active', i === 0));
      document.querySelectorAll('.checkbox-row input').forEach(c => c.checked = false);
      document.querySelectorAll('.price-btn').forEach(b => b.classList.remove('selected'));
    });
  }

  /* ---------- Pill filters (events page) ---------- */
  document.querySelectorAll('.event-filters .pill, .pill-group .pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const group = pill.parentElement;
      group.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
    });
  });

  /* ---------- Save / bookmark heart toggle on cards ---------- */
  document.querySelectorAll('.save-heart').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      btn.classList.toggle('saved');
    });
  });

  /* ---------- Load more (simulated) ---------- */
  const loadMoreBtn = document.querySelector('.load-more-btn');
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', () => {
      loadMoreBtn.textContent = 'กำลังโหลด...';
      loadMoreBtn.disabled = true;
      setTimeout(() => {
        loadMoreBtn.textContent = 'โหลดครบทั้งหมดแล้ว';
      }, 700);
    });
  }

  /* ---------- Star picker (review form) ---------- */
  const starPicker = document.querySelector('.star-picker');
  if (starPicker) {
    const stars = [...starPicker.querySelectorAll('button')];
    stars.forEach((star, idx) => {
      star.addEventListener('click', () => {
        stars.forEach((s, i) => s.classList.toggle('filled', i <= idx));
        starPicker.dataset.value = idx + 1;
      });
      star.addEventListener('mouseenter', () => {
        stars.forEach((s, i) => s.classList.toggle('filled', i <= idx));
      });
    });
    starPicker.addEventListener('mouseleave', () => {
      const val = parseInt(starPicker.dataset.value || '0', 10);
      stars.forEach((s, i) => s.classList.toggle('filled', i < val));
    });
  }

  /* ---------- Review textarea char counter ---------- */
  const reviewText = document.querySelector('#reviewText');
  const charCount = document.querySelector('.char-count');
  if (reviewText && charCount) {
    const max = 500;
    const update = () => { charCount.textContent = `${reviewText.value.length} / ${max}`; };
    reviewText.addEventListener('input', () => {
      if (reviewText.value.length > max) reviewText.value = reviewText.value.slice(0, max);
      update();
    });
    update();
  }

  /* ---------- Photo upload box (cosmetic file picker) ---------- */
  const uploadBox = document.querySelector('.upload-box');
  if (uploadBox) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.style.display = 'none';
    uploadBox.appendChild(input);
    uploadBox.addEventListener('click', () => input.click());
    input.addEventListener('change', () => {
      const label = uploadBox.querySelector('.upload-label');
      if (label && input.files.length) {
        label.textContent = `เลือกแล้ว ${input.files.length} รูปภาพ`;
      }
    });
  }

  /* ---------- Supabase Initialization ---------- */
  // ใส่ URL และ Anon Key ของโปรเจกต์ Supabase ของคุณ
  const supabaseUrl = 'https://lcmqqovjgdkcbwyxxfwa.supabase.co';
  const supabaseKey = 'sb_publishable_ljqn7Kr_anpQJ2k7PvHSig_zRSS5o-8';
  const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

  /* ---------- Review submit (Updated with Backend) ---------- */
  const reviewForm = document.querySelector('.review-form');
  if (reviewForm) {
    reviewForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = reviewForm.querySelector('button[type="submit"]');
      
      // ดึงค่าต่างๆ จากฟอร์ม
      const rating = parseInt(document.querySelector('.star-picker').dataset.value || '0', 10);
      const reviewText = document.querySelector('#reviewText').value;
      const fileInput = document.querySelector('.upload-box input[type="file"]');
      
      // Validate เบื้องต้น (ไม่บังคับ แต่ควรมีเผื่อกรณีผู้ใช้ลืมกดดาว)
      if (rating === 0) {
        alert('กรุณาให้คะแนนดาวก่อนส่งรีวิว');
        return;
      }

      // เปลี่ยนสถานะปุ่มตอนกำลังโหลด
      submitBtn.textContent = 'กำลังส่งรีวิว...';
      submitBtn.disabled = true;

      try {
        let uploadedImageUrls = [];

        // 1. จัดการอัปโหลดรูปภาพลง Supabase Storage (ถ้ามี)
        if (fileInput && fileInput.files.length > 0) {
          for (const file of fileInput.files) {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `reviews/${fileName}`;

            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('review_images') // ชื่อ Bucket ที่สร้างไว้
              .upload(filePath, file);

            if (uploadError) throw uploadError;

            // ดึง Public URL ของไฟล์มาเก็บไว้
            const { data: publicUrlData } = supabase.storage
              .from('review_images')
              .getPublicUrl(filePath);
              
            uploadedImageUrls.push(publicUrlData.publicUrl);
          }
        }

        // 2. บันทึกข้อมูลรีวิวลง Table 'reviews'
        const { error: insertError } = await supabase
          .from('reviews')
          .insert([
            {
              place_id: 'the_study_hub', // ควบคุม id สถานที่ตามหน้าต่าง ๆ
              rating: rating,
              review_text: reviewText,
              image_urls: uploadedImageUrls,
            }
          ]);

        if (insertError) throw insertError;

        // หากทำงานสำเร็จ จะแสดงผลตาม UI เดิมของ Frontend
        submitBtn.textContent = 'ส่งรีวิวแล้ว ✓';
        // คุณสามารถเพิ่มโค้ดล้างค่าฟอร์ม หรือ redirect ผู้ใช้ได้ที่นี่

      } catch (error) {
        console.error('Error submitting review:', error.message);
        submitBtn.textContent = 'ส่งรีวิว'; // คืนสถานะปุ่มหากมี Error
        submitBtn.disabled = false;
        alert('เกิดข้อผิดพลาดในการส่งรีวิว กรุณาลองใหม่อีกครั้ง');
      }
    });
  }

  /* ---------- Login form (cosmetic validation) ---------- */
  const loginForm = document.querySelector('.login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = loginForm.querySelector('#email');
      const error = loginForm.querySelector('.form-error');
      if (email && !email.value.includes('@')) {
        error.textContent = 'กรุณากรอกอีเมลมหาวิทยาลัยให้ถูกต้อง';
        error.classList.add('show');
        return;
      }
      if (error) error.classList.remove('show');
      const btn = loginForm.querySelector('button[type="submit"]');
      btn.textContent = 'กำลังเข้าสู่ระบบ...';
    });
  }

  /* ---------- Campus map: pin -> popup ---------- */
  const popup = document.querySelector('.map-popup');
  document.querySelectorAll('.map-pin').forEach(pin => {
    pin.addEventListener('click', () => {
      if (!popup) return;
      const name = pin.dataset.name || '';
      const desc = pin.dataset.desc || '';
      popup.querySelector('h4').textContent = name;
      popup.querySelector('p').textContent = desc;
      popup.style.display = 'block';
      document.querySelectorAll('.map-pin').forEach(p => p.classList.remove('pin-selected'));
      pin.classList.add('pin-selected');
    });
  });
  const popupClose = document.querySelector('.map-popup .popup-head button');
  if (popupClose && popup) {
    popupClose.addEventListener('click', () => { popup.style.display = 'none'; });
  }

  /* ---------- View toggle (list / map) ---------- */
  document.querySelectorAll('.view-toggle').forEach(toggle => {
    toggle.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        toggle.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  });

});
