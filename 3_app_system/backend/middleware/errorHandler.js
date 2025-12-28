// Unified error handling (after all routes)
module.exports = (err, req, res, next) => {
    const status = err.status || 500;
    const message = err.message || 'Internal Server Error';
    // In production, the stack can be hidden
    res.status(status).json({
      error: { message, status, stack: process.env.NODE_ENV === 'production' ? undefined : err.stack }
    });
  };
  