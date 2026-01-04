// middlewares/sanitizeNumbers.js

const parseGreekNumber = (value) => {
    if (value == null || value === '') return null;
    if (typeof value === 'number') return value;
    
    let str = String(value).trim();
    if (!  str) return null;
    
    str = str.replace(',', '.');
    const num = parseFloat(str);
    return isNaN(num) ? null : num;
};

const sanitizeNumberFields = (req, res, next) => {
    const body = req.body;
    
    // Patterns για πεδία που πρέπει να sanitizoνται
    const patterns = [
        /^pososto_/,
        /^poso_/,
        /_poso$/,
        /^misthos/,
        /^hmeromisthio/,
        /^oromisthio/,
    ];
    
    const shouldSanitize = (key) => {
        return patterns. some(pattern => pattern.test(key));
    };
    
    const sanitizeObject = (obj) => {
        if (!  obj || typeof obj !== 'object') return;
        
        Object.keys(obj).forEach(key => {
            const value = obj[key];
            
            // Αν είναι object, κάνε recursive sanitization
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                sanitizeObject(value);
            }
            // Αν είναι string και ταιριάζει στα patterns, sanitize το
            else if (shouldSanitize(key) && typeof value === 'string') {
                obj[key] = parseGreekNumber(value);
            }
        });
    };
    
    // ✅ Sanitize το root body
    sanitizeObject(body);
    
    // ✅ Sanitize το formData (αν υπάρχει)
    if (body.formData && typeof body.formData === 'object') {
        sanitizeObject(body.formData);
    }
    
    next();
};

module.exports = sanitizeNumberFields;