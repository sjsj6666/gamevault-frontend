if (!window.supabase) {
    console.error("Supabase client not found.");
}
const supabase = window.supabase;

let allGamesForSearch = [];

const PLACEHOLDER_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 1 1'%3E%3Crect fill='%23cccccc' width='1' height='1'/%3E%3C/svg%3E";

window.getOptimizedImageUrl = function(url, width = 300) {
    if (!url) return PLACEHOLDER_IMG;
    if (url.includes('supabase.co/storage/v1/object/public')) {
        return url; 
    }
    return url;
};

window.escapeHtml = function(unsafe) {
    if (typeof unsafe !== 'string') return unsafe;
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};

window.showToast = function(message, type = 'success', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => { toast.classList.add('show'); }, 10);
    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        });
    }, duration);
};

window.showCustomAlert = function(title, message, confirmCallback = null, showCancel = false) {
    const modal = document.getElementById('custom-alert-modal');
    if (!modal) {
        if (confirmCallback && typeof confirmCallback === 'function') {
            if (confirm(message)) confirmCallback();
        } else {
            alert(message);
        }
        return;
    }
    
    document.getElementById('custom-alert-title').textContent = title;
    document.getElementById('custom-alert-message').textContent = message;
    
    const confirmBtn = document.getElementById('custom-alert-confirm');
    const cancelBtn = document.getElementById('custom-alert-cancel');
    
    const newConfirmBtn = confirmBtn.cloneNode(true);
    const newCancelBtn = cancelBtn ? cancelBtn.cloneNode(true) : null;
    
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    if (cancelBtn) cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    const closeAlert = () => {
        modal.classList.add('hidden');
    };

    newConfirmBtn.addEventListener('click', () => {
        closeAlert();
        if (confirmCallback) confirmCallback();
    });
    
    if (showCancel && newCancelBtn) {
        newCancelBtn.style.display = 'inline-block';
        newCancelBtn.addEventListener('click', closeAlert);
    } else if (newCancelBtn) {
        newCancelBtn.style.display = 'none';
    }
    
    modal.classList.remove('hidden');
};

window.updateSocialMeta = function(property, content) {
    if (!content) return;
    let tag = document.querySelector(`meta[property="${property}"]`) || document.querySelector(`meta[name="${property}"]`);
    
    if (!tag) {
        tag = document.createElement('meta');
        if (property.startsWith('og:')) {
            tag.setAttribute('property', property);
        } else {
            tag.name = property;
        }
        document.head.appendChild(tag);
    }
    tag.content = content;
};

window.updateMeta = function(name, content) {
    if (!content) return;

    let tag = document.querySelector(`meta[name="${name}"]`);
    if (!tag) {
        tag = document.createElement('meta');
        tag.name = name;
        document.head.appendChild(tag);
    }
    tag.content = content;

    if (name === 'description') {
        window.updateSocialMeta('og:description', content);
        window.updateSocialMeta('twitter:description', content);
    } 
};

async function applyGlobalSEOSettings() {
    try {
        const { data: settings, error } = await supabase
            .from('settings')
            .select('key, value')
            .in('key', [
                'seo_site_title', 
                'seo_site_description', 
                'seo_site_keywords', 
                'seo_gtm_id', 
                'seo_ga_id',
                'site_base_url',
                'site_logo_url'
            ]);

        if (error || !settings) return;

        const config = settings.reduce((acc, item) => {
            acc[item.key] = item.value;
            return acc;
        }, {});
                
        injectSchemaMarkup(config); 

        if (config.seo_site_title && (document.title === 'GameVault - Game Top-up' || document.title === '' || document.title === 'GameVault' || document.title === 'GameVault - My Account')) {
            document.title = config.seo_site_title;
            window.updateSocialMeta('og:title', config.seo_site_title);
            window.updateSocialMeta('twitter:title', config.seo_site_title);
        }

        if (config.seo_site_description) {
            window.updateMeta('description', config.seo_site_description);
        }

        if (config.seo_site_keywords) {
            window.updateMeta('keywords', config.seo_site_keywords);
        }

        if (config.seo_gtm_id && !document.getElementById('gtm-script')) {
            const script = document.createElement('script');
            script.id = 'gtm-script';
            script.innerHTML = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','${config.seo_gtm_id}');`;
            document.head.appendChild(script);
            
            const noscript = document.createElement('noscript');
            const iframe = document.createElement('iframe');
            iframe.src = `https://www.googletagmanager.com/ns.html?id=${config.seo_gtm_id}`;
            iframe.height = "0";
            iframe.width = "0";
            iframe.style.display = "none";
            iframe.style.visibility = "hidden";
            noscript.appendChild(iframe);
            document.body.insertBefore(noscript, document.body.firstChild);
        }

        if (config.seo_ga_id && !document.getElementById('ga4-script')) {
            const srcScript = document.createElement('script');
            srcScript.id = 'ga4-script';
            srcScript.async = true;
            srcScript.src = `https://www.googletagmanager.com/gtag/js?id=${config.seo_ga_id}`;
            document.head.appendChild(srcScript);

            const configScript = document.createElement('script');
            configScript.innerHTML = `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${config.seo_ga_id}');
            `;
            document.head.appendChild(configScript);
        }

    } catch (error) {
        console.error("Failed to load Global SEO settings:", error);
    }
}

