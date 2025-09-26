
// Rate Limiting Integration
// Add this to your server.js file before route definitions

const { smartRateLimiter, rateLimiters } = require('./middleware/rateLimiter');

// Apply smart rate limiting globally
app.use(smartRateLimiter);

// Or apply specific rate limiters to specific routes
app.use('/api/superadmin', rateLimiters.admin);
app.use('/api/leads', rateLimiters.leads);
app.use('/api/upload', rateLimiters.upload);

console.log('✅ Rate limiting applied');
