// Capture exceptions in async controllers and pass them to errorHandler
module.exports = fn => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
  