function injectSchemaMarkup(config) {
    const schemaScript = document.getElementById('structured-data');
    if (!schemaScript) return;

    const domain = config.site_base_url || window.location.origin;
    const siteName = config.seo_site_title || 'GameVault';
    const logoUrl = config.site_logo_url || `${domain}/assets/logo.png`;

    const schema = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "Organization",
                "@id": `${domain}/#organization`,
                "name": siteName,
                "url": domain,
                "logo": {
                    "@type": "ImageObject",
                    "url": logoUrl,
                    "width": 512,
                    "height": 512,
                    "caption": siteName
                }
            },
            {
                "@type": "WebSite",
                "@id": `${domain}/#website`,
                "url": domain,
                "name": siteName,
                "description": config.seo_site_description || "Premium Game Top-ups",
                "publisher": { "@id": `${domain}/#organization` },
                "potentialAction": [
                    {
                        "@type": "SearchAction",
                        "target": {
                            "@type": "EntryPoint",
                            "urlTemplate": `${domain}/games.html?q={search_term_string}`
                        },
                        "query-input": "required name=search_term_string"
                    }
                ]
            }
        ]
    };

    schemaScript.textContent = JSON.stringify(schema);
}

async function applyGlobalCardStyles() {
    try {
        const { data: settings, error } = await supabase
            .from('settings')
            .select('key, value')
            .in('key', ['game_card_width_px', 'game_card_image_height_px']);

        if (error) throw error;

        const cardWidth = settings?.find(s => s.key === 'game_card_width_px')?.value || '150';
        const imageHeight = settings?.find(s => s.key === 'game_card_image_height_px')?.value || '190';

        const dynamicStyles = `
            @media (min-width: 640px) {
                .game-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(${cardWidth}px, 1fr)) !important;
                    gap: 1rem;
                }
                .game-card .game-image {
                    height: ${imageHeight}px !important;
                }
                .skeleton-image {
                    height: ${imageHeight}px !important;
                }
            }
        `;

        let styleSheet = document.getElementById('game-card-dynamic-styles');
        if (!styleSheet) {
            styleSheet = document.createElement('style');
            styleSheet.id = 'game-card-dynamic-styles';
            document.head.appendChild(styleSheet);
        }
        styleSheet.textContent = dynamicStyles;

    } catch (error) {
        console.error("Could not load dynamic card styles, using defaults.", error);
    }
}

async function loadComponent(elementId, filePath, callback) {
    const element = document.getElementById(elementId);
    if (!element) return;

    const cacheKey = `component_cache_${filePath}`;
    const cachedContent = localStorage.getItem(cacheKey);
    const cacheTimestamp = localStorage.getItem(`${cacheKey}_ts`);
    const now = Date.now();

    if (cachedContent && cacheTimestamp && (now - parseInt(cacheTimestamp) < 86400000)) {
        element.innerHTML = cachedContent;
        if (callback) setTimeout(() => callback(element), 0);
        
        fetch(filePath).then(res => res.text()).then(text => {
            if (text !== cachedContent) {
                localStorage.setItem(cacheKey, text);
                localStorage.setItem(`${cacheKey}_ts`, now);
            }
        }).catch(err => console.log("Background fetch failed", err));
        return;
    }

    try {
        const response = await fetch(filePath);
        if (!response.ok) throw new Error(`Fetch error: ${response.statusText}`);
        const text = await response.text();
        
        element.innerHTML = text;
        
        localStorage.setItem(cacheKey, text);
        localStorage.setItem(`${cacheKey}_ts`, now);

        if (callback) {
            setTimeout(() => callback(element), 0);
        }
    } catch (error) {
        console.error(`Error loading component into ${elementId}:`, error);
    }
}

