// --- Firebase Initialization ---
console.log("Initializing Firebase...");
if (typeof firebase !== 'undefined') {
    if (window.firebaseConfig) {
        try {
            firebase.initializeApp(window.firebaseConfig);
            console.log("Firebase initialized successfully.");
        } catch (err) {
            console.error("Firebase initialization failed:", err);
            showThemedErrorPopup("Firebase Init Error: " + err.message);
        }
    } else {
        console.error("Firebase config (window.firebaseConfig) is missing!");
        showThemedErrorPopup("CRITICAL: Firebase config not found. Please check firebase-config.js");
    }
} else {
    console.error("Firebase SDK not loaded.");
    showThemedErrorPopup("CRITICAL: Firebase SDK failed to load. Check your internet or script tags.");
}

// --- Logging Utility ---
async function logToFirestore(event, details = {}) {
    try {
        const db = firebase.firestore();
        await db.collection('debug_logs').add({
            source: 'main-app',
            event,
            details,
            projectId: window.firebaseConfig?.projectId,
            url: window.location.href,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (e) { console.error("Logger failed", e); }
}

const GOOGLE_APPS_SCRIPT_URL = ""; // Removed in favor of Firebase Email Link

// --- Global Utilities ---
function isMobileApp() {
    // Robust detection: Capacitor.isNative is the official way to check for APK context
    return window.Capacitor?.isNative === true || window.location.protocol === 'capacitor:';
}

/**
 * Robust helper to wait for a Capacitor plugin if it's not immediately available
 */
async function getCapacitorPlugin(name, retries = 5) {
    for (let i = 0; i < retries; i++) {
        const plugin = window.Capacitor?.Plugins?.[name];
        if (plugin) return plugin;
        console.log(`[CAPACITOR] ${name} plugin not available yet, retrying in 400ms... (${i+1}/${retries})`);
        await new Promise(r => setTimeout(r, 400));
    }
    return null;
}

// --- Global Error Logger ---
window.onerror = function (msg, url, lineNo, columnNo, error) {
    console.error(`ERROR: ${msg} at ${lineNo}:${columnNo}`);
    return false;
};


// --- Sign Out (Global, called directly from onclick) ---
function handleSignOut() {
    const dropdown = document.querySelector('.profile-dropdown');
    if (dropdown) dropdown.classList.remove('show');

    const overlay = document.createElement('div');
    overlay.id = 'signout-overlay';
    overlay.className = 'verification-overlay';
    overlay.style.zIndex = '10000';
    overlay.innerHTML = `
        <div class="verification-card" style="border-color:#f59e0b;box-shadow:0 20px 40px rgba(0,0,0,0.6),0 0 20px rgba(245,158,11,0.2);">
            <div class="logo-icon" style="margin-bottom:20px;">
                <svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:50px;height:50px;margin:0 auto;">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
            </div>
            <h2 style="color:#f59e0b;">Sign Out?</h2>
            <p>Are you sure you want to sign out?</p>
            <div style="display:flex;gap:12px;margin-top:20px;">
                <button class="btn-primary w-full" onclick="handleConfirmSignOut()" style="background:#f59e0b;">Sign Out</button>
                <button class="btn-primary w-full" onclick="dismissSignOutOverlay()" style="background:rgba(255,255,255,0.05);border:1px solid var(--glass-border);">Cancel</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('show'));
}

function dismissSignOutOverlay() {
    const overlay = document.getElementById('signout-overlay');
    if (!overlay) return;
    overlay.classList.remove('show');
    setTimeout(() => overlay.remove(), 400);
}

async function handleConfirmSignOut() {
    const btn = document.querySelector('#signout-overlay .btn-primary');
    if (btn) btn.innerText = 'Signing Out...';
    const overlay = document.getElementById('signout-overlay');
    if (overlay) overlay.style.pointerEvents = 'none';
    try {
        localStorage.removeItem('domaaf_auth_hint');
        sessionStorage.removeItem('domaaf_admin_auth');
        await firebase.auth().signOut();
    } catch(e) { console.warn('Signout error:', e); }
    if (overlay) overlay.classList.remove('show');
    setTimeout(() => {
        if (overlay) overlay.remove();
        window.location.href = window.location.pathname.includes('/admin/') ? '../index.html' : 'index.html';
    }, 300);
}

// --- UI Utilities ---

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;">
            <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    // Auto remove after animation completes
    setTimeout(() => {
        toast.remove();
    }, 5000);
}

document.addEventListener('DOMContentLoaded', () => {
    // --- Handle Verification Landing ---
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('verified') === 'true') {
        const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.replaceState({ path: cleanUrl }, '', cleanUrl); // Clean the URL
        
        setTimeout(() => {
            if (typeof showThemedSuccessPopup === 'function') {
                showThemedSuccessPopup("Email Verified Successfully! You can now sign in to your professional Domaaf account.");
            }
        }, 1000);
    }
    // ELIMINATE FLICKER: If we have an auth hint, hide login buttons immediately
    const authHint = localStorage.getItem('domaaf_auth_hint') === 'true';
    const authBtnGroup = document.getElementById('auth-buttons');
    const userProf = document.getElementById('user-profile');

    if (authHint) {
        // Only set displayed flex, don't show info yet to avoid "User Name" ghosting
        if (authBtnGroup) authBtnGroup.style.display = 'none';
        if (userProf) userProf.style.display = 'flex';
    }

    const path = window.location.pathname;
    const page = path.split("/").pop() || "index.html";
    console.log("DOM Loaded. Current Page:", page);

    try {
        // Show skeletonloaders immediately for UX
        if (page === "dashboard.html") {
            const grid = document.getElementById('dashboard-grid');
            if (grid) grid.innerHTML = '<div class="property-card loading"></div>'.repeat(3);
        }

        initAuthListener();
        handleFirebaseAuthActions();
        initModals();
        initMediaUpload();
        initFilters();
        initFormSubmission();
        initModalDrag();
        initCustomDropdown();

        // Page-specific initialization
        if (page === "index.html" || page === "" || !page.includes('.')) {
            loadProperties();
        } else if (page === "dashboard.html") {
            initDashboardEventListeners();
        } else if (page === "profile.html") {
            initProfileEventListeners();
        }

        // Non-blocking SW registration
        setTimeout(() => registerSW().catch(() => { }), 1000);

        console.log("All systems initialized.");
    } catch (err) {
        console.error("Initialization Error:", err);
    }
});

// --- PWA Registration ---
async function registerSW() {
    if ('serviceWorker' in navigator && !isMobileApp()) {
        try {
            await navigator.serviceWorker.register('sw.js?v=3');
            console.log("Service Worker registered successfully.");
        } catch (e) {
            console.log('SW registration failed');
        }
    } else if (isMobileApp()) {
        console.log("APK detected: Service Worker registration skipped for stability.");
    }
}

// --- Custom Property Type Dropdown (Search Panel) ---
function initCustomDropdown() {
    const wrap = document.getElementById('type-custom-select');
    if (!wrap) return;

    const trigger = document.getElementById('type-select-trigger');
    const optionsList = document.getElementById('type-select-options');
    const label = document.getElementById('type-select-label');
    const hiddenSelect = document.getElementById('search-type');
    const options = optionsList ? optionsList.querySelectorAll('.custom-select-option') : [];

    if (!trigger || !optionsList) return;

    // Toggle open/close on trigger click
    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = wrap.classList.toggle('open');
        optionsList.style.display = isOpen ? 'block' : '';
    });

    // Option selection
    options.forEach(opt => {
        opt.addEventListener('click', (e) => {
            e.stopPropagation();
            const value = opt.dataset.value;
            const text = opt.textContent.trim();

            // Update label (strip emoji, keep text clean)
            if (label) label.textContent = value ? text.replace(/^[^\w]+/, '').trim() : 'All Types';

            // Update hidden native select so filters still work
            if (hiddenSelect) {
                hiddenSelect.value = value;
                hiddenSelect.dispatchEvent(new Event('change'));
            }

            // Mark selected
            options.forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');

            // Close dropdown
            wrap.classList.remove('open');
        });
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (!wrap.contains(e.target)) {
            wrap.classList.remove('open');
        }
    });
}

// --- Form Submission ---
function initFormSubmission() {
    const form = document.getElementById('property-form');
    if (!form) return;

    const submitBtn = document.getElementById('submit-listing-btn') || form.querySelector('button[type="submit"]');

    // --- Real-time validation: enable submit only when all fields valid ---
    function validateForm() {
        if (!submitBtn) return;
        const title = form.querySelector('input[type="text"]')?.value?.trim();
        const desc = form.querySelector('textarea')?.value?.trim();
        const price = form.querySelector('input[type="number"]')?.value?.trim();
        const type = document.getElementById('property-type')?.value;
        const location = document.getElementById('property-location')?.value?.trim();
        const images = form.querySelectorAll('#image-preview img');
        const email = document.getElementById('contact-email')?.value?.trim();
        const phone = document.getElementById('contact-phone')?.value?.trim();

        const allFilled = title && desc && price && type && location && images.length > 0;
        const contactOk = !!(email || phone);

        const valid = allFilled && contactOk;
        submitBtn.disabled = !valid;
        submitBtn.style.opacity = valid ? '1' : '0.45';
        submitBtn.style.cursor = valid ? 'pointer' : 'not-allowed';

        if (valid) {
            submitBtn.style.background = 'linear-gradient(135deg, var(--primary), #34d399)';
            submitBtn.style.boxShadow = '0 8px 25px rgba(16, 185, 129, 0.3)';
            submitBtn.title = "";
        } else {
            submitBtn.style.background = 'rgba(255,255,255,0.05)';
            submitBtn.style.boxShadow = 'none';
            let missing = [];
            if (!title) missing.push("Title");
            if (!desc) missing.push("Description");
            if (!price) missing.push("Price");
            if (!type) missing.push("Type");
            if (!location) missing.push("Location");
            if (!images.length) missing.push("Photo");
            if (!contactOk) missing.push("Contact Info");
            submitBtn.title = "Missing: " + missing.join(", ");
        }
    }
    // Make validateForm available globally if needed
    window.validateForm = validateForm;

    // Listen to all relevant inputs for real-time enable/disable
    ['input', 'change'].forEach(evt => {
        form.addEventListener(evt, validateForm);
    });
    // Also re-check when image preview changes (file upload)
    const imgInput = document.getElementById('image-input');
    if (imgInput) imgInput.addEventListener('change', () => setTimeout(validateForm, 300));

    // Start disabled
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.45';
        submitBtn.style.cursor = 'not-allowed';
    }

    form.onsubmit = async (e) => {
        e.preventDefault();

        const user = firebase.auth().currentUser;
        if (!user) {
            showThemedWarningPopup("Please login first to post a property.");
            document.getElementById('login-modal').classList.remove('hidden');
            return;
        }

        // Hard guard: verify contact again (in case JS validation was bypassed)
        const _email = document.getElementById('contact-email')?.value?.trim();
        const _phone = document.getElementById('contact-phone')?.value?.trim();
        if (!_email && !_phone) {
            showThemedWarningPopup("Please provide at least one contact method — email or phone number.");
            document.getElementById('contact-email')?.focus();
            return;
        }

        const submitBtn = document.getElementById('submit-listing-btn') || form.querySelector('button[type="submit"]');
        const isEditing = form.dataset.editId;
        const btnText = submitBtn?.querySelector('.btn-text');
        const btnLoader = submitBtn?.querySelector('.btn-loader');

        // Animate button — ripple + loader
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.classList.add('loading', 'ripple');
            if (btnText) btnText.classList.add('hidden');
            if (btnLoader) btnLoader.classList.remove('hidden');
            setTimeout(() => submitBtn.classList.remove('ripple'), 500);
        }

        const propertyData = {
            title: form.querySelector('input[type="text"]')?.value || '',
            description: form.querySelector('textarea')?.value || '',
            price: form.querySelector('input[type="number"]')?.value || '',
            type: document.getElementById('property-type')?.value || 'Apartment',
            location: document.getElementById('property-location')?.value || '',
            plan: document.getElementById('plan-choice')?.value || 'free',
            userEmail: user.email,
            uid: user.uid,
            status: 'pending',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        // Owner contact fields
        if (_email) propertyData.contactEmail = _email;
        if (_phone) propertyData.contactPhone = _phone;

        console.log("Submitting property with UID:", propertyData.uid);

        if (!isEditing) {
            propertyData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        }

        // Helper to upload directly to Google Apps Script (works from any URL/protocol)
        async function uploadMedia(dataUrlOrFile, type) {
            try {
                let mediaBase64 = dataUrlOrFile;

                if (!dataUrlOrFile) {
                    console.log(`[UPLOAD] No ${type} provided, skipping.`);
                    return null;
                }

                if (typeof dataUrlOrFile !== 'string' || (dataUrlOrFile.startsWith && !dataUrlOrFile.startsWith('data:'))) {
                    mediaBase64 = await fileToBase64(dataUrlOrFile);
                }

                // Upload directly to Google Apps Script (handles base64 -> Google Drive)
                // This works from any protocol (file://, localhost, production domain)
                const GAS_URL = 'https://script.google.com/macros/s/AKfycbxrKDzspdVQCaYOJ8CRJzJn77eDlqfVLYdwno8bGpH889X-PCv_YYsruSa4Z0Oa06cNRg/exec';

                console.log(`[UPLOAD] Sending ${type} directly to Google Apps Script...`);

                // GAS requires a form/no-cors approach — use no-cors then handle separately
                // Actually, GAS Web Apps support CORS when deployed with "Anyone" access
                const payload = {
                    title: (propertyData.title || 'property').replace(/[^a-zA-Z0-9]/g, '_'),
                    userEmail: propertyData.userEmail,
                    type: propertyData.type,
                    plan: propertyData.plan,
                };
                // Attach the right field
                if (type === 'img') payload.image = mediaBase64;
                else payload.video = mediaBase64;

                const response = await fetch(GAS_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // text/plain prevents CORS preflight OPTIONS request
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const errText = await response.text();
                    console.error(`[UPLOAD] GAS error: ${response.status} - ${errText}`);
                    throw new Error(`Upload failed: ${response.status}`);
                }

                const data = await response.json();
                const fileUrl = data.imageUrl || data.videoUrl || data.url;

                if (!fileUrl) {
                    console.error('[UPLOAD] GAS returned no URL:', data);
                    throw new Error('Google Drive upload returned no link.');
                }

                console.log(`[UPLOAD] Success! Drive URL: ${fileUrl}`);
                return fileUrl;
            } catch (err) {
                console.error(`[UPLOAD] ${type} upload error:`, err);
                return null;
            }
        }


        try {
            // 1. Upload Images
            const imgPreviews = Array.from(document.querySelectorAll('#image-preview img'));
            const imageUrls = [];

            if (imgPreviews.length > 0) {
                // Set the first image as the primary imageUrl for backward compatibility
                propertyData.imageUrl = imgPreviews[0].src;

                // Upload all images in parallel
                const uploadPromises = imgPreviews.map(async (img, i) => {
                    if (img.src.startsWith('data:')) {
                        try {
                            const driveUrl = await uploadMedia(img.src, 'img');
                            return driveUrl || img.src;
                        } catch (e) {
                            console.warn(`[SUBMIT] Image ${i} upload failed:`, e);
                            return img.src;
                        }
                    }
                    return img.src; // Already a URL (editing case)
                });

                const uploadedUrls = await Promise.all(uploadPromises);
                propertyData.imageUrls = uploadedUrls;
                propertyData.imageUrl = uploadedUrls[0]; // Primary remains first
                console.log('[SUBMIT] All images processed:', propertyData.imageUrls);
            }

            // 2. Upload Video
            const videoInput = document.getElementById('video-input');
            if (videoInput && videoInput.files && videoInput.files[0]) {
                propertyData.videoUrl = await uploadMedia(videoInput.files[0], 'vid');
            }

            // 3. Save to Firestore
            console.log("Saving to Firestore with data:", propertyData);
            if (isEditing) {
                await firebase.firestore().collection('properties').doc(isEditing).update(propertyData);
                showThemedSuccessPopup("Property updated successfully! Any changes will be live instantly.");
                delete form.dataset.editId;
            } else {
                propertyData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                const docRef = await firebase.firestore().collection('properties').add(propertyData);
                console.log("Save complete. Document ID:", docRef.id);
                showThemedSuccessPopup("Listing Received! Your property has been submitted for a Trust & Safety review. It will appearing on Domaaf once approved (usually 2-4 hours).");
            }

            form.reset();
            const uploadModal = document.getElementById('upload-modal');
            if (uploadModal) uploadModal.classList.add('hidden');

            const imgPreviewDiv = document.getElementById('image-preview');
            if (imgPreviewDiv) imgPreviewDiv.innerHTML = "";

            const vidPreviewDiv = document.getElementById('video-preview');
            if (vidPreviewDiv) vidPreviewDiv.innerHTML = "";

            // Refresh wherever we are
            const dashboardVal = document.getElementById('dashboard');
            if (dashboardVal && !dashboardVal.classList.contains('hidden')) {
                loadUserDashboard();
            } else {
                loadProperties();
            }
        } catch (err) {
            console.error("Submission Error Details:", err);
            // More specific error alerts
            if (err.message && err.message.includes("Upload failed")) {
                showThemedErrorPopup("Media upload failed: " + err.message + "\n\nPlease check your Google Drive script and backend logs.");
            } else if (err.code === "permission-denied") {
                showThemedErrorPopup("Firestore Permission Denied: You may not have access to post. Please try logging out and back in.");
            } else {
                showThemedErrorPopup("Error saving to database: " + err.message);
            }
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.classList.remove('loading', 'ripple');
                if (btnText) btnText.classList.remove('hidden');
                if (btnLoader) btnLoader.classList.add('hidden');
            }
        }
    };
}

/**
 * Universal Drag-to-resize/close for modals and panels (up/down drag handle)
 */
function initModalDrag() {
    setupDraggablePanel('modal-drag-handle', 'upload-modal-content');
    setupDraggablePanel('property-panel-drag-handle', 'property-detail-panel');
    setupDraggablePanel('plan-panel-drag-handle', 'plan-detail-panel');
}

function setupDraggablePanel(handleId, panelId) {
    const handle = document.getElementById(handleId);
    const panel = document.getElementById(panelId);
    if (!handle || !panel) return;

    let startY = 0;
    let startH = 0;
    let dragging = false;

    const onStart = (clientY) => {
        startY = clientY;
        startH = panel.offsetHeight;
        dragging = true;
        document.body.style.cursor = 'ns-resize';
        document.body.style.userSelect = 'none';
        panel.style.transition = 'none'; // Disable transition for smooth dragging
    };

    const onMove = (clientY) => {
        if (!dragging) return;
        const delta = clientY - startY;
        
        // For mobile detail panels and modals (acting as bottom sheets), use translateY for swipe-down
        if ((panel.classList.contains('property-panel') || panel.classList.contains('modal-content')) && window.innerWidth <= 768) {
            if (delta > 0) { // Only allow dragging downwards
                panel.style.transform = `translateY(${delta}px)`;
            }
        } else {
            // Desktop/Tablet or Standard Modal: Height resizing
            const newH = Math.max(300, Math.min(window.innerHeight * 0.95, startH + delta));
            panel.style.height = newH + 'px';
            panel.style.maxHeight = newH + 'px';
        }
    };

    const onEnd = () => {
        if (!dragging) return;
        dragging = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        panel.style.transition = ''; // Restore CSS transition

        // If mobile bottom sheet was dragged down significantly, close it
        if ((panel.classList.contains('property-panel') || panel.classList.contains('modal-content')) && window.innerWidth <= 768) {
            const transformStr = panel.style.transform;
            if (transformStr.includes('translateY')) {
                const currentY = parseFloat(transformStr.replace('translateY(', '').replace('px)', '')) || 0;
                if (currentY > window.innerHeight * 0.25) { // Dragged down more than 25% of screen
                    if (panel.classList.contains('modal-content')) {
                        const closeBtn = panel.querySelector('.close-modal');
                        if (closeBtn) closeBtn.click();
                    } else {
                        const closeBtnId = panelId === 'property-detail-panel' ? 'panel-close-btn' : 'plan-panel-close-btn';
                        const closeBtn = document.getElementById(closeBtnId);
                        if (closeBtn) closeBtn.click();
                    }
                }
            }
            panel.style.transform = ''; // Reset inline transform to let CSS handle open/close state
        }
    };

    // Mouse events
    handle.addEventListener('mousedown', (e) => { e.preventDefault(); onStart(e.clientY); });
    document.addEventListener('mousemove', (e) => onMove(e.clientY));
    document.addEventListener('mouseup', onEnd);

    // Touch events
    handle.addEventListener('touchstart', (e) => { onStart(e.touches[0].clientY); }, { passive: true });
    document.addEventListener('touchmove', (e) => { 
        if (dragging) { 
            e.preventDefault(); 
            onMove(e.touches[0].clientY); 
        } 
    }, { passive: false });
    document.addEventListener('touchend', onEnd);
}

/**
 * Helper to convert File to Base64
 */
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

/**
 * Helper to get a valid, embeddable image URL
 */
function getValidImageUrl(url) {
    const fallback = 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=400&q=80';
    if (!url || typeof url !== 'string' || url.trim().length < 10) return fallback;
    // Reject clearly broken data strings
    // Reject clearly broken markers
    if (url === 'Media uploaded to Drive (Check folder)') return fallback;
    
    // Safety: Only reject localhost fallback if we're NOT in the APK (since APK is localhost)
    if (!isMobileApp() && url.startsWith('http://localhost')) return fallback;

    // Handle base64 - show as-is
    if (url.startsWith('data:')) return url;

    // Route ALL Google Drive images through our backend proxy to bypass ORB/CORS
    if (url.includes('drive.google.com') || url.includes('googleusercontent.com') || url.includes('lh3.google')) {
        // Try every known Drive URL pattern to extract the file ID
        let fileId = null;

        // Pattern 1: /d/FILEID (sharing links)
        const m1 = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (m1) fileId = m1[1];

        // Pattern 2: ?id=FILEID or &id=FILEID  (uc?export= links, thumbnail links)
        if (!fileId) {
            const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
            if (m2) fileId = m2[1];
        }

        // Pattern 4: /file/d/FILEID
        if (!fileId) {
            const m4 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
            if (m4) fileId = m4[1];
        }

        // Pattern 5: lh3.googleusercontent.com/d/FILEID or lh3.google.com/d/FILEID
        if (!fileId) {
            const m5 = url.match(/(?:lh3\.googleusercontent\.com|lh3\.google\.com)\/d\/([a-zA-Z0-9_-]+)/);
            if (m5) fileId = m5[1];
        }

        if (fileId) {
            // Using Drive's built-in thumbnail endpoint naturally bypasses CORS restrictions
            // and eliminates the need for a separate backend proxy.
            return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
        }

        // If we can't extract a file ID, fall through to return the URL as-is
        console.warn('[IMAGE] Could not extract Drive file ID from:', url);
    }

    // Fallback for broken placeholder service
    if (url.includes('placeholder.com')) return fallback;

    return url;
}

// --- Global Auth State ---
let isSignUpMode = false;

/**
 * Updates the authentication modal UI based on isSignUpMode
 */
function applyAuthModeUI() {
    const authTitle = document.getElementById('auth-modal-title');
    const authDesc = document.getElementById('auth-modal-desc');
    const authSubmitBtn = document.getElementById('auth-submit-btn');
    const toggleAuth = document.getElementById('toggle-auth');
    const toggleMsg = document.querySelector('.auth-toggle-msg');

    if (authTitle) authTitle.innerText = isSignUpMode ? "Create Your Account" : "Welcome Back";
    if (authDesc) {
        if (isSignUpMode) {
            authDesc.innerHTML = "Join Domaaf to start listing properties<br><small style='color: var(--primary); opacity: 0.8;'>💡 Tip: Google accounts don't need a password</small>";
        } else {
            authDesc.innerHTML = "Sign in to your account to continue<br><small style='color: var(--primary); opacity: 0.8;'>💡 Signed up with Google? Use the button below</small>";
        }
    }
    if (authSubmitBtn) {
        authSubmitBtn.innerText = isSignUpMode ? "Create Account" : "Sign In";
        // Apply yellow style to Sign In button for better conversion and consistency
        if (!isSignUpMode) {
            authSubmitBtn.classList.add('btn-premium-yellow');
        } else {
            authSubmitBtn.classList.remove('btn-premium-yellow');
        }
    }
    const googleBtnSpan = document.querySelector('.btn-google span');
    if (googleBtnSpan) {
        // Unified label — Google button handles both sign-up & sign-in automatically
        googleBtnSpan.textContent = 'Continue with Google';
    }

    if (toggleAuth) toggleAuth.innerText = isSignUpMode ? "Login" : "Sign Up";

    if (toggleMsg && toggleMsg.firstChild) {
        toggleMsg.firstChild.textContent = isSignUpMode ? "Already have an account? " : "Don't have an account? ";
    }

    // Toggle Forgot Password link — only show when in Sign In mode
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    if (forgotPasswordLink) {
        forgotPasswordLink.style.display = isSignUpMode ? 'none' : 'block';
    }
}

// --- Modal Logic ---
function initModals() {
    console.log("Initializing modals with event delegation...");
    const uploadModal = document.getElementById('upload-modal');
    const loginModal = document.getElementById('login-modal');
    const authTitle = document.getElementById('auth-modal-title');
    const authDesc = document.getElementById('auth-modal-desc');
    const authSubmitBtn = document.getElementById('auth-submit-btn');
    const toggleAuth = document.getElementById('toggle-auth');
    const loginForm = document.getElementById('login-form');
    const authEmail = document.getElementById('auth-email');
    const authPassword = document.getElementById('auth-password');

    // delegating clicks to document for maximum reliability
    document.addEventListener('click', (e) => {
        const target = e.target;
        const closestBtn = target.closest('button, .avatar, .category-pill');

        if (closestBtn) {
            closestBtn.classList.add('btn-click-anim');
            setTimeout(() => closestBtn.classList.remove('btn-click-anim'), 300);
        }


        // Sign Up Button
        if (target.id === 'signup-btn') {
            console.log("Signup button delegator caught click");
            isSignUpMode = true;
            applyAuthModeUI();
            if (loginModal) loginModal.classList.remove('hidden');
        }

        // Login Button
        if (target.id === 'login-btn') {
            console.log("Login button delegator caught click");
            isSignUpMode = false;
            applyAuthModeUI();
            if (loginModal) loginModal.classList.remove('hidden');
        }

        // Post Property (Upload) Button
        if (target.id === 'upload-btn') {
            target.classList.add('btn-animating', 'btn-click-anim');
            setTimeout(() => target.classList.remove('btn-animating', 'btn-click-anim'), 300);

            const uploadModal = document.getElementById('upload-modal');
            const form = document.getElementById('property-form');
            if (uploadModal && form) {
                const user = firebase.auth().currentUser;
                if (user) {
                    // Reset form for "Add" mode
                    delete form.dataset.editId;
                    form.reset();

                    // Reset UI labels
                    const modalTitle = uploadModal.querySelector('h2');

                    const submitBtn = document.getElementById('submit-listing-btn');
                    if (submitBtn) {
                        const btnText = submitBtn.querySelector('.btn-text');
                        if (btnText) btnText.innerText = "Submit Listing";
                    }

                    // Clear previews
                    const imgPreview = document.getElementById('image-preview');
                    if (imgPreview) imgPreview.innerHTML = "";
                    const vidPreview = document.getElementById('video-preview');
                    if (vidPreview) vidPreview.innerHTML = "";

                    uploadModal.classList.remove('hidden');
                } else {
                    showAuthRequiredPopup();
                }
            }
        }

        // Close buttons
        if (target.classList.contains('close-modal')) {
            if (uploadModal) uploadModal.classList.add('hidden');
            if (loginModal) loginModal.classList.add('hidden');
        }

        // Outside Click (Modals)
        if (target === uploadModal) uploadModal.classList.add('hidden');
        if (target === loginModal) loginModal.classList.add('hidden');

        // Sign Out Button (must be checked BEFORE the dropdown toggle)
        const logoutTarget = target.closest('#logout-btn');
        if (logoutTarget) {
            // Close the dropdown first
            const dd = document.querySelector('.profile-dropdown');
            if (dd) dd.classList.remove('show');

            // Show confirmation overlay
            const overlay = document.createElement('div');
            overlay.className = 'verification-overlay';
            overlay.style.zIndex = '10000';
            overlay.innerHTML = `
                <div class="verification-card" style="border-color: #f59e0b; box-shadow: 0 20px 40px rgba(0,0,0,0.6), 0 0 20px rgba(245,158,11,0.2);">
                    <div class="logo-icon" style="margin-bottom: 20px;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:50px;height:50px;margin:0 auto;">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                            <polyline points="16 17 21 12 16 7"></polyline>
                            <line x1="21" y1="12" x2="9" y2="12"></line>
                        </svg>
                    </div>
                    <h2 style="color:#f59e0b;">Sign Out?</h2>
                    <p>Are you sure you want to sign out of your account?</p>
                    <div style="display:flex;gap:12px;margin-top:20px;">
                        <button class="btn-primary btn-danger w-full" id="confirm-logout-btn">Sign Out</button>
                        <button class="btn-primary w-full" id="cancel-logout-btn" style="background:rgba(255,255,255,0.05);border:1px solid var(--glass-border);">Cancel</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            document.getElementById('cancel-logout-btn').onclick = () => {
                overlay.style.opacity = '0';
                setTimeout(() => overlay.remove(), 400);
            };

            document.getElementById('confirm-logout-btn').onclick = async () => {
                try {
                    overlay.style.pointerEvents = 'none';
                    document.getElementById('confirm-logout-btn').innerText = 'Signing Out...';
                    localStorage.removeItem('domaaf_auth_hint');
                    sessionStorage.removeItem('domaaf_admin_auth');
                    await firebase.auth().signOut();
                    overlay.style.opacity = '0';
                    setTimeout(() => {
                        overlay.remove();
                        window.location.href = window.location.pathname.includes('/admin/') ? '../index.html' : 'index.html';
                    }, 400);
                } catch (err) {
                    console.error('Logout error:', err);
                    overlay.remove();
                }
            };

            return; // don't toggle dropdown
        }

        // Profile Dropdown Toggle
        const userProfile = document.getElementById('user-profile');
        const dropdown = document.querySelector('.profile-dropdown');
        if (userProfile && userProfile.contains(target)) {
            if (dropdown) dropdown.classList.toggle('show');
        } else if (dropdown && !dropdown.contains(target)) {
            dropdown.classList.remove('show');
        }
        // Google Login Button (Continue with Google)
        const googleTarget = target.closest('.btn-google');
        if (googleTarget) {
            console.log("[AUTH] Google Login clicked — using relay flow via delegation");
            handleGoogleRelayLogin(loginModal);
        }
    });

    // Toggle Link inside Modal
    if (toggleAuth) {
        toggleAuth.onclick = (e) => {
            e.preventDefault();
            isSignUpMode = !isSignUpMode;
            applyAuthModeUI();
        };
    }

    // Forgot Password Link
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    if (forgotPasswordLink) {
        forgotPasswordLink.onclick = async (e) => {
            e.preventDefault();
            const email = authEmail.value.trim();
            const authErrorMsg = document.getElementById('auth-error-msg');
            
            if (!email) {
                if (authErrorMsg) {
                    authErrorMsg.innerText = "Please enter your email address first, then click 'Forgot password?'.";
                    authErrorMsg.style.display = 'block';
                } else {
                    showThemedWarningPopup("Please enter your email address first to reset your password.");
                }
                authEmail.focus();
                return;
            }

            // Show loading state on link
            const originalText = forgotPasswordLink.innerText;
            forgotPasswordLink.innerText = "Sending...";
            forgotPasswordLink.style.pointerEvents = "none";
            forgotPasswordLink.style.opacity = "0.5";

            try {
                await firebase.auth().sendPasswordResetEmail(email);
                showThemedSuccessPopup("Password reset email sent! Check your inbox.");
                if (authErrorMsg) authErrorMsg.style.display = 'none';
            } catch (error) {
                console.error("Password Reset Error:", error);
                if (authErrorMsg) {
                    authErrorMsg.innerText = error.message;
                    authErrorMsg.style.display = 'block';
                } else {
                    showThemedErrorPopup(error.message);
                }
            } finally {
                forgotPasswordLink.innerText = originalText;
                forgotPasswordLink.style.pointerEvents = "auto";
                forgotPasswordLink.style.opacity = "1";
            }
        };
    }

    // Password Visibility Toggle
    const togglePasswordBtn = document.getElementById('toggle-password-visibility');
    if (togglePasswordBtn && authPassword) {
        togglePasswordBtn.onclick = () => {
            const isPassword = authPassword.type === 'password';
            authPassword.type = isPassword ? 'text' : 'password';
            
            // Toggle icon state
            togglePasswordBtn.classList.toggle('is-visible', !isPassword);
            
            // Update SVG icon (Eye vs Eye Off)
            const eyeIcon = document.getElementById('eye-icon');
            if (eyeIcon) {
                if (isPassword) {
                    // Eye Off Icon
                    eyeIcon.innerHTML = `
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                        <line x1="1" y1="1" x2="23" y2="23"></line>
                    `;
                } else {
                    // Regular Eye Icon
                    eyeIcon.innerHTML = `
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                    `;
                }
            }
        };
    }

    if (loginForm) {
        loginForm.onsubmit = async (e) => {
            e.preventDefault();
            const email = authEmail.value;
            const password = authPassword.value;

            const authErrorMsg = document.getElementById('auth-error-msg');
            if (authErrorMsg) authErrorMsg.style.display = 'none';

            authSubmitBtn.disabled = true;

            // Option A: Email Link Authentication
            if (isSignUpMode) {
                authSubmitBtn.innerText = "Creating Account...";
                try {
                    await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
                    const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
                    const user = userCredential.user;

                    // Send verification email
                    await user.sendEmailVerification();

                    if (loginModal) loginModal.classList.add('hidden');

                    // Unified Signup Success Flow
                    showThemedSuccessPopup("Account Created Successfully! Please verify your email to continue.");
                    setTimeout(() => showVerificationPopup(email), 2200);

                    // Sign out immediately to force re-login after verification
                    await firebase.auth().signOut();
                } catch (error) {
                    console.error("Sign-up Error:", error);
                    if (authErrorMsg) {
                        authErrorMsg.innerText = error.message;
                        authErrorMsg.style.display = 'block';
                    } else {
                        showThemedErrorPopup(error.message);
                    }
                } finally {
                    authSubmitBtn.disabled = false;
                    authSubmitBtn.innerText = "Sign Up";
                }
            } else {
                // Log In with Password
                authSubmitBtn.innerText = "Logging In...";
                try {
                    await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
                    const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
                    const user = userCredential.user;

                    // Always reload to get the LATEST emailVerified status (prevents stale cache)
                    await user.reload();
                    const freshUser = firebase.auth().currentUser;

                    if (!freshUser || !freshUser.emailVerified) {
                        showThemedErrorPopup("Your email address has not been verified yet. Please check your inbox and click the verification link before signing in.");
                        await firebase.auth().signOut();
                        authSubmitBtn.disabled = false;
                        authSubmitBtn.innerText = "Sign In";
                        return;
                    }

                    // Verified — hide modal and sync profile manually
                    // (don't rely on observer re-fire since it may have already fired and exited)
                    if (loginModal) loginModal.classList.add('hidden');
                    syncUserProfile(user).catch(console.error);
                    showThemedWelcomePopup(user.displayName || user.email.split('@')[0]);

                    // Manually update nav UI
                    const authButtons = document.getElementById('auth-buttons');
                    const userProfile = document.getElementById('user-profile');
                    const userEmailText = document.getElementById('user-display-email');
                    const userNameText = document.getElementById('user-display-name');
                    const userAvatar = document.getElementById('user-avatar');
                    const dropdownAvatarMini = document.getElementById('dropdown-avatar-mini'); // Corrected variable name
                    const logoutBtn = document.getElementById('logout-btn'); // Added for completeness if needed elsewhere

                    if (authButtons) authButtons.style.display = 'none';
                    if (userProfile) userProfile.style.display = 'flex';
                    if (userEmailText) userEmailText.innerText = user.email;
                    if (userNameText) userNameText.innerText = user.displayName || "User";

                    // Simple initial for avatars
                    const initial = (user.displayName || user.email)[0].toUpperCase();
                    if (userAvatar) userAvatar.innerText = initial;
                    if (dropdownAvatarMini) dropdownAvatarMini.innerText = initial;

                } catch (error) {
                    console.error("Auth Error:", error);

                    const showError = (msg) => {
                        if (authErrorMsg) {
                            authErrorMsg.innerText = msg;
                            authErrorMsg.style.display = 'block';
                        } else {
                            showThemedErrorPopup(msg);
                        }
                    };

                    if (error.code === 'auth/wrong-password') {
                        showError("Password is incorrect.");
                    } else if (error.code === 'auth/user-not-found') {
                        showThemedWarningPopup("No account found with this email address. Please sign up first.");
                    } else if (error.code === 'auth/invalid-credential') {
                        // Due to Firebase email enumeration protection, invalid-credential covers both wrong password and user not found.
                        // We will try to fetch methods to be helpful, but default to 'Password is incorrect' to fix the UX bug.
                        try {
                            const methods = await firebase.auth().fetchSignInMethodsForEmail(email);
                            if (methods.includes('google.com')) {
                                showThemedWarningPopup("This email is linked to a Google account. Please use the 'Continue with Google' button to sign in.");
                            } else {
                                showError("Password is incorrect.");
                            }
                        } catch (fetchErr) {
                            showError("Password is incorrect.");
                        }
                    } else {
                        showError(error.message);
                    }
                } finally {
                    authSubmitBtn.disabled = false;
                    authSubmitBtn.innerText = "Sign In";
                }
            }
        };
    }

    // Verify Google button exists
    const googleLoginBtn = document.querySelector('.btn-google');
    console.log("[AUTH] Google button found in DOM:", !!googleLoginBtn);
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', () => {
            console.log("[AUTH] Google Login button clicked (Direct Listener)");
        });
    }

    // Google Login Logic — unified sign-up & sign-in flow
    async function handleGoogleRelayLogin(loginModal) {
        console.log("[AUTH] handleGoogleRelayLogin triggered");
        try {
            sessionStorage.setItem('isAuthProcessing', 'true');
            
            // WEB vs APK branching
            let relayResult;
            if (!isMobileApp()) {
                console.log("[AUTH] Web environment — using direct signInWithPopup");
                const provider = new firebase.auth.GoogleAuthProvider();
                provider.setCustomParameters({ prompt: 'select_account' });
                provider.addScope('email');
                provider.addScope('profile');
                
                const result = await firebase.auth().signInWithPopup(provider);
                await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
                relayResult = {
                    user: result.user,
                    isNewUser: result.additionalUserInfo?.isNewUser || false
                };
            } else {
                console.log("[AUTH] APK environment — using session relay via Firestore");
                relayResult = await signInWithGoogleViaRelay();
            }
            if (!relayResult || !relayResult.user) {
                throw new Error('No user data received from relay.');
            }

            const user      = relayResult.user;
            const isNewUser = relayResult.isNewUser;

            // ── Update UI IMMEDIATELY for responsiveness ───────────────────
            if (loginModal) loginModal.classList.add('hidden');
            localStorage.setItem('domaaf_auth_hint', 'true');
            localStorage.setItem('is_google_auth', 'true');
            console.log("[AUTH] UI hints set. Updating dashboard/profile views...");

            // ── Sync Firestore profile in the background ────────────────────
            console.log("[AUTH] Syncing user profile...");
            logToFirestore('profile-sync-start', { email: user.email });
            
            // We await it, but even if it fails, we've already updated the UI.
            // This prevents "stuck" login states if Firestore is slow.
            try {
                await syncUserProfile(user);
                logToFirestore('profile-sync-success', { email: user.email });
            } catch (syncErr) {
                console.warn("[AUTH] Profile sync failed, but login proceeded:", syncErr);
                logToFirestore('profile-sync-failed', { error: syncErr.message });
            }

            const authButtons    = document.getElementById('auth-buttons');
            const userProfileEl  = document.getElementById('user-profile');
            const userEmailText  = document.getElementById('user-display-email');
            const userNameText   = document.getElementById('user-display-name');
            const userAvatarEl   = document.getElementById('user-avatar');
            const dropdownAvatar = document.getElementById('dropdown-avatar-mini');

            if (authButtons)   authButtons.style.display   = 'none';
            if (userProfileEl) userProfileEl.style.display = 'flex';

            const displayName = user.displayName || user.email.split('@')[0];
            if (userNameText)  userNameText.innerText  = displayName;
            if (userEmailText) userEmailText.innerText = user.email;

            const setAvatar = (el) => {
                if (!el) return;
                if (user.photoURL) {
                    el.style.backgroundImage = `url(${user.photoURL})`;
                    el.style.backgroundSize  = 'cover';
                    el.innerText = '';
                } else {
                    el.innerText = displayName[0].toUpperCase();
                }
            };
            setAvatar(userAvatarEl);
            setAvatar(dropdownAvatar);

            if (isNewUser) {
                showThemedSuccessPopup(`Welcome to Domaaf, ${displayName}! Your Google account is verified and ready.`);
            } else {
                showThemedWelcomePopup(displayName);
            }

        } catch (error) {
            console.error("[AUTH] handleGoogleRelayLogin Error:", error);
            logToFirestore('handle-relay-login-error', { code: error.code, message: error.message });
            if (error.code !== 'auth/popup-closed-by-user' &&
                error.code !== 'auth/cancelled-popup-request') {
                showThemedErrorPopup(error.message || 'Sign-in failed. Please try again.');
            }
        } finally {
            sessionStorage.removeItem('isAuthProcessing');
        }
    }
}

