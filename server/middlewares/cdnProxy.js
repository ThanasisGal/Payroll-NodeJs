const https = require('https');
const http = require('http');
const logger = require('../utils/logger');

module.exports = (req, res, next) => {
    // Μόνο για paths που ξεκινάνε με /cdn-proxy/
    if (!req.path.startsWith('/cdn-proxy/')) {
        return next();
    }

    // Μετέτρεψε /cdn-proxy/assets/... -> https://cdn.webpayrollsolutions.com/assets/...
    const cdnPath = req.path.replace('/cdn-proxy/', '');
    const cdnUrl = `https://cdn.webpayrollsolutions.com/${cdnPath}`;

    logger.info(`[CDN Proxy] Fetching: ${cdnUrl}`);

    const requestModule = cdnUrl.startsWith('https:') ? https : http;

    requestModule
        .get(cdnUrl, (cdnRes) => {
            // Set response headers
            res.statusCode = cdnRes.statusCode;
            res.setHeader('Content-Type', cdnRes.headers['content-type'] || 'text/plain');
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            res.setHeader('Access-Control-Allow-Origin', '*');

            // Pipe the response
            cdnRes.pipe(res);
        })
        .on('error', (err) => {
            logger.error(`[CDN Proxy] Error: ${err.message}`);
            res.status(502).send('CDN resource unavailable');
        });
};
