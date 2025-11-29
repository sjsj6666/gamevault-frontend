// blog.js

document.addEventListener('DOMContentLoaded', () => {
    // Ensure dependencies are loaded
    if (!window.supabase) {
        console.error('Supabase client not found.');
        return;
    }
    const supabase = window.supabase;

    const postsPerPage = 10;
    let currentPage = 1;
    let currentCategory = 'All';
    let currentSearchTerm = '';

    const fetchAndRenderPosts = async () => {
        const container = document.getElementById('posts-container');
        if (!container) return;

        container.innerHTML = getSkeletonLoaderHTML(5);

        const from = (currentPage - 1) * postsPerPage;
        const to = from + postsPerPage - 1;

        let query = supabase
            .from('posts')
            .select('*', { count: 'exact' })
            .eq('is_published', true)
            .order('created_at', { ascending: false })
            .range(from, to);

        if (currentCategory !== 'All') {
            query = query.eq('category', currentCategory);
        }

        if (currentSearchTerm) {
            // Escape single quotes to prevent SQL errors in textSearch
            const safeSearch = currentSearchTerm.replace(/'/g, "");
            query = query.textSearch('title', `'${safeSearch}'`);
        }

        const { data: posts, error, count } = await query;
        
        if (error) {
            console.error('Error loading posts:', error);
            container.innerHTML = '<p class="text-red-500">Could not load posts. Please try again later.</p>';
            return;
        }

        if (!posts || posts.length === 0) {
            container.innerHTML = '<div class="text-center py-12 text-gray-500"><p class="text-xl">No posts found.</p></div>';
            renderPagination(0);
            return;
        }

        container.innerHTML = posts.map(createPostCardHTML).join('');
        renderPagination(count);
    };

    const createPostCardHTML = (post) => {
        // Sanitize inputs
        const title = window.escapeHtml(post.title);
        const excerpt = window.escapeHtml(post.excerpt);
        const slug = window.escapeHtml(post.slug);
        const date = new Date(post.created_at).toLocaleDateString();
        const image = post.image_url || 'https://via.placeholder.com/200x120';

        return `
        <a href="post.html?slug=${slug}" class="post-card group">
            <div class="post-card-thumbnail overflow-hidden rounded-lg">
                <div class="w-full h-full bg-cover bg-center transition-transform duration-300 group-hover:scale-105" 
                     style="background-image: url('${image}')">
                </div>
            </div>
            <div class="post-card-content">
                <h2 class="group-hover:text-blue-600 transition-colors">${title}</h2>
                <p>${excerpt}</p>
                <div class="date">${date}</div>
            </div>
        </a>`;
    };

    const renderPagination = (totalPosts) => {
        const container = document.getElementById('pagination-container');
        if (!container) return;

        if (totalPosts === 0) {
            container.innerHTML = '';
            return;
        }

        const totalPages = Math.ceil(totalPosts / postsPerPage);

        container.innerHTML = `
            <button id="prev-page" class="pagination-btn ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}" ${currentPage === 1 ? 'disabled' : ''}>Previous</button>
            <span class="text-gray-600">Page ${currentPage} of ${totalPages}</span>
            <button id="next-page" class="pagination-btn ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}" ${currentPage === totalPages ? 'disabled' : ''}>Next</button>
        `;

        document.getElementById('prev-page')?.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                fetchAndRenderPosts();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });

        document.getElementById('next-page')?.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                fetchAndRenderPosts();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    };
    
    const setupEventListeners = () => {
        // Category Filters
        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                currentCategory = tab.dataset.category;
                currentPage = 1; // Reset to first page
                fetchAndRenderPosts();
            });
        });

        // Search Functionality
        const searchInput = document.getElementById('blog-search-input');
        const searchBtn = document.getElementById('blog-search-btn');
        
        const performSearch = () => {
            currentSearchTerm = searchInput.value.trim();
            currentPage = 1;
            fetchAndRenderPosts();
        };

        if (searchBtn && searchInput) {
            searchBtn.addEventListener('click', performSearch);
            searchInput.addEventListener('keyup', (e) => {
                if (e.key === 'Enter') performSearch();
            });
        }
    };

    const getSkeletonLoaderHTML = (count) => {
        let html = '';
        for (let i = 0; i < count; i++) {
            html += `
                <div class="post-card animate-pulse">
                    <div class="post-card-thumbnail bg-gray-200 h-[150px] w-full sm:w-[200px] rounded-lg"></div>
                    <div class="post-card-content w-full mt-4 sm:mt-0">
                        <div class="h-6 bg-gray-200 rounded w-3/4 mb-3"></div>
                        <div class="h-4 bg-gray-200 rounded w-full mb-1"></div>
                        <div class="h-4 bg-gray-200 rounded w-5/6 mb-4"></div>
                        <div class="h-3 bg-gray-200 rounded w-24"></div>
                    </div>
                </div>
            `;
        }
        return html;
    };

    // Initialize
    fetchAndRenderPosts();
    setupEventListeners();
});