function initializeHeaderScripts(container) {
    const searchContainer = container.querySelector('#searchContainer');
    const searchInput = container.querySelector('#searchInput');
    const resultsContainer = container.querySelector('#search-results-container');
    if (!searchContainer || !searchInput || !resultsContainer) return;

    const renderSearchResults = (games) => {
        if (games.length === 0) {
            resultsContainer.innerHTML = `<div class="p-4 text-center text-gray-400">No games found.</div>`;
            return;
        }
        resultsContainer.innerHTML = games.map(game => `
            <a class="search-result-item" href="/topup-page.html?game=${window.escapeHtml(game.game_key)}">
                <img src="${game.image_url || PLACEHOLDER_IMG}" alt="${window.escapeHtml(game.name)}">
                <span>${window.escapeHtml(game.name)}</span>
            </a>
        `).join('');
    };

    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value.trim().toLowerCase();
        if (searchTerm.length > 0) {
            const filteredGames = allGamesForSearch.filter(game => game.name.toLowerCase().includes(searchTerm));
            renderSearchResults(filteredGames);
            resultsContainer.classList.add('visible');
        } else {
            resultsContainer.classList.remove('visible');
        }
    });

    searchInput.addEventListener('focus', () => {
        if (searchInput.value.trim().length > 0) {
            resultsContainer.classList.add('visible');
        }
    });

    searchContainer.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!searchContainer.classList.contains('active')) {
            searchContainer.classList.add('active');
            searchInput.focus();
        }
    });

    document.addEventListener('click', (e) => {
        if (!searchContainer.contains(e.target)) {
            searchContainer.classList.remove('active');
            resultsContainer.classList.remove('visible');
        }
    });
}

async function initializeAuthScripts(container) {
    if (!supabase) return;

    const signInBtn = document.getElementById('header-signin-btn');
    const profileArea = container.querySelector('.profile-area');
    const messagesIcon = document.getElementById('header-messages-icon');
    const authModal = document.getElementById('auth-modal');
    const closeAuthModal = document.getElementById('close-auth-modal');
    const providerButtons = document.querySelectorAll('.auth-provider-btn');

    if (!signInBtn || !profileArea || !authModal || !closeAuthModal) return;

    const showAuthModal = () => authModal.classList.remove('hidden');
    const hideAuthModal = () => authModal.classList.add('hidden');
    window.showAuthModal = showAuthModal;

    signInBtn.addEventListener('click', showAuthModal);
    closeAuthModal.addEventListener('click', hideAuthModal);
    authModal.addEventListener('click', (e) => { if (e.target === authModal) hideAuthModal(); });

    providerButtons.forEach(button => {
        button.addEventListener('click', async () => {
            const provider = button.dataset.provider;
            const returnUrl = window.location.href;

            if (provider === 'email') {
                const email = prompt("Enter your email:");
                if (!email) return;
                const { error } = await supabase.auth.signInWithOtp({ 
                    email,
                    options: { emailRedirectTo: returnUrl }
                });
                if (error) window.showToast(error.message, 'error'); 
                else window.showToast("Check your email for a login link!", 'info');
            } else {
                const { error } = await supabase.auth.signInWithOAuth({ 
                    provider, 
                    options: { 
                        redirectTo: returnUrl,
                        queryParams: { prompt: 'select_account' }
                    } 
                });
                if (error) window.showToast("Could not sign in: " + error.message, 'error');
            }
        });
    });

    const updateUI = async (user) => {
        hideAuthModal();
        let profileData = null;
        if (user) {
            signInBtn.classList.add('hidden');
            profileArea.classList.remove('hidden');
            if(messagesIcon) messagesIcon.classList.remove('hidden');

            const { data: profile } = await supabase.from('profiles').select('nickname, balance, points, avatar_url').eq('id', user.id).single();
            if (profile) profileData = profile;

            const avatarUrl = profile?.avatar_url || user.user_metadata?.avatar_url || `https://i.pravatar.cc/50?u=${user.id}`;
            const mainAvatar = container.querySelector('.user-avatar');
            const dropdownAvatar = container.querySelector('.profile-avatar img');
            if (mainAvatar) mainAvatar.style.backgroundImage = `url(${avatarUrl})`;
            if (dropdownAvatar) dropdownAvatar.src = avatarUrl;

            const { count: couponCount } = await supabase.from('user_coupons').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'active');
            
            const profileIdEl = container.querySelector('#profile-id');
            const profileBalanceEl = container.querySelector('#profile-balance');
            const profilePointsEl = container.querySelector('#profile-points');
            const couponCountEl = container.querySelector('#coupon-count');

            if (profileIdEl) profileIdEl.textContent = profileData?.nickname ? window.escapeHtml(profileData.nickname) : `User-${user.id.slice(0, 8)}`;
            if (profileBalanceEl) profileBalanceEl.textContent = `$${(profileData?.balance || 0).toFixed(2)}`;
            if (profilePointsEl) profilePointsEl.textContent = profileData?.points || 0;
            if (couponCountEl) couponCountEl.textContent = couponCount || 0;
            
            const loggedInView = container.querySelector('#profile-logged-in');
            if(loggedInView) loggedInView.style.display = 'block';
            
            const logoutButton = container.querySelector('#logout-button');
            if (logoutButton) {
                const newLogoutBtn = logoutButton.cloneNode(true);
                logoutButton.parentNode.replaceChild(newLogoutBtn, logoutButton);
                newLogoutBtn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    await supabase.auth.signOut();
                    window.showToast("You have been logged out.", 'info');
                });
            }

        } else {
            signInBtn.classList.remove('hidden');
            profileArea.classList.add('hidden');
            if(messagesIcon) messagesIcon.classList.add('hidden');
        }
        if (typeof updateSidebarUser === 'function') {
            updateSidebarUser(user, profileData);
        }
    };

    const { data: { session: initialSession } } = await supabase.auth.getSession();
    updateUI(initialSession?.user);

    supabase.auth.onAuthStateChange((_event, session) => {
        updateUI(session?.user);
    });
}