// ── Google Sign-In — Unified Entry Point ──────────────────────────────────────
// • Web (HTTPS domain): calls signInWithPopup directly — no relay needed.
// • APK (Capacitor WebView): opens auth-relay.html in Chrome Custom Tab,
//   then listens for the credential written to Firestore by that page.
async function signInWithGoogleViaRelay() {
    // Only used by APK/WebView to bypass storage partitioning
    const sessionKey = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0')).join('');

    const baseUrl = window.location.href.split('index.html')[0].split('?')[0];
    const relayUrl = `${baseUrl}auth-relay.html?s=${sessionKey}`;
    
    console.log('[AUTH] APK — opening relay page:', relayUrl);

    // Use Capacitor Browser (Chrome Custom Tab) for stability
    const BrowserPlugin = await getCapacitorPlugin('Browser');
    if (!BrowserPlugin) {
        logToFirestore('plugin-error', { plugin: 'Browser' });
        throw new Error('Capacitor Browser plugin not available.');
    }
    
    await BrowserPlugin.open({ url: relayUrl, toolbarColor: '#0f172a' });

    return listenForRelayCredential(sessionKey);
}

// ── Firestore listener — used exclusively by the APK relay path ─────────────
function listenForRelayCredential(sessionKey) {
    return new Promise((resolve, reject) => {
        const db     = firebase.firestore();
        const docRef = db.collection('auth_sessions').doc(sessionKey);
        let   solved = false;

        console.log('[AUTH] APK — listening for relay credential via Firestore...', sessionKey);

        const cleanup = (unsubFn) => {
            if (solved) return;
            solved = true;
            if (unsubFn) unsubFn();
        };

        const unsubscribe = docRef.onSnapshot(async (snap) => {
            if (snap.exists && !solved) {
                const data = snap.data();
                if (data.idToken || data.accessToken) {
                    console.log('[AUTH] APK — credential received from Firestore');
                    cleanup(unsubscribe);
                    try {
                        const result = await readRelayCredential(sessionKey, data);
                        window.Capacitor?.Plugins?.Browser?.close().catch(() => {});
                        resolve(result);
                    } catch (err) { reject(err); }
                }
            }
        }, (error) => {
            console.error('[AUTH] Snapshot listener error:', error);
            cleanup(unsubscribe);
            reject(new Error('Auth session sync failed: ' + error.message));
        });

        // Fallback: user closed the Chrome Custom Tab without picking an account
        window.Capacitor?.Plugins?.Browser?.addListener('browserFinished', () => {
            setTimeout(() => {
                if (!solved) {
                    cleanup(unsubscribe);
                    reject(new Error('Sign-in window closed.'));
                }
            }, 1500); // grace period so snapshot fires first if sign-in succeeded
        });
    });
}


