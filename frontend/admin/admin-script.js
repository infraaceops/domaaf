/**
 * Admin Dashboard specific functionality for Domaaf
 */

console.log("Admin Script Loading...");

// Ensure we only run this on the admin page
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    if (path.includes('/admin/')) {
        console.log("Admin Page detected, initializing...");
        checkAdminAccess();
        initSidebar();
        refreshDashboard();
        initAdminLogout();
    }
});

/**
 * Initialize Admin specific logout with Professional Confirmation
 */
function initAdminLogout() {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showAdminLogoutConfirm();
        });
    }
}

/**
 * Show a professional glassmorphic confirm for logout
 */
function showAdminLogoutConfirm() {
    const overlay = document.createElement('div');
    overlay.className = 'verification-overlay';
    overlay.style.zIndex = '10000';
    overlay.innerHTML = `
        <div class="verification-card glass-premium anim-premium-pop" style="border-color: #f59e0b !important; border-width: 2px !important; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 20px rgba(245, 158, 11, 0.2) !important;">
            <div class="logo-icon" style="margin-bottom: 24px;">
                <svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 60px; height: 60px; margin: 0 auto; filter: drop-shadow(0 0 12px rgba(245, 158, 11, 0.4));">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
            </div>
            <h2 style="color: #f59e0b; font-weight: 800; font-size: 1.8rem; letter-spacing: -0.5px; margin-bottom: 15px;">Sign Out?</h2>
            <p style="font-size: 1.1rem; color: #cbd5e1; line-height: 1.6; margin-bottom: 30px;">Are you sure you want to end your admin session and return to the main site?</p>
            <div style="display: flex; gap: 15px;">
                <button class="btn-primary btn-danger w-full" id="confirm-logout-yes">Sign Out</button>
                <button class="btn-primary w-full" id="confirm-logout-no" style="background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); height: 52px; font-weight: 700; font-size: 1rem;">Cancel</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    
    // Fade in
    setTimeout(() => overlay.classList.add('show'), 10);

    const close = () => {
        overlay.classList.remove('show');
        setTimeout(() => overlay.remove(), 400);
    };

    document.getElementById('confirm-logout-no').onclick = close;
    
    document.getElementById('confirm-logout-yes').onclick = async () => {
        const btn = document.getElementById('confirm-logout-yes');
        btn.innerText = "Leaving Admin...";
        btn.disabled = true;
        
        try {
            // ONLY clear admin session — keep Firebase user active for the main site
            sessionStorage.removeItem('domaaf_admin_auth');
            
            // Note: We skip firebase.auth().signOut() here so that 
            // the user stays logged into their regular account on the main app.
            
            window.location.href = '../index.html';
        } catch (err) {
            console.error("Logout Error:", err);
            sessionStorage.removeItem('domaaf_admin_auth');
            window.location.href = '../index.html';
        }
    };
}

/**
 * Robust admin access check & UI Sync
 */
async function checkAdminAccess() {
    // 1. Immediate check for local manual session
    const isManualAuth = sessionStorage.getItem('domaaf_admin_auth') === 'true';

    firebase.auth().onAuthStateChanged(async (user) => {
        if (!user) {
            // Allow manual auth to stay even if not signed into Firebase
            if (isManualAuth) {
                console.log("Admin Dashboard showing via Manual Root session.");
                return;
            }

            // Check if we have an auth hint before redirecting immediately
            const authHint = localStorage.getItem('domaaf_auth_hint') === 'true';
            if (!authHint) {
                console.warn("No user session, redirecting to home...");
                window.location.href = '../index.html';
            }
            return;
        }

        const isAdmin = ['admin@domaaf.com'].includes(user.email?.toLowerCase());
        
        // If logged into Firebase as a non-admin, and NO manual auth, then kick them out
        if (!isAdmin && !isManualAuth) {
            console.warn("Unauthorized access to admin panel by:", user.email);
            window.location.href = '../index.html';
        } else {
            console.log("Admin access granted via Firebase.");
            // Keep the hint alive
            localStorage.setItem('domaaf_auth_hint', 'true');
            
            // Sync Admin Info to Sidebar
            const adminName = document.getElementById('admin-name');
            const adminAvatar = document.getElementById('admin-avatar-mini');
            if (adminName) adminName.innerText = "Admin";
            if (adminAvatar) adminAvatar.innerText = "R";
        }
    });
}

/**
 * Initialize sidebar navigation
 */
function initSidebar() {
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.dashboard-section');
    const sectionTitle = document.getElementById('section-title');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetSet = item.getAttribute('data-section');
            
            // UI Toggle
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            sections.forEach(sec => sec.classList.add('hidden'));
            const activeSec = document.getElementById(`${targetSet}-section`);
            if (activeSec) activeSec.classList.remove('hidden');

            if (sectionTitle) {
                sectionTitle.innerText = item.querySelector('span').innerText;
            }

            // Refresh data if needed
            if (targetSet === 'overview') loadStats();
        });
    });
}

/**
 * Refresh all dashboard data
 */
async function refreshDashboard() {
    await loadStats();
    await loadPendingProperties();
    await loadApprovedProperties();
}

/**
 * Load dashboard statistics
 */
async function loadStats() {
    const db = firebase.firestore();
    const propertiesRef = db.collection('properties');

    // Real-time listener for all stats
    propertiesRef.onSnapshot(allSnap => {
        const total = allSnap.size;
        const pending = allSnap.docs.filter(d => d.data().status === 'pending').length;
        const approved = allSnap.docs.filter(d => d.data().status === 'published').length;

        const statTotal = document.getElementById('stat-total');
        const statPending = document.getElementById('stat-pending');
        const statApproved = document.getElementById('stat-approved');
        const pendingBadge = document.getElementById('pending-count');

        if (statTotal) statTotal.innerText = total;
        if (statPending) statPending.innerText = pending;
        if (statApproved) statApproved.innerText = approved;
        if (pendingBadge) pendingBadge.innerText = pending;
    }, err => console.error("Stats Listener error:", err));
}

/**
 * Load pending properties
 */
async function loadPendingProperties() {
    const grid = document.getElementById('admin-grid');
    if (!grid) return;

    grid.innerHTML = '<div class="property-card loading"></div>'.repeat(3);

    firebase.firestore().collection('properties')
        .where('status', '==', 'pending')
        .onSnapshot(snapshot => {
            const properties = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            if (properties.length === 0) {
                grid.innerHTML = `
                    <div style="grid-column: 1/-1; text-align: center; padding: 60px; background: rgba(255,255,255,0.02); border-radius: 20px; border: 1px dashed var(--glass-border);">
                        <p style="color: var(--text-muted);">No properties pending approval.</p>
                    </div>
                `;
                return;
            }

            renderGrid(grid, properties, false);
        }, err => {
            console.error("Pending Listener Error:", err);
            grid.innerHTML = '<p style="color: #ef4444; text-align: center; padding: 20px;">Failed to load properties.</p>';
        });
}

/**
 * Load approved properties
 */
async function loadApprovedProperties() {
    const grid = document.getElementById('approved-grid');
    if (!grid) return;

    grid.innerHTML = '<div class="property-card loading"></div>'.repeat(3);

    firebase.firestore().collection('properties')
        .where('status', '==', 'published')
        .onSnapshot(snapshot => {
            const properties = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            if (properties.length === 0) {
                grid.innerHTML = `
                    <div style="grid-column: 1/-1; text-align: center; padding: 60px; background: rgba(255,255,255,0.02); border-radius: 20px; border: 1px dashed var(--glass-border);">
                        <p style="color: var(--text-muted);">No approved properties yet.</p>
                    </div>
                `;
                return;
            }

            renderGrid(grid, properties, true);
        }, err => {
            console.error("Approved Listener Error:", err);
        });
}

/**
 * Universal Grid Renderer
 */
function renderGrid(container, data, isApproved) {
    container.innerHTML = data.map(p => {
        const imageUrl = typeof getValidImageUrl === 'function' ? getValidImageUrl(p.imageUrl) : p.imageUrl;
        const date = p.createdAt ? new Date(p.createdAt.seconds * 1000).toLocaleDateString() : 'Recent';
        
        return `
        <div class="property-card anim-fade-up">
            <div class="card-img">
                <img src="${imageUrl}" alt="${p.title}" onerror="this.src='https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=400&q=80'">
                <span class="card-badge" style="background: ${isApproved ? 'var(--primary)' : 'var(--secondary)'}; position: absolute; top: 15px; right: 15px; padding: 4px 10px; border-radius: 6px; font-size: 0.7rem; font-weight: 700; color: white;">
                    ${isApproved ? 'PUBLISHED' : 'PENDING'}
                </span>
            </div>
            <div class="card-content" style="padding: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                    <span style="color:var(--primary); font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing: 0.5px;">${p.type || 'Property'}</span>
                    <span style="color: var(--text-muted); font-size: 0.7rem;">${date}</span>
                </div>
                <h3 style="margin: 0 0 10px; color: white; font-size: 1.1rem; font-weight: 700;">${p.title}</h3>
                <div style="margin-bottom: 15px;">
                    <p style="font-size: 0.8rem; color: var(--text-muted); margin: 0; display: flex; align-items: center; gap: 5px;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        ${p.userEmail}
                    </p>
                    <p style="font-size: 0.8rem; color: var(--text-muted); margin: 5px 0 0; display: flex; align-items: center; gap: 5px;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        ${p.location || 'Cameroon'}
                    </p>
                </div>
                <p class="price" style="font-size: 1.3rem; margin-bottom: 20px;">${Number(p.price).toLocaleString()} <small style="font-size: 0.8rem; opacity: 0.7;">XAF</small></p>
                
                <div class="card-actions">
                    ${!isApproved ? `
                        <button class="btn-approve" onclick="handleAction('approve', '${p.id}')">Approve</button>
                    ` : ''}
                    <button class="${isApproved ? 'btn-delete' : 'btn-reject'}" onclick="handleAction('${isApproved ? 'delete' : 'reject'}', '${p.id}')">
                        ${isApproved ? 'Delete' : 'Reject'}
                    </button>
                </div>
            </div>
        </div>
    `;
    }).join('');
}

/**
 * Handle Admin Actions
 */
async function handleAction(action, id) {
    let title = "Confirm Action";
    let message = "Are you sure?";
    let btnText = "Confirm";

    if (action === 'approve') {
        title = "Publish Listing";
        message = "Are you sure you want to approve and publish this property?";
        btnText = "Approve & Publish";
    } else if (action === 'reject') {
        title = "Reject Listing";
        message = "Reject this property? It will be removed from the moderation queue.";
        btnText = "Reject Listing";
    } else if (action === 'delete') {
        title = "Delete Property";
        message = "Permanently delete this property? This action is irreversible.";
        btnText = "Delete Permanently";
    }

    const confirm = typeof showThemedConfirm === 'function' ? await showThemedConfirm(title, message, btnText) : window.confirm(message);
    if (!confirm) return;

    try {
        if (action === 'approve') {
            await firebase.firestore().collection('properties').doc(id).update({
                status: 'published',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } else {
            await firebase.firestore().collection('properties').doc(id).delete();
        }

        if (typeof showThemedSuccessPopup === 'function') {
            showThemedSuccessPopup(`Property ${action}d successfully!`);
        }
        
        refreshDashboard();
    } catch (err) {
        console.error("Action error:", err);
        if (typeof showThemedErrorPopup === 'function') showThemedErrorPopup("Operation failed.");
    }
}

/**
 * Helper to get a valid, embeddable image URL (Sync'd with script.js version)
 */
function getValidImageUrl(url) {
    const fallback = 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=400&q=80';
    if (!url || typeof url !== 'string' || url.trim().length < 10) return fallback;
    if (url === 'Media uploaded to Drive (Check folder)' || url.startsWith('http://localhost')) return fallback;
    if (url.startsWith('data:')) return url;

    if (url.includes('drive.google.com') || url.includes('googleusercontent.com') || url.includes('lh3.google')) {
        let fileId = null;
        const m1 = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (m1) fileId = m1[1];
        if (!fileId) {
            const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
            if (m2) fileId = m2[1];
        }

        if (fileId) {
            const host = window.location.hostname;
            const backendBase = (host === 'localhost' || host === '127.0.0.1')
                ? `http://${host}:5001`
                : `${window.location.protocol}//${host}:5001`;
            return `${backendBase}/api/image-proxy?fileId=${fileId}`;
        }
    }
    return url;
}

