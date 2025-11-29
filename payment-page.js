const API_BASE_URL = 'https://ninja-flask-backend.onrender.com';

let paymentState = {
    order: null,
    selectedMethod: null,
    paymentMethods: [],
    modalSelectedServer: '',
    modalSelectedServerName: '',
    appliedCoupon: null,
    userCoupons: [] 
};

let modalDebounceTimer;
let countdownInterval;

const UID_SERVER_ID_GAMES = ['mobile-legends'];
const UID_SERVER_REGION_GAMES = [
    'genshin-impact', 'honkai-star-rail', 'zenless-zone-zero', 'love-and-deepspace',
    'identity-v', 'snowbreak-containment-zone', 'ragnarok-origin', 'magic-chess-go-go'
];

const isUidAndServerIdGame = (gameKey) => UID_SERVER_ID_GAMES.includes(gameKey);
const isUidAndServerRegionGame = (gameKey) => UID_SERVER_REGION_GAMES.includes(gameKey);

document.addEventListener('DOMContentLoaded', () => {
    loadOrderData();
    setupEventListeners();
    fetchUserCoupons();
});

async function loadOrderData() {
    if (sessionStorage.getItem('pendingOrderId')) {
        showPaymentPendingModal();
        return;
    }

    const orderData = sessionStorage.getItem('currentOrder');
    const orderExpiry = sessionStorage.getItem('orderExpiry');

    if (!orderData || !orderExpiry || Date.now() >= parseInt(orderExpiry)) {
        sessionStorage.removeItem('currentOrder');
        sessionStorage.removeItem('orderExpiry');
        window.location.href = 'index.html';
        return;
    }

    paymentState.order = JSON.parse(orderData);

    const { data, error } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('is_active', true)
        .order('name');

    if (error || !data) {
        document.getElementById('payment-methods-container').innerHTML = `<p class="text-red-500">Could not load payment options.</p>`
        return;
    }
    paymentState.paymentMethods = data;
    if (data.length > 0 && !paymentState.selectedMethod) {
        paymentState.selectedMethod = data[0];
    }
    
    updateAllUI();
    startCountdown(parseInt(orderExpiry));
}

async function fetchUserCoupons() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        return; 
    }

    const { data, error } = await supabase
        .from('user_coupons')
        .select('*, coupons(*)')
        .eq('user_id', session.user.id)
        .eq('status', 'active');

    if (data) {
        const now = new Date();
        paymentState.userCoupons = data.filter(uc => 
            uc.coupons && 
            uc.coupons.is_active && 
            (!uc.coupons.expiry_date || new Date(uc.coupons.expiry_date) > now)
        );
    }
}

function showPaymentPendingModal() {
    const modal = document.getElementById('payment-pending-modal');
    const amountEl = document.getElementById('pending-payment-amount');
    const totalAmount = sessionStorage.getItem('lastGatewayTotal');

    if(amountEl && totalAmount) {
        amountEl.textContent = `S$${parseFloat(totalAmount).toFixed(2)}`;
    }

    modal.classList.remove('hidden');

    document.getElementById('go-to-payment-btn').onclick = () => {
        window.location.href = 'payment-gateway.html';
    };
    
    document.getElementById('change-method-btn').onclick = () => {
        sessionStorage.removeItem('pendingOrderId');
        sessionStorage.removeItem('lastGatewayTotal');
        window.location.href = 'index.html';
    };
}

function startCountdown(expiryTime) {
    clearInterval(countdownInterval);

    const minutesEl = document.getElementById('countdown-minutes');
    const secondsEl = document.getElementById('countdown-seconds');
    const payNowBtn = document.getElementById('pay-now-btn');
    const countdownContainer = document.getElementById('countdown-container');

    const updateTimer = () => {
        const remainingTime = expiryTime - Date.now();

        if (remainingTime <= 0) {
            clearInterval(countdownInterval);
            countdownContainer.innerHTML = '<div class="text-red-500 font-bold text-lg">Order Expired</div>';
            if (payNowBtn) {
                payNowBtn.disabled = true;
                payNowBtn.classList.add('bg-gray-300', 'cursor-not-allowed');
                payNowBtn.classList.remove('bg-yellow-400', 'hover:bg-yellow-500');
            }
            sessionStorage.removeItem('currentOrder');
            sessionStorage.removeItem('orderExpiry');
            return;
        }

        const minutes = Math.floor((remainingTime / 1000) / 60);
        const seconds = Math.floor((remainingTime / 1000) % 60);

        minutesEl.textContent = String(minutes).padStart(2, '0');
        secondsEl.textContent = String(seconds).padStart(2, '0');
    };

    updateTimer();
    countdownInterval = setInterval(updateTimer, 1000);
}

