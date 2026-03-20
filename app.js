/**
 * Voice-Based Billing System — Frontend Logic
 * SPA with 3 pages: Home, New Order, Transactions
 * Features: GST toggle, Discount, Print/PDF, TX Filters
 */

// ===========================
//  STATE
// ===========================
let menu = {};
let billItems = {};
let isListening = false;
let recognition;

// Billing extras
let gstEnabled = false;
const GST_RATE = 0.18;
let discountValue = 0;
let discountType = 'percent'; // 'percent' | 'fixed'

// All orders cache for client-side filtering
let allOrders = [];

// Always point API calls at the Express server
const SERVER_BASE = (location.protocol === 'file:') ? 'http://localhost:3001' : '';

// Number words for voice NLP
const numberWords = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
    "a": 1, "an": 1, "the": 1
};

// ===========================
//  DOM REFS
// ===========================
const micBtn = document.getElementById('mic-btn');
const transcriptEl = document.getElementById('transcript');
const langBadge = document.getElementById('recognition-lang');
const billBody = document.getElementById('bill-body');
const subtotalEl = document.getElementById('subtotal-el');
const grandTotalEl = document.getElementById('grand-total');
const itemCountLabel = document.getElementById('item-count-label');
const clearBtn = document.getElementById('clear-btn');
const cancelBtn = document.getElementById('cancel-btn');
const submitBtn = document.getElementById('submit-btn');
const quickMenuGrid = document.getElementById('quick-menu-grid');
const transactionsContent = document.getElementById('transactions-content');
const refreshTxBtn = document.getElementById('refresh-transactions-btn');
const toastEl = document.getElementById('toast');

// Billing extras DOM
const gstToggle = document.getElementById('gst-toggle');
const gstStatusText = document.getElementById('gst-status-text');
const gstRowDisplay = document.getElementById('gst-row-display');
const gstAmountEl = document.getElementById('gst-amount-el');
const discountInput = document.getElementById('discount-input');
const discountRowDisplay = document.getElementById('discount-row-display');
const discountAmountEl = document.getElementById('discount-amount-el');
const discountPctBtn = document.getElementById('discount-pct-btn');
const discountFixedBtn = document.getElementById('discount-fixed-btn');
const printBtn = document.getElementById('print-btn');
const pdfBtn = document.getElementById('pdf-btn');

// Home stats
const statCartItems = document.getElementById('stat-cart-items');
const statCartTotal = document.getElementById('stat-cart-total');
const statOrderCount = document.getElementById('stat-order-count');

// TX filter
const txSearch = document.getElementById('tx-search');
const txDateFilter = document.getElementById('tx-date-filter');
const txSort = document.getElementById('tx-sort');

// Dashboard refs
const dashTotalSales = document.getElementById('dash-total-sales');
const dashTotalOrders = document.getElementById('dash-total-orders');
const dashAvgValue = document.getElementById('dash-avg-value');
const dashTopItems = document.getElementById('dash-top-items');
const refreshDashboardBtn = document.getElementById('refresh-dashboard-btn');
const salesChartCtx = document.getElementById('sales-chart');
let salesChartInstance = null;

// ===========================
//  ROUTER
// ===========================
const PAGES = ['home', 'order', 'transactions', 'dashboard'];

function router() {
    const hash = location.hash.replace('#', '') || 'home';
    const page = PAGES.includes(hash) ? hash : 'home';

    document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
    const target = document.getElementById(`page-${page}`);
    if (target) target.classList.add('active');

    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.dataset.page === page);
    });

    if (page === 'home') updateHomeStats();
    if (page === 'transactions') fetchTransactions();
    if (page === 'dashboard') fetchDashboard();
}

document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-page]');
    if (link) {
        const page = link.dataset.page;
        if (PAGES.includes(page)) {
            history.pushState(null, '', `#${page}`);
            router();
            e.preventDefault();
        }
    }
});

window.addEventListener('popstate', router);

