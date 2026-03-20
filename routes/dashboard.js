/**
 * routes/dashboard.js
 * GET /api/dashboard
 * Returns aggregated sales stats for today + last 7 days.
 */

const express = require('express');
const fs      = require('fs');
const path    = require('path');

const router      = express.Router();
const ORDERS_FILE = path.join(__dirname, '..', 'orders.json');

function readOrders() { return JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf-8')); }

router.get('/', (req, res, next) => {
    try {
        const all  = readOrders();
        const now  = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // ── TODAY stats ────────────────────────────────────────────
        const todayOrders = all.filter(o => new Date(o.timestamp) >= todayStart);

        const totalSalesToday = todayOrders.reduce(
            (sum, o) => sum + parseFloat(o.finalTotal || o.grandTotal || 0), 0
        );
        const totalOrdersToday = todayOrders.length;
        const avgOrderValue    = totalOrdersToday > 0
            ? totalSalesToday / totalOrdersToday : 0;

        // ── TOP SELLING ITEMS (all-time) ───────────────────────────
        const itemTotals = {};
        for (const order of all) {
            for (const [name, data] of Object.entries(order.items || {})) {
                const qty = Number(data.quantity) || 0;
                itemTotals[name] = (itemTotals[name] || 0) + qty;
            }
        }
        const topItems = Object.entries(itemTotals)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, quantity]) => ({ name, quantity }));

        // ── DAILY SALES — last 7 days ──────────────────────────────
        const dailySales = [];
        for (let i = 6; i >= 0; i--) {
            const dayStart = new Date(todayStart);
            dayStart.setDate(dayStart.getDate() - i);
            const dayEnd = new Date(dayStart);
            dayEnd.setDate(dayEnd.getDate() + 1);

            const label = dayStart.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
            const sales = all
                .filter(o => {
                    const d = new Date(o.timestamp);
                    return d >= dayStart && d < dayEnd;
                })
                .reduce((sum, o) => sum + parseFloat(o.finalTotal || o.grandTotal || 0), 0);

            dailySales.push({ label, sales: parseFloat(sales.toFixed(2)) });
        }

        res.json({
            today: {
                totalSales:    parseFloat(totalSalesToday.toFixed(2)),
                totalOrders:   totalOrdersToday,
                avgOrderValue: parseFloat(avgOrderValue.toFixed(2)),
            },
            topItems,
            dailySales,
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