function updateAllUI() {
    if (!paymentState.order) return;
    const order = paymentState.order;
    const price = parseFloat(order.product.price);
    const quantity = parseInt(order.quantity);
    const subtotal = price * quantity;

    let discount = 0;
    const discountRow = document.getElementById('discount-row');
    const couponInput = document.getElementById('coupon-input');
    const redeemBtn = document.getElementById('redeem-btn');

    if (paymentState.appliedCoupon && paymentState.appliedCoupon.coupons) {
        const coupon = paymentState.appliedCoupon.coupons;
        if (coupon.discount_type === 'percentage') {
            discount = subtotal * (coupon.discount_value / 100);
        } else {
            discount = coupon.discount_value;
        }
        discount = Math.min(subtotal, discount);

        discountRow.classList.remove('hidden');
        document.getElementById('sidebar-discount').textContent = discount.toFixed(2);
        couponInput.value = coupon.code;
        couponInput.disabled = true;
        redeemBtn.textContent = 'Remove';
        redeemBtn.classList.remove('bg-gray-200', 'text-gray-700');
        redeemBtn.classList.add('bg-red-100', 'text-red-600');

    } else {
        discountRow.classList.add('hidden');
        couponInput.disabled = false;
        redeemBtn.textContent = 'Redeem';
        redeemBtn.classList.add('bg-gray-200', 'text-gray-700');
        redeemBtn.classList.remove('bg-red-100', 'text-red-600');
    }

    const discountedSubtotal = subtotal - discount;

    const feeLabel = document.getElementById('fee-label');
    let fee = 0;
    let feeRate = 0;
    if (paymentState.selectedMethod && paymentState.selectedMethod.fee_is_active) {
        feeRate = paymentState.selectedMethod.fee_rate;
        fee = discountedSubtotal * (feeRate / 100);
    }
    feeLabel.textContent = `Payment Fee (${feeRate}%)`;

    const total = discountedSubtotal + fee;
    const points = Math.floor(discountedSubtotal);

    document.getElementById('product-name').textContent = order.product.name;
    document.getElementById('product-price').textContent = subtotal.toFixed(2);
    document.getElementById('quantity-display').value = quantity;
    document.getElementById('uid-display').textContent = order.uid;

    const serverDisplay = document.getElementById('server-display');
    if (order.server) {
        serverDisplay.textContent = order.serverName || order.server;
        serverDisplay.parentElement.style.display = 'block';
    } else {
        serverDisplay.parentElement.style.display = 'none';
    }

    document.getElementById('sidebar-price').textContent = subtotal.toFixed(2);
    document.getElementById('sidebar-fee').textContent = fee.toFixed(2);
    document.getElementById('sidebar-points').textContent = points;
    document.getElementById('sidebar-points-value').textContent = (points * 0.01).toFixed(2);
    document.getElementById('sidebar-total').textContent = total.toFixed(2);

    renderPaymentMethods();
}

function renderPaymentMethods() {
    const container = document.getElementById('payment-methods-container');
    if (!paymentState.paymentMethods) return;

    container.innerHTML = paymentState.paymentMethods.map(method => {
        const subtotal = parseFloat(paymentState.order.product.price) * parseInt(paymentState.order.quantity);

        let discount = 0;
        if (paymentState.appliedCoupon && paymentState.appliedCoupon.coupons) {
            const coupon = paymentState.appliedCoupon.coupons;
            if (coupon.discount_type === 'percentage') {
                discount = subtotal * (coupon.discount_value / 100);
            } else {
                discount = coupon.discount_value;
            }
            discount = Math.min(subtotal, discount);
        }
        const discountedSubtotal = subtotal - discount;

        let fee = 0;
        if (method.fee_is_active) {
            fee = discountedSubtotal * (method.fee_rate / 100);
        }
        const methodTotal = discountedSubtotal + fee;

        return `
        <div class="payment-method ${paymentState.selectedMethod && method.id === paymentState.selectedMethod.id ? 'selected' : ''}" data-method-id="${method.id}">
            <div class="flex items-center gap-3">
                <img src="${method.icon_url || 'https://via.placeholder.com/32'}" class="w-8 h-8 object-contain">
                <div class="radio-circle"></div>
                <span>${window.escapeHtml(method.name)}</span>
            </div>
            <span class="font-bold text-lg">SGD S$${methodTotal.toFixed(2)}</span>
        </div>`;
    }).join('');

    document.querySelectorAll('.payment-method').forEach(option => {
        option.addEventListener('click', () => selectPaymentMethod(option.dataset.methodId));
    });
}

