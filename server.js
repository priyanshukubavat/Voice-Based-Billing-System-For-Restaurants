/**
 * server.js — Main Entry Point
 * Voice-Based Billing System for Restaurants
 *
 * Security:
 *   - helmet      : secure HTTP headers
 *   - cors        : restricted origin allowlist
 *   - rate-limit  : 100 req / 15 min per IP
 *   - xss         : sanitize string inputs
 *   - validation  : via validators/orders.js
 *
 * Routes (modular):
 *   /api/orders   → routes/orders.js
 *   /api/dashboard → routes/dashboard.js
 */

const express    = require('express');
const fs         = require('fs');
const path       = require('path');

// ── Security middleware ────────────────────────────────────────────
const { applySecurityMiddleware } = require('./middleware/security');
const { errorHandler }            = require('./middleware/errorHandler');

// ── Route modules ──────────────────────────────────────────────────
const ordersRouter    = require('./routes/orders');
const dashboardRouter = require('./routes/dashboard');

const app  = express();
const PORT = 3001;
const ORDERS_FILE = path.join(__dirname, 'orders.json');

// ── Core middleware ────────────────────────────────────────────────
app.use(express.json());   // parse JSON bodies (must come before security sanitizer)
applySecurityMiddleware(app);

// ── Static frontend ────────────────────────────────────────────────
app.use(express.static(path.join(__dirname)));

// ── Initialize orders file ─────────────────────────────────────────
if (!fs.existsSync(ORDERS_FILE)) {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify([], null, 2));
} else {
    try {
        const current = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf-8'));
        if (!Array.isArray(current)) {
            throw new Error('Invalid orders format');
        }
    } catch (err) {
        // Recreate file with an empty order array if the JSON is corrupted
        fs.writeFileSync(ORDERS_FILE, JSON.stringify([], null, 2));
    }
}

// ───────────────────────────────────────────────────────────────────
//  MENU (in-memory, unchanged)
// ───────────────────────────────────────────────────────────────────
const MENU = {
    burger:       { price: 149, category: 'Main'   },
    cheeseburger: { price: 179, category: 'Main'   },
    pizza:        { price: 299, category: 'Main'   },
    sandwich:     { price: 99,  category: 'Main'   },
    pasta:        { price: 199, category: 'Main'   },
    salad:        { price: 129, category: 'Sides'  },
    fries:        { price: 79,  category: 'Sides'  },
    soup:         { price: 89,  category: 'Sides'  },
    cola:         { price: 49,  category: 'Drinks' },
    water:        { price: 25,  category: 'Drinks' },
    coffee:       { price: 69,  category: 'Drinks' },
    lemonade:     { price: 59,  category: 'Drinks' },
};

app.get('/api/menu', (_req, res) => res.json(MENU));

// ───────────────────────────────────────────────────────────────────
//  MOUNT ROUTERS
// ───────────────────────────────────────────────────────────────────
app.use('/api/orders',    ordersRouter);
app.use('/api/dashboard', dashboardRouter);

// ── 404 for unmatched API routes ───────────────────────────────────
app.use('/api/*', (_req, res) => {
    res.status(404).json({ success: false, message: 'API endpoint not found.' });
});

// ── Centralized error handler (must be last middleware) ────────────
app.use(errorHandler);

// ───────────────────────────────────────────────────────────────────
//  START
// ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log('\n✅  Voice Billing backend started');
    console.log(`    App:       http://localhost:${PORT}`);
    console.log(`    Dashboard: http://localhost:${PORT}/api/dashboard`);
    console.log(`    Security:  helmet + cors + rate-limit + xss\n`);
});
