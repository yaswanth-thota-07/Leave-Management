function errorHandler(err, req, res, next) {
  console.error('[Error Middleware]:', err.stack || err.message);
  const status = err.statusCode || 500;
  res.status(status).json({
    error: err.message || 'Internal Server Error',
    status
  });
}

function notFoundHandler(req, res, next) {
  if (req.originalUrl.startsWith('/api')) {
    return res.status(404).json({ error: `API route ${req.originalUrl} not found.` });
  }
  next();
}

module.exports = { errorHandler, notFoundHandler };