async function readRelayCredential(sessionKey, predefinedData = null) {
    console.log('[AUTH] Starting credential retrieval for session:', sessionKey);
    const db = firebase.firestore();
    try {
        const docRef = db.collection('auth_sessions').doc(sessionKey);
        let data = predefinedData;

        if (!data) {
            console.log('[AUTH] Fetching session document from Firestore manually...');
            const snap = await docRef.get();
            if (!snap.exists) {
                console.error('[AUTH] Relay document NOT FOUND for session:', sessionKey);
                throw new Error('Sign-in session not found or expired. Please try again.');
            }
            data = snap.data();
        }
        console.log('[AUTH] Relay data retrieved successfully. Tokens present:', !!data.idToken, !!data.accessToken);

        // Delete immediately — one-time use only for security
        docRef.delete().catch(err => console.warn('[AUTH] Session cleanup failed:', err));

        if (!data.idToken && !data.accessToken) {
            console.error('[AUTH] No valid tokens in relay data:', data);
            throw new Error('Received incomplete credentials. Please try again.');
        }

        console.log('[AUTH] Building Firebase credential...');
        const credential = firebase.auth.GoogleAuthProvider.credential(
            data.idToken     || null,
            data.accessToken || null
        );

        console.log('[AUTH] Signing in with credential...');
        const authResult = await firebase.auth().signInWithCredential(credential);
        console.log('[AUTH] Sign-in SUCCESS for user:', authResult.user.email);
        return { user: authResult.user, isNewUser: data.isNewUser };

    } catch (err) {
        console.error('[AUTH] readRelayCredential FAILED:', err);
        throw err;
    }
}

