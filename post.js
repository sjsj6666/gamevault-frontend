document.addEventListener('DOMContentLoaded', () => {
    if (!window.supabase) {
        console.error('Supabase client not found.');
        return;
    }
    const supabase = window.supabase;

    const fetchAndRenderPost = async () => {
        const params = new URLSearchParams(window.location.search);
        const slug = params.get('slug');

        if (!slug) {
            document.getElementById('post-content-container').innerHTML = '<div class="p-4 text-center">Post not found.</div>';
            return;
        }

        const { data: post, error } = await supabase
            .from('posts')
            .select('*')
            .eq('slug', slug)
            .single();

        if (error || !post) {
            console.error('Error fetching post:', error);
            document.getElementById('post-content-container').innerHTML = '<div class="p-4 text-center text-red-500">Error loading post.</div>';
            return;
        }

        renderPostContent(post);
        createEnhancedTOC();
        fetchAndRenderRelatedContent(post);
        setupTocScrollSpy();
    };

    const renderPostContent = (post) => {
        const safeTitle = window.escapeHtml(post.title);
        const safeAuthor = window.escapeHtml(post.author_name || 'GameVault Staff');
        
        // Security Fix: Sanitize HTML content before injection
        const sanitizedContent = window.DOMPurify ? window.DOMPurify.sanitize(post.content) : post.content;
        
        document.title = post.seo_title 
            ? window.escapeHtml(post.seo_title) 
            : `${safeTitle} - GameVault Blog`;

        const metaDescription = post.seo_description || post.excerpt;
        if (metaDescription) {
            updateMeta('description', window.escapeHtml(metaDescription));
        }

        const breadcrumbTitle = document.getElementById('breadcrumb-post-title');
        if (breadcrumbTitle) breadcrumbTitle.textContent = safeTitle;

        const postDate = new Date(post.created_at).toLocaleDateString();
        const container = document.getElementById('post-content-container');

        container.innerHTML = `
            <h1 class="text-3xl font-bold mb-6">${safeTitle}</h1>
            <div class="author-info">
                <div class="flex items-center gap-4">
                    <div class="author-avatar placeholder-avatar">
                        ${safeAuthor.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div class="font-bold">${safeAuthor}</div>
                        <div class="text-sm text-gray-500">${postDate}</div>
                    </div>
                </div>
                <div class="ml-auto flex items-center gap-2">
                    <span class="text-sm text-gray-500">Share</span>
                    ${getShareButtonsHTML(window.location.href, safeTitle)}
                </div>
            </div>
            <div class="article-body mt-8">${sanitizedContent}</div>
        `;
    };

    const createEnhancedTOC = () => {
        const content = document.querySelector('.article-body');
        if (!content) return;

        const headings = content.querySelectorAll('h2, h3, h4');
        const tocList = document.getElementById('toc-list');
        const tocContainer = document.getElementById('toc-container');
        
        if (!tocList || !tocContainer) return;
        
        if (headings.length < 2) {
            tocContainer.style.display = 'none';
            return;
        }
        
        tocList.innerHTML = '';
        let stack = [{ element: tocList, level: 1 }];
        
        headings.forEach((heading, index) => {
            const level = parseInt(heading.tagName.substring(1));
            const text = heading.textContent;
            const safeId = `section-${index}`;
            
            heading.id = safeId;
            
            while (stack.length > 0 && stack[stack.length - 1].level >= level) {
                stack.pop();
            }
            
            const parent = stack.length > 0 ? stack[stack.length - 1].element : tocList;
            const listItem = document.createElement('li');
            
            const link = document.createElement('a');
            link.href = `#${safeId}`;
            link.className = 'toc-link';
            link.innerHTML = `
                <span class="toc-text">${window.escapeHtml(text)}</span>
                <span class="toc-progress"></span>
            `;
            
            listItem.appendChild(link);
            parent.appendChild(listItem);
            
            const nestedList = document.createElement('ul');
            nestedList.className = 'nested';
            listItem.appendChild(nestedList);
            stack.push({ element: nestedList, level: level });
        });
    };

    const fetchAndRenderRelatedContent = async (post) => {
        if (post.game_key) {
            const { data: game } = await supabase.from('games').select('*').eq('game_key', post.game_key).single();
            
            if (game) {
                const { data: products } = await supabase
                    .from('products')
                    .select('price')
                    .eq('game_key', post.game_key)
                    .eq('is_active', true)
                    .order('price', { ascending: true })
                    .limit(1);
                
                const cheapestPrice = products && products.length > 0 ? products[0].price : null;
                const gameContainer = document.getElementById('related-game-container');
                
                if (gameContainer) {
                    gameContainer.innerHTML = `
                        <h3 class="font-bold mb-4">Related Game</h3>
                        <div class="related-card">
                            <div class="flex items-center gap-4 mb-4">
                                <img src="${game.image_url || 'https://via.placeholder.com/64'}" class="w-16 h-16 rounded-lg object-cover">
                                <div>
                                    <div class="font-bold">${window.escapeHtml(game.name)}</div>
                                    ${cheapestPrice ? `<div class="text-sm text-gray-600">From S$${cheapestPrice.toFixed(2)}</div>` : ''}
                                </div>
                            </div>
                            <a href="/topup-page.html?game=${window.escapeHtml(game.game_key)}" class="w-full text-center block bg-yellow-400 px-3 py-2 rounded-md font-semibold hover:bg-yellow-500">Buy Now</a>
                        </div>
                    `;
                }
            }
        }
        
        if (post.category) {
            const { data: news } = await supabase
                .from('posts')
                .select('*')
                .eq('category', post.category)
                .neq('id', post.id)
                .eq('is_published', true)
                .limit(3);

             if (news && news.length > 0) {
                const newsContainer = document.getElementById('related-news-container');
                if (newsContainer) {
                    newsContainer.innerHTML = `<h3 class="font-bold my-4">Related News</h3>` + news.map(item => `
                        <a href="post.html?slug=${window.escapeHtml(item.slug)}" class="related-card block hover:bg-gray-50 transition-colors">
                            <div class="flex items-center gap-4">
                                <div class="w-16 h-16 bg-gray-200 rounded-lg flex-shrink-0 bg-cover bg-center" 
                                     style="background-image: url('${item.image_url || ''}');"></div>
                                 <div>
                                    <div class="font-semibold text-sm leading-tight line-clamp-2">${window.escapeHtml(item.title)}</div>
                                    <div class="text-xs text-gray-500 mt-1">${new Date(item.created_at).toLocaleDateString()}</div>
                                </div>
                            </div>
                        </a>
                    `).join('');
                }
            }
        }
    };
    
    const setupTocScrollSpy = () => {
        const sections = document.querySelectorAll('.article-body h2, .article-body h3, .article-body h4');
        if (sections.length === 0) return;
        
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                const id = entry.target.getAttribute('id');
                const tocLink = document.querySelector(`.toc-link[href="#${id}"]`);
                
                if (tocLink) {
                    if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
                        document.querySelectorAll('.toc-link').forEach(link => link.classList.remove('active'));
                        tocLink.classList.add('active');
                        
                        let parent = tocLink.closest('ul');
                        while (parent && parent.id !== 'toc-list') {
                            parent = parent.parentElement.closest('ul');
                        }
                    }
                }
            });
        }, { 
            threshold: [0.1, 0.6],
            rootMargin: '-20% 0px -35% 0px'
        });

        sections.forEach(section => observer.observe(section));
    };

    fetchAndRenderPost();
});

function getShareButtonsHTML(url, title) {
    const encodedUrl = encodeURIComponent(url);
    const encodedTitle = encodeURIComponent(title);
    
    return `
        <a href="https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}" target="_blank" class="social-share-btn" title="Share on Facebook">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"></path></svg>
        </a>
        <a href="https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}" target="_blank" class="social-share-btn" title="Share on X">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z"></path></svg>
        </a>
        <a href="https://wa.me/?text=${encodedTitle}%20${encodedUrl}" target="_blank" class="social-share-btn" title="Share on WhatsApp">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
        </a>
    `;
}

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