// ===========================
//  INIT
// ===========================
async function init() {
    await requestMicPermission();
    await fetchMenu();
    setupSpeechRecognition();
    renderBill();

    // Initialize Lucide icons
    if (window.lucide) window.lucide.createIcons();

    // Core bill controls
    clearBtn?.addEventListener('click', clearBill);
    cancelBtn?.addEventListener('click', cancelOrder);
    submitBtn?.addEventListener('click', submitOrder);
    refreshTxBtn?.addEventListener('click', fetchTransactions);
    refreshDashboardBtn?.addEventListener('click', fetchDashboard);

    // GST Toggle
    gstToggle?.addEventListener('change', () => {
        gstEnabled = gstToggle.checked;
        if (gstStatusText) {
            gstStatusText.textContent = gstEnabled ? 'ON' : 'OFF';
            gstStatusText.classList.toggle('on', gstEnabled);
        }
        updateTotalsDisplay();
    });

    // Discount input
    discountInput?.addEventListener('input', () => {
        let val = parseFloat(discountInput.value) || 0;
        if (val < 0) { val = 0; discountInput.value = 0; }
        // cap validation happens in updateTotalsDisplay
        discountValue = val;
        updateTotalsDisplay();
    });

    // Discount type buttons (% vs ₹)
    discountPctBtn?.addEventListener('click', () => setDiscountType('percent'));
    discountFixedBtn?.addEventListener('click', () => setDiscountType('fixed'));

    // Print / PDF
    printBtn?.addEventListener('click', printBill);
    pdfBtn?.addEventListener('click', downloadPDF);

    // TX Filters (client-side)
    txSearch?.addEventListener('input', renderFilteredTransactions);
    txDateFilter?.addEventListener('change', renderFilteredTransactions);
    txSort?.addEventListener('change', renderFilteredTransactions);

    // Mobile Drawer Toggle
    const menuToggle = document.getElementById('menu-toggle');
    const closeDrawer = document.getElementById('close-drawer');
    const mobileDrawer = document.getElementById('mobile-drawer');
    const drawerOverlay = document.getElementById('drawer-overlay');

    const toggleDrawer = (isOpen) => {
        mobileDrawer?.classList.toggle('open', isOpen);
        drawerOverlay?.classList.toggle('active', isOpen);
        document.body.style.overflow = isOpen ? 'hidden' : '';
    };

    menuToggle?.addEventListener('click', () => toggleDrawer(true));
    closeDrawer?.addEventListener('click', () => toggleDrawer(false));
    drawerOverlay?.addEventListener('click', () => toggleDrawer(false));
    document.querySelectorAll('.drawer-links .nav-link').forEach(link => {
        link.addEventListener('click', () => toggleDrawer(false));
    });

    // Boot router
    router();
}

// ===========================
//  DISCOUNT TYPE
// ===========================
function setDiscountType(type) {
    discountType = type;
    discountPctBtn?.classList.toggle('active', type === 'percent');
    discountFixedBtn?.classList.toggle('active', type === 'fixed');
    updateTotalsDisplay();
}

// ===========================
//  MIC PERMISSION
// ===========================
async function requestMicPermission() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop());
    } catch (err) {
        console.warn('Mic not granted:', err.name);
    }
}

// ===========================
//  API — MENU
// ===========================
async function fetchMenu() {
    try {
        const res = await fetch(`${SERVER_BASE}/api/menu`);
        menu = await res.json();
        renderQuickMenu();
        showToast('Menu loaded', 'success');
    } catch {
        menu = {
            burger: { price: 149, category: 'Main' },
            pizza: { price: 299, category: 'Main' },
            sandwich: { price: 99, category: 'Main' },
            pasta: { price: 199, category: 'Main' },
            salad: { price: 129, category: 'Sides' },
            fries: { price: 79, category: 'Sides' },
            soup: { price: 89, category: 'Sides' },
            coke: { price: 49, category: 'Drinks' },
            water: { price: 25, category: 'Drinks' },
            coffee: { price: 69, category: 'Drinks' },
            lemonade: { price: 59, category: 'Drinks' },
        };
        renderQuickMenu();
        showToast('Using offline menu', 'warning');
    }
}

// ===========================
//  API — ORDERS
// ===========================
async function fetchTransactions() {
    if (!transactionsContent) return;
    transactionsContent.innerHTML = '<div class="tx-empty">Loading…</div>';
    try {
        const res = await fetch(`${SERVER_BASE}/api/orders`);
        const data = await res.json();
        allOrders = Array.isArray(data) ? data : (data.orders || []);
        renderFilteredTransactions();
        updateOrderCount(allOrders.length);
    } catch {
        transactionsContent.innerHTML = '<div class="tx-empty">Could not load orders. Is the server running?</div>';
    }
}

