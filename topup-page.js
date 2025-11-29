let state = {
    game: null,
    uid: '',
    serverId: '',
    username: '',
    server: '',
    serverName: '',
    roles: [],
    selectedRole: null,
    quantity: 1,
    selectedProduct: null,
    products: [],
    gameInfo: {}, // Stores full game row from DB (inc. config flags)
    allGames: []
};

let debounceTimer;

document.addEventListener('DOMContentLoaded', () => {
    if (!window.supabase) {
        console.error('Supabase client not found. Ensure supabase-client.js is loaded.');
        return;
    }
    initializeTopupPage();
});

async function initializeTopupPage() {
    showLoadingScreen();
    // Wait for game data (and config flags) to load before rendering
    const dataLoaded = await fetchGameData();
    if (dataLoaded) {
        await renderPageContent();
    } else {
        showErrorState();
    }
}

function showLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.classList.remove('hidden');
        startLoadingTips();
    }
}

function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.style.opacity = '0';
        loadingScreen.style.transition = 'opacity 0.5s ease-out';
        setTimeout(() => {
            loadingScreen.classList.add('hidden');
        }, 500);
    }
}

function startLoadingTips() {
    const tips = document.querySelectorAll('.loading-tip');
    let currentTip = 0;
    if (tips.length > 0) {
        tips[0].classList.remove('hidden');
        setTimeout(() => tips[0].classList.add('opacity-100'), 100);
    }
    setInterval(() => {
        if (tips[currentTip]) {
            tips[currentTip].classList.remove('opacity-100');
            setTimeout(() => {
                tips[currentTip].classList.add('hidden');
                currentTip = (currentTip + 1) % tips.length;
                if (tips[currentTip]) {
                    tips[currentTip].classList.remove('hidden');
                    setTimeout(() => tips[currentTip].classList.add('opacity-100'), 100);
                }
            }, 3000);
        }
    }, 3000);
}

// --- DYNAMIC CONFIGURATION LOGIC ---

async function fetchGameData() {
    try {
        // Fetch all games including the new boolean flags
        const { data: games, error: gamesError } = await window.supabase.from('games').select('*');
        if (gamesError) throw gamesError;
        
        state.allGames = games;
        // Create a lookup map: game_key -> game_row
        state.gameInfo = games.reduce((acc, game) => { acc[game.game_key] = game; return acc; }, {});

        const { data: products, error: productsError } = await window.supabase.from('products').select('*').eq('is_active', true);
        if (productsError) throw productsError;
        state.products = products;

        // Artificial delay for smooth loading animation
        await new Promise(resolve => setTimeout(resolve, 1000));
        return true;
    } catch (error) {
        console.error('Error fetching game data:', error);
        return false;
    }
}

// Checks the DB flag: has_server_id
function isUidAndServerIdGame(gameKey) {
    const game = state.gameInfo[gameKey];
    return game && game.has_server_id;
}

// Checks the DB flag: has_region_selection
function isUidAndServerRegionGame(gameKey) {
    const game = state.gameInfo[gameKey];
    return game && game.has_region_selection;
}

// --- RENDERING LOGIC ---

async function renderPageContent() {
    // Check if we are repurchasing (data from Order History)
    const repurchaseDataString = sessionStorage.getItem('repurchaseData');
    let repurchaseData = null;

    if (repurchaseDataString) {
        repurchaseData = JSON.parse(repurchaseDataString);
        sessionStorage.removeItem('repurchaseData');
    }

    const urlParams = new URLSearchParams(window.location.search);
    const gameKeyFromUrl = urlParams.get('game');

    if (!gameKeyFromUrl && !repurchaseData?.gameKey) {
        showErrorState();
        return;
    }

    const gameKey = repurchaseData?.gameKey || gameKeyFromUrl;

    if (!state.gameInfo[gameKey]) {
        showErrorState();
        return;
    }

    state.game = gameKey;
    const game = state.gameInfo[gameKey];
    if (!game) { showErrorState(); return; }

    const serverIdContainer = document.getElementById('server-id-container');
    const serverRegionContainer = document.getElementById('server-dropdown-btn').parentElement.parentElement;

    document.getElementById('character-selection-container').classList.add('hidden');

    // DYNAMIC INPUT SHOW/HIDE BASED ON DB FLAGS
    if (isUidAndServerIdGame(gameKey)) {
        // Show Server ID input
        serverIdContainer.classList.remove('hidden');
        serverRegionContainer.classList.add('hidden');
    } else if (isUidAndServerRegionGame(gameKey)) {
        // Show Region/Server Dropdown
        serverIdContainer.classList.add('hidden');
        serverRegionContainer.classList.remove('hidden');
        await renderServerOptions(gameKey);
    } else {
        // Default: UID Only (Hide both)
        serverIdContainer.classList.add('hidden');
        serverRegionContainer.classList.add('hidden');
    }

    updateGameHeader(game);
    renderProductsSection(gameKey);
    setupEventListeners();
    await updateGameStatsAndReviews(gameKey);

    if (repurchaseData) {
        loadRepurchaseDetails(repurchaseData);
    } else {
        loadSavedUserDetails();
    }

    hideLoadingScreen();
}

