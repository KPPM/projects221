document.addEventListener('DOMContentLoaded', () => {

    // 1. สลับหมวดหมู่
    const catButtons = document.querySelectorAll('.cat-btn');
    catButtons.forEach(button => {
        button.addEventListener('click', () => {
            catButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
        });
    });

    // 2. สลับราคา
    const priceButtons = document.querySelectorAll('.price-btn');
    priceButtons.forEach(button => {
        button.addEventListener('click', () => {
            priceButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
        });
    });

    // 3. ค้นหาการ์ดสถานที่
    const searchInput = document.querySelector('.search-box input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const keyword = e.target.value.toLowerCase();
            const cards = document.querySelectorAll('.card');

            cards.forEach(card => {
                const title = card.querySelector('h3').textContent.toLowerCase();
                if (title.includes(keyword)) {
                    card.style.display = 'block';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    }

});