async function populateGamesDropdown(container) {
    const dropdown = container.querySelector('.dropdown');
    if (!dropdown) return;

    const games = allGamesForSearch;
    if (!games || games.length === 0) {
        dropdown.innerHTML = '<div class="p-4 text-gray-400">Could not load games.</div>';
        return;
    }

    const ITEMS_PER_COLUMN = 7;

    const generateItemHTML = (game, showIcon = true) => {
        if (!game) return '<div class="dropdown-item" style="visibility: hidden;"></div>';

        return `
            <a href="/topup-page.html?game=${window.escapeHtml(game.game_key)}" class="dropdown-item" data-game-key="${window.escapeHtml(game.game_key)}">
                ${showIcon ? `<img src="${game.image_url || PLACEHOLDER_IMG}" class="dropdown-item-icon" alt="${window.escapeHtml(game.name)}">` : ''}
                <span>${window.escapeHtml(game.name)}</span>
            </a>`;
    };

    let html = '<div class="dropdown-grid">';
    html += '<div>';
    html += '<div class="dropdown-title">🔥 Popular Games</div>';
    for (let i = 0; i < ITEMS_PER_COLUMN; i++) {
        html += generateItemHTML(games[i], true);
    }
    html += '</div>';

    html += '<div>';
    html += '<div class="dropdown-title" style="visibility: hidden;">_</div>';
    for (let i = ITEMS_PER_COLUMN; i < ITEMS_PER_COLUMN * 2; i++) {
        html += generateItemHTML(games[i], true);
    }
    html += '</div>';

    html += '<div>';
    html += '<a href="/games.html" class="dropdown-title all-games-link">All Games ›</a>';
    html += '<div class="all-games-wrapper">';
    games.forEach(game => {
        html += generateItemHTML(game, false);
    });
    html += '</div>';
    html += '</div>';

    html += '</div>';

    dropdown.innerHTML = html;
}

let hotGamesPage = 0;
const hotGamesPerPage = 14;
let totalHotGames = 0;

function initializeSliderLogic() {
    const slideContainer = document.querySelector('.slider-container');
    const slides = document.querySelectorAll('.hero-slide');
    const dots = document.querySelectorAll('.slider-dot');
    const prevArrow = document.getElementById('slider-arrow-prev');
    const nextArrow = document.getElementById('slider-arrow-next');

    if (!slideContainer || slides.length <= 1) {
        if (prevArrow) prevArrow.style.display = 'none';
        if (nextArrow) nextArrow.style.display = 'none';
        return;
    }

    let currentSlide = 0;
    let slideInterval;

    const updateSlidePositions = () => {
        slides.forEach((s, i) => {
            s.classList.remove('active', 'prev', 'next', 'hidden');
            if (i === currentSlide) {
                s.classList.add('active');
            } else if (i === (currentSlide - 1 + slides.length) % slides.length) {
                s.classList.add('prev');
            } else if (i === (currentSlide + 1) % slides.length) {
                s.classList.add('next');
            } else {
                s.classList.add('hidden');
            }
        });
        dots.forEach((d, i) => d.classList.toggle('active', i === currentSlide));
    };

    const resetSlideInterval = () => {
        clearInterval(slideInterval);
        slideInterval = setInterval(autoSlide, 5000);
    };

    const autoSlide = () => {
        currentSlide = (currentSlide + 1) % slides.length;
        updateSlidePositions();
    };

    const changeSlide = (dir) => {
        currentSlide = (currentSlide + dir + slides.length) % slides.length;
        updateSlidePositions();
        resetSlideInterval();
    };

    const goToSlide = (idx) => {
        if (idx === currentSlide) return;
        currentSlide = idx;
        updateSlidePositions();
        resetSlideInterval();
    };

    if(prevArrow) prevArrow.addEventListener('click', () => changeSlide(-1));
    if(nextArrow) nextArrow.addEventListener('click', () => changeSlide(1));

    if(slideContainer) {
        slideContainer.addEventListener('click', (e) => {
            const clickedSlide = e.target.closest('.hero-slide');
            if (!clickedSlide) return;

            const url = clickedSlide.dataset.url;
            if (url) {
                window.location.href = url;
            }
        });
    }

    window.goToSlide = goToSlide;

    updateSlidePositions();
    slideInterval = setInterval(autoSlide, 5000);
}

