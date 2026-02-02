// Domaaf App Logic
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbw_Ap_E1zATVguMwhuhZHxv2xT6l3wJozEFaCvg1eYLPaED8-UyKwLIFSchjJ2JRvE1bg/exec";

document.addEventListener('DOMContentLoaded', () => {
    initModals();
    initMediaUpload();
    initFormSubmission();
    loadProperties();
    registerSW();
});

// --- PWA Registration ---
async function registerSW() {
    if ('serviceWorker' in navigator) {
        try {
            await navigator.serviceWorker.register('sw.js');
        } catch (e) {
            console.log('SW registration failed');
        }
    }
}

// --- Form Submission ---
function initFormSubmission() {
    const form = document.getElementById('property-form');
    form.onsubmit = async (e) => {
        e.preventDefault();
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerText = "Posting...";

        const formData = {
            title: form[0].value,
            description: form[1].value,
            price: form[2].value,
            plan: document.getElementById('plan-choice').value,
            // Images and videos would be base64 encoded here
            // Note: For large videos, base64 might be slow, but for 5s/5MB it works.
        };

        // Get compressed images from previews
        const img = document.querySelector('#image-preview img');
        if (img) formData.image = img.src;

        try {
            const response = await fetch(WEB_APP_URL, {
                method: 'POST',
                mode: 'no-cors', // Apps Script requires no-cors sometimes or custom headers
                body: JSON.stringify(formData)
            });
            alert("Property submitted! It will appear after review.");
            form.reset();
            document.getElementById('upload-modal').classList.add('hidden');
        } catch (err) {
            console.error(err);
            alert("Error submitting property. Check console.");
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerText = "Submit Listing";
        }
    };
}

// --- Modal Logic ---
function initModals() {
    const uploadBtn = document.getElementById('upload-btn');
    const loginBtn = document.getElementById('login-btn');
    const uploadModal = document.getElementById('upload-modal');
    const loginModal = document.getElementById('login-modal');
    const closeBtns = document.querySelectorAll('.close-modal');

    if (uploadBtn) uploadBtn.onclick = () => uploadModal.classList.remove('hidden');
    if (loginBtn) loginBtn.onclick = () => loginModal.classList.remove('hidden');

    closeBtns.forEach(btn => {
        btn.onclick = () => {
            uploadModal.classList.add('hidden');
            loginModal.classList.add('hidden');
        };
    });

    window.onclick = (event) => {
        if (event.target == uploadModal) uploadModal.classList.add('hidden');
        if (event.target == loginModal) loginModal.classList.add('hidden');
    };
}

// --- Media Upload & Compression ---
function initMediaUpload() {
    const imageInput = document.getElementById('image-input');
    const videoInput = document.getElementById('video-input');
    const imagePreview = document.getElementById('image-preview');
    const videoPreview = document.getElementById('video-preview');

    if (!imageInput) return;

    imageInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        imagePreview.innerHTML = '<em>Compressing...</em>';
        try {
            const compressed = await compressImage(file, 15); // Target ~15KB for safety
            const reader = new FileReader();
            reader.readAsDataURL(compressed);
            reader.onloadend = () => {
                imagePreview.innerHTML = `<img src="${reader.result}" style="width:100%; border-radius:12px; margin-top:10px; border:1px solid #10b981">`;
            };
        } catch (err) {
            imagePreview.innerHTML = '<span style="color:red">Error compressing image</span>';
        }
    };

    videoInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = () => {
            window.URL.revokeObjectURL(video.src);
            if (video.duration > 6) {
                alert("Video must be 5 seconds or less.");
                videoInput.value = "";
                videoPreview.innerHTML = "";
            } else if (file.size > 5 * 1024 * 1024) {
                alert("Video must be 5MB or less.");
                videoInput.value = "";
                videoPreview.innerHTML = "";
            } else {
                videoPreview.innerHTML = `<span style="color:#10b981">✓ Video Valid (${(file.size / 1024 / 1024).toFixed(1)}MB)</span>`;
            }
        };
        video.src = URL.createObjectURL(file);
    };
}

/**
 * Compresses image using Canvas
 */
async function compressImage(file, targetKB) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                const maxDim = 800;
                if (width > height) {
                    if (width > maxDim) {
                        height *= maxDim / width;
                        width = maxDim;
                    }
                } else {
                    if (height > maxDim) {
                        width *= maxDim / height;
                        height = maxDim;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                let quality = 0.5;
                const adjustQuality = () => {
                    canvas.toBlob((blob) => {
                        if (blob.size / 1024 > targetKB && quality > 0.1) {
                            quality -= 0.05;
                            adjustQuality();
                        } else {
                            resolve(blob);
                        }
                    }, 'image/jpeg', quality);
                };
                adjustQuality();
            };
        };
    });
}

// --- Data Loading ---
async function loadProperties() {
    const grid = document.getElementById('properties-grid');

    // Fetch from Apps Script or fallback to mock
    try {
        if (WEB_APP_URL.includes("YOUR_")) throw "Setup URL first";
        const response = await fetch(WEB_APP_URL);

        if (response.status === 403) {
            console.error("Access Denied: Is the Apps Script deployed as 'Anyone'?");
            alert("Backend Access Denied (403). Please ensure Google Apps Script is deployed with access set to 'Anyone'.");
            throw "403 Forbidden";
        }

        const data = await response.json();
        renderGrid(data);
    } catch (e) {
        console.log("Using mock data while URL is not set or access is denied:", e);
        const mockData = [
            { id: 1, title: 'Modern Studio in Akwa', price: '150,000', type: 'Studio', plan: 'Gold', img: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b026a?auto=format&fit=crop&w=400&q=80' },
            { id: 2, title: 'Luxury Villa Bastos', price: '850,000', type: 'Villa', plan: 'Platinum', img: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=400&q=80' },
            { id: 3, title: 'Family House Bonaberi', price: '250,000', type: 'House', plan: 'Free', img: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=400&q=80' }
        ];
        renderGrid(mockData);
    }
}

function renderGrid(data) {
    const grid = document.getElementById('properties-grid');
    grid.innerHTML = data.map(p => `
        <div class="property-card">
            <div class="card-img" style="background: url('${p.img || p.imageUrl || 'https://via.placeholder.com/400x300?text=Property'}') center/cover">
                ${p.plan && p.plan !== 'Free' ? `<span class="card-badge badge-gold">${p.plan}</span>` : ''}
            </div>
            <div class="card-content">
                <p style="color:var(--primary); font-size:0.8rem; font-weight:600;">${p.type}</p>
                <h3 style="margin: 5px 0;">${p.title}</h3>
                <p class="price">${p.price} XAF <small>/ month</small></p>
            </div>
        </div>
    `).join('');
}
