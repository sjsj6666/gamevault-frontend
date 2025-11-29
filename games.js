document.addEventListener('DOMContentLoaded', () => {
    // Ensure dependencies are loaded
    if (!window.supabase) {
        console.error('Supabase client not found.');
        return;
    }
    initializeGamesPage();
});

let currentSort = 'name';
const supabase = window.supabase;

function initializeGamesPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get('q');

    if (searchQuery) {
        // Hide sidebar on search to give more space for results
        document.querySelector('.sidebar')?.classList.add('hidden');
        const breadcrumbSpan = document.querySelector('.breadcrumb span');
        if (breadcrumbSpan) breadcrumbSpan.textContent = 'Search';
        
        renderSearchResults(searchQuery);
    } else {
        updateAllCategoryCounts();
        renderAllGames(currentSort); 
        setupCategoryListeners();
        setupFilterListeners();
    }
}

async function renderSearchResults(query) {
    const container = document.getElementById('all-games-grid');
    const categoryTitle = document.getElementById('category-title');
    const totalItemsCount = document.getElementById('total-items-count');
    const filtersContainer = document.getElementById('filters-container');

    if (!container || !categoryTitle || !totalItemsCount || !filtersContainer) return;

    // Sanitize the query for display
    const safeQuery = window.escapeHtml(query);

    filtersContainer.classList.add('hidden');
    container.innerHTML = getSkeletonLoaderHTML(8);
    categoryTitle.textContent = `Search results for "${safeQuery}"`;
    
    // FIXED: Removed 'price' and 'original_price'
    const { data: games, error, count } = await supabase
        .from('games')
        .select('name, game_key, image_url, card_image_url, sales_count, category', { count: 'exact' })
        .eq('is_active', true)
        .is('parent_game_key', null)
        .ilike('name', `%${query}%`); 
    
    if (error) {
        console.error("Error fetching search results:", error);
        container.innerHTML = "<p class='col-span-full text-center text-red-500'>Could not perform search. Please try again later.</p>";
        totalItemsCount.textContent = 'Error';
        return;
    }

    totalItemsCount.textContent = `Found ${count} items`;

    if (!games || games.length === 0) {
        container.innerHTML = `<p class="col-span-full text-center py-8">No games found matching "${safeQuery}".</p>`;
        return;
    }

    container.innerHTML = games.map(createGameCardHTML).join('');
}

async function updateAllCategoryCounts() {
    const { count, error } = await supabase
        .from('games')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .is('parent_game_key', null);

    const topUpCountEl = document.querySelector('.category-item[data-category="Top-Up"] .count');
    if (topUpCountEl) {
        topUpCountEl.textContent = error ? '0' : count;
    }

    const otherCategories = ['Game Coins', 'Gift Card', 'Game Items', 'CDKEY'];
    otherCategories.forEach(categoryName => {
        const countEl = document.querySelector(`.category-item[data-category="${categoryName}"] .count`);
        if (countEl) {
            countEl.textContent = 0;
        }
    });
}

function setupCategoryListeners() {
    const categories = document.querySelectorAll('.category-item');
    categories.forEach(category => {
        category.addEventListener('click', () => {
            categories.forEach(c => c.classList.remove('active'));
            category.classList.add('active');
            const categoryName = category.dataset.category;

            const filters = document.getElementById('filters-container');
            if(filters) filters.style.display = 'flex';
            
            if (categoryName === 'Top-Up') {
                renderAllGames(currentSort);
            } else {
                showEmptyCategoryView(categoryName);
            }
        });
    });
}

function setupFilterListeners() {
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentSort = btn.dataset.sort;
            renderAllGames(currentSort);
        });
    });
}

async function renderAllGames(sortBy = 'name') {
    const container = document.getElementById('all-games-grid');
    const categoryTitle = document.getElementById('category-title');
    const totalItemsCount = document.getElementById('total-items-count');

    if (!container) return;
    
    if(categoryTitle) categoryTitle.textContent = "Top-Up";
    container.innerHTML = getSkeletonLoaderHTML(8); 

    try {
        // FIXED: Removed 'price' and 'original_price'
        let query = supabase
            .from('games')
            .select('name, game_key, image_url, card_image_url, sales_count, category, created_at', { count: 'exact' })
            .eq('is_active', true)
            .is('parent_game_key', null);

        if (sortBy === 'created_at') {
            query = query.order('created_at', { ascending: false }).limit(30);
        } else {
            query = query.order('name', { ascending: true });
        }

        const { data: games, error, count } = await query;

        if (error) throw error;

        if (totalItemsCount) {
            if (sortBy === 'name') {
                totalItemsCount.textContent = `Total ${count} items`;
            } else {
                totalItemsCount.textContent = `Showing latest ${games.length} items`;
            }
        }
        
        if (!games || games.length === 0) {
            container.innerHTML = '<p class="col-span-full text-center">No games are available in this category right now.</p>';
            return;
        }

        container.innerHTML = games.map(createGameCardHTML).join('');

    } catch (err) {
        console.error("Error fetching games:", err);
        container.innerHTML = "<p class='col-span-full text-center text-red-500'>Could not load games. Please try again later.</p>";
    }
}

function showEmptyCategoryView(categoryName) {
    const container = document.getElementById('all-games-grid');
    const categoryTitle = document.getElementById('category-title');
    const totalItemsCount = document.getElementById('total-items-count');
    const filters = document.getElementById('filters-container');

    if(categoryTitle) categoryTitle.textContent = categoryName;
    if(totalItemsCount) totalItemsCount.textContent = 'Total 0 items';
    if(filters) filters.style.display = 'none'; 
    
    if(container) {
        container.innerHTML = `
            <div class="col-span-full text-center py-16 px-6 bg-white rounded-lg shadow-sm">
                <h2 class="text-2xl font-bold text-gray-800 mb-2">Coming Soon!</h2>
                <p class="text-gray-500">
                    The "${window.escapeHtml(categoryName)}" category is currently under development. Please check back later!
                </p>
            </div>
        `;
    }
}

function getSkeletonLoaderHTML(count) {
    let skeletons = '';
    for (let i = 0; i < count; i++) {
        skeletons += `
            <div class="game-card shimmer">
                <div class="game-image bg-gray-200"></div>
                <div class="game-info p-4">
                    <div class="game-title h-5 bg-gray-200 rounded w-3/4"></div>
                    <div class="game-stats h-4 bg-gray-200 rounded w-1/2 mt-2"></div>
                </div>
            </div>`;
    }
    return skeletons;
}

function createGameCardHTML(game) {
    // Note: Since price is removed from query, discount logic will default to null (no badge), which is correct.
    const discount = (game.original_price && game.price) ? Math.round(((game.original_price - game.price) / game.original_price) * 100) : null;
    const imageUrl = window.getOptimizedImageUrl(game.card_image_url || game.image_url);
    
    const safeName = window.escapeHtml(game.name);
    const safeKey = window.escapeHtml(game.game_key);
    
    return `
    <div class="game-card fade-in-up" data-game-key="${safeKey}">
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
    </div>
    `;
}