// ===========================
//  API — DASHBOARD
// ===========================
async function fetchDashboard() {
    if (!dashTotalSales) return;
    try {
        const res = await fetch(`${SERVER_BASE}/api/dashboard`);
        if (!res.ok) throw new Error('Failed to load dashboard');
        const data = await res.json();

        dashTotalSales.textContent = `₹${data.today.totalSales.toFixed(2)}`;
        dashTotalOrders.textContent = data.today.totalOrders;
        dashAvgValue.textContent = `₹${data.today.avgOrderValue.toFixed(2)}`;

        dashTopItems.innerHTML = data.topItems.length ? data.topItems.map(t => `
            <div class="top-item-row">
                <span class="top-item-name">${capitalize(t.name)}</span>
                <span class="top-item-qty">${t.quantity} sold</span>
            </div>
        `).join('') : '<div class="tx-empty">No sales data yet</div>';

        renderSalesChart(data.dailySales);
    } catch (err) {
        console.error(err);
        showToast('Could not load dashboard data', 'error');
    }
}

function renderSalesChart(dailySales) {
    if (!salesChartCtx || !window.Chart) return;

    const chartData = [...dailySales].reverse();
    const labels = chartData.map(d => d.label);
    const data = chartData.map(d => d.sales);

    if (salesChartInstance) {
        salesChartInstance.data.labels = labels;
        salesChartInstance.data.datasets[0].data = data;
        salesChartInstance.update();
        return;
    }

    salesChartInstance = new window.Chart(salesChartCtx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Sales (₹)',
                data,
                backgroundColor: 'rgba(59, 130, 246, 0.8)',
                borderRadius: 4,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { color: '#f3f4f6' } },
                x: { grid: { display: false } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

// ===========================
//  TX FILTERS (Client-side)
// ===========================
function renderFilteredTransactions() {
    let orders = [...allOrders];

    // Date filter
    const dateVal = txDateFilter?.value || 'all';
    if (dateVal !== 'all') {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        orders = orders.filter(o => {
            const d = new Date(o.timestamp);
            if (dateVal === 'today') return d >= today;
            if (dateVal === '7days') {
                const week = new Date(today);
                week.setDate(week.getDate() - 6);
                return d >= week;
            }
            return true;
        });
    }

    // Search
    const q = (txSearch?.value || '').trim().toLowerCase();
    if (q) {
        orders = orders.filter(o => {
            const idMatch = String(o.id).includes(q);
            const itemMatch = Object.keys(o.items || {}).some(k => k.toLowerCase().includes(q));
            return idMatch || itemMatch;
        });
    }

    // Sort
    const sortVal = txSort?.value || 'newest';
    orders = [...orders].sort((a, b) => {
        if (sortVal === 'newest') return new Date(b.timestamp) - new Date(a.timestamp);
        if (sortVal === 'oldest') return new Date(a.timestamp) - new Date(b.timestamp);
        const va = parseFloat(a.finalTotal || a.grandTotal || 0);
        const vb = parseFloat(b.finalTotal || b.grandTotal || 0);
        if (sortVal === 'asc') return va - vb;
        if (sortVal === 'desc') return vb - va;
        return 0;
    });

    renderTransactionsTable(orders);
}

// ===========================
//  RENDER: TRANSACTIONS
// ===========================
function renderTransactionsTable(orders) {
    if (!transactionsContent) return;
    if (!orders.length) {
        transactionsContent.innerHTML = '<div class="tx-empty">No orders found.</div>';
        return;
    }

    const rows = orders.map(o => {
        const date = new Date(o.timestamp || Date.now());
        const timeStr = date.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
        const itemList = Object.entries(o.items)
            .map(([n, d]) => `${capitalize(n)} ×${d.quantity}`).join(', ');
        const total = o.finalTotal || o.grandTotal || '0.00';
        const orderId = String(o.id).slice(-5);
        return `
            <tr>
                <td>#${orderId}</td>
                <td><span class="tx-items">${itemList}</span></td>
                <td>₹${Number(total).toFixed(2)}</td>
                <td><span class="tx-badge completed">Completed</span></td>
                <td style="color:var(--text-muted);font-size:12px">${timeStr}</td>
                <td>
                    <button class="tx-delete-btn" onclick="deleteOrder(${o.id})" title="Delete order">✕</button>
                </td>
            </tr>`;
    }).join('');

    transactionsContent.innerHTML = `
        <table class="tx-table">
            <thead>
                <tr>
                    <th>ORDER</th>
                    <th>ITEMS</th>
                    <th>TOTAL</th>
                    <th>STATUS</th>
                    <th>TIME</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>`;
}

// ===========================
//  DELETE ORDER
// ===========================
async function deleteOrder(id) {
    if (!confirm(`Delete order #${String(id).slice(-5)}? This cannot be undone.`)) return;
    try {
        const res = await fetch(`${SERVER_BASE}/api/orders/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed');
        allOrders = allOrders.filter(o => o.id !== id);
        renderFilteredTransactions();
        updateOrderCount(allOrders.length);
        showToast('Order deleted', 'info');
    } catch {
        showToast('Could not delete order', 'error');
    }
}

// ===========================
//  SUBMIT ORDER
// ===========================
async function submitOrder() {
    if (Object.keys(billItems).length === 0) {
        showToast('Cart is empty!', 'error');
        return;
    }

    const { subtotal, discountAmt, afterDiscount, gstAmt, finalTotal } = computeTotals();

    // Frontend validation before API request
    if (subtotal < 0) {
        showToast('Subtotal cannot be negative', 'error');
        return;
    }
    if (discountValue < 0 || (discountType === 'percent' && discountValue > 100) || (discountType === 'fixed' && discountValue > subtotal)) {
        showToast('Invalid discount value', 'error');
        return;
    }

    try {
        const res = await fetch(`${SERVER_BASE}/api/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                items: billItems,
                subtotal: subtotal.toFixed(2),
                discount: discountValue,
                discountType,
                discountAmount: discountAmt.toFixed(2),
                gstEnabled,
                gstRate: gstEnabled ? 18 : 0,
                gstAmount: gstAmt.toFixed(2),
                finalTotal: finalTotal.toFixed(2),
            })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `Server error ${res.status}`);
        }

        const data = await res.json();
        showToast(`Order #${String(data.order.id).slice(-5)} completed! ₹${finalTotal.toFixed(2)}`, 'success');
        clearBill();
    } catch (err) {
        showToast(`Payment failed: ${err.message}`, 'error');
    }
}