/**
 * Helper to create a premium glassmorphic overlay
 */
function createPremiumOverlay(contentHtml, borderColor = 'var(--primary)', shadowColor = 'rgba(16, 185, 129, 0.2)') {
    const overlay = document.createElement('div');
    overlay.className = 'verification-overlay';
    overlay.style.zIndex = '10000';

    overlay.innerHTML = `
        <div class="verification-card glass-premium anim-premium-pop" style="border-color: ${borderColor} !important; border-width: 2px !important; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 20px ${shadowColor} !important;">
            ${contentHtml}
        </div>
    `;
    document.body.appendChild(overlay);

    // Trigger show class for fade in
    setTimeout(() => overlay.classList.add('show'), 10);

    const closePopup = (callback) => {
        overlay.classList.remove('show');
        const card = overlay.querySelector('.verification-card');
        if (card) {
            card.style.transform = 'scale(0.9) translateY(20px)';
            card.style.filter = 'blur(10px)';
            card.style.opacity = '0';
        }
        setTimeout(() => {
            overlay.remove();
            if (callback) callback();
        }, 400);
    };

    return { overlay, closePopup };
}

/**
 * Custom themed success popup (Green)
 */
function showThemedSuccessPopup(message) {
    const { closePopup } = createPremiumOverlay(`
        <div class="logo-icon" style="margin-bottom: 24px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 60px; height: 60px; margin: 0 auto; filter: drop-shadow(0 0 12px rgba(16, 185, 129, 0.4));">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
        </div>
        <h2 style="color: #10b981; font-weight: 800; font-size: 1.8rem; letter-spacing: -0.5px;">Success!</h2>
        <p style="font-size: 1.1rem; color: #cbd5e1; line-height: 1.6;">${message}</p>
        <button class="btn-primary w-full" id="close-success-popup" style="margin-top: 28px; height: 52px; font-weight: 700; font-size: 1rem;">Great</button>
    `);

    document.getElementById('close-success-popup').onclick = () => closePopup();
}

/**
 * Custom authentication required popup with both Sign In and Sign Up options
 */
function showAuthRequiredPopup() {
    const { closePopup } = createPremiumOverlay(`
        <div class="logo-icon" style="margin-bottom: 24px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 60px; height: 60px; margin: 0 auto; filter: drop-shadow(0 0 12px rgba(245, 158, 11, 0.4));">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
            </svg>
        </div>
        <h2 style="color: #f59e0b; font-weight: 800; font-size: 1.8rem;">Authentication Required</h2>
        <p style="font-size: 1.1rem; color: #cbd5e1;">Please sign in or create an account to list your property on Domaaf.</p>
        <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 28px;">
            <button class="btn-premium-yellow w-full" id="auth-popup-signin" style="height: 52px; font-weight: 700;">Sign In</button>
            <button class="btn-primary w-full" id="auth-popup-signup" style="background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); height: 52px; font-weight: 700;">Sign Up</button>
            <button class="btn-link" id="auth-popup-close" style="margin-top: 8px; color: var(--text-muted); font-size: 0.9rem; background: none; border: none; cursor: pointer;">Maybe Later</button>
        </div>
    `, '#f59e0b', 'rgba(245, 158, 11, 0.2)');

    document.getElementById('auth-popup-signin').onclick = () => {
        closePopup(() => {
            isSignUpMode = false;
            applyAuthModeUI();
            const loginModal = document.getElementById('login-modal');
            if (loginModal) loginModal.classList.remove('hidden');
        });
    };

    document.getElementById('auth-popup-signup').onclick = () => {
        closePopup(() => {
            isSignUpMode = true;
            applyAuthModeUI();
            const loginModal = document.getElementById('login-modal');
            if (loginModal) loginModal.classList.remove('hidden');
        });
    };

    document.getElementById('auth-popup-close').onclick = () => closePopup();
}

/**
 * Custom themed welcome popup
 */