function setupEventListeners() {
    document.getElementById('modify-btn').addEventListener('click', openModifyModal);
    document.getElementById('close-modify-modal').addEventListener('click', closeModifyModal);
    document.getElementById('modal-confirm-btn').addEventListener('click', saveModifiedDetails);

    document.getElementById('qty-minus').addEventListener('click', () => updateQuantity(-1));
    document.getElementById('qty-plus').addEventListener('click', () => updateQuantity(1));

    document.getElementById('pay-now-btn').addEventListener('click', processPayment);

    document.getElementById('redeem-btn').addEventListener('click', async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            if (window.showAuthModal) window.showAuthModal(); 
            else alert("Please log in to use coupons.");
            return;
        }

        if (paymentState.appliedCoupon) {
            removeCoupon();
        } else {
            applyCoupon();
        }
    });

    const selectCouponBtn = document.getElementById('select-coupon-modal-btn');
    if(selectCouponBtn) {
        selectCouponBtn.addEventListener('click', openCouponModal);
    }
    
    document.getElementById('close-coupon-modal').addEventListener('click', () => {
        document.getElementById('coupon-selection-modal').classList.add('hidden');
    });

    document.getElementById('modal-server-button').addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('modal-server-menu').style.display = 'block';
    });

    document.getElementById('modal-uid-input').addEventListener('input', triggerModalValidation);
    document.getElementById('modal-server-id-input').addEventListener('input', triggerModalValidation);

    document.addEventListener('click', () => {
        const menu = document.getElementById('modal-server-menu');
        if (menu) menu.style.display = 'none';
    });
}

async function openCouponModal() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        if (window.showAuthModal) window.showAuthModal();
        else alert("Please log in to see your coupons.");
        return;
    }

    const modal = document.getElementById('coupon-selection-modal');
    const listContainer = document.getElementById('available-coupons-list');
    modal.classList.remove('hidden');
    listContainer.innerHTML = '<div class="text-center text-gray-500 py-4">Loading coupons...</div>';

    await fetchUserCoupons();

    const currentSubtotal = parseFloat(paymentState.order.product.price) * parseInt(paymentState.order.quantity);
    const coupons = paymentState.userCoupons;

    if (coupons.length === 0) {
        listContainer.innerHTML = '<div class="text-center text-gray-500 py-4">No active coupons available.</div>';
        return;
    }

    listContainer.innerHTML = coupons.map(uc => {
        const coupon = uc.coupons;
        const isUsable = currentSubtotal >= coupon.min_order_value;
        const opacityClass = isUsable ? '' : 'opacity-50 cursor-not-allowed';
        const bgClass = isUsable ? 'hover:bg-gray-50 cursor-pointer' : 'bg-gray-100';
        
        return `
        <div class="coupon-item border rounded-lg p-3 flex justify-between items-center ${bgClass} ${opacityClass}" 
             data-code="${window.escapeHtml(coupon.code)}" 
             ${isUsable ? `onclick="selectCouponFromModal('${window.escapeHtml(coupon.code)}')"` : ''}>
            <div>
                <div class="font-bold text-orange-500">${window.escapeHtml(coupon.description)}</div>
                <div class="text-xs text-gray-500">Min spend: S$${coupon.min_order_value}</div>
                ${!isUsable ? `<div class="text-xs text-red-500">Order amount too low</div>` : ''}
            </div>
            <button class="text-sm font-semibold bg-gray-200 px-3 py-1 rounded ${isUsable ? 'text-black' : 'text-gray-400'}">
                Use
            </button>
        </div>`;
    }).join('');
}

window.selectCouponFromModal = (code) => {
    document.getElementById('coupon-input').value = code;
    document.getElementById('coupon-selection-modal').classList.add('hidden');
    applyCoupon(); 
};