function cancelOrder() { clearBill(); showToast('Order cancelled', 'info'); }

// ===========================
//  PRINT BILL
// ===========================
function printBill() {
    if (Object.keys(billItems).length === 0) {
        showToast('Cart is empty — nothing to print', 'warning');
        return;
    }
    window.print();
}

// ===========================
//  DOWNLOAD PDF (jsPDF)
// ===========================
function downloadPDF() {
    if (Object.keys(billItems).length === 0) {
        showToast('Cart is empty — nothing to download', 'warning');
        return;
    }
    if (!window.jspdf) { showToast('PDF library not loaded', 'error'); return; }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a5' });
    const W = doc.internal.pageSize.getWidth();
    const now = new Date();
    const dateStr = now.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
    const { subtotal, discountAmt, gstAmt, finalTotal } = computeTotals();

    let y = 14;
    const LM = 14; // left margin
    const RM = W - 14; // right edge

    // Header
    doc.setFontSize(16).setFont('helvetica', 'bold');
    doc.text('Voice Billing', W / 2, y, { align: 'center' });
    y += 7;
    doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(100);
    doc.text('Restaurant Invoice', W / 2, y, { align: 'center' });
    y += 5;
    doc.text(dateStr, W / 2, y, { align: 'center' });
    y += 7;

    // Divider
    doc.setDrawColor(220).setLineWidth(0.3).line(LM, y, RM, y);
    y += 6;

    // Column headers
    doc.setFontSize(8.5).setFont('helvetica', 'bold').setTextColor(120);
    doc.text('ITEM', LM, y);
    doc.text('QTY', LM + 60, y);
    doc.text('PRICE', LM + 80, y);
    doc.text('TOTAL', RM, y, { align: 'right' });
    y += 4;
    doc.setDrawColor(220).line(LM, y, RM, y);
    y += 5;

    // Items
    doc.setFont('helvetica', 'normal').setTextColor(30);
    Object.entries(billItems).forEach(([name, { price, quantity }]) => {
        const lineTotal = price * quantity;
        doc.setFontSize(9);
        doc.text(capitalize(name), LM, y);
        doc.text(String(quantity), LM + 60, y);
        doc.text(`₹${price.toFixed(2)}`, LM + 80, y);
        doc.text(`₹${lineTotal.toFixed(2)}`, RM, y, { align: 'right' });
        y += 6;
    });

    y += 2;
    doc.setDrawColor(220).line(LM, y, RM, y);
    y += 6;

    // Totals
    const addTotal = (label, amount, bold = false) => {
        if (bold) doc.setFont('helvetica', 'bold').setFontSize(10);
        else doc.setFont('helvetica', 'normal').setFontSize(9);
        doc.setTextColor(bold ? 20 : 80);
        doc.text(label, LM, y);
        doc.text(`₹${amount.toFixed(2)}`, RM, y, { align: 'right' });
        y += 6;
    };

    addTotal('Subtotal', subtotal);
    if (discountAmt > 0) addTotal(`Discount (${discountType === 'percent' ? discountValue + '%' : '₹' + discountValue} off)`, discountAmt);
    if (gstEnabled) addTotal('GST (18%)', gstAmt);

    y += 1;
    doc.setDrawColor(30).setLineWidth(0.5).line(LM, y, RM, y);
    y += 6;
    addTotal('TOTAL DUE', finalTotal, true);

    // Footer
    y += 6;
    doc.setFontSize(8).setFont('helvetica', 'italic').setTextColor(150);
    doc.text('Thank you for dining with us!', W / 2, y, { align: 'center' });

    doc.save(`VoiceBilling_Invoice_${Date.now()}.pdf`);
    showToast('PDF downloaded!', 'success');
}