function showThemedWelcomePopup(name) {
    const { closePopup } = createPremiumOverlay(`
        <div style="text-align: center; padding: 10px 0;">
            <!-- Icon with multi-layer glow -->
            <div style="position: relative; width: 80px; height: 80px; margin: 0 auto 30px;">
                <div style="position: absolute; inset: -10px; background: radial-gradient(circle, rgba(59, 130, 246, 0.4) 0%, transparent 70%); filter: blur(15px); border-radius: 50%;"></div>
                <div style="position: relative; width: 100%; height: 100%; background: rgba(59, 130, 246, 0.1); border-radius: 24px; display: flex; align-items: center; justify-content: center; transform: rotate(10deg); border: 2px solid rgba(59, 130, 246, 0.3); transition: all 0.5s ease;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 40px; height: 40px; transform: rotate(-10deg);">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                        <polyline points="9 22 9 12 15 12 15 22"></polyline>
                    </svg>
                </div>
            </div>

            <h2 style="font-family: 'Outfit', sans-serif; font-size: 2.2rem; font-weight: 800; margin-bottom: 12px; background: linear-gradient(135deg, #fff 0%, #3b82f6 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; letter-spacing: -1px;">Welcome back, ${name}!</h2>
            
            <p style="font-size: 1.15rem; color: #94a3b8; line-height: 1.6; margin-bottom: 35px; font-weight: 400;">
                Your premium dashboard is ready. Discover the most exclusive properties in Cameroon today.
            </p>

            <div style="background: rgba(255, 255, 255, 0.03); border-radius: 20px; padding: 20px; border: 1px solid rgba(255, 255, 255, 0.05); margin-bottom: 35px; text-align: left; display: flex; align-items: flex-start; gap: 15px;">
                <div style="background: rgba(59, 130, 246, 0.15); padding: 8px; border-radius: 10px; color: #3b82f6; flex-shrink: 0;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 20px; height: 20px;"><path d="M9.663 17h4.674M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.364-6.364l-.707-.707M8.28 17.03C7.26 16.01 6 14.01 6 12a6 6 0 0112 0c0 2.01-1.26 4.01-2.28 5.03l-.22.22c-.31.31-.5.73-.5 1.17a3 3 0 01-6 0c0-.44-.19-.86-.5-1.17l-.22-.22z"/></svg>
                </div>
                <div>
                    <h4 style="margin: 0 0 4px; color: white; font-size: 0.95rem; font-weight: 600;">Pro Tip</h4>
                    <p style="margin: 0; color: #64748b; font-size: 0.85rem; line-height: 1.5;">Use the new search filters to find studio apartments and villas faster based on your location.</p>
                </div>
            </div>
            
            <button class="btn-primary w-full" id="close-welcome-popup" style="background: #3b82f6; border: none; height: 60px; font-size: 1.1rem; font-weight: 700; border-radius: 18px; box-shadow: 0 15px 30px rgba(59, 130, 246, 0.3); transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); cursor: pointer; color: white;">
                Explore Properties
            </button>
        </div>
    `, '#3b82f6', 'rgba(59, 130, 246, 0.2)');

    document.getElementById('close-welcome-popup').onclick = () => closePopup();
}

/**
 * Custom themed warning popup (Yellow/Orange)
 */
function showThemedWarningPopup(message) {
    const { closePopup } = createPremiumOverlay(`
        <div class="logo-icon" style="margin-bottom: 24px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 60px; height: 60px; margin: 0 auto; filter: drop-shadow(0 0 12px rgba(245, 158, 11, 0.4));">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
        </div>
        <h2 style="color: #f59e0b; font-weight: 800; font-size: 1.8rem;">Action Required</h2>
        <p style="font-size: 1.1rem; color: #cbd5e1;">${message}</p>
        <button class="btn-primary w-full" id="close-warning-popup" style="background: #f59e0b; border: none; box-shadow: 0 4px 20px rgba(245, 158, 11, 0.4); margin-top: 28px; height: 52px; font-weight: 700;">Continue</button>
    `, '#f59e0b', 'rgba(245, 158, 11, 0.2)');

    document.getElementById('close-warning-popup').onclick = () => {
        closePopup(() => {
            isSignUpMode = true;
            applyAuthModeUI();
            const loginModal = document.getElementById('login-modal');
            if (loginModal) loginModal.classList.remove('hidden');
        });
    };
}

/**
 * Custom themed error popup matching the app's style
 */
/**
 * Custom themed confirm dialog (Returns Promise)
 */
function showThemedConfirm(title, message, confirmText = "Confirm", cancelText = "Cancel") {
    return new Promise((resolve) => {
        const { closePopup } = createPremiumOverlay(`
            <div class="logo-icon" style="margin-bottom: 24px;">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 60px; height: 60px; margin: 0 auto; filter: drop-shadow(0 0 12px rgba(16, 185, 129, 0.4));">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
            </div>
            <h2 style="color: var(--primary); font-weight: 800; font-size: 1.8rem;">${title}</h2>
            <p style="font-size: 1.1rem; color: #cbd5e1;">${message}</p>
            <div style="display: flex; gap: 15px; margin-top: 32px;">
                <button class="btn-primary" id="confirm-cancel" style="background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); flex: 1; height: 50px; font-weight: 700;">${cancelText}</button>
                <button class="btn-primary" id="confirm-ok" style="flex: 1; height: 50px; font-weight: 700;">${confirmText}</button>
            </div>
        `);

        document.getElementById('confirm-ok').onclick = () => {
            closePopup(() => resolve(true));
        };

        document.getElementById('confirm-cancel').onclick = () => {
            closePopup(() => resolve(false));
        };
    });
}

/**
 * Custom themed error popup (Red)
 */
function showThemedErrorPopup(message) {
    const { closePopup } = createPremiumOverlay(`
        <div class="logo-icon" style="margin-bottom: 24px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 60px; height: 60px; margin: 0 auto; filter: drop-shadow(0 0 12px rgba(239, 68, 68, 0.4));">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
        </div>
        <h2 style="color: #ef4444; font-weight: 800; font-size: 1.8rem;">Action Failed</h2>
        <p style="font-size: 1.1rem; color: #cbd5e1;">${message}</p>
        <button class="btn-primary w-full" id="close-error-popup" style="background: #ef4444; border: none; box-shadow: 0 4px 20px rgba(239, 68, 68, 0.4); margin-top: 28px; height: 52px; font-weight: 700;">Close</button>
    `, '#ef4444', 'rgba(239, 68, 68, 0.2)');

    document.getElementById('close-error-popup').onclick = () => closePopup();
}

// --- Verification UI ---
function showVerificationPopup(email) {
    const { closePopup } = createPremiumOverlay(`
        <div class="logo-icon" style="margin-bottom: 24px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 60px; height: 60px; margin: 0 auto; filter: drop-shadow(0 0 12px rgba(16, 185, 129, 0.4));">
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
        </div>
        <h2 style="color: #10b981; font-weight: 800; font-size: 1.8rem;">Verify Your Email</h2>
        <p style="font-size: 1.1rem; color: #cbd5e1;">We've sent a verification link to<br><strong style="color:white;">${email}</strong></p>
        <p style="font-size: 0.95rem; color: var(--text-muted); line-height: 1.5; margin-top: 10px;">Please click the link in your inbox to activate your account and start listing properties.</p>
        <button class="btn-primary w-full" id="close-verify-popup" style="margin-top: 28px; height: 52px; font-weight: 700;">Got it, checking now!</button>
    `);

    document.getElementById('close-verify-popup').onclick = () => closePopup();
}

// --- User Profile Sync ---
async function syncUserProfile(user) {
    if (!user) return;

    // Google users are automatically considered verified
    const isGoogleUser = user.providerData && user.providerData.some(p => p.providerId === 'google.com');

    console.log("[DEBUG] syncUserProfile called for:", user.email, "Verified:", user.emailVerified, "isGoogle:", isGoogleUser);

    if (!user.emailVerified && !isGoogleUser) {
        console.log("[DEBUG] Skipping Firestore sync: Not qualified (unverified non-Google).");
        return;
    }

    console.log("[DEBUG] Qualified for sync. Starting Firestore operations...");

    try {
        const db = firebase.firestore();
        const userRef = db.collection('users').doc(user.uid);

        const userData = {
            email: user.email,
            lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
            domaafVerified: true,
            provider: isGoogleUser ? 'google' : 'password'
        };

        // Standardizing: use set with merge for robust "upsert"
        // This ensures the doc is created if missing, and updated if exists.
        await userRef.set(userData, { merge: true });

        // If it's a completely new document, add the decorative fields
        const docSnap = await userRef.get();
        if (docSnap.exists && !docSnap.data().createdAt) {
            await userRef.update({
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                displayName: user.displayName || user.email.split('@')[0]
            });
        }

        console.log("Firestore profile synchronized successfully.");
        localStorage.setItem('domaaf_auth_hint', 'true');
    } catch (err) {
        console.error("Profile sync failure:", err);
        if (err.code === "permission-denied") {
            console.error("⚠️ Firestore Permission Denied! Update your Rules in Firebase Console to allow writes to 'users' collection.");
        } else {
            console.warn("Profile sync had a minor issue, but login continues.");
        }
    }
}

// --- Auth Observer ---
function initAuthListener() {
    firebase.auth().onAuthStateChanged(async (user) => {
        const authButtons = document.getElementById('auth-buttons');
        const userProfile = document.getElementById('user-profile');
        const userAvatar = document.getElementById('user-avatar');
        const userEmailText = document.getElementById('user-display-email');
        const userNameText = document.getElementById('user-display-name');
        const dropdownAvatarMini = document.getElementById('dropdown-avatar-mini');

        if (user) {
            // --- ENFORCE EMAIL VERIFICATION (Skip for Admin or Google Users) ---
            const isAdmin = ['admin@domaaf.com'].includes(user.email?.toLowerCase());
            
            // Comprehensive Google user check: either via providerData or external flag
            const isGoogleByProvider = user.providerData && user.providerData.some(p => p.providerId === 'google.com');
            const isGoogleByHint = localStorage.getItem('is_google_auth') === 'true';
            const isGoogleUser = isGoogleByProvider || isGoogleByHint;

            if (!user.emailVerified && !isAdmin && !isGoogleUser) {
                // IMPORTANT: Give a small grace period for the SDK to populate providerData
                // This prevents race conditions during the initial login fire.
                setTimeout(async () => {
                    const freshUser = firebase.auth().currentUser;
                    if (!freshUser) return;
                    
                    const stillGoogleCheck = freshUser.providerData && freshUser.providerData.some(p => p.providerId === 'google.com');
                    if (!freshUser.emailVerified && !isAdmin && !stillGoogleCheck) {
                        console.warn("Unverified non-Google user confirmed. Enforcing logout.");
                        localStorage.removeItem('domaaf_auth_hint');
                        localStorage.removeItem('is_google_auth');

                        if (authButtons) authButtons.style.display = 'flex';
                        if (userProfile) userProfile.style.display = 'none';

                        await firebase.auth().signOut();
                    }
                }, 2000); 
                return;
            }

            // --- VERIFIED USER FLOW ---
            localStorage.setItem('domaaf_auth_hint', 'true');
            if (isGoogleUser) localStorage.setItem('is_google_auth', 'true');

            if (authButtons) authButtons.style.display = 'none';
            if (userProfile) userProfile.style.display = 'flex';
            if (userEmailText) userEmailText.innerText = user.email;

            const userInitial = (user.displayName || user.email || "?").charAt(0).toUpperCase();

            const page = window.location.pathname.split("/").pop() || "index.html";
            if (page === "dashboard.html") loadUserDashboard();
            else if (page === "profile.html") loadUserProfileData();

            // Real-time Firestore profile enrichment
            firebase.firestore().collection('users').doc(user.uid).get().then(userDoc => {
                if (!userDoc.exists) return;
                const data = userDoc.data();
                const displayName = data.displayName || user.displayName || "User";
                if (userNameText) userNameText.innerText = displayName;

                const initial = displayName[0].toUpperCase();
                const photoURL = data.photoURL || user.photoURL;

                [userAvatar, dropdownAvatarMini].forEach(el => {
                    if (el) {
                        if (photoURL) {
                            let finalURL = photoURL;
                            if (photoURL.startsWith('assets/') && window.location.pathname.includes('/admin/')) {
                                finalURL = '../' + photoURL;
                            }

                            const img = new Image();
                            img.onload = () => {
                                el.innerText = "";
                                el.style.backgroundImage = `url(${finalURL})`;
                                el.style.backgroundSize = 'cover';
                            };
                            img.onerror = () => {
                                el.innerText = initial;
                                el.style.backgroundImage = 'none';
                            };
                            img.src = finalURL;
                        } else {
                            el.innerText = initial;
                            el.style.backgroundImage = 'none';
                        }
                    }
                });
            }).catch(e => console.warn("Doc fetch failed:", e));

        } else {
            // --- NO USER ---
            localStorage.removeItem('domaaf_auth_hint');
            if (authButtons) authButtons.style.display = 'flex';
            if (userProfile) userProfile.style.display = 'none';
        }
    });
}

/**
 * Handle Firebase Dynamic Email Actions (Reset Password, Verify Email)
 */
async function handleFirebaseAuthActions() {
    // ── Step 2: Handle email action links (password reset, email verification) ──
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    const oobCode = urlParams.get('oobCode');

    if (!mode || !oobCode) return;

    console.log(`[AUTH-ACTION] Detected mode: ${mode}`);

    // Clean URL after capturing params
    const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
    window.history.replaceState({ path: cleanUrl }, '', cleanUrl);

    try {
        if (mode === 'resetPassword') {
            const email = await firebase.auth().verifyPasswordResetCode(oobCode);
            showPasswordResetPopup(oobCode, email);
        } else if (mode === 'verifyEmail') {
            await firebase.auth().applyActionCode(oobCode);
            showThemedSuccessPopup("Email Verified Successfully! You can now access all features.");
        }
    } catch (error) {
        console.error(`[AUTH-ACTION] Error handling ${mode}:`, error);
        showThemedErrorPopup(error.message || "Invalid or expired action link. Please try again.");
    }
}

/**
 * Show a premium themed popup for password reset
 */