async function applyCoupon() {
    const couponInput = document.getElementById('coupon-input');
    const redeemBtn = document.getElementById('redeem-btn');
    const code = couponInput.value.trim().toUpperCase();
    
    if (!code) {
        window.showToast('Please enter a coupon code.', 'error');
        return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    redeemBtn.disabled = true;
    redeemBtn.textContent = '...';

    let userCoupon = paymentState.userCoupons.find(uc => uc.coupons.code === code);

    if (!userCoupon) {
        const { data, error } = await supabase
            .from('user_coupons')
            .select(`*, coupons(*)`)
            .eq('user_id', session.user.id)
            .eq('status', 'active')
            .eq('coupons.code', code)
            .single();
        
        if (data) userCoupon = data;
    }

    redeemBtn.disabled = false;
    redeemBtn.textContent = 'Redeem';

    if (!userCoupon || !userCoupon.coupons || !userCoupon.coupons.is_active) {
        window.showToast('Invalid or expired coupon code.', 'error');
        return;
    }

    const subtotal = parseFloat(paymentState.order.product.price) * parseInt(paymentState.order.quantity);
    if (subtotal < userCoupon.coupons.min_order_value) {
        window.showToast(`Min spend S$${userCoupon.coupons.min_order_value.toFixed(2)} required.`, 'error');
        return;
    }

    paymentState.appliedCoupon = userCoupon;
    window.showToast('Coupon applied successfully!', 'success');
    updateAllUI();
}

function removeCoupon() {
    const couponInput = document.getElementById('coupon-input');
    
    paymentState.appliedCoupon = null;
    couponInput.value = '';
    window.showToast('Coupon removed.', 'info');
    updateAllUI();
    couponInput.disabled = false;
}

function selectPaymentMethod(methodId) {
    const selected = paymentState.paymentMethods.find(m => m.id == methodId);
    if (selected) {
        paymentState.selectedMethod = selected;
        updateAllUI();
    }
}

async function openModifyModal() {
    const order = paymentState.order;
    const gameKey = order.game;

    const serverIdContainer = document.getElementById('modal-server-id-container');
    const serverRegionContainer = document.getElementById('modal-server-region-container');
    const usernameContainer = document.getElementById('modal-username').parentElement;

    serverIdContainer.classList.add('hidden');
    serverRegionContainer.classList.add('hidden');
    usernameContainer.classList.add('hidden');

    document.getElementById('modal-uid-input').value = order.uid;

    if (isUidAndServerIdGame(gameKey)) {
        serverIdContainer.classList.remove('hidden');
        document.getElementById('modal-server-id-input').value = order.server || '';
    } else if (isUidAndServerRegionGame(gameKey)) {
        serverRegionContainer.classList.remove('hidden');
        await populateModalServerOptions(gameKey);
        selectModalServer(order.server, order.serverName);
    }

    document.getElementById('modify-modal').classList.remove('hidden');
    triggerModalValidation();
}

async function populateModalServerOptions(gameKey) {
    const serverMenu = document.getElementById('modal-server-menu');
    let serverList = [];

    if (gameKey === 'ragnarok-origin') {
        serverMenu.innerHTML = `<div class="p-2 text-gray-500">Loading servers...</div>`;
        try {
            const response = await fetch(`${API_BASE_URL}/ro-origin/get-servers`);
            const data = await response.json();
            if (data.status === 'success' && data.servers) {
                serverList = data.servers.map(s => ({ value: s.server_id, name: s.server_name }));
            } else {
                throw new Error('Failed to fetch servers');
            }
        } catch (error) {
            console.error("Could not fetch RO servers for modal:", error);
            serverMenu.innerHTML = `<div class="p-2 text-red-500">Error fetching servers.</div>`;
            return;
        }
    } else {
        const serverMaps = {
            'identity-v': ['Asia', 'NA-EU'],
            'love-and-deepspace': ['Asia', 'America', 'Europe'],
            'zenless-zero': ['America', 'Asia', 'Europe', 'TW/HK/MO'],
            'snowbreak-containment-zone': ['Asia', 'SEA', 'Americas', 'Europe'],
        };
        const defaultServers = ['America', 'Asia', 'Europe', 'TW,HK,MO'];
        serverList = (serverMaps[gameKey] || defaultServers).map(s => ({ value: s, name: s }));
    }

    serverMenu.innerHTML = serverList.map(server =>
        `<div class="custom-select-option" data-value="${window.escapeHtml(String(server.value))}">${window.escapeHtml(server.name)}</div>`
    ).join('');

    document.querySelectorAll('#modal-server-menu .custom-select-option').forEach(option => {
        option.addEventListener('click', function() {
            selectModalServer(this.dataset.value, this.textContent);
            triggerModalValidation();
        });
    });
}

function closeModifyModal() {
    document.getElementById('modify-modal').classList.add('hidden');
}

function selectModalServer(value, name = null) {
    paymentState.modalSelectedServer = value;
    paymentState.modalSelectedServerName = name || value;
    document.getElementById('modal-server-selected-text').textContent = name || value || 'Select Server';
    document.querySelectorAll('#modal-server-menu .custom-select-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.value === value);
    });
    const menu = document.getElementById('modal-server-menu');
    if (menu) menu.style.display = 'none';
}