function loadRepurchaseDetails(data) {
    const uidInput = document.getElementById('uid-input');
    if (uidInput) {
        uidInput.value = data.uid;
        state.uid = data.uid;
    }

    if (isUidAndServerIdGame(state.game)) {
        const serverIdInput = document.getElementById('server-id-input');
        if (serverIdInput) {
            serverIdInput.value = data.server;
            state.serverId = data.server;
        }
    } else if (isUidAndServerRegionGame(state.game)) {
        if (data.server) {
            state.server = data.server;
            state.serverName = data.server; // In repurchase, server often equals serverName
            document.getElementById('selected-server').textContent = data.server;
        }
    }

    if (data.quantity) {
        state.quantity = data.quantity;
        document.getElementById('quantity').value = data.quantity;
    }

    if (data.productId) {
        // Small delay to ensure products are rendered
        setTimeout(() => {
            selectProduct(data.productId.toString());
        }, 300);
    }

    attemptValidation();
}

function renderProductsSection(gameKey) {
    const currentGame = state.gameInfo[gameKey];
    if (!currentGame) return;

    if (currentGame.regions && currentGame.regions.length > 1) {
        renderDynamicRegionTabs(currentGame);
    } else {
        document.getElementById('region-tabs-container').classList.add('hidden');
        const gameProducts = state.products.filter(p => p.game_key === gameKey && !p.region);
        renderProducts(gameProducts);
    }
}

function renderDynamicRegionTabs(game) {
    const container = document.getElementById('region-tabs-container');
    container.classList.remove('hidden');

    const storageKey = `gamevault-last-region-${game.game_key}`;
    const savedRegion = sessionStorage.getItem(storageKey);
    const activeRegion = savedRegion && game.regions.includes(savedRegion) ? savedRegion : game.regions[0];

    container.innerHTML = `<div class="flex flex-wrap gap-2">${
        game.regions.map(regionName => {
            const isActive = regionName === activeRegion;
            return `<button class="region-tab ${isActive ? 'active' : ''}" data-region-name="${window.escapeHtml(regionName)}">${window.escapeHtml(regionName)}</button>`;
        }).join('')
    }</div>`;

    document.querySelectorAll('.region-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('.region-tab').forEach(t => t.classList.remove('active'));
            const clickedTab = e.currentTarget;
            clickedTab.classList.add('active');

            const selectedRegion = clickedTab.dataset.regionName;
            sessionStorage.setItem(storageKey, selectedRegion);

            const regionalProducts = state.products.filter(p => p.game_key === game.game_key && p.region === selectedRegion);
            renderProducts(regionalProducts);
        });
    });

    const initialProducts = state.products.filter(p => p.game_key === game.game_key && p.region === activeRegion);
    renderProducts(initialProducts);
}

