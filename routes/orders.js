/**
 * routes/orders.js
 * Express router for all /api/orders endpoints.
 * Uses validator to validate incoming payloads.
 */

const express = require('express');
const fs      = require('fs');
const path    = require('path');
const { validateOrderBody } = require('../validators/orders');

const router     = express.Router();
const ORDERS_FILE = path.join(__dirname, '..', 'orders.json');

function readOrders()         { return JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf-8')); }
function writeOrders(orders)  { fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2)); }

function normalizeOrderItems(items) {
    const normalized = {};
    for (const key of Object.keys(items)) {
        const cleanName = String(key).trim();
        if (!cleanName) continue;

        const existing = normalized[cleanName];
        const quantity = Number(items[key].quantity || 0);
        const price = Number(items[key].price || 0);

        if (existing) {
            // Merge quantities when duplicate names appear (after trimming)
            normalized[cleanName].quantity = existing.quantity + quantity;
        } else {
            normalized[cleanName] = {
                quantity: Number.isFinite(quantity) ? quantity : 0,
                price: Number.isFinite(price) ? price : 0,
            };
        }
    }
    return normalized;
}

// ──────────────────────────────────────────────────────────────────
// GET /api/orders
// Supports ?search=&dateFilter=today|7days&sort=asc|desc
// ──────────────────────────────────────────────────────────────────
router.get('/', (req, res, next) => {
    try {
        let orders = readOrders();
        const { search, dateFilter, sort } = req.query;

        if (dateFilter) {
            const now   = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            orders = orders.filter(o => {
                const d = new Date(o.timestamp);
                if (dateFilter === 'today') return d >= today;
                if (dateFilter === '7days') {
                    const week = new Date(today);
                    week.setDate(week.getDate() - 6);
                    return d >= week;
                }
                return true;
            });
        }

        if (search) {
            const q = search.toLowerCase();
            orders = orders.filter(o => {
                const idMatch   = String(o.id).includes(q);
                const itemMatch = Object.keys(o.items || {}).some(k => k.toLowerCase().includes(q));
                return idMatch || itemMatch;
            });
        }

        if (sort === 'asc' || sort === 'desc') {
            orders = [...orders].sort((a, b) => {
                const va = parseFloat(a.finalTotal || a.grandTotal || 0);
                const vb = parseFloat(b.finalTotal || b.grandTotal || 0);
                return sort === 'asc' ? va - vb : vb - va;
            });
        }

        res.json(orders);
    } catch (err) {
        next(err);
    }
});

// ──────────────────────────────────────────────────────────────────
// POST /api/orders
// Validates payload with validateOrderBody() before saving.
// ──────────────────────────────────────────────────────────────────
router.post('/', (req, res, next) => {
    try {
        // Server-side validation (security layer)
        const { valid, message } = validateOrderBody(req.body);
        if (!valid) {
            return res.status(400).json({ success: false, message });
        }

        const {
            items,
            subtotal,
            discount       = 0,
            discountType   = 'percent',
            discountAmount = 0,
            gstEnabled     = false,
            gstRate        = 18,
            gstAmount      = 0,
            finalTotal,
        } = req.body;

        const normalizedItems = normalizeOrderItems(items);
        if (Object.keys(normalizedItems).length === 0) {
            return res.status(400).json({ success: false, message: 'Order items cannot be empty after normalization.' });
        }

        const orders   = readOrders();
        const newOrder = {
            id:             Date.now(),
            timestamp:      new Date().toISOString(),
            items:          normalizedItems,
            subtotal:       parseFloat(subtotal).toFixed(2),
            discount:       parseFloat(discount).toFixed(2),
            discountType,
            discountAmount: parseFloat(discountAmount).toFixed(2),
            gstEnabled:     Boolean(gstEnabled),
            gstRate:        gstEnabled ? parseFloat(gstRate) : 0,
            gstAmount:      parseFloat(gstAmount).toFixed(2),
            finalTotal:     parseFloat(finalTotal).toFixed(2),
            grandTotal:     parseFloat(finalTotal).toFixed(2),
        };

        orders.push(newOrder);
        writeOrders(orders);

        res.status(201).json({ success: true, order: newOrder });
    } catch (err) {
        next(err);
    }
});

// ──────────────────────────────────────────────────────────────────
// DELETE /api/orders/:id
// ──────────────────────────────────────────────────────────────────
router.delete('/:id', (req, res, next) => {
    const orderId = parseInt(req.params.id, 10);
    if (isNaN(orderId)) {
        return res.status(400).json({ success: false, message: 'Invalid order ID.' });
    }
    try {
        let orders       = readOrders();
        const initial    = orders.length;
        orders           = orders.filter(o => o.id !== orderId);
        if (orders.length === initial) {
            return res.status(404).json({ success: false, message: 'Order not found.' });
        }
        writeOrders(orders);
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