function triggerModalValidation() {
    clearTimeout(modalDebounceTimer);
    modalDebounceTimer = setTimeout(validateInModal, 500);
}

async function validateInModal() {
    const uid = document.getElementById('modal-uid-input').value.trim();
    let gameKey = paymentState.order.game;

    const serverId = document.getElementById('modal-server-id-input').value.trim();
    const serverRegion = paymentState.modalSelectedServer;

    const usernameContainer = document.getElementById('modal-username').parentElement;
    const usernameEl = document.getElementById('modal-username');
    const confirmBtn = document.getElementById('modal-confirm-btn');

    if (!uid || (isUidAndServerIdGame(gameKey) && !serverId) || (isUidAndServerRegionGame(gameKey) && !serverRegion)) {
        usernameContainer.style.display = 'none';
        confirmBtn.disabled = true;
        return;
    }

    usernameContainer.style.display = 'block';
    usernameEl.textContent = 'Validating...';
    confirmBtn.disabled = true;

    if (gameKey === 'zenless-zero') gameKey = 'zenless-zone-zero';
    if (gameKey === 'mobile-legends') gameKey = 'mobile-legends';

    let apiUrl = `${API_BASE_URL}/check-id/${gameKey}/${uid}/`;
    if (isUidAndServerIdGame(gameKey)) {
        apiUrl += serverId;
    } else if (isUidAndServerRegionGame(gameKey)) {
        apiUrl += serverRegion;
    }

    try {
        const response = await fetch(apiUrl);
        const data = await response.json();

        if (response.ok && data.status === 'success' && (data.username || (data.roles && data.roles.length > 0))) {
            const username = data.username || (data.roles.length === 1 ? data.roles[0].roleName : 'Role selection required');
            usernameContainer.className = 'text-sm p-2 bg-green-100 text-green-800 rounded-md';
            usernameEl.innerHTML = `<strong class="font-bold">${window.escapeHtml(username)}</strong>`;
            paymentState.order.username = username;
            confirmBtn.disabled = false;
        } else {
            throw new Error(data.message || 'Invalid details');
        }

    } catch (error) {
        usernameContainer.className = 'text-sm p-2 bg-red-100 text-red-800 rounded-md';
        usernameEl.textContent = error.message;
        confirmBtn.disabled = true;
    }
}

function saveModifiedDetails() {
    const order = paymentState.order;
    const gameKey = order.game;

    order.uid = document.getElementById('modal-uid-input').value.trim();

    if (isUidAndServerIdGame(gameKey)) {
        order.server = document.getElementById('modal-server-id-input').value.trim();
        order.serverName = order.server;
    } else if (isUidAndServerRegionGame(gameKey)) {
        order.server = paymentState.modalSelectedServer;
        order.serverName = paymentState.modalSelectedServerName;
    } else {
        order.server = null;
        order.serverName = null;
    }

    sessionStorage.setItem('currentOrder', JSON.stringify(order));
    updateAllUI();
    closeModifyModal();
}

function updateQuantity(change) {
    if (!paymentState.order) return;
    let quantity = parseInt(paymentState.order.quantity);
    if (quantity + change >= 1) {
        quantity += change;
        paymentState.order.quantity = quantity;
        sessionStorage.setItem('currentOrder', JSON.stringify(paymentState.order));
        updateAllUI();
    }
}

