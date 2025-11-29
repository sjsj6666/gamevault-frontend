// order-details.js

let currentOrderDetails = null;

document.addEventListener('DOMContentLoaded', () => {
    // Ensure dependencies are loaded
    if (!window.supabase) {
        console.error('Supabase client not found.');
        return;
    }
    
    loadOrderData();
    setupGlobalListeners();
});

function setupGlobalListeners() {
    // These are general page navigation buttons if they exist outside the dynamic content
    document.getElementById('back-home-btn')?.addEventListener('click', () => window.location.href = 'index.html');
    document.getElementById('back-history-btn')?.addEventListener('click', () => window.location.href = 'account.html#buy-history');
    
    // Modal Listeners
    document.getElementById('close-review-modal')?.addEventListener('click', closeReviewModal);
    document.getElementById('submit-review-btn')?.addEventListener('click', submitReview);
    
    document.getElementById('close-service-modal')?.addEventListener('click', closeServiceModal);
    document.getElementById('submit-ticket-btn')?.addEventListener('click', submitTicket);
    
    // Star Rating Logic
    document.querySelectorAll('.star').forEach(star => {
        star.addEventListener('click', (e) => {
            const rating = e.target.dataset.rating;
            document.querySelectorAll('.star').forEach(s => {
                s.textContent = s.dataset.rating <= rating ? '★' : '☆';
            });
            document.getElementById('review-stars').dataset.selected = rating;
        });
    });
}

async function loadOrderData() {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('id');
    const supabase = window.supabase;

    if (!orderId) {
        document.querySelector('.max-w-7xl').innerHTML = "<div class='p-8 text-center text-red-500'>Error: No Order ID provided.</div>";
        return;
    }
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        window.location.href = 'index.html'; 
        return;
    }

    const { data: order, error } = await supabase
        .from('orders')
        .select(`
            *, 
            order_items(
                quantity, 
                unit_price, 
                products(id, name, image_url, game_key)
            )
        `)
        .eq('id', orderId)
        .eq('user_id', user.id)
        .single();

    if (error || !order) {
        console.error("Error fetching order or access denied:", error);
        document.querySelector('.max-w-7xl').innerHTML = "<div class='p-8 text-center text-red-500'>Error: Order not found or access denied.</div>";
        return;
    }
    
    currentOrderDetails = order;
    renderOrderDetails(order);
}