async function renderServerOptions(gameKey) {
    const serverMenu = document.getElementById('server-dropdown-menu');
    serverMenu.innerHTML = `<div class="p-2 text-gray-500">Loading servers...</div>`;

    let serverList = [];

    // Special logic for RO Origin (Fetch from API)
    if (gameKey === 'ragnarok-origin') {
        try {
            const response = await fetch(`${window.API_BASE_URL}/ro-origin/get-servers`);
            const data = await response.json();
            if (data.status === 'success' && data.servers) {
                serverList = data.servers.map(s => ({ id: s.server_id, name: s.server_name }));
            }
        } catch (error) {
            serverMenu.innerHTML = `<div class="p-2 text-red-500">Error loading servers.</div>`;
            return;
        }
    } else {
        // Standard Server Lists
        const serverMaps = {
            'identity-v': ['Asia', 'NA-EU'],
            'love-and-deepspace': ['Asia', 'America', 'Europe'],
            'zenless-zone-zero': ['America', 'Asia', 'Europe', 'TW/HK/MO'],
            'snowbreak-containment-zone': ['Asia', 'SEA', 'Americas', 'Europe'],
        };
        const defaultServers = ['America', 'Asia', 'Europe', 'TW,HK,MO'];
        const list = serverMaps[gameKey] || defaultServers;
        serverList = list.map(s => ({ id: s, name: s }));
    }

    serverMenu.innerHTML = serverList.map(server =>
        `<button class="server-option w-full px-4 py-2 text-left hover:bg-gray-100" data-server-id="${window.escapeHtml(String(server.id))}" data-server-name="${window.escapeHtml(server.name)}">${window.escapeHtml(server.name)}</button>`
    ).join('');

    document.querySelectorAll('.server-option').forEach(option => {
        option.addEventListener('click', function() {
            state.server = this.dataset.serverId;
            state.serverName = this.dataset.serverName;
            document.getElementById('selected-server').textContent = this.dataset.serverName;
            serverMenu.classList.add('hidden');
            document.getElementById('dropdown-icon').classList.remove('rotate-180');
            if (state.game) {
                localStorage.setItem(`gamevault-server-${state.game}`, state.server);
                localStorage.setItem(`gamevault-serverName-${state.game}`, state.serverName);
            }
            attemptValidation();
            updateTopupButton();
        });
    });
}

function loadSavedUserDetails() {
    if (!state.game) return;

    const savedUid = localStorage.getItem(`gamevault-uid-${state.game}`);
    const uidInput = document.getElementById('uid-input');
    if (savedUid && uidInput) {
        uidInput.value = savedUid;
        state.uid = savedUid;
    }

    if (isUidAndServerIdGame(state.game)) {
        const savedServerId = localStorage.getItem(`gamevault-serverId-${state.game}`);
        const serverIdInput = document.getElementById('server-id-input');
        if (savedServerId && serverIdInput) {
            serverIdInput.value = savedServerId;
            state.serverId = savedServerId;
        }
    } else if (isUidAndServerRegionGame(state.game)) {
        const savedServer = localStorage.getItem(`gamevault-server-${state.game}`);
        const savedServerName = localStorage.getItem(`gamevault-serverName-${state.game}`);
        if (savedServer) {
            state.server = savedServer;
            state.serverName = savedServerName || savedServer;
            document.getElementById('selected-server').textContent = state.serverName;
        }
    }

    attemptValidation();
}

function attemptValidation() {
    const currentGame = state.gameInfo[state.game];
    // Use the database flag for API validation
    if (currentGame && currentGame.api_validation_enabled) {
        validateGenericUser();
    } else {
        showSimpleWelcome();
    }
}

function showSimpleWelcome() {
    const usernameDisplay = document.getElementById('username-display');
    const usernameText = document.getElementById('username-text');
    if (state.uid) {
        usernameDisplay.classList.remove('hidden');
        usernameText.innerHTML = `<strong class="text-green-800">Details Entered</strong>`;
        state.username = `User-${state.uid.slice(-4)}`; // Pseudo-username
    } else {
        usernameDisplay.classList.add('hidden');
        state.username = '';
    }
    updateTopupButton();
}

