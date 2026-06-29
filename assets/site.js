// ===== Day/Night theme toggle =====
(function () {
    const stored = localStorage.getItem('bb-theme');
    if (stored === 'day') document.documentElement.classList.add('day');
})();

function toggleTheme() {
    const html = document.documentElement;
    html.classList.toggle('day');
    localStorage.setItem('bb-theme', html.classList.contains('day') ? 'day' : 'night');
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) btn.textContent = html.classList.contains('day') ? 'Night' : 'Day';
}

document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) {
        btn.textContent = document.documentElement.classList.contains('day') ? 'Night' : 'Day';
        btn.addEventListener('click', toggleTheme);
    }
});

// ===== Toast helper =====
function showToast(message) {
    let toast = document.getElementById('bb-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'bb-toast';
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

// ===== Share helper =====
async function sharePlaylist(title, url, evt) {
    if (evt) evt.preventDefault();
    const fullUrl = new URL(url, window.location.href).href;
    const shareData = {
        title: `${title} — Blackbeard's Little Music Library`,
        text: `Check out the "${title}" playlist on Blackbeard's Little Music Library!`,
        url: fullUrl
    };
    if (navigator.share) {
        try { await navigator.share(shareData); return; } catch (e) {}
    }
    try {
        await navigator.clipboard.writeText(fullUrl);
        showToast('🔗 Link copied to clipboard!');
    } catch (e) {
        showToast(fullUrl);
    }
}

// ===== Micro-interactions =====
function spawnFloatingEmoji(x, y, emoji) {
    const el = document.createElement('span');
    el.className = 'float-emoji';
    el.textContent = emoji;
    el.style.left = (x - 12) + 'px';
    el.style.top  = (y - 12) + 'px';
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
}

function spawnRipple(target, x, y) {
    const rect = target.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const el = document.createElement('span');
    el.className = 'ripple-ring';
    el.style.width  = size + 'px';
    el.style.height = size + 'px';
    el.style.left   = (x - rect.left - size / 2) + 'px';
    el.style.top    = (y - rect.top  - size / 2) + 'px';
    target.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.playlist-card').forEach(card => {
        card.addEventListener('click', function(e) {
            if (e.target.closest('.share-btn')) return;
            const emoji = this.querySelector('.art')?.textContent?.trim() || '🎵';
            spawnFloatingEmoji(e.clientX, e.clientY, emoji);
            spawnRipple(this, e.clientX, e.clientY);
        });
    });
});

// ===== Drag-to-scroll for playlist grid =====
document.addEventListener('DOMContentLoaded', () => {
    const grid = document.querySelector('.playlist-grid');
    if (!grid) return;
    let isDown = false, startX, scrollLeft;
    grid.addEventListener('mousedown', e => {
        isDown = true;
        startX = e.pageX - grid.offsetLeft;
        scrollLeft = grid.scrollLeft;
    });
    grid.addEventListener('mouseleave', () => isDown = false);
    grid.addEventListener('mouseup', () => isDown = false);
    grid.addEventListener('mousemove', e => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - grid.offsetLeft;
        grid.scrollLeft = scrollLeft - (x - startX) * 1.2;
    });
});

// ===== Suggestion form (Web3Forms) =====
document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('.suggestion-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = form.querySelector('.form-submit');
        const msg = form.querySelector('[name="message"]');
        if (!msg.value.trim()) { msg.focus(); return; }

        btn.disabled = true;
        btn.textContent = 'Sending...';

        try {
            const res = await fetch('https://api.web3forms.com/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify(Object.fromEntries(new FormData(form)))
            });
            const data = await res.json();
            if (data.success) {
                form.hidden = true;
                document.getElementById('form-success').hidden = false;
            } else {
                btn.disabled = false;
                btn.textContent = 'Send It';
                showToast('Something went wrong — try again');
            }
        } catch (err) {
            btn.disabled = false;
            btn.textContent = 'Send It';
            showToast('Something went wrong — try again');
        }
    });
});