async function renderHomepageBanners() {
    const heroSlider = document.querySelector('.hero-slider');
    const slideContainer = document.querySelector('.slider-container');
    const dotsContainer = document.querySelector('.slider-dots');

    if (!heroSlider || !slideContainer || !dotsContainer) return;

    try {
        const { data: settings, error: settingsError } = await supabase
            .from('settings')
            .select('key, value')
            .in('key', ['banner_height', 'banner_peek_percentage', 'banner_side_scale']);

        if (settingsError) throw settingsError;

        const height = settings?.find(s => s.key === 'banner_height')?.value || '450';
        const peek = settings?.find(s => s.key === 'banner_peek_percentage')?.value || '10';
        const scale = settings?.find(s => s.key === 'banner_side_scale')?.value || '85';

        heroSlider.style.height = `${height}px`;

        const dynamicStyles = `
            :root {
                --banner-peek: ${peek}%;
                --side-banner-scale: ${parseFloat(scale) / 100};
            }
        `;
        let styleSheet = document.getElementById('banner-dynamic-styles');
        if (!styleSheet) {
            styleSheet = document.createElement('style');
            styleSheet.id = 'banner-dynamic-styles';
            document.head.appendChild(styleSheet);
        }
        styleSheet.textContent = dynamicStyles;

    } catch (error) {
        console.error("Could not load banner settings, using defaults.", error);
        heroSlider.style.height = `450px`;
    }

    const { data: banners, error } = await supabase
        .from('banners')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

    if (error || !banners || banners.length === 0) {
        slideContainer.innerHTML = '<p>Could not load banners.</p>';
        return;
    }

    slideContainer.innerHTML = banners.map(banner => {
        return `
        <div class="hero-slide" data-url="${window.escapeHtml(banner.button_url)}">
            <div class="hero-content" style="background-image: url('${banner.image_url}');">
                ${banner.badge_text ? `<div class="promo-badge">${window.escapeHtml(banner.badge_text)}</div>` : ''}
                <h1>${window.escapeHtml(banner.title)}</h1>
                <p>${window.escapeHtml(banner.subtitle)}</p>
                <button class="btn-hero">${window.escapeHtml(banner.button_text)} ▶</button>
            </div>
        </div>`;
    }).join('');

    dotsContainer.innerHTML = banners.map((_, index) =>
        `<div class="slider-dot" onclick="goToSlide(${index})"></div>`
    ).join('');

    document.querySelectorAll('.hero-slide .btn-hero').forEach((button) => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const slide = e.target.closest('.hero-slide');
            const url = slide.dataset.url;
            if (url) {
                window.location.href = url;
            }
        });
    });

    initializeSliderLogic();
}

function initializeHomepage() {
    renderHomepageBanners();
    renderRecentlyViewed();
    renderHotGames(true);
    renderBestsellers();

    updateHomepageCounts();
    setupCarouselControls();

    document.getElementById('view-more-btn')?.addEventListener('click', () => renderHotGames(false));
    document.getElementById('clear-recently-viewed')?.addEventListener('click', clearRecentlyViewed);
    const scrollTop = document.querySelector('.scroll-top');
    if (scrollTop) window.addEventListener('scroll', () => { scrollTop.style.display = (window.pageYOffset > 300) ? 'flex' : 'none'; });
}

function getSkeletonHTML(count, isTemporary = false) {
    let html = '';
    const tempClass = isTemporary ? ' temp-skeleton' : '';
    for (let i = 0; i < count; i++) {
        html += `
            <div class="game-card-skeleton${tempClass}">
                <div class="skeleton-image"></div>
                <div class="skeleton-text"></div>
                <div class="skeleton-text short"></div>
            </div>`;
    }
    return html;
}