function showPasswordResetPopup(oobCode, email) {
    const overlay = document.createElement('div');
    overlay.className = 'verification-overlay';
    overlay.style.zIndex = '20000';
    
    overlay.innerHTML = `
        <div class="verification-card glass-premium anim-premium-pop" style="max-width: 400px; padding: 40px; border-color: var(--primary) !important;">
            <div class="logo-icon" style="margin-bottom: 24px;">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:48px;height:48px;margin:0 auto;">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    <path d="M8 11h8"/><path d="M12 7v8"/>
                </svg>
            </div>
            
            <h2 style="font-size: 1.8rem; font-weight: 800; color: white; margin-bottom: 8px;">Reset Password</h2>
            <p style="color: var(--text-muted); font-size: 0.95rem; margin-bottom: 24px;">Setting a new password for <br><strong style="color:white;">${email}</strong></p>
            
            <div id="reset-error" style="color: #ef4444; font-size: 0.85rem; background: rgba(239, 68, 68, 0.1); padding: 10px; border-radius: 12px; margin-bottom: 16px; border: 1px solid rgba(239,68,68,0.2); display: none;"></div>

            <form id="reset-password-form" style="display:flex; flex-direction:column; gap: 20px;">
                <div style="display:flex; flex-direction:column; gap:8px;">
                    <label style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">New Password</label>
                    <input type="password" id="new-password" placeholder="Min. 6 characters" class="input-premium" required minlength="6">
                </div>
                <div style="display:flex; flex-direction:column; gap:8px;">
                    <label style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Confirm New Password</label>
                    <input type="password" id="confirm-new-password" placeholder="Repeat new password" class="input-premium" required minlength="6">
                </div>
                
                <button type="submit" class="btn-primary w-full" style="height:54px; font-weight:700; font-size:1rem; margin-top:10px;">Update Password</button>
            </form>
        </div>
    `;
    
    document.body.appendChild(overlay);
    setTimeout(() => overlay.classList.add('show'), 100);

    const form = document.getElementById('reset-password-form');
    const errorDiv = document.getElementById('reset-error');
    const submitBtn = form.querySelector('button');

    form.onsubmit = async (e) => {
        e.preventDefault();
        const pass1 = document.getElementById('new-password').value;
        const pass2 = document.getElementById('confirm-new-password').value;

        if (pass1 !== pass2) {
            errorDiv.innerText = "Passwords do not match.";
            errorDiv.style.display = 'block';
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerText = "Updating...";
        errorDiv.style.display = 'none';

        try {
            await firebase.auth().confirmPasswordReset(oobCode, pass1);
            
            overlay.classList.remove('show');
            setTimeout(() => overlay.remove(), 400);

            showThemedSuccessPopup("Password updated successfully! You can now sign in with your new password.");
            
            setTimeout(() => {
                const loginModal = document.getElementById('login-modal');
                if (loginModal) loginModal.classList.remove('hidden');
            }, 1000);

        } catch (error) {
            console.error("Confirm Reset Error:", error);
            errorDiv.innerText = error.message;
            errorDiv.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.innerText = "Update Password";
        }
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

        imagePreview.innerHTML = '';
        imagePreview.classList.remove('hidden');

        const previewItem = document.createElement('div');
        previewItem.className = 'preview-item';
        previewItem.style.position = 'relative';
        previewItem.style.borderRadius = '12px';
        previewItem.style.overflow = 'hidden';
        previewItem.style.aspectRatio = '1';
        previewItem.innerHTML = '<div class="btn-loader mini"></div>';
        imagePreview.appendChild(previewItem);

        try {
            // Compress before browser read
            const compressed = await compressImage(file, 22);
            const reader = new FileReader();
            reader.onload = (re) => {
                previewItem.innerHTML = `<img src="${re.target.result}" style="width:100%; height:100%; object-fit:cover;">`;
            };
            reader.readAsDataURL(compressed);
        } catch (err) {
            console.error("Preview error:", err);
            previewItem.innerHTML = '<span>!</span>';
        }

        if (typeof validateForm === 'function') validateForm();
    };

    if (videoInput) {
        videoInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const video = document.createElement('video');
            video.preload = 'metadata';
            video.onloadedmetadata = () => {
                window.URL.revokeObjectURL(video.src);
                if (video.duration > 6) {
                    showThemedWarningPopup("Video must be 5 seconds or less.");
                    videoInput.value = "";
                    videoPreview.innerHTML = "";
                } else if (file.size > 5 * 1024 * 1024) {
                    showThemedWarningPopup("Video must be 5MB or less.");
                    videoInput.value = "";
                    videoPreview.innerHTML = "";
                } else {
                    videoPreview.innerHTML = `<span style="color:#10b981">✓ Video Valid (${(file.size / 1024 / 1024).toFixed(1)}MB)</span>`;
                }
            };
            video.src = URL.createObjectURL(file);
        };
    }
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
                // Target output: 800×450 (16:9) — matches card-img display ratio perfectly
                const TARGET_W = 800;
                const TARGET_H = 450;

                const canvas = document.createElement('canvas');
                canvas.width = TARGET_W;
                canvas.height = TARGET_H;
                const ctx = canvas.getContext('2d');

                // Center-crop: scale image to cover the target canvas, centered
                const srcRatio = img.width / img.height;
                const dstRatio = TARGET_W / TARGET_H;

                let sx = 0, sy = 0, sw = img.width, sh = img.height;
                if (srcRatio > dstRatio) {
                    // Image is wider — crop sides
                    sw = img.height * dstRatio;
                    sx = (img.width - sw) / 2;
                } else {
                    // Image is taller — crop top/bottom
                    sh = img.width / dstRatio;
                    sy = (img.height - sh) / 2;
                }

                ctx.drawImage(img, sx, sy, sw, sh, 0, 0, TARGET_W, TARGET_H);

                // Compress to target KB
                let quality = 0.7;
                const adjustQuality = () => {
                    canvas.toBlob((blob) => {
                        if (blob.size / 1024 > (targetKB || 200) && quality > 0.15) {
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
// --- Search & Filtering ---
function initFilters() {
    const searchBtn = document.getElementById('search-btn');
    const searchNowBtn = document.getElementById('search-now-btn');
    const locationInput = document.getElementById('search-location');
    const typeSelect = document.getElementById('search-type');
    const categoryPills = document.querySelectorAll('.category-pill');

    // --- Typing Placeholder Animation ---
    if (locationInput) {
        const phrases = [
            'Search in Douala...',
            'Search in Yaoundé...',
            'Search in Bafoussam...',
            'Search in Limbe...',
            'Search in Buea...',
            'Find your perfect stay...',
        ];
        let phraseIndex = 0, charIndex = 0, isDeleting = false;
        let typingTimer;

        function typeEffect() {
            const current = phrases[phraseIndex];
            if (document.activeElement === locationInput) {
                typingTimer = setTimeout(typeEffect, 2000);
                return;
            }
            if (!isDeleting) {
                locationInput.placeholder = current.substring(0, charIndex + 1);
                charIndex++;
                if (charIndex === current.length) {
                    isDeleting = true;
                    typingTimer = setTimeout(typeEffect, 1800);
                    return;
                }
            } else {
                locationInput.placeholder = current.substring(0, charIndex - 1);
                charIndex--;
                if (charIndex === 0) {
                    isDeleting = false;
                    phraseIndex = (phraseIndex + 1) % phrases.length;
                }
            }
            typingTimer = setTimeout(typeEffect, isDeleting ? 50 : 110);
        }
        typeEffect();
    }

    // --- Filter Segment Focus Logic ---
    const locationSegment = document.getElementById('location-segment');
    const typeSegment = document.getElementById('type-segment');

    if (locationSegment && locationInput) {
        locationSegment.onclick = () => locationInput.focus();
    }
    if (typeSegment && typeSelect) {
        typeSegment.onclick = () => typeSelect.focus();
    }

    // 1. Search Icon Scroll
    if (searchBtn) {
        searchBtn.onclick = () => {
            const hero = document.querySelector('.hero');
            if (hero) hero.scrollIntoView({ behavior: 'smooth' });
            if (locationInput) locationInput.focus();
        };
    }

    // 2. Search Now Button
    if (searchNowBtn) {
        searchNowBtn.onclick = (e) => {
            e.stopPropagation(); // Prevent segment click from firing
            const loc = locationInput.value.toLowerCase();
            const type = typeSelect.value;

            // Add animation class
            searchNowBtn.classList.add('btn-click-anim');

            // Remove the class after a short delay (e.g., 300ms)
            setTimeout(() => {
                searchNowBtn.classList.remove('btn-click-anim');
            }, 300);

            loadProperties(loc, type);

            // Sync category pills with the searched property type
            categoryPills.forEach(p => p.classList.remove('active'));
            const targetCategory = type || 'All';
            const matchedPill = Array.from(categoryPills).find(p => p.getAttribute('data-category') === targetCategory);
            if (matchedPill) matchedPill.classList.add('active');
        };
    }

    // 3. Category Pills
    categoryPills.forEach(pill => {
        pill.onclick = () => {
            categoryPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            const cat = pill.getAttribute('data-category');
            loadProperties('', cat === 'All' ? '' : cat);
        };
    });

    // 4. Tier Cards Integration
    const tierCards = document.querySelectorAll('.tier-card');
    tierCards.forEach(card => {
        card.onclick = () => {
            let plan = 'free';
            if (card.classList.contains('gold')) plan = 'gold';
            if (card.classList.contains('platinum')) plan = 'platinum';

            const planSelect = document.getElementById('plan-choice');
            if (planSelect) planSelect.value = plan;

            // Open Upload Modal
            const uploadBtn = document.getElementById('upload-btn');
            if (uploadBtn) uploadBtn.click();
        };
    });
}

/**
 * Load properties from Firestore with optional filtering
 */
async function loadProperties(locationFilter = '', typeFilter = '') {
    console.log(`Loading properties... Filter[Loc: ${locationFilter}, Type: ${typeFilter}]`);
    const grid = document.getElementById('properties-grid');
    if (!grid) return;

    // Show skeletons
    grid.innerHTML = '<div class="property-card loading"></div>'.repeat(3);

    try {
        if (typeof firebase === 'undefined' || !firebase.apps.length) {
            throw new Error("FIREBASE_NOT_INIT");
        }

        let query = firebase.firestore().collection('properties');

        // Only show published properties on main feed
        query = query.where('status', '==', 'published');

        if (typeFilter) {
            query = query.where('type', '==', typeFilter);
        }

        // For dev, we might want to see everything
        const snapshot = await query.limit(20).get();
        let properties = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (locationFilter) {
            properties = properties.filter(p =>
                (p.title && p.title.toLowerCase().includes(locationFilter)) ||
                (p.description && p.description.toLowerCase().includes(locationFilter))
            );
        }

        if (properties.length === 0) {
            grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">No properties found matching your criteria.</div>';
        } else {
            renderGrid(properties);
        }
    } catch (e) {
        console.warn("Load error:", e.message);
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #ef4444;">Unable to load properties. Please check your connection.</div>';
    }
}

/**
 * Render the property grid with a list of properties
 */
/**
 * Render the property grid with a list of properties
 */
function renderGrid(data) {
    const grid = document.getElementById('properties-grid');
    if (!grid) return;

    // Use DocumentFragment for better DOM injection performance
    const fragment = document.createDocumentFragment();
    
    // Reset property list global
    window._propertyList = [];

    data.forEach((p, idx) => {
        window._propertyList[idx] = p;
        const imageUrl = getValidImageUrl(p.imageUrl);
        
        const card = document.createElement('div');
        card.className = 'property-card';
        card.style.cursor = 'pointer';
        card.onclick = () => openPropertyPanel(idx);
        
        card.innerHTML = `
            <div class="card-img">
                <img src="${imageUrl}" alt="${p.title}" loading="lazy" decoding="async" style="width:100%; height:100%; object-fit:cover;">
                ${p.plan && p.plan !== 'free' ? `<span class="card-badge badge-gold">${p.plan}</span>` : ''}
                <div style="position: absolute; bottom: 10px; left: 10px; background: rgba(0,0,0,0.6); color: white; padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; display: flex; align-items: center; gap: 4px; backdrop-filter: blur(4px);">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:12px;height:12px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    ${p.location || 'Cameroon'}
                </div>
            </div>
            <div class="card-content">
                <p style="color:var(--primary); font-size:0.8rem; font-weight:600; text-transform:uppercase;">${p.type || 'Property'}</p>
                <h3 style="margin: 5px 0; color: white; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.title}</h3>
                <p class="price" style="color: #10b981; font-weight: 700;">${Number(p.price).toLocaleString()} XAF <small style="color: grey; font-weight: 400;">/ month</small></p>
                <button class="btn-primary" style="width:100%; padding:10px; margin-top:15px; font-size:0.85rem; font-weight: 600;">View Details</button>
            </div>
        `;
        fragment.appendChild(card);
    });

    grid.innerHTML = ''; // Clear skeleton
    grid.appendChild(fragment);
}

// --- Property Detail Panel ---
async function openPropertyPanel(idOrIdx) {
    let p = null;
    
    // Check if it's an index from the loaded list
    if (typeof idOrIdx === 'number' && window._propertyList && window._propertyList[idOrIdx]) {
        p = window._propertyList[idOrIdx];
    } else {
        // It's a document ID, fetch it from Firestore directly
        try {
            const doc = await firebase.firestore().collection('properties').doc(idOrIdx).get();
            if (doc.exists) {
                p = { id: doc.id, ...doc.data() };
            }
        } catch (err) {
            console.error("Failed to fetch property details:", err);
        }
    }

    if (!p) return;

    const panel = document.getElementById('property-detail-panel');
    const backdrop = document.getElementById('property-panel-backdrop');
    if (!panel || !backdrop) return;

    // Slider Logic
    const sliderWrapper = document.getElementById('slider-wrapper');
    const sliderDots = document.getElementById('slider-dots');
    const prevBtn = document.getElementById('slider-prev');
    const nextBtn = document.getElementById('slider-next');

    // Support both new 'imageUrls' array and legacy single 'imageUrl'
    const images = p.imageUrls || (p.imageUrl ? [p.imageUrl] : []);

    // Clean slider
    sliderWrapper.innerHTML = '';
    sliderDots.innerHTML = '';
    window._currentSlide = 0;

    if (images.length === 0) {
        sliderWrapper.innerHTML = `<div class="slide"><img src="https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=400&q=80" alt="Fallback"></div>`;
        if (prevBtn) prevBtn.style.display = 'none';
        if (nextBtn) nextBtn.style.display = 'none';
    } else {
        images.forEach((url, i) => {
            const validUrl = getValidImageUrl(url);
            sliderWrapper.innerHTML += `<div class="slide"><img src="${validUrl}" alt="Property ${i + 1}"></div>`;
            sliderDots.innerHTML += `<div class="dot ${i === 0 ? 'active' : ''}" onclick="setSlide(${i})"></div>`;
        });

        const showNav = images.length > 1;
        if (prevBtn) prevBtn.style.display = showNav ? 'flex' : 'none';
        if (nextBtn) nextBtn.style.display = showNav ? 'flex' : 'none';
    }

    // Badge / type
    const videoWrap = document.getElementById('panel-video-wrap');
    const videoEl = document.getElementById('panel-video');
    if (p.videoUrl) {
        videoEl.src = p.videoUrl;
        videoWrap.classList.remove('hidden');
    } else {
        videoEl.src = '';
        videoWrap.classList.add('hidden');
    }

    // Badge / type
    document.getElementById('panel-type-badge').textContent = p.type || 'Property';

    // Title, plan
    document.getElementById('panel-title').textContent = p.title || '';
    const planBadge = document.getElementById('panel-plan-badge');
    const plan = (p.plan || 'free').toLowerCase();
    planBadge.textContent = plan.charAt(0).toUpperCase() + plan.slice(1);
    planBadge.className = `plan-badge ${plan !== 'free' ? plan : ''}`;

    // Price
    document.getElementById('panel-price').textContent = Number(p.price).toLocaleString() + ' XAF';

    // Description
    document.getElementById('panel-description').textContent = p.description || 'No description provided.';

    // Contact
    const contactGrid = document.getElementById('panel-contact-grid');
    contactGrid.innerHTML = '';
    const contacts = [
        { icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`, value: p.contactEmail, label: 'Email' },
        { icon: `<svg viewBox="0 0 24 24" fill="currentColor" style="width:18px;height:18px;"><path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>`, value: p.contactPhone, label: 'Phone / WhatsApp' },
        { icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`, value: p.userEmail, label: 'Account Email' },
    ];
    contacts.forEach(c => {
        if (!c.value) return;
        contactGrid.innerHTML += `<div class="panel-contact-item">${c.icon}<div><div class="meta-label">${c.label}</div><div>${c.value}</div></div></div>`;
    });
    if (!contactGrid.innerHTML) {
        contactGrid.innerHTML = '<p style="color:var(--text-muted); font-size:0.85rem;">No contact info provided.</p>';
    }

    // Meta grid
    const metaGrid = document.getElementById('panel-meta-grid');
    const listed = p.createdAt?.toDate ? p.createdAt.toDate().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Recently';
    metaGrid.innerHTML = `
        <div class="panel-meta-item"><div class="meta-label">Type</div><div class="meta-value">${p.type || '—'}</div></div>
        <div class="panel-meta-item"><div class="meta-label">Location</div><div class="meta-value">${p.location || 'Cameroon'}</div></div>
        <div class="panel-meta-item"><div class="meta-label">Plan</div><div class="meta-value">${plan.charAt(0).toUpperCase() + plan.slice(1)}</div></div>
        <div class="panel-meta-item"><div class="meta-label">Status</div><div class="meta-value" style="color:var(--primary);">${(p.status || 'active').charAt(0).toUpperCase() + (p.status || 'active').slice(1)}</div></div>
        <div class="panel-meta-item"><div class="meta-label">Listed</div><div class="meta-value">${listed}</div></div>
    `;

    // Action buttons
    const waBtn = document.getElementById('panel-whatsapp-btn');
    const emailBtn = document.getElementById('panel-email-btn');
    const callBtn = document.getElementById('panel-call-btn');

    if (p.contactPhone) {
        waBtn.href = `https://wa.me/${p.contactPhone.replace(/[^0-9+]/g, '')}`;
        waBtn.classList.remove('hidden');
        callBtn.href = `tel:${p.contactPhone}`;
        callBtn.classList.remove('hidden');
    } else {
        waBtn.classList.add('hidden');
        callBtn.classList.add('hidden');
    }
    if (p.contactEmail || p.userEmail) {
        emailBtn.href = `mailto:${p.contactEmail || p.userEmail}`;
        emailBtn.classList.remove('hidden');
    } else {
        emailBtn.classList.add('hidden');
    }

    // Open panel
    panel.classList.remove('hidden'); // Fix: Remove hidden before adding open class
    backdrop.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => panel.classList.add('panel-open'));
}

function closePropertyPanel() {
    const panel = document.getElementById('property-detail-panel');
    const backdrop = document.getElementById('property-panel-backdrop');
    if (!panel) return;
    panel.classList.remove('panel-open');
    document.body.style.overflow = '';
    setTimeout(() => {
        if (backdrop) backdrop.classList.add('hidden');
        panel.classList.add('hidden'); // Fix: Add hidden back after transition
    }, 350);
    // Pause video
    const videoEl = document.getElementById('panel-video');
    if (videoEl) videoEl.pause();
}

/**
 * Slider Navigation
 */
function moveSlide(direction) {
    const images = document.querySelectorAll('.slider-wrapper .slide');
    if (images.length <= 1) return;

    window._currentSlide = (window._currentSlide + direction + images.length) % images.length;
    updateSliderUI();
}

function setSlide(index) {
    window._currentSlide = index;
    updateSliderUI();
}

function updateSliderUI() {
    const wrapper = document.getElementById('slider-wrapper');
    const dots = document.querySelectorAll('.slider-dots .dot');

    if (wrapper) {
        wrapper.style.transform = `translateY(-${window._currentSlide * 100}%)`;
    }

    dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === window._currentSlide);
    });
}

/**
 * Preview Slider Navigation (In Modal)
 */
window._currentPreviewSlide = 0;
window._totalPreviewSlides = 0;

function movePreviewSlide(direction) {
    if (window._totalPreviewSlides <= 1) return;
    window._currentPreviewSlide = (window._currentPreviewSlide + direction + window._totalPreviewSlides) % window._totalPreviewSlides;
    updatePreviewSliderUI();
}

// Obsolete slider functions removed.

// Init panel close events
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('panel-close-btn')?.addEventListener('click', closePropertyPanel);
    document.getElementById('property-panel-backdrop')?.addEventListener('click', closePropertyPanel);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePropertyPanel(); });
});