// ===== Side nav (auto-injected on every page) =====
document.addEventListener('DOMContentLoaded', () => {
    const ALL_PAGES = [
        { href: 'index.html',          label: 'Home',           group: null },
        { href: 'heavy-rotation.html', label: 'Heavy Rotation', group: 'Playlists' },
        { href: 'island-bliss.html',   label: 'Island Bliss',   group: null },
        { href: 'raccoon-jams.html',   label: 'Raccoon Jams',   group: null },
        { href: 'walking.html',        label: 'Walking',        group: null },
        { href: 'new-loud.html',       label: 'New Loud',       group: null },
        { href: 'dads-garage.html',    label: "Dad's Garage",   group: null },
        { href: 'saturdaze.html',      label: 'Saturdaze',      group: null },
        { href: 'discoveries.html',    label: 'Discoveries',    group: 'Explore' },
        { href: 'about.html',          label: 'About',          group: null },
    ];

    // Current page for active highlight
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';

    // Build drawer HTML
    function buildNavHTML() {
        let linksHTML = '';
        let currentGroup = '__NONE__';

        ALL_PAGES.forEach(page => {
            // Open new group if needed
            if (page.group !== null && page.group !== currentGroup) {
                if (currentGroup !== '__NONE__') linksHTML += '</div>';
                linksHTML += `<div class="nav-group"><div class="nav-group-label">${page.group}</div>`;
                currentGroup = page.group;
            } else if (page.group === null && currentGroup === '__NONE__') {
                // no group label needed — top-level solo items
            } else if (page.group === null && currentGroup !== '__NONE__') {
                // Close previous named group, back to top-level
                linksHTML += '</div>';
                currentGroup = '__NONE__';
            }

            const isActive = page.href === currentPage ? ' active' : '';
            linksHTML += `<a class="nav-link${isActive}" href="${page.href}" data-label="${page.label.toLowerCase()}">${page.label}</a>`;
        });

        // Close any open group
        if (currentGroup !== '__NONE__') linksHTML += '</div>';

        return `
            <div class="nav-header">
                <span class="nav-brand">The Library</span>
                <button class="nav-close" id="nav-close" aria-label="Close menu">✕</button>
            </div>
            <div class="nav-search-wrap">
                <input type="text" id="nav-search-input" placeholder="Search..." autocomplete="off" spellcheck="false">
            </div>
            <div class="nav-links" id="nav-links">
                ${linksHTML}
                <div class="nav-no-results" id="nav-no-results">No matches found</div>
            </div>
        `;
    }

    // Create elements
    const overlay = document.createElement('div');
    overlay.className = 'nav-overlay';
    overlay.id = 'nav-overlay';

    const drawer = document.createElement('nav');
    drawer.id = 'side-nav';
    drawer.className = 'side-nav';
    drawer.setAttribute('aria-label', 'Site navigation');
    drawer.innerHTML = buildNavHTML();

    const toggle = document.createElement('button');
    toggle.id = 'nav-toggle';
    toggle.className = 'nav-toggle';
    toggle.setAttribute('aria-label', 'Open navigation menu');
    toggle.innerHTML = '<span></span><span></span><span></span>';

    document.body.appendChild(overlay);
    document.body.appendChild(drawer);
    document.body.appendChild(toggle);

    // Open / close state
    let closeTimer = null;
    let isOpen = false;

    function openNav() {
        clearTimeout(closeTimer);
        if (isOpen) return;
        isOpen = true;
        drawer.classList.add('open');
        overlay.classList.add('open');
        toggle.classList.add('active');
        // Clear search when opening
        const inp = document.getElementById('nav-search-input');
        if (inp && inp.value) { inp.value = ''; filterNav(''); }
    }

    function closeNav(immediate) {
        if (!isOpen) return;
        if (immediate) {
            isOpen = false;
            drawer.classList.remove('open');
            overlay.classList.remove('open');
            toggle.classList.remove('active');
        } else {
            closeTimer = setTimeout(() => {
                isOpen = false;
                drawer.classList.remove('open');
                overlay.classList.remove('open');
                toggle.classList.remove('active');
            }, 250);
        }
    }

    // Hover on toggle — open immediately
    toggle.addEventListener('mouseenter', openNav);
    toggle.addEventListener('mouseleave', () => closeNav(false));

    // Keep open when cursor moves into drawer
    drawer.addEventListener('mouseenter', () => clearTimeout(closeTimer));
    drawer.addEventListener('mouseleave', () => closeNav(false));

    // Click toggle to open/close (works on mobile too)
    toggle.addEventListener('click', () => {
        clearTimeout(closeTimer);
        isOpen ? closeNav(true) : openNav();
    });

    // Click overlay to close
    overlay.addEventListener('click', () => closeNav(true));

    // Close button inside drawer
    document.getElementById('nav-close').addEventListener('click', () => closeNav(true));

    // Escape key closes
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && isOpen) closeNav(true);
    });

    // ===== Live search =====
    function filterNav(q) {
        const links = document.querySelectorAll('#nav-links .nav-link');
        const groups = document.querySelectorAll('#nav-links .nav-group');
        const noResults = document.getElementById('nav-no-results');
        let visibleCount = 0;

        links.forEach(link => {
            const matches = !q || link.dataset.label.includes(q);
            link.style.display = matches ? '' : 'none';
            if (matches) visibleCount++;
        });

        // Show/hide group labels based on whether they have visible children
        groups.forEach(group => {
            const hasVisible = Array.from(group.querySelectorAll('.nav-link'))
                .some(l => l.style.display !== 'none');
            group.style.display = hasVisible ? '' : 'none';
        });

        if (noResults) noResults.style.display = (visibleCount === 0 && q) ? 'block' : 'none';
    }

    const searchInput = document.getElementById('nav-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', e => filterNav(e.target.value.toLowerCase().trim()));
    }
});