async function renderHotGames(isInitialLoad) {
    const container = document.getElementById('hot-games-grid');
    if (!container) return;

    if (isInitialLoad) {
        hotGamesPage = 0;
    } else {
        const gamesAlreadyShown = hotGamesPage * hotGamesPerPage;
        const remainingGames = totalHotGames - gamesAlreadyShown;

        if (remainingGames <= 0) {
            const viewMoreBtn = document.getElementById('view-more-btn');
            if (viewMoreBtn) viewMoreBtn.style.display = 'none';
            return;
        }

        const skeletonsToShow = Math.min(hotGamesPerPage, remainingGames);
        const skeletonHTML = getSkeletonHTML(skeletonsToShow, true);
        container.insertAdjacentHTML('beforeend', skeletonHTML);
    }

    const from = hotGamesPage * hotGamesPerPage;
    const to = from + hotGamesPerPage - 1;

    // FIXED: Removed 'price' and 'original_price' from selection
    const { data: games, error, count } = await supabase
        .from('games')
        .select('name, game_key, image_url, card_image_url, sales_count, category', { count: 'exact' })
        .eq('is_active', true)
        .eq('category', 'Game Top-up')
        .range(from, to)
        .order('name', { ascending: true });

    if (isInitialLoad && count !== null) {
        totalHotGames = count;
    }

    if (error) {
        container.innerHTML = "<p>Could not load games.</p>";
        return;
    }

    const gamesHTML = games.map((game, index) => {
        const card = createGameCardHTML(game);
        const delay = isInitialLoad ? index * 50 : 0;
        const parser = new DOMParser();
        const doc = parser.parseFromString(card, 'text/html');
        const cardElement = doc.body.firstChild;
        cardElement.style.animationDelay = `${delay}ms`;
        return cardElement.outerHTML;
    }).join('');

    if (isInitialLoad) {
        setTimeout(() => {
            container.innerHTML = gamesHTML;
        }, 500);
    } else {
        const tempSkeletons = container.querySelectorAll('.temp-skeleton');
        tempSkeletons.forEach(skeleton => skeleton.remove());
        container.insertAdjacentHTML('beforeend', gamesHTML);
    }

    hotGamesPage++;

    const viewMoreBtn = document.getElementById('view-more-btn');
    const totalGamesLoaded = hotGamesPage * hotGamesPerPage;

    if (viewMoreBtn && totalGamesLoaded >= totalHotGames) {
        viewMoreBtn.style.display = 'none';
    }
}

async function renderBestsellers() {
    const container = document.getElementById('bestseller-carousel');
    if (!container) return;

    const { data: gamesPool, error } = await supabase
        .from('games')
        .select('*')
        .eq('is_active', true)
        .order('sales_count', { ascending: false })
        .limit(30);

    if (error || !gamesPool || gamesPool.length < 7) {
        container.innerHTML = `<p>Could not load bestsellers.</p>`;
        return;
    }

    const shuffled = gamesPool.sort(() => 0.5 - Math.random());
    const randomGames = shuffled.slice(0, 7);

    container.innerHTML = randomGames.map((game, index) => createBestsellerCardHTML(game, index + 1)).join('');
}

async function renderRecentlyViewed() {
    const container = document.getElementById('recently-viewed-carousel');
    const section = document.getElementById('recently-viewed-section');
    if (!container || !section) return;

    const viewedKeys = JSON.parse(localStorage.getItem('recentlyViewed')) || [];
    if (viewedKeys.length === 0) {
        section.classList.add('hidden');
        return;
    }

    section.classList.remove('hidden');
    const { data: games, error } = await supabase.from('games').select('*').in('game_key', viewedKeys);
    if (error || !games) {
        section.classList.add('hidden');
        return;
    }

    const orderedGames = viewedKeys.map(key => games.find(g => g.game_key === key)).filter(Boolean);
    if (orderedGames.length === 0) {
        section.classList.add('hidden');
        return;
    }

    container.innerHTML = orderedGames.map(game => createRecentlyViewedCardHTML(game)).join('');
}

function clearRecentlyViewed() {
    localStorage.removeItem('recentlyViewed');
    const carousel = document.getElementById('recently-viewed-carousel');
    if (carousel) {
        carousel.innerHTML = '';
    }
    document.getElementById('recently-viewed-section')?.classList.add('hidden');
}

async function updateHomepageCounts() {
    const { count, error } = await supabase.from('games').select('*', { count: 'exact', head: true }).eq('is_active', true);
    const gameCount = error ? 0 : count;
    const viewAllTopup = document.getElementById('view-all-topup');
    if (viewAllTopup) {
        viewAllTopup.textContent = `All (${gameCount}) →`;
    }
}