// --- Dashboard Functionality ---

function initDashboardEventListeners() {
    // Buttons are now standard links/redirections in HTML
}

async function showDashboardSection() {
    const dashboard = document.getElementById('dashboard');
    if (dashboard) dashboard.classList.remove('hidden');
}

function showHomeSection() {
    // Handled by index.html being a separate page
}

async function loadUserDashboard() {
    const user = firebase.auth().currentUser;
    if (!user) {
        console.warn("loadUserDashboard called but no user is logged in.");
        return;
    }

    console.log("Loading dashboard for user:", user.uid, user.email);
    const grid = document.getElementById('dashboard-grid');
    if (!grid) {
        console.warn("Dashboard grid element not found!");
        return;
    }

    grid.innerHTML = '<div class="property-card loading"></div>'.repeat(2);

    try {
        const db = firebase.firestore();
        console.log("Querying properties for UID:", user.uid);

        let query = db.collection('properties').where('uid', '==', user.uid);

        // Use try-catch specifically for the query to detect index errors
        let snapshot;
        try {
            snapshot = await query.orderBy('createdAt', 'desc').get();
            console.log("Dashboard query success (ordered)");
        } catch (indexErr) {
            console.warn("Ordered query failed (maybe missing index), falling back to unordered:", indexErr.message);
            snapshot = await query.get();
        }

        const properties = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(`Found ${properties.length} properties for this user.`);

        if (properties.length === 0) {
            console.log("Rendering 'empty' state for dashboard.");
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 60px; background: var(--glass); border-radius: 20px;">
                    <p style="color: var(--text-muted); margin-bottom: 20px;">You haven't posted any properties yet.</p>
                    <button class="btn-primary" onclick="document.getElementById('upload-btn').click()">Post Your First Property</button>
                </div>
            `;
            return;
        }

        renderDashboardGrid(properties);
    } catch (err) {
        console.error("Dashboard Load Error:", err);
        grid.innerHTML = `<p style="color: #ef4444; text-align: center; padding: 20px;">Failed to load your properties: ${err.message}</p>`;
    }
}

function renderDashboardGrid(data) {
    console.log("Rendering Dashboard Grid with", data.length, "items");
    const grid = document.getElementById('dashboard-grid');
    if (!grid) return;

    grid.innerHTML = data.map(p => {
        console.log(`Rendering item: ${p.id}, Status: ${p.status}`);
        const imageUrl = getValidImageUrl(p.imageUrl);
        return `
        <div class="property-card">
            <div class="card-img" onclick="openPropertyPanel('${p.id}')" style="cursor:pointer;">
                <img src="${imageUrl}" alt="${p.title}" loading="lazy" style="width:100%; height:100%; object-fit:cover;">
                <span class="card-badge ${p.status === 'published' ? 'badge-published' : 'badge-pending'}">${p.status === 'published' ? 'Published' : 'Approval Pending'}</span>
            </div>
            <div class="card-content">
                <p style="color:var(--primary); font-size:0.8rem; font-weight:600; text-transform:uppercase;">${p.type || 'Property'}</p>
                <h3 onclick="openPropertyPanel('${p.id}')" style="margin: 5px 0; color: white; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor:pointer;">${p.title}</h3>
                <p class="price" style="color: #10b981; font-weight: 700;">${Number(p.price).toLocaleString()} XAF</p>
                
                <div class="card-actions">
                    <button class="btn-edit" onclick="editProperty('${p.id}')">Edit</button>
                    <button class="btn-delete" onclick="deleteProperty('${p.id}')">Delete</button>
                </div>
            </div>
        </div>
    `;
    }).join('');
}

async function deleteProperty(id) {
    const overlay = document.createElement('div');
    overlay.className = 'verification-overlay';
    overlay.style.zIndex = '10000';
    overlay.innerHTML = `
        <div class="verification-card" style="border-color: #ef4444; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6), 0 0 20px rgba(239, 68, 68, 0.2);">
            <div class="logo-icon" style="margin-bottom: 20px;">
                <svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 50px; height: 50px; margin: 0 auto;">
                    <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
            </div>
            <h2 style="color: #ef4444;">Delete Property?</h2>
            <p>Are you sure you want to delete this listing? This action cannot be undone.</p>
            <div style="display: flex; gap: 12px; margin-top: 20px;">
                <button class="btn-primary w-full" id="confirm-delete-btn" style="background: #ef4444;">Delete</button>
                <button class="btn-primary w-full" id="cancel-delete-btn" style="background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border);">Cancel</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('cancel-delete-btn').onclick = () => {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 400);
    };

    document.getElementById('confirm-delete-btn').onclick = async () => {
        try {
            overlay.style.pointerEvents = 'none';
            document.getElementById('confirm-delete-btn').innerText = "Deleting...";
            await firebase.firestore().collection('properties').doc(id).delete();
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 400);
            showThemedSuccessPopup("Property deleted!");
            loadUserDashboard();
        } catch (err) {
            console.error("Delete Error:", err);
            showThemedErrorPopup("Failed to delete property.");
            overlay.remove();
        }
    };
}