async function validateGenericUser() {
    document.getElementById('character-selection-container').classList.add('hidden');
    state.roles = [];
    state.selectedRole = null;

    let { game, uid, server, serverId } = state;
    const usernameDisplay = document.getElementById('username-display');
    const usernameText = document.getElementById('username-text');

    if (!uid) {
        usernameDisplay.classList.add('hidden');
        state.username = '';
        return;
    }

    // Check requirements based on DYNAMIC flags
    if ((isUidAndServerIdGame(game) && !serverId) || (isUidAndServerRegionGame(game) && !server)) {
        usernameDisplay.classList.remove('hidden');
        usernameText.textContent = 'Please select a server.';
        state.username = '';
        updateTopupButton();
        return;
    }

    // Special case normalization for specific APIs if needed
    if (game === 'zenless-zero') game = 'zenless-zone-zero';

    usernameDisplay.classList.remove('hidden');
    usernameText.textContent = 'Validating...';

    // Construct URL dynamically
    let apiUrl = `${window.API_BASE_URL}/check-id/${game}/${uid}/`;
    if (isUidAndServerRegionGame(game) && server) apiUrl += server;
    else if (isUidAndServerIdGame(game) && serverId) apiUrl += serverId;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(apiUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Service unavailable (${response.status})`);
        }

        const data = await response.json();

        if (data.status === 'success') {
            if (data.roles && data.roles.length > 1) {
                state.username = 'VALIDATED';
                state.roles = data.roles;
                usernameText.innerHTML = `<strong class="text-blue-600">Multiple characters found. Please select one below.</strong>`;
                populateCharacterSelector(data.roles);
            } else {
                const finalUsername = data.username || (data.roles && data.roles[0] ? data.roles[0].roleName : null);
                if (finalUsername) {
                    usernameText.innerHTML = `Welcome, <strong class="text-green-800">${window.escapeHtml(finalUsername)}</strong>`;
                    state.username = finalUsername;
                    if (game === 'ragnarok-origin' && data.roles && data.roles[0]) {
                        state.selectedRole = data.roles[0].roleId;
                    }
                } else {
                    throw new Error("Validation successful but no username found.");
                }
            }
        } else {
            throw new Error(data.message || 'Invalid details provided.');
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            usernameText.innerHTML = `<span class="text-orange-500">Validation timed out. Please double-check UID.</span>`;
        } else {
            usernameText.innerHTML = `<span class="text-red-500">${error.message}</span>`;
        }
        state.username = '';
    } finally {
        updateTopupButton();
    }
}

function populateCharacterSelector(roles) {
    const container = document.getElementById('character-selection-container');
    const select = document.getElementById('character-select');

    select.innerHTML = '<option value="">-- Please Select Your Character --</option>';
    roles.forEach(role => {
        const option = document.createElement('option');
        option.value = role.roleId;
        option.textContent = role.roleName;
        select.appendChild(option);
    });

    container.classList.remove('hidden');
}

function updateGameHeader(game) {
    const finalTitle = game.seo_title && game.seo_title.trim() !== '' 
        ? game.seo_title 
        : `${game.name} Top-up - GameVault`;
    
    document.title = finalTitle;

    if (window.updateSocialMeta) {
        window.updateSocialMeta('og:title', finalTitle);
        window.updateSocialMeta('twitter:title', finalTitle);
    }

    if (game.seo_description && window.updateMeta) {
        window.updateMeta('description', game.seo_description);
    }
    
    document.getElementById('page-title').textContent = finalTitle;
    document.getElementById('breadcrumb-game').textContent = `${game.name} Top-Up`;
    document.getElementById('game-title').textContent = game.name;
    
    const gameIconEl = document.getElementById('game-icon');

    if (game.image_url) {
        gameIconEl.className = 'w-24 h-24 sm:w-32 sm:h-32 rounded-lg flex items-center justify-center bg-cover bg-center fade-in-up flex-shrink-0';
        gameIconEl.style.backgroundImage = `url('${game.image_url}')`;
        gameIconEl.textContent = '';
    } else {
        gameIconEl.className = `w-24 h-24 sm:w-32 sm:h-32 bg-gradient-to-br ${game.color_class || 'from-gray-400 to-gray-600'} rounded-lg flex items-center justify-center text-4xl sm:text-6xl fade-in-up flex-shrink-0`;
        gameIconEl.textContent = game.icon || '🎮';
        gameIconEl.style.backgroundImage = '';
    }
}

function renderProducts(products) {
    const grid = document.getElementById('products-grid');
    if (!grid) return;
    if (!products || products.length === 0) {
        grid.innerHTML = '<p class="col-span-full text-center text-gray-500 py-8">No products available for this region at the moment.</p>';
        return;
    }
    grid.innerHTML = products.map(product => {
        const originalPrice = product.original_price;
        const infoIconHtml = product.description
            ? `<div class="info-icon" data-description="${encodeURIComponent(product.description)}">i</div>`
            : '';

        return `
        <div class="product-card" data-product-id="${product.id}">
            ${infoIconHtml}
            <div class="gradient-bg">
                ${product.image_url ? `<img src="${product.image_url}" alt="${window.escapeHtml(product.name)}">` : '<div class="text-5xl">💎</div>'}
            </div>
            <div class="product-info">
                <div class="product-name">${window.escapeHtml(product.name)}</div>
                <div class="price-container">
                    <span class="final-price">S$${parseFloat(product.price).toFixed(2)}</span>
                    ${(originalPrice && originalPrice > product.price) ? `<span class="original-price">S$${parseFloat(originalPrice).toFixed(2)}</span>` : ''}
                </div>
            </div>
        </div>`;
    }).join('');

    document.querySelectorAll('.product-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.classList.contains('info-icon')) {
                return;
            }
            selectProduct(card.dataset.productId);
        });
    });

    document.querySelectorAll('.info-icon').forEach(icon => {
        icon.addEventListener('click', (e) => {
            e.stopPropagation();
            const description = decodeURIComponent(e.target.dataset.description);
            showDescriptionModal(description);
        });
    });
}

function selectProduct(productId) {
    state.selectedProduct = state.products.find(p => p.id.toString() === productId);
    document.querySelectorAll('.product-card').forEach(card => card.classList.remove('selected'));
    const selectedCard = document.querySelector(`[data-product-id="${productId}"]`);
    if (selectedCard) selectedCard.classList.add('selected');
    updatePrice();
    updateTopupButton();
}

function updatePrice() {
    if (state.selectedProduct) {
        const total = state.selectedProduct.price * state.quantity;
        document.getElementById('total-price').textContent = total.toFixed(2);
    }
}

function updateTopupButton() {
    const button = document.getElementById('topup-btn');
    const { isValid } = validateOrderData();
    button.disabled = !isValid;
    button.classList.toggle('bg-gray-300', !isValid);
    button.classList.toggle('bg-yellow-400', isValid);
    button.classList.toggle('hover:bg-yellow-500', isValid);
    button.classList.toggle('cursor-not-allowed', !isValid);
    updateProgressIndicator();
}

function validateOrderData() {
    const errors = [];
    if (!state.uid) errors.push('UID is required');
    if (!state.selectedProduct) errors.push('Product selection is required');

    const currentGame = state.gameInfo[state.game];
    const isValidationEnabled = currentGame && currentGame.api_validation_enabled;
    const isUserValidated = !!state.username && state.username !== 'VALIDATED' && state.username !== '';

    const needsRoleSelection = state.roles && state.roles.length > 0;
    const roleIsSelected = !!state.selectedRole;

    if (isValidationEnabled) {
        if (needsRoleSelection) {
            if (!roleIsSelected) {
                errors.push('Please select a character.');
            }
        } else if (!isUserValidated) {
            errors.push('User validation is pending or failed.');
        }
    }

    // Dynamic Validation based on DB flags
    if (isUidAndServerIdGame(state.game)) {
        if (!state.serverId) errors.push('Server/Zone ID is required');
    } else if (isUidAndServerRegionGame(state.game)) {
        if (!state.server) errors.push('Server selection is required');
    }

    return { isValid: errors.length === 0, errors, isUserValidated };
}

function updateProgressIndicator() {
    let completed = 0;
    let actualTotalSteps = 2;
    const { isUserValidated } = validateOrderData();

    if (isUidAndServerIdGame(state.game) || isUidAndServerRegionGame(state.game)) {
        actualTotalSteps = 4;
        if (state.serverId || state.server) completed++;
        if (isUserValidated) completed++;
    } else {
        const currentGame = state.gameInfo[state.game];
        if (currentGame && currentGame.api_validation_enabled) {
            actualTotalSteps = 3;
            if (isUserValidated) completed++;
        }
    }

    if (state.uid) completed++;
    if (state.selectedProduct) completed++;

    const percentage = actualTotalSteps > 0 ? Math.round((completed / actualTotalSteps) * 100) : 0;
    document.getElementById('progress-fill').style.width = `${percentage}%`;
    document.getElementById('progress-text').textContent = `${percentage}% Complete`;
}

function setupEventListeners() {
    document.getElementById('uid-input').addEventListener('input', (e) => {
        state.uid = e.target.value;
        if (state.game) localStorage.setItem(`gamevault-uid-${state.game}`, state.uid);
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(attemptValidation, 500);
        updateTopupButton();
    });

    document.getElementById('server-id-input').addEventListener('input', (e) => {
        state.serverId = e.target.value;
        if (state.game) localStorage.setItem(`gamevault-serverId-${state.game}`, state.serverId);
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(attemptValidation, 500);
    });

    document.getElementById('character-select').addEventListener('change', (e) => {
        state.selectedRole = e.target.value;
        updateTopupButton();
    });

    document.getElementById('server-dropdown-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('server-dropdown-menu').classList.toggle('hidden');
        document.getElementById('dropdown-icon').classList.toggle('rotate-180');
    });

    document.getElementById('qty-minus').addEventListener('click', () => { if (state.quantity > 1) { state.quantity--; document.getElementById('quantity').value = state.quantity; updatePrice(); } });
    document.getElementById('qty-plus').addEventListener('click', () => { state.quantity++; document.getElementById('quantity').value = state.quantity; updatePrice(); });

    document.getElementById('topup-btn').addEventListener('click', handleTopupClick);
    document.getElementById('close-modal').addEventListener('click', hideConfirmationModal);
    document.getElementById('confirm-purchase-btn').addEventListener('click', proceedToPayment);

    document.getElementById('change-uid-btn').addEventListener('click', hideWarningModal);
    document.getElementById('continue-anyway-btn').addEventListener('click', () => {
        hideWarningModal();
        proceedToPayment();
    });

    document.getElementById('close-description-modal').addEventListener('click', hideDescriptionModal);

    document.getElementById('tab-details').addEventListener('click', () => switchTab('details'));
    document.getElementById('tab-reviews').addEventListener('click', () => switchTab('reviews'));

    initializeInviteBox();
}

function initializeInviteBox() {
    const timerEl = document.getElementById('invite-countdown');
    if (timerEl) {
        const updateTimer = () => {
            const now = new Date();
            const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
            const diff = endOfDay - now;

            const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
            const m = Math.floor((diff / (1000 * 60)) % 60);
            const s = Math.floor((diff / 1000) % 60);

            timerEl.textContent = `${String(h).padStart(2, '0')} | ${String(m).padStart(2, '0')} | ${String(s).padStart(2, '0')}`;
        };
        updateTimer();
        setInterval(updateTimer, 1000);
    }

    const inviteBtn = document.getElementById('invite-btn');
    if (inviteBtn) {
        inviteBtn.addEventListener('click', async () => {
            const { data: { session } } = await window.supabase.auth.getSession();

            if (!session) {
                if (window.showAuthModal) {
                    window.showAuthModal();
                } else {
                    alert("Please log in to invite friends.");
                }
                return;
            }

            const currentUrl = encodeURIComponent(window.location.href);
            const origin = window.location.origin;
            const refLink = `${origin}/invite.html?ref=${session.user.id}&next=${currentUrl}`;

            try {
                await navigator.clipboard.writeText(refLink);
                window.showToast("Referral link copied!", "success");
            } catch (err) {
                try {
                    const textArea = document.createElement("textarea");
                    textArea.value = refLink;
                    textArea.style.position = "fixed";
                    textArea.style.left = "-9999px";
                    textArea.style.top = "0";
                    document.body.appendChild(textArea);
                    textArea.focus();
                    textArea.select();
                    const successful = document.execCommand('copy');
                    document.body.removeChild(textArea);
                    if (successful) {
                        window.showToast("Referral link copied!", "success");
                    } else {
                        throw new Error("Copy command failed");
                    }
                } catch (fallbackErr) {
                    console.error('Clipboard copy failed', fallbackErr);
                    window.showToast("Failed to auto-copy. Please copy the link manually from your browser.", "error");
                }
            }
        });
    }
}

async function switchTab(tabName) {
    const detailsContent = document.getElementById('details-content');
    const reviewsContent = document.getElementById('reviews-content');
    const tabDetails = document.getElementById('tab-details');
    const tabReviews = document.getElementById('tab-reviews');

    if (tabName === 'details') {
        detailsContent.classList.remove('hidden');
        reviewsContent.classList.add('hidden');
        tabDetails.classList.add('text-orange-500', 'border-orange-500');
        tabDetails.classList.remove('text-gray-600');
        tabReviews.classList.remove('text-orange-500', 'border-orange-500');
        tabReviews.classList.add('text-gray-600');
    } else if (tabName === 'reviews') {
        detailsContent.classList.add('hidden');
        reviewsContent.classList.remove('hidden');
        tabReviews.classList.add('text-orange-500', 'border-orange-500');
        tabReviews.classList.remove('text-gray-600');
        tabDetails.classList.remove('text-orange-500', 'border-orange-500');
        tabDetails.classList.add('text-gray-600');
        await fetchAndRenderReviews();
    }
}

async function updateGameStatsAndReviews(gameKey) {
    const { data: reviews, error: reviewsError, count: reviewCount } = await window.supabase
        .from('reviews')
        .select('rating', { count: 'exact' })
        .eq('game_key', gameKey);

    const { data: game, error: gameError } = await window.supabase
        .from('games')
        .select('sales_count')
        .eq('game_key', gameKey)
        .single();

    const tabReviews = document.getElementById('tab-reviews');
    if (tabReviews) {
        tabReviews.textContent = `Review(${reviewsError ? 0 : reviewCount})`;
    }

    const ratingValueEl = document.getElementById('game-rating-value');
    const ratingStarsEl = document.getElementById('game-rating-stars');
    const reviewCountEl = document.getElementById('game-review-count');
    const salesCountEl = document.getElementById('game-sales-count');

    if (reviews && reviews.length > 0) {
        const totalRating = reviews.reduce((acc, review) => acc + review.rating, 0);
        const avgRating = (totalRating / reviews.length);
        const roundedAvg = Math.round(avgRating * 10) / 10;

        if (ratingValueEl) ratingValueEl.textContent = roundedAvg.toFixed(1);
        if (ratingStarsEl) {
            const fullStars = Math.round(avgRating);
            ratingStarsEl.innerHTML = '★'.repeat(fullStars) + '☆'.repeat(5 - fullStars);
        }
        if (reviewCountEl) reviewCountEl.textContent = `${reviewCount.toLocaleString()}`;
    } else {
        if (ratingValueEl) ratingValueEl.textContent = 'N/A';
        if (ratingStarsEl) ratingStarsEl.innerHTML = '☆☆☆☆☆';
        if (reviewCountEl) reviewCountEl.textContent = `0`;
    }

    if (game && game.sales_count) {
        const sales = game.sales_count;
        let salesText;
        if (sales > 100000) {
            salesText = '100k+';
        } else if (sales > 1000) {
            salesText = `${(sales / 1000).toFixed(0)}k+`;
        } else {
            salesText = `${sales}`;
        }
        if (salesCountEl) salesCountEl.textContent = `${salesText} Sold`;
    } else {
        if (salesCountEl) salesCountEl.textContent = '0 Sold';
    }
}

function anonymizeName(name) {
    if (!name) return '***';
    if (name.length <= 3) return name.charAt(0) + '***';
    return name.substring(0, 3) + '***';
}

async function fetchAndRenderReviews() {
    const reviewsContent = document.getElementById('reviews-content');
    reviewsContent.innerHTML = '<p>Loading reviews...</p>';

    const { data: reviews, error } = await window.supabase
        .from('reviews')
        .select('*')
        .eq('game_key', state.game)
        .order('created_at', { ascending: false })
        .limit(10);

    if (error || !reviews || reviews.length === 0) {
        reviewsContent.innerHTML = '<p>No reviews found for this game yet.</p>';
        return;
    }

    reviewsContent.innerHTML = reviews.map(review => `
        <div class="border-b py-4">
            <div class="flex items-center mb-2">
                <div class="font-semibold">${window.escapeHtml(anonymizeName(review.author_name))}</div>
                <div class="ml-auto text-yellow-400">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</div>
            </div>
            <p class="text-gray-600">${window.escapeHtml(review.comment)}</p>
            <p class="text-xs text-gray-400 mt-2">${new Date(review.created_at).toLocaleDateString()}</p>
        </div>
    `).join('');
}

function showDescriptionModal(description) {
    document.getElementById('modal-description-content').textContent = description;
    document.getElementById('description-modal').classList.remove('hidden');
}

function hideDescriptionModal() {
    document.getElementById('description-modal').classList.add('hidden');
}

function handleTopupClick() {
    const { isValid, errors, isUserValidated } = validateOrderData();

    if (!isValid) {
        alert('Please fix the following errors:\n' + errors.join('\n'));
        return;
    }

    const currentGame = state.gameInfo[state.game];
    if (currentGame && currentGame.api_validation_enabled && !isUserValidated) {
        showWarningModal();
    } else {
        showConfirmationModal();
    }
}

function showConfirmationModal() {
    const modal = document.getElementById('confirmation-modal');
    const uidEl = document.getElementById('confirm-uid');
    const serverEl = document.getElementById('confirm-server');
    const usernameEl = document.getElementById('confirm-username');

    uidEl.textContent = state.uid;
    uidEl.parentElement.classList.remove('hidden');

    usernameEl.textContent = state.username;
    usernameEl.parentElement.classList.remove('hidden');

    serverEl.parentElement.style.display = 'none';

    // DYNAMIC MODAL FIELDS
    if (isUidAndServerIdGame(state.game)) {
        serverEl.parentElement.style.display = 'flex';
        serverEl.previousElementSibling.textContent = 'Server/Zone ID';
        serverEl.textContent = state.serverId;
    } else if (isUidAndServerRegionGame(state.game)) {
        serverEl.parentElement.style.display = 'flex';
        serverEl.previousElementSibling.textContent = 'Server';
        serverEl.textContent = state.serverName;
    }

    const currentGame = state.gameInfo[state.game];
    if (currentGame && currentGame.api_validation_enabled === false) {
        usernameEl.parentElement.style.display = 'none';
    }

    modal.classList.remove('hidden');
}

function hideConfirmationModal() {
    document.getElementById('confirmation-modal').classList.add('hidden');
}

function showWarningModal() {
    document.getElementById('warning-modal').classList.remove('hidden');
}

function hideWarningModal() {
    document.getElementById('warning-modal').classList.add('hidden');
}

function proceedToPayment() {
    let serverValue = null;
    let finalUid = state.uid;

    if (isUidAndServerIdGame(state.game)) {
        serverValue = state.serverId;
    } else if (isUidAndServerRegionGame(state.game)) {
        serverValue = state.server;
    }

    const orderData = {
        game: state.game,
        product: state.selectedProduct,
        uid: finalUid,
        server: serverValue,
        serverName: state.serverName,
        quantity: state.quantity,
        username: state.username
    };

    const keysToRemove = [
        'pendingOrderId', 'lastGatewayTotal', 'paymentQRCodeData', 
        'paymentOrderId', 'paymentReferenceId', 'paymentReadableId', 
        'paymentTotalAmount', 'paymentExpiryTimestamp'
    ];
    keysToRemove.forEach(key => sessionStorage.removeItem(key));

    sessionStorage.setItem('currentOrder', JSON.stringify(orderData));
    
    const newExpiry = Date.now() + 30 * 60 * 1000;
    
    sessionStorage.setItem('orderExpiry', newExpiry);

    window.location.href = 'payment-page.html';
}
function showErrorState() {
    hideLoadingScreen();
    const errorHtml = `
        <div class="text-center py-12">
            <h2 class="text-2xl font-bold text-gray-800 mb-4">Game Not Found</h2>
            <p class="text-gray-600 mb-6">The game you're looking for doesn't exist or couldn't be loaded.</p>
            <button onclick="window.location.href='./'" class="bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-2 rounded-lg">
                Back to Homepage
            </button>
        </div>
    `;

    const container = document.getElementById('products-grid') || document.querySelector('.game-content');
    if (container) {
        container.innerHTML = errorHtml;
    }
}

document.addEventListener('click', function(event) {
    const dropdownMenu = document.getElementById('server-dropdown-menu');
    const dropdownBtn = document.getElementById('server-dropdown-btn');
    if (dropdownMenu && !dropdownMenu.classList.contains('hidden') && dropdownBtn && !dropdownMenu.contains(event.target) && !dropdownMenu.contains(event.target)) {
        dropdownMenu.classList.add('hidden');
        document.getElementById('dropdown-icon').classList.remove('rotate-180');
    }
});

document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        hideConfirmationModal();
        hideWarningModal();
        hideDescriptionModal();
    }
});

function updateMeta(name, content) {
    if (!content) return;
    let tag = document.querySelector(`meta[name="${name}"]`);
    if (!tag) {
        tag = document.createElement('meta');
        tag.name = name;
        document.head.appendChild(tag);
    }
    tag.content = content;
}