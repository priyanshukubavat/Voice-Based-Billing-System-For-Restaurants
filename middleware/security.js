/**
 * middleware/security.js
 * Applies all security middleware to the Express app:
 *   - helmet    → secure HTTP headers
 *   - cors      → restrict allowed origins
 *   - rateLimit → cap requests per IP
 *   - sanitize  → strip XSS from string body fields
 */

const helmet      = require('helmet');
const cors        = require('cors');
const rateLimit   = require('express-rate-limit');
const xss         = require('xss');

// ──────────────────────────────────────────────────────────────────
// 1. CORS — only allow requests from localhost origins
// ──────────────────────────────────────────────────────────────────
const allowedOrigins = [
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    'null',           // allow file:// during dev
];

const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, same-host)
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error(`CORS: origin '${origin}' not allowed`));
        }
    },
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
};

// ──────────────────────────────────────────────────────────────────
// 2. RATE LIMITER — 100 requests per 15-minute window per IP
// ──────────────────────────────────────────────────────────────────
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,   // 15 minutes
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests. Please try again later.' },
});

// ──────────────────────────────────────────────────────────────────
// 3. XSS SANITIZER — recursively clean string fields in req.body
// ──────────────────────────────────────────────────────────────────
function sanitizeBody(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    for (const [key, val] of Object.entries(obj)) {
        if (typeof val === 'string') {
            obj[key] = xss(val);
        } else if (typeof val === 'object') {
            obj[key] = sanitizeBody(val);
        }
    }
    return obj;
}

const xssSanitizer = (req, _res, next) => {
    if (req.body) req.body = sanitizeBody(req.body);
    next();
};

// ──────────────────────────────────────────────────────────────────
// 4. Apply all security middleware to an Express app
// ──────────────────────────────────────────────────────────────────
function applySecurityMiddleware(app) {
    // Helmet — sets Content-Security-Policy, X-Frame-Options, HSTS, etc.
    app.use(helmet({ contentSecurityPolicy: false }));

    // CORS
    app.use(cors(corsOptions));
    app.options('*', cors(corsOptions));  // pre-flight

    // Rate limiting (applies to all routes)
    app.use(limiter);

    // XSS sanitizer (runs after JSON body parser)
    app.use(xssSanitizer);
}

module.exports = { applySecurityMiddleware };