async function editProperty(id) {
    try {
        const doc = await firebase.firestore().collection('properties').doc(id).get();
        if (!doc.exists) return;

        const data = doc.data();
        const form = document.getElementById('property-form');
        const modal = document.getElementById('upload-modal');

        if (!form || !modal) return;

        // Populate fields using querySelector for robustness
        const titleInput = form.querySelector('input[type="text"]');
        if (titleInput) titleInput.value = data.title || "";

        const descInput = form.querySelector('textarea');
        if (descInput) descInput.value = data.description || "";

        const priceInput = form.querySelector('input[type="number"]');
        if (priceInput) priceInput.value = data.price || "";

        const typeSelect = document.getElementById('property-type');
        if (typeSelect) typeSelect.value = data.type || "Apartment";

        const locationSelect = document.getElementById('property-location');
        if (locationSelect) locationSelect.value = data.location || "";

        const planSelect = document.getElementById('plan-choice');
        if (planSelect) planSelect.value = data.plan || "free";

        const emailInput = document.getElementById('contact-email');
        if (emailInput) emailInput.value = data.contactEmail || "";

        const phoneInput = document.getElementById('contact-phone');
        if (phoneInput) phoneInput.value = data.contactPhone || "";

        // Modal title and button text
        const modalTitle = modal.querySelector('h2');
        if (modalTitle) modalTitle.innerText = "Edit Property Listing";

        const submitBtn = document.getElementById('submit-listing-btn');
        if (submitBtn) {
            const btnText = submitBtn.querySelector('.btn-text');
            if (btnText) {
                btnText.innerText = "Update Listing";
            } else {
                submitBtn.innerText = "Update Listing";
            }
            submitBtn.style.opacity = '1';
            submitBtn.style.cursor = 'pointer';
            submitBtn.disabled = false;
        }

        // Set edit ID
        form.dataset.editId = id;

        // Image Preview (Matches single-image structure)
        const imagePreview = document.getElementById('image-preview');
        if (imagePreview) {
            imagePreview.innerHTML = "";
            imagePreview.classList.remove('hidden');
            const imgUrl = data.imageUrl || (data.imageUrls && data.imageUrls[0]);
            if (imgUrl) {
                const previewUrl = getValidImageUrl(imgUrl);
                const previewItem = document.createElement('div');
                previewItem.className = 'preview-item';
                previewItem.style.position = 'relative';
                previewItem.style.borderRadius = '12px';
                previewItem.style.overflow = 'hidden';
                previewItem.style.aspectRatio = '1';
                previewItem.innerHTML = `<img src="${previewUrl}" style="width:100%; height:100%; object-fit:cover;">`;
                imagePreview.appendChild(previewItem);
            }
        }

        const vidPreview = document.getElementById('video-preview');
        if (vidPreview) {
            if (data.videoUrl) {
                vidPreview.innerHTML = `<span style="color:#10b981">✓ Video Attached</span>`;
            } else {
                vidPreview.innerHTML = "";
            }
        }

        modal.classList.remove('hidden');
        if (typeof validateForm === 'function') validateForm();
    } catch (err) {
        console.error("Edit Error:", err);
        showThemedErrorPopup("Failed to load property details for editing.");
    }
}

// --- Profile Functionality ---

function initProfileEventListeners() {
    const profilePicContainer = document.getElementById('profile-img-container');
    const profilePicInput = document.getElementById('profile-pic-input');
    const profileForm = document.getElementById('profile-form');

    if (profilePicContainer && profilePicInput) {
        profilePicContainer.onclick = () => profilePicInput.click();

        profilePicInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const preview = document.getElementById('profile-pic-preview');
            if (preview) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    preview.src = event.target.result;
                };
                reader.readAsDataURL(file);
            }
        };
    }

    if (profileForm) {
        profileForm.onsubmit = async (e) => {
            e.preventDefault();
            await saveUserProfile();
        };
    }
}

async function showProfileSection() {
    const profileSection = document.getElementById('profile-section');
    if (profileSection) profileSection.classList.remove('hidden');
}


// 3D Cartoon Avatars

// Let's replace placeholders with the actual generated local paths
// Note: In a real prod environment these would be served from a CDN/Storage
// But for this session, we link to the generated workspace files.
const ACTUAL_AVATARS = [
    'assets/avatars/avatar_3d_1_1773476206598.png',
    'assets/avatars/avatar_3d_2_1773476244147.png',
    'assets/avatars/avatar_3d_3_1773476305243.png',
    'assets/avatars/avatar_3d_4_1773476324370.png',
    'assets/avatars/avatar_3d_5.png',
    'assets/avatars/avatar_3d_6.png',
    'assets/avatars/avatar_3d_7.png'
];

let selectedAvatarUrl = null;

function initAvatarGrid(currentPhotoUrl) {
    const grid = document.getElementById('avatar-grid');
    if (!grid) return;

    grid.innerHTML = '';
    ACTUAL_AVATARS.forEach(url => {
        const div = document.createElement('div');
        div.className = 'avatar-item';
        div.style.cssText = `
            width: 100%;
            aspect-ratio: 1;
            border-radius: 12px;
            cursor: pointer;
            border: 2px solid transparent;
            overflow: hidden;
            transition: all 0.2s ease;
            background: rgba(255,255,255,0.05);
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        const img = document.createElement('img');
        img.src = url;
        img.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';

        div.appendChild(img);

        if (url === currentPhotoUrl) {
            div.style.borderColor = 'var(--primary)';
            div.style.background = 'rgba(16, 185, 129, 0.1)';
            selectedAvatarUrl = url;
        }

        div.onclick = () => {
            // Deselect others
            document.querySelectorAll('.avatar-item').forEach(item => {
                item.style.borderColor = 'transparent';
                item.style.background = 'rgba(255,255,255,0.05)';
            });
            // Select this
            div.style.borderColor = 'var(--primary)';
            div.style.background = 'rgba(16, 185, 129, 0.1)';
            selectedAvatarUrl = url;

            // Update preview
            const preview = document.getElementById('profile-pic-preview');
            if (preview) preview.src = url;

            // Clear file input
            const picInput = document.getElementById('profile-pic-input');
            if (picInput) picInput.value = '';
        };

        grid.appendChild(div);
    });
}

async function loadUserProfileData() {
    const user = firebase.auth().currentUser;
    if (!user) return;

    try {
        const doc = await firebase.firestore().collection('users').doc(user.uid).get();
        if (doc.exists) {
            const data = doc.data();
            const nameEl = document.getElementById('profile-name');
            const locEl = document.getElementById('profile-location');
            const picEl = document.getElementById('profile-pic-preview');

            if (nameEl) nameEl.value = data.displayName || "";
            if (locEl) locEl.value = data.location || "";
            if (data.photoURL) {
                if (picEl) picEl.src = data.photoURL;
                initAvatarGrid(data.photoURL);
            } else {
                initAvatarGrid(null);
            }
        } else {
            initAvatarGrid(null);
        }
    } catch (err) {
        console.error("Profile Load Error:", err);
    }
}

async function saveUserProfile() {
    const user = firebase.auth().currentUser;
    if (!user) return;

    const name = document.getElementById('profile-name')?.value || '';
    const location = document.getElementById('profile-location')?.value || '';
    const picInput = document.getElementById('profile-pic-input');
    const submitBtn = document.getElementById('save-profile-btn');

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = "Saving...";
    }

    try {
        const updateData = {
            displayName: name,
            location: location,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (picInput?.files && picInput.files[0]) {
            const base64 = await fileToBase64(picInput.files[0]);
            updateData.photoURL = base64;
        } else if (selectedAvatarUrl) {
            updateData.photoURL = selectedAvatarUrl;
        }

        await firebase.firestore().collection('users').doc(user.uid).set(updateData, { merge: true });

        // Update global UI
        const userNameText = document.getElementById('user-display-name');
        if (userNameText) userNameText.innerText = name || "User";

        const avatar = document.getElementById('user-avatar');
        if (avatar && name) {
            avatar.innerText = name.charAt(0).toUpperCase();
            if (updateData.photoURL) {
                avatar.innerText = "";
                avatar.style.backgroundImage = `url(${updateData.photoURL})`;
                avatar.style.backgroundSize = 'cover';
                avatar.style.backgroundPosition = 'center';
            }
        }

        showThemedSuccessPopup("Profile updated successfully!");
    } catch (err) {
        console.error("Profile Save Error:", err);
        showThemedErrorPopup("Failed to save profile.");
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = "Save Profile";
    }
}

function closeProfileDropdown() {
    const dropdown = document.querySelector('.profile-dropdown');
    if (dropdown) dropdown.classList.remove('show');
}

// --- Plan Detail Panel Logic ---
const planDetails = {
    free: {
        title: "Standard (Free Trial)",
        price: "0 XAF",
        period: "Forever",
        description: "Perfect for casual listers or those just getting started with Domaaf.",
        features: [
            { text: "Unlimited property listings", enabled: true },
            { text: "Standard visibility in search results", enabled: true },
            { text: "Email support", enabled: true },
            { text: "Premium badge on profile", enabled: false },
            { text: "Priority search placement", enabled: false }
        ],
        btnLabel: "Continue with Free"
    },
    gold: {
        title: "Gold Tier",
        price: "11,999 XAF",
        period: "per month",
        description: "Get more eyes on your properties with boosted visibility and priority support.",
        features: [
            { text: "Unlimited property listings", enabled: true },
            { text: "Priority visibility in search results", enabled: true },
            { text: "WhatsApp & Email support", enabled: true },
            { text: "Premium 'Gold' badge on listings", enabled: true },
            { text: "Priority search placement", enabled: false }
        ],
        btnLabel: "Upgrade to Gold"
    },
    platinum: {
        title: "Platinum Tier",
        price: "24,999 XAF",
        period: "per month",
        description: "The ultimate exposure for real estate professionals and agencies.",
        features: [
            { text: "Unlimited property listings", enabled: true },
            { text: "Maximum visibility & top placement", enabled: true },
            { text: "Premium 'Platinum' badge on listings", enabled: true },
            { text: "Featured listing status on homepage", enabled: true }
        ],
        btnLabel: "Get Unlimited Access"
    }
};

function openPlanPanel(planId) {
    const details = planDetails[planId];
    if (!details) return;

    const panel = document.getElementById('plan-detail-panel');
    const backdrop = document.getElementById('plan-panel-backdrop');
    if (!panel || !backdrop) return;

    // Fill data
    document.getElementById('plan-panel-title').textContent = details.title;
    document.getElementById('plan-panel-price').textContent = details.price;
    document.getElementById('plan-panel-period').textContent = details.period;
    document.getElementById('plan-panel-description').textContent = details.description;

    const featuresList = document.getElementById('plan-features-list');
    featuresList.innerHTML = '';
    details.features.forEach(feat => {
        const li = document.createElement('li');
        li.textContent = feat.text;
        if (!feat.enabled) li.className = 'disabled';
        featuresList.appendChild(li);
    });

    const selectBtn = document.getElementById('plan-select-btn');
    if (selectBtn) {
        selectBtn.textContent = details.btnLabel;
        selectBtn.onclick = () => {
            // If on home/post page, open upload modal and pre-select
            const planSelect = document.getElementById('plan-choice');
            if (planSelect) planSelect.value = planId;
            closePlanPanel();

            const uploadBtn = document.getElementById('upload-btn');
            if (uploadBtn) uploadBtn.click();
        };
    }

    // Show panel
    backdrop.classList.remove('hidden');
    panel.classList.remove('hidden');
    setTimeout(() => {
        panel.classList.add('panel-open');
    }, 10);
}

function closePlanPanel() {
    const panel = document.getElementById('plan-detail-panel');
    const backdrop = document.getElementById('plan-panel-backdrop');
    if (panel) panel.classList.remove('panel-open');
    if (backdrop) backdrop.classList.add('hidden');
    setTimeout(() => {
        if (panel) panel.classList.add('hidden');
    }, 300);
}

// Initialize listeners for plan cards
function initPlanPanelListeners() {
    // Standard (Free)
    const freeCard = document.querySelector('.tier-card.free');
    if (freeCard) freeCard.onclick = () => openPlanPanel('free');

    // Gold
    const goldCard = document.querySelector('.tier-card.gold');
    if (goldCard) goldCard.onclick = () => openPlanPanel('gold');

    // Platinum
    const platinumCard = document.querySelector('.tier-card.platinum');
    if (platinumCard) platinumCard.onclick = () => openPlanPanel('platinum');

    // Close listeners
    const closeBtn = document.getElementById('plan-panel-close-btn');
    if (closeBtn) closeBtn.onclick = closePlanPanel;

    const backdrop = document.getElementById('plan-panel-backdrop');
    if (backdrop) backdrop.onclick = closePlanPanel;
}

// Call this in DOMContentLoaded or main initialization flow
document.addEventListener('DOMContentLoaded', () => {
    initPlanPanelListeners();
});