function createGameCardHTML(game) {
    // Discount will be null since price is removed, which is expected
    const discount = (game.original_price && game.price) ? Math.round(((game.original_price - game.price) / game.original_price) * 100) : null;
    const imageUrl = window.getOptimizedImageUrl(game.card_image_url || game.image_url);
    const safeName = window.escapeHtml(game.name);
    
    return `
        <div class="game-card fade-in-up" data-game-key="${window.escapeHtml(game.game_key)}">
            ${discount ? `<div class="discount-badge">-${discount}%</div>` : ''}
            <div class="game-image" 
                 style="background-image: url('${imageUrl}'); content-visibility: auto; contain-intrinsic-size: 150px 190px;"
                 role="img" 
                 aria-label="${safeName}">
            </div>
            <div class="game-info">
                <div class="game-title">${safeName}</div>
                <div>
                    <span class="rating">⭐ 5.0</span>
                    <span class="game-sales">${(game.sales_count || 0) / 1000 > 100 ? '100k+' : (game.sales_count/1000).toFixed(1) + 'k'} Sold</span>
                </div>
            </div>
        </div>`;
}

function createBestsellerCardHTML(game, rank) {
    const imageUrl = game.card_image_url || game.image_url || PLACEHOLDER_IMG;
    return `
        <div class="bestseller-card" data-game-key="${window.escapeHtml(game.game_key)}">
            <div class="bestseller-rank">${rank}</div>
            <div class="bestseller-card-image" style="background-image: url('${imageUrl}');"></div>
            <div class="game-info">
                <div class="game-title">${window.escapeHtml(game.name)}</div>
                <div class="game-sales">
                    <span>🔥</span>
                    ${(game.sales_count || 0) / 1000 > 100 ? '100k+' : (game.sales_count/1000).toFixed(1) + 'k'} Sold
                </div>
            </div>
        </div>
    `;
}

function createRecentlyViewedCardHTML(game) {
    return `
        <div class="recently-viewed-card" data-game-key="${window.escapeHtml(game.game_key)}">
            <img src="${game.image_url || PLACEHOLDER_IMG}" alt="${window.escapeHtml(game.name)}">
            <div class="info">
                <span class="title">Game Top Up</span>
                <span class="subtitle">${window.escapeHtml(game.name)}</span>
            </div>
        </div>
    `;
}

function setupCarouselControls() {
    document.querySelectorAll('.carousel-arrow').forEach(button => {
        button.addEventListener('click', () => {
            const targetId = button.dataset.target;
            const carousel = document.getElementById(targetId);
            const scrollAmount = carousel.clientWidth * 0.75;
            if (button.classList.contains('prev')) {
                carousel.scrollLeft -= scrollAmount;
            } else {
                carousel.scrollLeft += scrollAmount;
            }
        });
    });
}

function handleGameCardClick(e) {
    const card = e.target.closest('.game-card, .bestseller-card, .recently-viewed-card');
    if (!card) return;
    const gameKey = card.dataset.gameKey;
    if (!gameKey) return;

    let viewed = JSON.parse(localStorage.getItem('recentlyViewed')) || [];
    viewed = viewed.filter(key => key !== gameKey);
    viewed.unshift(gameKey);
    if (viewed.length > 14) viewed.pop();
    localStorage.setItem('recentlyViewed', JSON.stringify(viewed));

    window.location.href = `/topup-page.html?game=${encodeURIComponent(gameKey)}`;
}

function updateSidebarUser(user, profile) {
    const profileLink = document.getElementById('sidebar-profile-link');
    const loginPrompt = document.getElementById('sidebar-login-prompt');
    
    if (!profileLink || !loginPrompt) return;

    if (user) {
        profileLink.style.display = 'flex';
        loginPrompt.style.display = 'none';
        
        const nicknameEl = document.getElementById('sidebar-nickname');
        const avatarImg = profileLink.querySelector('img');
        
        if (profile && profile.nickname) {
            nicknameEl.textContent = window.escapeHtml(profile.nickname);
        } else {
            nicknameEl.textContent = `User-${user.id.slice(0, 8)}`;
        }

        if (profile && profile.avatar_url) {
            avatarImg.src = profile.avatar_url;
        } else if (user.user_metadata && user.user_metadata.avatar_url) {
            avatarImg.src = user.user_metadata.avatar_url;
        } else {
            avatarImg.src = `https://i.pravatar.cc/50?u=${user.id}`;
        }

    } else {
        profileLink.style.display = 'none';
        loginPrompt.style.display = 'flex';
    }
}

