/**
 * middleware/errorHandler.js
 * Centralized Express error handler.
 * Always returns a structured JSON response:
 *   { success: false, message: "..." }
 *
 * Usage: app.use(errorHandler)  — must be registered LAST.
 */

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
    // Log for server-side visibility
    console.error(`[Error] ${req.method} ${req.path} →`, err.message);

    // Determine appropriate HTTP status
    let status = err.status || err.statusCode || 500;

    // Handle known Express / library errors
    if (err.type === 'entity.parse.failed') {
        status = 400;
        err.message = 'Invalid JSON in request body.';
    }

    if (err.message && err.message.startsWith('CORS:')) {
        status = 403;
    }

    res.status(status).json({
        success: false,
        message: err.message || 'An unexpected error occurred.',
    });
}

module.exports = { errorHandler };