// ===== Surprise Me button =====
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('surprise-btn');
    if (!btn) return;

    const playlists = [
        'heavy-rotation.html', 'island-bliss.html', 'raccoon-jams.html',
        'walking.html', 'new-loud.html', 'dads-garage.html', 'saturdaze.html'
    ];

    btn.addEventListener('click', () => {
        btn.classList.add('spinning');
        btn.disabled = true;
        const pick = playlists[Math.floor(Math.random() * playlists.length)];
        setTimeout(() => {
            document.body.style.transition = 'opacity 0.2s ease';
            document.body.style.opacity = '0';
            setTimeout(() => { window.location.href = pick; }, 200);
        }, 520);
    });
});

// ===== Flag parallax on mousemove =====
document.addEventListener('DOMContentLoaded', () => {
    const flag = document.querySelector('.flag-bg');
    if (!flag) return;
    let ticking = false;
    document.addEventListener('mousemove', (e) => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
            const dx = (e.clientX / window.innerWidth  - 0.5) * 18;
            const dy = (e.clientY / window.innerHeight - 0.5) * 12;
            flag.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
            ticking = false;
        });
    });
    document.addEventListener('mouseleave', () => {
        flag.style.transform = 'translate(-50%, -50%)';
    });
});

// ===== Easter egg — Konami code + skull tap =====
document.addEventListener('DOMContentLoaded', () => {
    // Build overlay
    const overlay = document.createElement('div');
    overlay.className = 'egg-overlay';
    overlay.id = 'egg-overlay';
    overlay.innerHTML = `
        <div class="egg-inner">
            <div class="egg-cannons">
                <span class="egg-cannon">💣</span>
                <span class="egg-cannon">💣</span>
            </div>
            <span class="egg-skull">☠️</span>
            <div class="egg-title">The <span>Crew Manifesto</span></div>
            <ul class="egg-manifesto">
                <li>Music is for sharing, not hoarding</li>
                <li>Every neighbor is crew</li>
                <li>A good playlist is better than a good excuse</li>
                <li>Alameda is an island. Act accordingly</li>
                <li>There are no bad genres, only bad moods</li>
                <li>The plank awaits those who skip a banger</li>
                <li>Blackbeard's Library: no late fees, no landlubbers</li>
            </ul>
            <button class="egg-close" id="egg-close">Aye Aye, Captain</button>
        </div>
    `;
    document.body.appendChild(overlay);

    function showEgg() { overlay.classList.add('active'); }
    function hideEgg() { overlay.classList.remove('active'); }

    document.getElementById('egg-close').addEventListener('click', hideEgg);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) hideEgg(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideEgg(); });

    // Konami code: ↑↑↓↓←→←→ba
    const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
    let konamiPos = 0;
    document.addEventListener('keydown', (e) => {
        if (e.key === KONAMI[konamiPos]) {
            konamiPos++;
            if (konamiPos === KONAMI.length) { showEgg(); konamiPos = 0; }
        } else {
            konamiPos = e.key === KONAMI[0] ? 1 : 0;
        }
    });

    // Triple-click the skull to trigger
    const skull = document.querySelector('.jolly-roger');
    if (skull) {
        let taps = 0, tapTimer;
        skull.addEventListener('click', () => {
            taps++;
            clearTimeout(tapTimer);
            if (taps >= 3) { showEgg(); taps = 0; return; }
            tapTimer = setTimeout(() => { taps = 0; }, 600);
        });
        skull.style.cursor = 'pointer';
    }
});