// ===========================
//  RENDER: QUICK MENU
// ===========================
function renderQuickMenu() {
    if (!quickMenuGrid) return;
    quickMenuGrid.innerHTML = '';
    Object.entries(menu).forEach(([name, { price }]) => {
        const card = document.createElement('div');
        card.className = 'menu-item-card';
        card.innerHTML = `
            <span class="menu-item-name">${capitalize(name)}</span>
            <span class="menu-item-price">₹${Number(price).toFixed(2)}</span>
        `;
        card.addEventListener('click', () => addItem(name, 1));
        quickMenuGrid.appendChild(card);
    });
}

// ===========================
//  HOME STATS
// ===========================
function updateHomeStats() {
    if (!statCartItems) return;
    const count = Object.values(billItems).reduce((s, i) => s + i.quantity, 0);
    const { finalTotal } = computeTotals();
    statCartItems.textContent = count;
    statCartTotal.textContent = `₹${finalTotal.toFixed(2)}`;
}

function updateOrderCount(n) {
    if (statOrderCount) statOrderCount.textContent = n;
}

// ===========================
//  SPEECH RECOGNITION
// ===========================
function setupSpeechRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
        if (micBtn) { micBtn.disabled = true; micBtn.style.opacity = '0.4'; }
        return;
    }

    recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
        isListening = true;
        micBtn?.classList.add('listening');
        if (transcriptEl) transcriptEl.textContent = 'Speak now…';
        if (langBadge) { langBadge.textContent = 'Web speech (EN)'; langBadge.classList.add('active'); }
    };

    recognition.onresult = (event) => {
        let interim = '', final = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const t = event.results[i][0].transcript;
            event.results[i].isFinal ? (final += t) : (interim += t);
        }
        if (final) {
            if (transcriptEl) { transcriptEl.textContent = final; transcriptEl.style.opacity = '1'; }
            processCommand(final);
        } else if (interim) {
            if (transcriptEl) { transcriptEl.textContent = interim; transcriptEl.style.opacity = '0.6'; }
        }
    };

    recognition.onerror = (e) => {
        const msg = e.error === 'not-allowed' ? 'Mic access denied' : `Error: ${e.error}`;
        stopListening();
        showToast(msg, 'error');
    };

    recognition.onend = () => {
        if (isListening) {
            try { recognition.start(); } catch (_) { }
        } else {
            micBtn?.classList.remove('listening');
            if (langBadge) { langBadge.textContent = 'Waiting'; langBadge.classList.remove('active'); }
        }
    };

    micBtn?.addEventListener('click', () => isListening ? stopListening() : startListening());
}