async function processPayment() {
    clearInterval(countdownInterval);
    const processingModal = document.getElementById('processing-modal');

    const showProcessingMessage = (message) => {
        processingModal.classList.remove('hidden');
        processingModal.innerHTML = `<div class="bg-white rounded-lg p-8 max-w-sm w-full mx-4 text-center"><div class="w-16 h-16 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mb-4 mx-auto"></div><h3 class="text-xl font-semibold mb-2">${window.escapeHtml(message)}</h3><p class="text-gray-600 mb-4">Please wait...</p><div class="loading-progress rounded-full"></div></div>`;
    };

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            if (window.showAuthModal) window.showAuthModal();
            else alert("You must be logged in to place an order.");
            return;
        }
        
        const remitterName = document.getElementById('remitter-name-input').value.trim();
        if (!remitterName) {
            window.showCustomAlert('Missing Information', 'Please enter your full name as per your bank account to proceed.');
            return;
        }

        if (!paymentState.order) {
            throw new Error("Order data is missing. Please restart the checkout process.");
        }

        showProcessingMessage("Creating Secure Order...");
        
        sessionStorage.removeItem('pendingOrderId');

        const order = paymentState.order;
        // const subtotal = parseFloat(order.product.price) * parseInt(order.quantity);
        // let discount = 0;
        const userCoupon = paymentState.appliedCoupon;
        let couponDetails = null;

        if (userCoupon && userCoupon.coupons) {
            couponDetails = userCoupon.coupons;
            // discount = couponDetails.discount_type === 'percentage'
            //     ? subtotal * (couponDetails.discount_value / 100)
            //     : couponDetails.discount_value;
            // discount = Math.min(subtotal, discount);
        }

        // const discountedSubtotal = subtotal - discount;
        // let fee = 0;
        // if (paymentState.selectedMethod && paymentState.selectedMethod.fee_is_active) {
        //     fee = discountedSubtotal * (paymentState.selectedMethod.fee_rate / 100);
        // }
        // const finalAmount = discountedSubtotal + fee;

        const orderItemsPayload = [{
            product_id: parseInt(order.product.id),
            quantity: parseInt(order.quantity)
            // unit_price: order.product.price
        }];

        const { data, error: rpcError } = await supabase.rpc('create_order_and_cancel_pending', {
            p_user_id: session.user.id,
            // p_total_amount: finalAmount,
            // p_currency: 'SGD',
            p_payment_method: paymentState.selectedMethod.name,
            p_game_uid: order.uid,
            p_server_region: order.serverName || order.server,
            p_game_nickname: order.username,
            p_coupon_code: couponDetails ? couponDetails.code : null,
            // p_discount_amount: discount,
            p_remitter_name: remitterName,
            p_order_items: orderItemsPayload
        });

        if (rpcError) throw new Error(`Order creation failed: ${rpcError.message}`);
        
        const newOrderUuid = data.id; 
        const verifiedTotalAmount = data.total; 
        
        const { data: orderRow } = await supabase
            .from('orders')
            .select('readable_id')
            .eq('id', newOrderUuid)
            .single();
            
        const displayId = orderRow ? orderRow.readable_id : newOrderUuid; 

        if (userCoupon) {
            // Note: Coupon status update is now handled in the RPC
            // await supabase.from('user_coupons').update({ status: 'used' }).eq('id', userCoupon.id);
        }

        showProcessingMessage("Generating PayNow QR...");

        const backendResponse = await fetch(`${API_BASE_URL}/create-paynow-qr`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_id: newOrderUuid, amount: verifiedTotalAmount })
        });

        if (!backendResponse.ok) {
            const errorText = await backendResponse.text();
            throw new Error(`QR generation failed: ${errorText}`);
        }

        const qrData = await backendResponse.json();

        sessionStorage.setItem('pendingOrderId', newOrderUuid);
        sessionStorage.setItem('lastGatewayTotal', verifiedTotalAmount);
        sessionStorage.setItem('paymentExpiryTimestamp', qrData.expiry_timestamp);
        sessionStorage.setItem('paymentQRCodeData', qrData.qr_code_data);
        sessionStorage.setItem('paymentOrderId', newOrderUuid);
        sessionStorage.setItem('paymentTotalAmount', verifiedTotalAmount);
        sessionStorage.setItem('paymentReferenceId', qrData.reference_id);
        
        sessionStorage.setItem('paymentReadableId', displayId);

        sessionStorage.removeItem('currentOrder');
        sessionStorage.removeItem('orderExpiry');

        window.location.href = 'payment-gateway.html';

    } catch (error) {
        console.error("Payment processing error:", error);
        window.showToast(`Error: ${error.message}`, 'error');
        processingModal.classList.add('hidden');
        if(paymentState.order) {
             const expiry = sessionStorage.getItem('orderExpiry');
             if(expiry) startCountdown(parseInt(expiry));
        }
    }
}