function populateSidebarGames() {
    const gamesList = document.getElementById('sidebar-games-list');
    if (!gamesList) return;

    const games = allGamesForSearch;
    if (!games || games.length === 0) {
        gamesList.innerHTML = '<li><a href="/games.html">No games found</a></li>';
        return;
    }

    let html = '<li><a href="/games.html" style="font-weight: bold;">All Games</a></li>';
    games.slice(0, 15).forEach(game => {
        html += `<li><a href="/topup-page.html?game=${window.escapeHtml(game.game_key)}">${window.escapeHtml(game.name)}</a></li>`;
    });

    gamesList.innerHTML = html;
}

function initializeHamburgerMenu() {
    const hamburger = document.getElementById('hamburger');
    const sidebar = document.getElementById('mobile-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const closeBtn = document.getElementById('sidebar-close-btn');
    const gamesToggle = document.getElementById('sidebar-games-toggle');
    const gamesSubmenu = document.getElementById('sidebar-games-list');
    const sidebarLoginBtn = document.querySelector('.sidebar-login-btn');

    if (!hamburger || !sidebar || !overlay || !closeBtn) return;

    const openSidebar = () => {
        sidebar.classList.add('open');
        overlay.classList.add('active');
    };

    const closeSidebar = () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
    };

    hamburger.addEventListener('click', openSidebar);
    closeBtn.addEventListener('click', closeSidebar);
    overlay.addEventListener('click', closeSidebar);

    if (sidebarLoginBtn) {
        sidebarLoginBtn.addEventListener('click', () => {
            closeSidebar();
            setTimeout(() => {
                if(window.showAuthModal) window.showAuthModal();
            }, 300);
        });
    }

    if (gamesToggle && gamesSubmenu) {
        gamesToggle.addEventListener('click', (e) => {
            e.preventDefault();
            gamesToggle.parentElement.classList.toggle('open');
            gamesSubmenu.classList.toggle('open');
        });
    }
}

function initializeMobileSearch() {
    const trigger = document.getElementById('mobile-search-trigger');
    const overlay = document.getElementById('mobile-search-overlay');
    const backBtn = document.getElementById('mobile-search-back-btn');
    const input = document.getElementById('mobile-search-input');
    const resultsContainer = document.getElementById('mobile-search-results');

    if (!trigger || !overlay || !backBtn || !input || !resultsContainer) return;

    const renderSearchResults = (games, container) => {
        if (!container) return;
        
        if (games.length === 0) {
            container.innerHTML = `<div class="p-4 text-center text-gray-400">No games found.</div>`;
            return;
        }
        container.innerHTML = games.map(game => `
            <a href="/topup-page.html?game=${window.escapeHtml(game.game_key)}" class="search-result-item">
                <img src="${game.image_url || PLACEHOLDER_IMG}" alt="${window.escapeHtml(game.name)}">
                <span>${window.escapeHtml(game.name)}</span>
            </a>
        `).join('');
    };

    trigger.addEventListener('click', () => {
        overlay.classList.add('visible');
        input.focus();
    });

    backBtn.addEventListener('click', () => {
        overlay.classList.remove('visible');
        input.value = '';
        resultsContainer.innerHTML = '';
    });

    input.addEventListener('input', () => {
        const searchTerm = input.value.trim().toLowerCase();
        if (searchTerm.length > 0) {
            const filteredGames = allGamesForSearch.filter(game =>
                game.name.toLowerCase().includes(searchTerm)
            );
            renderSearchResults(filteredGames, resultsContainer);
        } else {
            resultsContainer.innerHTML = '';
        }
    });
}

function initializeHeader(headerContainer) {
    if (!headerContainer) {
        return;
    }
    initializeHeaderScripts(headerContainer);
    initializeAuthScripts(headerContainer);
    populateGamesDropdown(headerContainer);
    populateSidebarGames();
    initializeHamburgerMenu();
    initializeMobileSearch();
}

document.addEventListener('DOMContentLoaded', async () => {
    await applyGlobalCardStyles();
    await applyGlobalSEOSettings(); 

    if (!supabase) {
        return;
    }
    
    const { data: games, error } = await supabase.from('games').select('*').order('name', { ascending: true });
    if (games) {
        allGamesForSearch = games.filter(g => !g.parent_game_key);
    }

    await Promise.all([
        loadComponent('header-placeholder', '/header.html', initializeHeader),
        loadComponent('footer-placeholder', '/footer.html')
    ]);

    document.body.addEventListener('click', handleGameCardClick);

    if (document.getElementById('hot-games-grid')) {
        initializeHomepage();
    } else if (document.getElementById('products-grid')) {
        if (typeof initializeTopupPage === 'function') initializeTopupPage();
    } else if (document.getElementById('all-games-grid')) {
        if (typeof initializeGamesPage === 'function') initializeGamesPage();
    }
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('Service Worker Registered'))
            .catch(err => console.log('Service Worker Error', err));
    });
}