function startListening() { try { recognition.start(); } catch (e) { console.error(e); } }
function stopListening() { isListening = false; recognition?.stop(); }

// ===========================
//  NLP
// ===========================
let lastCommandTime = 0;

function playBeep() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = 800; // a nice confirmation tick
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.1);
    } catch (e) { /* ignore if audio not supported */ }
}

function processCommand(text) {
    const now = Date.now();
    if (now - lastCommandTime < 1000) return; // debounce 1s
    lastCommandTime = now;

    text = text.toLowerCase().trim().replace(/[.,!?]/g, '');
    playBeep(); // Audio feedback

    // ── 1. Navigation Commands ─────────────────────────────
    if (/\b(go home|open home|show home)\b/.test(text)) {
        location.hash = '#home';
        showToast('Navigating to Home...', 'info');
        return;
    }
    if (/\b(go dashboard|open dashboard|show dashboard)\b/.test(text)) {
        location.hash = '#dashboard';
        showToast('Navigating to Dashboard...', 'info');
        return;
    }
    if (/\b(new order|open order|go to order|start order)\b/.test(text)) {
        location.hash = '#order';
        showToast('Navigating to New Order...', 'info');
        return;
    }
    if (/\b(show transactions|open transactions|go to transactions)\b/.test(text)) {
        location.hash = '#transactions';
        showToast('Navigating to Transactions...', 'info');
        return;
    }

    // ── 2. Bill Action Commands ────────────────────────────
    if (/\b(clear bill|clear all|reset|start over)\b/.test(text)) { clearBill(); return; }
    if (/\b(submit order|place order|checkout|complete payment)\b/.test(text)) { submitOrder(); return; }

    if (/\b(print bill|print the bill|print invoice)\b/.test(text)) {
        if (Object.keys(billItems).length === 0) { showToast('Cart is empty', 'warning'); return; }
        showToast('Printing bill...', 'success');
        printBill();
        return;
    }
    if (/\b(download bill|download invoice|download pdf)\b/.test(text)) {
        if (Object.keys(billItems).length === 0) { showToast('Cart is empty', 'warning'); return; }
        showToast('Downloading PDF...', 'success');
        downloadPDF();
        return;
    }
    if (/\b(add gst|apply gst|enable gst)\b/.test(text)) {
        if (gstToggle) gstToggle.checked = true;
        gstEnabled = true;
        if (gstStatusText) {
            gstStatusText.textContent = 'ON';
            gstStatusText.classList.add('on');
        }
        updateTotalsDisplay();
        showToast('GST Applied', 'success');
        return;
    }

    const discountMatch = text.match(/\b(?:apply|add) discount (\d+) percent\b/);
    if (discountMatch) {
        let val = parseInt(discountMatch[1], 10);
        if (val > 100) val = 100;
        if (discountInput) discountInput.value = val;
        discountValue = val;
        setDiscountType('percent');
        showToast(`Applied ${val}% discount`, 'success');
        return;
    }

    // ── 3. Product Addition/Removal ────────────────────────
    const isRemove = /\b(remove|delete|cancel|take off|minus|drop)\b/.test(text);

    let qty = 1;
    const numMatch = text.match(/\b(\d+)\b/);
    if (numMatch) {
        qty = parseInt(numMatch[1], 10);
    } else {
        for (const [w, v] of Object.entries(numberWords)) {
            if (new RegExp(`\\b${w}\\b`).test(text)) { qty = v; break; }
        }
    }

    const menuKeys = Object.keys(menu).sort((a, b) => b.length - a.length);
    let found = null;
    for (const item of menuKeys) {
        const plural = item.endsWith('s') ? item : item + 's';
        if (new RegExp(`\\b(${item}|${plural})\\b`).test(text)) { found = item; break; }
    }

    // ── 4. Fallback ────────────────────────────────────────
    if (!found) {
        showToast(`Command or item not recognized: "${text}"`, 'error');
        return;
    }

    isRemove ? removeItem(found, qty) : addItem(found, qty);
}

// ===========================
//  BILLING
// ===========================
function addItem(item, qty) {
    const isUpdate = !!billItems[item];
    if (isUpdate) {
        billItems[item].quantity += qty;
    } else {
        billItems[item] = { price: menu[item]?.price ?? 0, quantity: qty };
    }
    showToast(`Added ${qty}× ${capitalize(item)}`, 'success');
    renderBill(item, isUpdate ? 'updated-item' : 'new-item');
}

