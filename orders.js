/**
 * validators/orders.js
 * Pure validation functions for order-related request bodies.
 * Returns { valid: boolean, message: string }.
 */

const ITEM_NAME_MAX_LEN = 60;
const ALLOWED_DISCOUNT_TYPES = ['percent', 'fixed'];

/**
 * Validates the POST /api/orders body.
 * @param {Object} body - Parsed request body.
 * @returns {{ valid: boolean, message: string }}
 */
function validateOrderBody(body) {
    const {
        items,
        subtotal,
        discount = 0,
        discountType = 'percent',
        gstEnabled,
        gstRate,
    } = body;

    // ── items ──────────────────────────────────────────────────────
    if (!items || typeof items !== 'object' || Array.isArray(items)) {
        return fail('`items` must be a non-empty object.');
    }

    const itemKeys = Object.keys(items);
    if (itemKeys.length === 0) {
        return fail('Order must contain at least one item.');
    }

    for (const name of itemKeys) {
        // Item name: string, max length
        if (typeof name !== 'string' || name.trim().length === 0) {
            return fail(`Item name must be a non-empty string.`);
        }
        if (name.length > ITEM_NAME_MAX_LEN) {
            return fail(`Item name "${name}" exceeds max length of ${ITEM_NAME_MAX_LEN}.`);
        }

        const { quantity, price } = items[name];

        // Quantity: positive integer
        if (!Number.isInteger(Number(quantity)) || Number(quantity) < 1) {
            return fail(`Quantity for "${name}" must be a positive integer.`);
        }

        // Price: positive number
        const p = parseFloat(price);
        if (isNaN(p) || p < 0) {
            return fail(`Price for "${name}" must be a non-negative number.`);
        }
    }

    // ── subtotal ───────────────────────────────────────────────────
    const sub = parseFloat(subtotal);
    if (isNaN(sub) || sub < 0) {
        return fail('`subtotal` must be a non-negative number.');
    }

    // ── discount ───────────────────────────────────────────────────
    const disc = parseFloat(discount);
    if (isNaN(disc) || disc < 0) {
        return fail('Discount cannot be negative.');
    }
    if (!ALLOWED_DISCOUNT_TYPES.includes(discountType)) {
        return fail(`discountType must be one of: ${ALLOWED_DISCOUNT_TYPES.join(', ')}.`);
    }
    if (discountType === 'percent' && disc > 100) {
        return fail('Percentage discount cannot exceed 100%.');
    }
    if (discountType === 'fixed' && disc > sub) {
        return fail('Fixed discount cannot exceed the subtotal.');
    }

    // ── GST ────────────────────────────────────────────────────────
    if (gstEnabled && (isNaN(parseFloat(gstRate)) || parseFloat(gstRate) < 0)) {
        return fail('`gstRate` must be a non-negative number when GST is enabled.');
    }

    return { valid: true, message: '' };
}

function fail(message) {
    return { valid: false, message };
}

module.exports = { validateOrderBody };
