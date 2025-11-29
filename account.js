// account.js

document.addEventListener('DOMContentLoaded', async () => {
    let currentUser = null;
    let userProfile = null;
    let orderSubscription = null;
    let selectedRating = 0;

    // Ensure dependencies are loaded
    if (!window.supabase) {
        console.error('Supabase client not found.');
        return;
    }
    const supabase = window.supabase;

    async function initializeAccountPage() {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            window.location.href = 'index.html';
            return;
        }
        currentUser = session.user;

        await renderUserProfile();
        setupEventListeners();

        // Check URL params for specific order view
        const params = new URLSearchParams(window.location.search);
        const orderId = params.get('id');

        const hash = window.location.hash || '#buy-history';
        // If ID exists, force order details view, otherwise follow hash
        showView(orderId ? 'order-details' : hash.substring(1), orderId);
    }

    function setupEventListeners() {
        // Sidebar Navigation
        document.querySelectorAll('.account-sidebar-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const viewName = e.currentTarget.dataset.view;
                
                // Update URL without reloading
                history.pushState(null, '', `account.html#${viewName}`);
                showView(viewName);
            });
        });

        // Handle Browser Back/Forward
        window.addEventListener('popstate', () => {
            cleanupSubscription();
            const hash = window.location.hash || '#buy-history';
            showView(hash.substring(1));
        });

        // Modals
        document.getElementById('close-settings-modal').addEventListener('click', closeSettingsModal);
        document.getElementById('settings-form').addEventListener('submit', saveProfileSettings);

        document.getElementById('close-ticket-modal').addEventListener('click', closeTicketModal);
        document.getElementById('ticket-form').addEventListener('submit', submitSupportTicket);

        document.getElementById('close-review-modal').addEventListener('click', closeReviewModal);
        document.getElementById('submit-review-btn').addEventListener('click', submitReview);

        document.querySelectorAll('#review-stars .star').forEach(star => {
            star.addEventListener('click', handleStarClick);
        });
    }

    function cleanupSubscription() {
        if (orderSubscription) {
            console.log('Cleaning up active order subscription');
            supabase.removeChannel(orderSubscription);
            orderSubscription = null;
        }
    }
    
    function handleStarClick(e) {
        selectedRating = parseInt(e.currentTarget.dataset.rating);
        const stars = document.querySelectorAll('#review-stars .star');
        stars.forEach(star => {
            star.textContent = parseInt(star.dataset.rating) <= selectedRating ? '★' : '☆';
        });
    }

    async function submitReview() {
        if (selectedRating === 0) {
            window.showToast('Please select a rating.', 'error');
            return;
        }
        const comment = document.getElementById('review-comment').value.trim();
        const params = new URLSearchParams(window.location.search);
        const orderId = params.get('id'); // Assumes we are on the order detail view
        
        if (!orderId) {
            window.showToast('Order ID missing.', 'error');
            return;
        }

        const { data: orderData, error: orderError } = await supabase
            .from('orders')
            .select('order_items(*, products(game_key))')
            .eq('id', orderId)
            .single();

        if (orderError || !orderData) {
            window.showToast('Could not find order details.', 'error');
            return;
        }

        // Validate game key existence
        if (!orderData.order_items || !orderData.order_items[0] || !orderData.order_items[0].products) {
             window.showToast('Invalid order product data.', 'error');
             return;
        }

        const gameKey = orderData.order_items[0].products.game_key;
        const authorName = userProfile.nickname || `User-${currentUser.id.slice(0,6)}`;
        
        const review = {
            game_key: gameKey,
            author_name: authorName, 
            rating: selectedRating,
            comment: comment, 
            user_id: currentUser.id,
        };

        const { error: insertError } = await supabase.from('reviews').insert([review]);

        if (insertError) {
            window.showToast(`Error: ${insertError.message}`, 'error');
        } else {
            // Award points
            await supabase.rpc('increment_points', { user_id_to_update: currentUser.id, points_to_add: 30 });
            
            window.showToast('Review submitted! +30 Points');
            closeReviewModal();
            renderUserProfile(); // Refresh points in sidebar
        }
    }

    function closeReviewModal() {
        document.getElementById('review-modal').classList.add('hidden');
        selectedRating = 0;
        document.querySelectorAll('#review-stars .star').forEach(star => star.textContent = '☆');
        document.getElementById('review-comment').value = '';
    }

    function showView(viewId, orderId = null) {
        cleanupSubscription();

        document.querySelectorAll('.account-view').forEach(view => view.classList.add('hidden'));
        
        // Handle View Mapping
        const activeView = document.getElementById(`view-${viewId}`);
        if (activeView) {
            activeView.classList.remove('hidden');
            if (viewId === 'order-details' && orderId) {
                 renderOrderDetails(orderId);
            } else {
                renderViewContent(viewId);
            }
        } else {
            // Fallback if view doesn't exist
            document.getElementById('view-buy-history').classList.remove('hidden');
        }

        // Update Sidebar Active State
        document.querySelectorAll('.account-sidebar-link').forEach(link => {
            const linkView = link.dataset.view;
            // Keep "Buy History" active if viewing order details
            const isActive = linkView === viewId || (viewId === 'order-details' && linkView === 'buy-history');
            link.classList.toggle('active', isActive);
        });
        
        // Update Breadcrumbs
        const breadcrumbContainer = document.querySelector('.breadcrumb');
        if (viewId === 'order-details' && orderId) {
            breadcrumbContainer.innerHTML = `
                <a href="index.html" class="hover:text-blue-600">Home</a> › 
                <a href="account.html#buy-history" class="hover:text-blue-600">Buy History</a> › 
                <span id="breadcrumb-current-page">Order ${window.escapeHtml(orderId.slice(0, 8))}...</span>
            `;
        } else {
            let viewName = viewId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            if (viewId === 'buy-history') viewName = 'Buy History';
            breadcrumbContainer.innerHTML = `
                <a href="index.html" class="hover:text-blue-600">Home</a> › 
                <span id="breadcrumb-current-page">${window.escapeHtml(viewName)}</span>
            `;
        }
    }

    async function renderViewContent(viewId) {
        switch (viewId) {
            case 'buy-history': await renderBuyHistory(); break;
            case 'coupons': await renderCoupons(); break;
            case 'settings': await renderSettings(); break;
            case 'feedback': await renderFeedback(); break;
            case 'messages': renderMessages(); break;
            case 'invite': renderInvitePage(); break;
            case 'affiliate': renderAffiliatePage(); break;
            case 'member': renderVipPage(); break;
            case 'help-center': renderHelpCenter(); break;
        }
    }

    async function renderUserProfile() {
        if (!currentUser) return;
        
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
        
        if (profile) {
            userProfile = profile;
            
            // --- FIX: Priority Logic for Avatar ---
            // 1. Check Database Profile (Custom Upload)
            // 2. Check Google Metadata (Social Login)
            // 3. Fallback to Placeholder
            const avatarUrl = profile.avatar_url || 
                              currentUser.user_metadata?.avatar_url || 
                              currentUser.user_metadata?.picture || 
                              `https://i.pravatar.cc/80?u=${currentUser.id}`;

            document.getElementById('profile-nickname').textContent = profile.nickname || `User-${currentUser.id.slice(0, 6)}`;
            document.getElementById('profile-avatar').src = avatarUrl;
            
            document.getElementById('profile-balance-sidebar').textContent = `S$${(profile.balance || 0).toFixed(2)}`;
            document.getElementById('profile-points-sidebar').textContent = profile.points || 0;
        }
    }

    async function renderBuyHistory(statusFilter = 'All') {
        const container = document.getElementById('view-buy-history');
        container.innerHTML = `
            <div class="content-header"><h2 class="text-xl font-bold">Buy History</h2></div>
            <div class="content-tabs">
                <button class="tab-button active" data-status="All">All</button>
                <button class="tab-button" data-status="verifying">Verifying</button>
                <button class="tab-button" data-status="processing">Processing</button>
                <button class="tab-button" data-status="completed">Completed</button>
                <button class="tab-button" data-status="manual_review">Review</button>
                <button class="tab-button" data-status="cancelled">Cancelled</button>
                <button class="tab-button" data-status="refunded">Refund</button>
            </div>
            <div id="orders-list"><div class="text-center p-8 text-gray-500">Loading orders...</div></div>`;
        
        container.querySelectorAll('.tab-button').forEach(button => {
            button.classList.toggle('active', button.dataset.status === statusFilter);
            button.addEventListener('click', () => renderBuyHistory(button.dataset.status));
        });
        
        let query = supabase.from('orders')
            .select('*, order_items(*, products(*, games(name)))')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false });
            
        if (statusFilter !== 'All') query = query.eq('status', statusFilter);

        const { data: orders, error } = await query;
        const ordersList = document.getElementById('orders-list');

        if (error || !orders || orders.length === 0) {
            ordersList.innerHTML = `<div class="text-center p-8 text-gray-500">No orders found.</div>`;
            return;
        }

        ordersList.innerHTML = orders.map(order => {
            if (!order.order_items || order.order_items.length === 0 || !order.order_items[0].products) return '';
            
            const item = order.order_items[0];
            const product = item.products;
            const orderDate = new Date(order.created_at).toLocaleString();
            const statusColors = { completed: 'text-green-600', processing: 'text-blue-600', verifying: 'text-yellow-600', manual_review: 'text-red-600', cancelled: 'text-gray-500', refunded: 'text-red-600' };
            
            return `
            <div class="order-card">
                <div class="order-card-header">
                    <span>${window.escapeHtml(orderDate)}</span>
                    <span>Order No: ${window.escapeHtml(order.id.slice(0, 8).toUpperCase())}</span>
                    <span class="font-semibold capitalize ${statusColors[order.status] || ''}">${window.escapeHtml(order.status.replace('_', ' '))}</span>
                </div>
                <div class="order-card-body" onclick="window.location.href='account.html?id=${order.id}'" style="cursor: pointer;">
                    <div class="order-product-image">
                        ${product.image_url ? `<img src="${product.image_url}" alt="${window.escapeHtml(product.name)}">` : '💎'}
                    </div>
                    <div class="order-details">
                        <h3 class="font-bold">${window.escapeHtml(product.name)}</h3>
                        <p class="text-sm text-gray-500">${window.escapeHtml(product.games?.name || 'Unknown Game')}</p>
                        <p class="text-sm text-gray-500">S$${item.unit_price.toFixed(2)} x ${item.quantity}</p>
                    </div>
                    <div class="order-price">S$${order.total_amount.toFixed(2)}</div>
                </div>
                <div class="order-actions">
                    <button class="action-btn" onclick="window.location.href='account.html?id=${order.id}'">View Details</button>
                    <button class="action-btn primary purchase-again-btn" 
                        data-order-info='${JSON.stringify({
                            gameKey: product.game_key, 
                            productId: product.id, 
                            uid: order.game_uid, 
                            server: order.server_region, 
                            quantity: item.quantity
                        }).replace(/'/g, "&#39;")}'>
                        Purchase Again
                    </button>
                </div>
            </div>`;
        }).join('');
        
        ordersList.querySelectorAll('.purchase-again-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                sessionStorage.setItem('repurchaseData', e.currentTarget.dataset.orderInfo);
                window.location.href = 'topup-page.html';
            });
        });
    }

    async function renderOrderDetails(orderId) {
        const container = document.getElementById('view-order-details');
        const skeleton = document.getElementById('order-details-skeleton');
        
        if (skeleton) skeleton.classList.remove('hidden');

        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select(`*, order_items(*, products(*, games(name)))`)
            .eq('id', orderId)
            .eq('user_id', currentUser.id)
            .single();

        if (orderError || !order) {
            console.error("Error fetching order details:", orderError);
            container.innerHTML = `<p class="p-4 text-red-500">Order not found or you do not have permission to view it.</p>`;
            return;
        }
        
        try {
            orderSubscription = supabase
                .channel(`order-updates-${orderId}`)
                .on(
                    'postgres_changes',
                    { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
                    (payload) => {
                        updateOrderStatusUI(payload.new);
                    }
                )
                .subscribe();
        } catch (error) {
            console.error('Error setting up real-time subscription:', error);
        }

        renderOrderDetailsUI(order);
    }

    function generateStatusHeaderHTML(status) {
        const statusConfig = {
            completed: { icon: '✓', color: 'green', title: 'Order Completed', message: 'Please log in to the game to check your purchase.' },
            verifying: { icon: '⏳', color: 'yellow', title: 'Verifying Payment', message: 'We are confirming your payment.' },
            processing: { icon: '⚙️', color: 'blue', title: 'Processing Order', message: 'Your order is being processed.' },
            refunded: { icon: '↩️', color: 'red', title: 'Order Refunded', message: 'Your payment has been refunded.' },
            cancelled: { icon: '✕', color: 'gray', title: 'Order Cancelled', message: 'This order has been cancelled.' },
            manual_review: { icon: 'M', color: 'red', title: 'Order Under Review', message: 'Issue verifying payment. Contact support.' }
        };

        const config = statusConfig[status] || { icon: '?', color: 'gray', title: 'Status Unknown', message: 'Contact support.' };

        return `
            <div class="flex items-center gap-3 mb-4">
                <div class="w-12 h-12 bg-${config.color}-100 rounded-full flex items-center justify-center">
                    <span class="text-2xl text-${config.color}-600">${config.icon}</span>
                </div>
                <div>
                    <h2 class="text-2xl font-bold text-${config.color}-600">${window.escapeHtml(config.title)}</h2>
                    <p class="text-gray-600">${window.escapeHtml(config.message)}</p>
                </div>
            </div>`;
    }

    function updateOrderStatusUI(updatedOrder) {
        const statusHeaderContainer = document.querySelector('.details-header');
        if (statusHeaderContainer) {
            const statusDisplay = statusHeaderContainer.querySelector('div:first-child');
            if(statusDisplay) {
                 statusDisplay.innerHTML = generateStatusHeaderHTML(updatedOrder.status);
            }
        }
        window.showToast(`Order status updated to: ${updatedOrder.status.replace('_', ' ')}`, 'info');
    }

    function renderOrderDetailsUI(order) {
        const item = order.order_items[0];
        const product = item.products;
        const gameName = product.games?.name || 'Unknown Game';
        const nickname = order.game_nickname;
        
        const statusHeaderHTML = generateStatusHeaderHTML(order.status);
        const formatDate = (dateString) => new Date(dateString).toLocaleString();
        const pointsEarned = Math.floor(order.total_amount);

        const sentAtHTML = (order.status === 'completed' && order.completed_at) 
            ? `<div class="info-grid-item" data-field="sent-at"><span class="label">Sent at:</span> <span class="value">${formatDate(order.completed_at)}</span></div>` 
            : '';

        const container = document.getElementById('view-order-details');
        
        container.innerHTML = `
            <div class="details-header">
                ${statusHeaderHTML}
                <div class="details-product-card">
                    <div class="details-product-image">
                        ${product.image_url ? `<img src="${product.image_url}" alt="${window.escapeHtml(product.name)}">` : '💎'}
                    </div>
                    <div class="details-product-info">
                        <div class="game-name">${window.escapeHtml(gameName)}</div>
                        <div class="product-name">${window.escapeHtml(product.name)} x${item.quantity}</div>
                    </div>
                    <div class="product-price">S$${order.total_amount.toFixed(2)}</div>
                </div>
            </div>

            <div class="details-info-section">
                <h3 class="text-xl font-bold mb-4">Order Information</h3>
                <div class="info-grid">
                    <div class="info-grid-item"><span class="label">Order Number:</span> <span class="value">${window.escapeHtml(order.id)} <span class="copy-icon" title="Copy">📋</span></span></div>
                    <div class="info-grid-item"><span class="label">Game UID:</span> <span class="value">${window.escapeHtml(order.game_uid)}</span></div>
                    <div class="info-grid-item"><span class="label">Created at:</span> <span class="value">${formatDate(order.created_at)}</span></div>
                    <div class="info-grid-item"><span class="label">Server:</span> <span class="value">${window.escapeHtml(order.server_region || 'N/A')}</span></div>
                    <div class="info-grid-item"><span class="label">Nickname:</span> <span class="value">${window.escapeHtml(nickname || 'N/A')}</span></div>
                    ${sentAtHTML}
                    <div class="info-grid-item"><span class="label">Payment Method:</span> <span class="value">${window.escapeHtml(order.payment_method)}</span></div>
                    <div class="info-grid-item"><span class="label">Points Earned:</span> <span class="value text-orange-500">🪙 ${pointsEarned}</span></div>
                </div>
            </div>
            <div class="flex gap-3 mt-6">
                <button id="cs-btn" class="flex-1 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-semibold">Customer Service</button>
                <button id="pa-btn" class="flex-1 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-semibold">Purchase Again</button>
                <button id="review-btn" class="flex-1 px-6 py-3 bg-yellow-400 hover:bg-yellow-500 rounded-lg font-semibold">Post a review</button>
            </div>
        `;

        container.querySelector('#cs-btn').addEventListener('click', () => {
            history.pushState(null, '', 'account.html#feedback');
            showView('feedback');
        });
        
        container.querySelector('#pa-btn').addEventListener('click', () => {
            sessionStorage.setItem('repurchaseData', JSON.stringify({
                gameKey: product.game_key, 
                productId: product.id, 
                uid: order.game_uid, 
                server: order.server_region, 
                quantity: item.quantity
            }));
            window.location.href = 'topup-page.html';
        });

        container.querySelector('#review-btn').addEventListener('click', () => {
            document.getElementById('review-modal').classList.remove('hidden');
        });
        
        container.querySelector('.copy-icon').addEventListener('click', () => {
            navigator.clipboard.writeText(order.id).then(() => {
                window.showToast('Order ID copied!');
            });
        });
    }

    async function renderCoupons() {
        const container = document.getElementById('view-coupons');
        const { data, error, count } = await supabase.from('user_coupons').select('*, coupons(*)', { count: 'exact' }).eq('user_id', currentUser.id).eq('status', 'active');
        
        container.innerHTML = `
            <div class="content-header flex justify-between items-center">
                <h2 class="text-xl font-bold">Coupons (${count || 0})</h2>
                <div class="flex"><input type="text" placeholder="Code" class="border p-2 rounded-l-md"><button class="bg-gray-200 p-2 rounded-r-md font-semibold">Redeem</button></div>
            </div>
            <div id="coupons-list" class="space-y-4">Loading...</div>
        `;
        
        const list = document.getElementById('coupons-list');
        if (error || !data || data.length === 0) { list.innerHTML = '<p class="text-center text-gray-500">No active coupons found.</p>'; return; }
        
        list.innerHTML = data.map(uc => {
            if (!uc.coupons) return '';
            const { description, image_url, min_order_value, expiry_date } = uc.coupons;
            const daysLeft = expiry_date ? Math.ceil((new Date(expiry_date) - new Date()) / 86400000) : null;
            return `
                <div class="coupon-card">
                    <img class="coupon-card-img" src="${image_url || 'https://via.placeholder.com/64'}" alt="Coupon">
                    <div class="flex-grow">
                        <h3 class="font-bold">${window.escapeHtml(description)}</h3>
                        <p class="text-sm text-gray-500">Valid for orders over S$${min_order_value.toFixed(2)}</p>
                        ${daysLeft ? `<p class="text-sm text-red-500">Expires in ${daysLeft} days</p>` : ''}
                    </div>
                    <button class="action-btn primary px-8" onclick="window.location.href='index.html'">Use</button>
                </div>`;
        }).join('');
    }

    async function renderSettings() {
        if (!userProfile) await renderUserProfile();
        const container = document.getElementById('view-settings');
        const safeNickname = window.escapeHtml(userProfile.nickname || `User-${currentUser.id.slice(0,6)}`);
        
        container.innerHTML = `
            <div class="content-header"><h2 class="text-xl font-bold">Account Information</h2></div>
            <div class="settings-row">
                <div><div class="font-semibold">Avatar</div></div>
                <div class="flex items-center gap-4">
                    <img src="${userProfile.avatar_url || `https://i.pravatar.cc/40?u=${currentUser.id}`}" class="w-10 h-10 rounded-full">
                    <button id="modify-avatar-btn" class="text-blue-500 font-semibold">Modify</button>
                </div>
            </div>
            <div class="settings-row">
                <div><div class="font-semibold">Nickname</div><div class="text-gray-500">${safeNickname}</div></div>
                <button id="modify-nickname-btn" class="text-blue-500 font-semibold">Modify</button>
            </div>`;
            
        container.querySelector('#modify-avatar-btn').addEventListener('click', openSettingsModal);
        container.querySelector('#modify-nickname-btn').addEventListener('click', openSettingsModal);
    }

    async function renderFeedback() {
        const container = document.getElementById('view-feedback');
        container.innerHTML = `
            <div class="content-header flex justify-between items-center">
                <h2 class="text-xl font-bold">Feedback</h2>
                <button id="new-ticket-btn" class="bg-yellow-400 text-black font-semibold px-4 py-2 rounded-lg">New Ticket</button>
            </div>
            <div id="tickets-list">Loading tickets...</div>`;
            
        container.querySelector('#new-ticket-btn').addEventListener('click', openTicketModal);
        
        const { data: tickets, error } = await supabase.from('support_tickets').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false });
        const list = document.getElementById('tickets-list');
        
        if (error || !tickets.length) { list.innerHTML = `<div class="text-center p-8 text-gray-500">No tickets found.</div>`; return; }
        
        list.innerHTML = tickets.map(t => `
            <div class="ticket-card">
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <p class="font-semibold">${window.escapeHtml(t.category)}</p>
                        <p class="text-xs text-gray-400">ID: ${window.escapeHtml(t.ticket_id)}</p>
                    </div>
                    <span class="ticket-status bg-yellow-100 text-yellow-800">${window.escapeHtml(t.status)}</span>
                </div>
                <p class="text-gray-600">${window.escapeHtml(t.content)}</p>
                <p class="text-xs text-gray-400 mt-2 text-right">${new Date(t.created_at).toLocaleString()}</p>
            </div>`).join('');
    }
    
    function openSettingsModal() {
        if (!userProfile) return;
        document.getElementById('nickname-input').value = userProfile.nickname || '';
        document.getElementById('avatar-url-input').value = userProfile.avatar_url || '';
        document.getElementById('settings-modal').classList.remove('hidden');
    }
    
    function closeSettingsModal() { document.getElementById('settings-modal').classList.add('hidden'); }
    
    async function saveProfileSettings(e) {
        e.preventDefault();
        const updates = { 
            nickname: document.getElementById('nickname-input').value.trim(), 
            avatar_url: document.getElementById('avatar-url-input').value.trim() 
        };
        
        const { error } = await supabase.from('profiles').update(updates).eq('id', currentUser.id);
        
        if (error) { 
            window.showToast('Error updating profile.', 'error'); 
        } else { 
            window.showToast('Profile updated successfully!'); 
            closeSettingsModal(); 
            await renderSettings(); 
            await renderUserProfile(); 
        }
    }
    
    function openTicketModal() { document.getElementById('ticket-modal').classList.remove('hidden'); }
    function closeTicketModal() { document.getElementById('ticket-modal').classList.add('hidden'); }

    async function submitSupportTicket(e) {
        e.preventDefault();
        const content = document.getElementById('ticket-content').value;
        if (!content.trim()) { window.showToast('Please describe your issue.', 'error'); return; }
        
        const { error } = await supabase.from('support_tickets').insert({ 
            user_id: currentUser.id, 
            ticket_id: `T${Date.now()}`, 
            category: document.getElementById('ticket-category').value, 
            content: content 
        });
        
        if (error) { window.showToast('Failed to submit ticket.', 'error'); }
        else { 
            window.showToast('Ticket submitted successfully!'); 
            closeTicketModal(); 
            await renderFeedback(); 
        }
    }

    function renderMessages() { document.getElementById('view-messages').innerHTML = `<p class="p-4 text-gray-500">No new messages.</p>`; }
    function renderInvitePage() { document.getElementById('view-invite').innerHTML = `<p class="p-4 text-gray-500">Referral system loading...</p>`; }
    function renderAffiliatePage() { document.getElementById('view-affiliate').innerHTML = `<p class="p-4 text-gray-500">Affiliate program coming soon.</p>`; }
    function renderVipPage() { document.getElementById('view-member').innerHTML = `<p class="p-4 text-gray-500">VIP tiers coming soon.</p>`; }
    function renderHelpCenter() { document.getElementById('view-help-center').innerHTML = `<p class="p-4 text-gray-500">FAQ section coming soon.</p>`; }

    initializeAccountPage();
});