// ===== Playlist registry =====
const PLAYLISTS = [
    { href: 'island-bliss.html',   emoji: '🌴', label: 'Island Bliss' },
    { href: 'raccoon-jams.html',   emoji: '🦝', label: 'Raccoon Jams' },
    { href: 'walking.html',        emoji: '🚶', label: 'Walking' },
    { href: 'new-loud.html',       emoji: '⚡', label: 'New Loud' },
    { href: 'dads-garage.html',    emoji: '🔧', label: "Dad's Garage" },
    { href: 'saturdaze.html',      emoji: '☀️', label: 'Saturdaze' },
    { href: 'heavy-rotation.html', emoji: '🔥', label: 'Heavy Rotation' },
];

// ===== Bottom playlist nav (injected on playlist pages only) =====
document.addEventListener('DOMContentLoaded', () => {
    const page = window.location.pathname.split('/').pop() || 'index.html';
    const currentIndex = PLAYLISTS.findIndex(p => p.href === page);
    if (currentIndex === -1) return; // not a playlist page — skip

    // Build nav
    const nav = document.createElement('nav');
    nav.id = 'playlist-switcher';
    nav.setAttribute('aria-label', 'Switch playlist');

    const inner = document.createElement('div');
    inner.className = 'switcher-inner';

    PLAYLISTS.forEach((pl, i) => {
        const btn = document.createElement('a');
        btn.href = pl.href;
        btn.className = 'switcher-pill' + (i === currentIndex ? ' active' : '');
        btn.setAttribute('aria-label', pl.label);
        btn.title = pl.label;
        btn.innerHTML = `<span class="pill-label">${pl.label}</span>`;
        inner.appendChild(btn);
    });

    nav.appendChild(inner);
    document.body.appendChild(nav);

    // Scroll active pill into view
    const activePill = inner.querySelector('.switcher-pill.active');
    if (activePill) {
        setTimeout(() => activePill.scrollIntoView({ inline: 'center', behavior: 'instant', block: 'nearest' }), 50);
    }

    // Add body padding so content isn't hidden behind nav
    document.body.style.paddingBottom = '84px';

    // ===== Swipe gesture =====
    let touchStartX = 0, touchStartY = 0;

    document.addEventListener('touchstart', e => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    document.addEventListener('touchend', e => {
        const dx = e.changedTouches[0].clientX - touchStartX;
        const dy = e.changedTouches[0].clientY - touchStartY;
        // Only trigger on horizontal swipes (not scrolling)
        if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx) * 0.8) return;

        const nextIndex = dx < 0
            ? (currentIndex + 1) % PLAYLISTS.length          // swipe left → next
            : (currentIndex - 1 + PLAYLISTS.length) % PLAYLISTS.length; // swipe right → prev

        // Brief flash animation then navigate
        document.body.style.transition = 'opacity 0.15s ease';
        document.body.style.opacity = '0';
        setTimeout(() => { window.location.href = PLAYLISTS[nextIndex].href; }, 150);
    }, { passive: true });

    // ===== Keyboard arrow navigation =====
    document.addEventListener('keydown', e => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if (e.key === 'ArrowRight') {
            window.location.href = PLAYLISTS[(currentIndex + 1) % PLAYLISTS.length].href;
        } else if (e.key === 'ArrowLeft') {
            window.location.href = PLAYLISTS[(currentIndex - 1 + PLAYLISTS.length) % PLAYLISTS.length].href;
        }
    });
});