function renderOrderDetails(order) {
    if (!order || !order.order_items || order.order_items.length === 0) return;

    const orderItem = order.order_items[0];
    const product = orderItem.products;
    
    // Sanitize Data
    const safeProductName = window.escapeHtml(product.name);
    const safeOrderId = window.escapeHtml(order.id);
    const safePaymentMethod = window.escapeHtml(order.payment_method);
    const safeGameUid = window.escapeHtml(order.game_uid);
    const safeServer = window.escapeHtml(order.server_region || 'N/A');
    const orderDate = new Date(order.created_at).toLocaleString();

    // Status Logic
    const statusConfig = {
        completed: { color: 'text-green-600', bg: 'bg-green-100', icon: '✓', text: 'Order Completed' },
        processing: { color: 'text-blue-600', bg: 'bg-blue-100', icon: '⚙️', text: 'Processing' },
        verifying: { color: 'text-yellow-600', bg: 'bg-yellow-100', icon: '⏳', text: 'Verifying Payment' },
        cancelled: { color: 'text-gray-600', bg: 'bg-gray-100', icon: '✕', text: 'Cancelled' },
        refunded: { color: 'text-red-600', bg: 'bg-red-100', icon: '↩️', text: 'Refunded' }
    };
    const status = statusConfig[order.status] || statusConfig.processing;

    // Render Status Card
    const statusCard = document.getElementById('order-status-card');
    if (statusCard) {
        statusCard.innerHTML = `
            <div class="flex items-center gap-3 mb-4">
                <div class="w-12 h-12 ${status.bg} rounded-full flex items-center justify-center"><span class="text-2xl ${status.color}">${status.icon}</span></div>
                <div><h2 class="text-2xl font-bold ${status.color}">${status.text}</h2><p class="text-gray-600">Thank you for your purchase.</p></div>
            </div>
            <div class="border-t pt-4">
                <div class="flex flex-col sm:flex-row items-center justify-between">
                    <div class="flex items-center gap-4 mb-4 sm:mb-0">
                        <div class="w-20 h-20 bg-gray-200 rounded-lg flex items-center justify-center text-4xl relative flex-shrink-0 overflow-hidden">
                            ${product.image_url ? `<img src="${product.image_url}" class="w-full h-full object-cover">` : '💎'}
                            <span class="absolute bottom-1 right-1 bg-gray-700 text-white text-xs px-1 rounded">x${orderItem.quantity}</span>
                        </div>
                        <div>
                            <h3 class="font-bold text-lg">${safeProductName}</h3>
                            <p class="text-gray-600">S$${parseFloat(orderItem.unit_price).toFixed(2)} x ${orderItem.quantity}</p>
                        </div>
                    </div>
                    <div class="text-right"><div class="text-2xl font-bold">S$${parseFloat(order.total_amount).toFixed(2)}</div></div>
                </div>
            </div>`;
    }

    // Render Info Card
    const infoCard = document.getElementById('order-info-card');
    if (infoCard) {
        infoCard.innerHTML = `
            <h3 class="text-xl font-bold mb-6">Order Information</h3>
            <div class="space-y-3">
                <div class="flex flex-col sm:flex-row justify-between"><span class="text-gray-600">Order Number:</span><span class="font-semibold break-all">${safeOrderId}</span></div>
                <div class="flex flex-col sm:flex-row justify-between"><span class="text-gray-600">Created at:</span><span class="font-semibold">${orderDate}</span></div>
                <div class="flex flex-col sm:flex-row justify-between"><span class="text-gray-600">Payment Method:</span><span class="font-semibold">${safePaymentMethod}</span></div>
                <div class="flex flex-col sm:flex-row justify-between"><span class="text-gray-600">Game UID:</span><span class="font-semibold">${safeGameUid}</span></div>
                <div class="flex flex-col sm:flex-row justify-between"><span class="text-gray-600">Server:</span><span class="font-semibold">${safeServer}</span></div>
            </div>`;
    }

    // Render Buttons
    const actionButtons = document.getElementById('action-buttons');
    if (actionButtons) {
        actionButtons.innerHTML = `
            <button id="btn-service" class="flex-1 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-semibold">Customer Service</button>
            <button id="btn-purchase-again" class="flex-1 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-semibold">Purchase Again</button>
            <button id="btn-review" class="flex-1 px-6 py-3 bg-yellow-400 hover:bg-yellow-500 rounded-lg font-semibold">Post a review</button>`;
            
        // Attach listeners explicitly (Safer than inline onclick)
        document.getElementById('btn-service').addEventListener('click', openServiceModal);
        document.getElementById('btn-purchase-again').addEventListener('click', purchaseAgain);
        document.getElementById('btn-review').addEventListener('click', openReviewModal);
    }
}

function purchaseAgain() {
    if (!currentOrderDetails || !currentOrderDetails.order_items[0]) return;

    const orderItem = currentOrderDetails.order_items[0];
    const product = orderItem.products;

    const repurchaseData = {
        gameKey: product.game_key,
        productId: product.id,
        uid: currentOrderDetails.game_uid,
        server: currentOrderDetails.server_region,
        quantity: orderItem.quantity
    };

    sessionStorage.setItem('repurchaseData', JSON.stringify(repurchaseData));
    window.location.href = 'topup-page.html';
}

// --- Modal Functions ---

function openReviewModal() { document.getElementById('review-modal')?.classList.remove('hidden'); }
function closeReviewModal() { document.getElementById('review-modal')?.classList.add('hidden'); }

function openServiceModal() { document.getElementById('service-modal')?.classList.remove('hidden'); }
function closeServiceModal() { document.getElementById('service-modal')?.classList.add('hidden'); }

async function submitReview() {
    const selected = document.getElementById('review-stars').dataset.selected || 0;
    const comment = document.getElementById('review-comment').value;
    
    if (selected == 0) { alert("Please select a star rating."); return; }
    
    // Logic to submit review to Supabase would go here...
    // For now, just close modal
    window.showToast("Review submitted successfully!");
    closeReviewModal();
}

async function submitTicket() {
    const content = document.getElementById('service-question').value;
    if(!content.trim()) { alert("Please enter your question."); return; }
    
    // Logic to submit ticket would go here...
    window.showToast("Ticket submitted successfully!");
    closeServiceModal();
}