function removeItem(item, qty) {
    if (!billItems[item]) { showToast(`${capitalize(item)} not in cart`, 'warning'); return; }
    billItems[item].quantity -= qty;
    if (billItems[item].quantity <= 0) {
        delete billItems[item];
        showToast(`Removed ${capitalize(item)}`, 'info');
        renderBill();
    } else {
        showToast(`Removed ${qty}× ${capitalize(item)}`, 'info');
        renderBill(item, 'updated-item');
    }
}

function clearBill() {
    billItems = {};
    discountValue = 0;
    if (discountInput) discountInput.value = '';
    renderBill();
}

function computeSubtotal() {
    return Object.values(billItems).reduce((s, { quantity, price }) => s + quantity * price, 0);
}

function computeTotals() {
    const subtotal = computeSubtotal();

    // Discount
    let discountAmt = 0;
    if (discountValue > 0) {
        if (discountType === 'percent') {
            const capped = Math.min(discountValue, 100);
            discountAmt = (subtotal * capped) / 100;
        } else {
            discountAmt = Math.min(discountValue, subtotal);
        }
    }

    const afterDiscount = subtotal - discountAmt;

    // GST
    const gstAmt = gstEnabled ? afterDiscount * GST_RATE : 0;
    const finalTotal = afterDiscount + gstAmt;

    return { subtotal, discountAmt, afterDiscount, gstAmt, finalTotal };
}

// ===========================
//  RENDER: BILL
// ===========================
function renderBill(animatedItem = null, animClass = null) {
    if (!billBody) return;
    billBody.innerHTML = '';
    const items = Object.keys(billItems);
    const count = items.reduce((s, k) => s + billItems[k].quantity, 0);

    if (itemCountLabel) itemCountLabel.textContent = `${count} item${count !== 1 ? 's' : ''}`;

    if (!items.length) {
        billBody.innerHTML = `<tr class="empty-state"><td colspan="4">Cart is empty. Make a selection.</td></tr>`;
        updateTotalsDisplay();
        updateHomeStats();
        return;
    }

    items.forEach(item => {
        const { quantity, price } = billItems[item];
        const lineTotal = quantity * price;
        const tr = document.createElement('tr');
        if (item === animatedItem && animClass) tr.classList.add(animClass);
        tr.innerHTML = `
            <td>${capitalize(item)}</td>
            <td>
                <div class="qty-controls">
                    <button class="qty-btn" onclick="removeItem('${item}',1)">−</button>
                    <span class="qty-value">${quantity}</span>
                    <button class="qty-btn" onclick="addItem('${item}',1)">+</button>
                </div>
            </td>
            <td>₹${Number(price).toFixed(2)}</td>
            <td class="text-right">
                ₹${lineTotal.toFixed(2)}
                <button class="delete-btn" onclick="removeItem('${item}',999)" title="Remove">✕</button>
            </td>`;
        billBody.appendChild(tr);
    });

    updateTotalsDisplay();
    updateHomeStats();
}

function updateTotalsDisplay() {
    const { subtotal, discountAmt, gstAmt, finalTotal } = computeTotals();

    if (subtotalEl) subtotalEl.textContent = `₹${subtotal.toFixed(2)}`;

    // Discount row
    if (discountRowDisplay && discountAmountEl) {
        discountRowDisplay.style.display = discountAmt > 0 ? '' : 'none';
        discountAmountEl.textContent = `-₹${discountAmt.toFixed(2)}`;
    }

    // GST row
    if (gstRowDisplay && gstAmountEl) {
        gstRowDisplay.style.display = gstEnabled ? '' : 'none';
        gstAmountEl.textContent = `₹${gstAmt.toFixed(2)}`;
    }

    if (grandTotalEl) grandTotalEl.textContent = `₹${finalTotal.toFixed(2)}`;
}

// ===========================
//  TOAST
// ===========================
let toastTimeout = null;
function showToast(msg, type = 'info') {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.className = `toast toast-${type} show`;
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toastEl.classList.remove('show'), 3000);
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// Boot
document.addEventListener('DOMContentLoaded', init);
