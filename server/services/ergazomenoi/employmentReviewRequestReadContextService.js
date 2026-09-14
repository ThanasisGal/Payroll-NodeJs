const REQUEST_READ_PROMISES = Symbol('employmentReviewRequestReadPromises');

function requestReadKey(parts = []) {
    return JSON.stringify(parts.map((part) => String(part ?? '')));
}

function getOrCreateRequestRead(req, keyParts, loader) {
    if (!req || typeof loader !== 'function') {
        throw new TypeError('Απαιτούνται request context και read loader.');
    }
    if (String(req.method || 'GET').toUpperCase() !== 'GET') {
        return Promise.resolve().then(loader);
    }
    if (!Object.prototype.hasOwnProperty.call(req, REQUEST_READ_PROMISES)) {
        Object.defineProperty(req, REQUEST_READ_PROMISES, {
            value: new Map(), enumerable: false, configurable: false, writable: false
        });
    }
    const key = requestReadKey(keyParts);
    if (!req[REQUEST_READ_PROMISES].has(key)) {
        req[REQUEST_READ_PROMISES].set(key, Promise.resolve().then(loader));
    }
    return req[REQUEST_READ_PROMISES].get(key);
}

module.exports = { getOrCreateRequestRead, requestReadKey };
