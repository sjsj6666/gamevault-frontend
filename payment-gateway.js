document.addEventListener('DOMContentLoaded', () => {
    if (!window.supabase) {
        console.error('Supabase client not found.');
        return;
    }
    const supabase = window.supabase;

    // Check URL for direct order link first (e.g. refresh or direct navigation)
    const urlParams = new URLSearchParams(window.location.search);
    const urlOrderId = urlParams.get('orderId');

    // Retrieve data from session storage
    let qrCodeData = sessionStorage.getItem('paymentQRCodeData');
    let orderId = sessionStorage.getItem('paymentOrderId') || urlOrderId;
    let referenceId = sessionStorage.getItem('paymentReferenceId');
    let readableId = sessionStorage.getItem('paymentReadableId');
    let totalAmount = sessionStorage.getItem('paymentTotalAmount');
    let expiryTimestamp = sessionStorage.getItem('paymentExpiryTimestamp');

    const paymentView = document.getElementById('payment-view');
    const successView = document.getElementById('success-view');
    const qrContainer = document.getElementById('qr-code-container');
    const amountEl = document.getElementById('payment-amount');
    const orderIdEl = document.getElementById('order-id');
    const statusContainer = document.getElementById('payment-status-container');
    
    let paymentChannel = null;
    let countdownInterval = null;

    const initializePage = async () => {
        // If session data is missing but we have an order ID from URL, try to fetch status
        if ((!qrCodeData || !totalAmount) && orderId) {
            console.log("Session data missing, fetching order status for:", orderId);
            const { data: order, error } = await supabase
                .from('orders')
                .select('*')
                .eq('id', orderId)
                .single();

            if (order) {
                // If order is already completed, show success immediately
                if (['processing', 'completed', 'verifying'].includes(order.status)) {
                    showSuccessState(order.id);
                    return;
                }
                // If order is pending but we lost the QR code session data, we can't easily regenerate it
                // without calling the backend again. For security/simplicity, we show an error or
                // redirect to history.
                // However, if the user just refreshed, they might want to see the QR.
                // Since we don't store the base64 QR in DB, we guide them to history.
                alert("Payment session expired or data lost. Please check your order history.");
                window.location.href = 'account.html#buy-history';
                return;
            }
        }

        // Validation: If data is still missing, redirect home
        if (!qrCodeData || !orderId || !totalAmount || !expiryTimestamp) {
            console.warn("Missing payment session data. Redirecting...");
            window.location.href = 'index.html';
            return;
        }

        sessionStorage.setItem('paymentGatewayAccessed', 'true');

        // Render Payment Details (Sanitized)
        qrContainer.innerHTML = `<img src="${qrCodeData}" alt="PayNow QR Code" class="w-full h-auto object-contain">`;
        amountEl.textContent = `S$${parseFloat(totalAmount).toFixed(2)}`;
        orderIdEl.textContent = window.escapeHtml(readableId || referenceId || orderId);

        setupRealtimeSubscription();
        startCountdown(parseInt(expiryTimestamp));
    };

    const setupRealtimeSubscription = () => {
        paymentChannel = supabase
            .channel(`payment-status-${orderId}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` }, (payload) => {
                console.log("Payment status update:", payload.new.status);
                if (['processing', 'completed', 'verifying'].includes(payload.new.status)) {
                    showSuccessState(orderId);
                }
            })
            .subscribe();
    };

    const cleanup = () => {
        clearInterval(countdownInterval);
        if (paymentChannel) supabase.removeChannel(paymentChannel);
        
        // Clear Sensitive Session Data
        const keysToRemove = [
            'pendingOrderId', 'lastGatewayTotal', 'paymentQRCodeData', 
            'paymentOrderId', 'paymentReferenceId', 'paymentTotalAmount', 
            'paymentExpiryTimestamp', 'paymentGatewayAccessed', 'paymentReadableId'
        ];
        keysToRemove.forEach(key => sessionStorage.removeItem(key));
        
        window.removeEventListener('beforeunload', beforeUnloadHandler);
    };

    const showSuccessState = (finalOrderId) => {
        cleanup();
        paymentView.classList.add('hidden');
        successView.classList.remove('hidden');
        
        let redirectSeconds = 5; 
        
        successView.querySelector('div').innerHTML = `
            <svg class="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                <circle class="checkmark__circle" cx="26" cy="26" r="25" fill="none"/>
                <path class="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
            </svg>
            <h2 class="text-2xl font-bold text-green-600 mb-2 mt-4">Payment Confirmed!</h2>
            <p class="text-gray-500 mb-6">Your order is now being processed.</p>
            <a href="account.html?id=${window.escapeHtml(finalOrderId)}" class="mt-4 w-full inline-block bg-blue-500 text-white font-bold py-3 rounded-lg hover:bg-blue-600 transition-all">
                View Order Details (<span id="redirect-countdown">${redirectSeconds}</span>)
            </a>`;

        const redirectInterval = setInterval(() => {
            redirectSeconds--;
            const countdownEl = document.getElementById('redirect-countdown');
            if (countdownEl) countdownEl.textContent = redirectSeconds;
            if (redirectSeconds <= 0) {
                clearInterval(redirectInterval);
                window.location.href = `account.html?id=${finalOrderId}`;
            }
        }, 1000);
    };

    const startCountdown = (expiry) => {
        const minutesEl = document.getElementById('countdown-minutes');
        const secondsEl = document.getElementById('countdown-seconds');
        
        const updateTimer = () => {
            const now = Date.now();
            const remaining = expiry - now;

            if (remaining <= 0) {
                clearInterval(countdownInterval);
                if(minutesEl) minutesEl.textContent = "00";
                if(secondsEl) secondsEl.textContent = "00";
                
                if (statusContainer) {
                    statusContainer.innerHTML = `<span class="text-red-600 font-bold text-lg">QR Code Expired</span>`;
                }
                if (qrContainer) {
                    qrContainer.innerHTML = `
                        <div class="flex flex-col items-center justify-center h-full w-full bg-gray-100 border-2 border-red-200 rounded-lg text-center p-4">
                            <span class="text-red-500 font-bold text-xl mb-2">QR Invalid</span>
                            <button onclick="window.location.reload()" class="bg-white border border-red-300 text-red-500 px-4 py-2 rounded hover:bg-red-50 font-semibold">
                                Refresh to Retry
                            </button>
                        </div>
                    `;
                }
                sessionStorage.removeItem('paymentQRCodeData');
                sessionStorage.removeItem('paymentExpiryTimestamp');
                return;
            }

            const minutes = Math.floor((remaining / 1000) / 60);
            const seconds = Math.floor((remaining / 1000) % 60);
            if(minutesEl) minutesEl.textContent = String(minutes).padStart(2, '0');
            if(secondsEl) secondsEl.textContent = String(seconds).padStart(2, '0');
        };

        updateTimer();
        countdownInterval = setInterval(updateTimer, 1000);
    };

    const beforeUnloadHandler = (e) => {
        e.preventDefault();
        e.returnValue = '';
    };

    window.addEventListener('beforeunload', beforeUnloadHandler);

    document.getElementById('back-to-payment-btn').addEventListener('click', (e) => {
        e.preventDefault();
        if(confirm("Are you sure you want to cancel payment?")) {
            window.history.back();
        }
    });

    initializePage();
});