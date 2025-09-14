const geoip = require("geoip-lite");
const { allowedCountries } = require("../../config/geo.json");

async function geoGuard(req, res, next) {
    // Απαιτεί app.set('trust proxy', 1) σε production για σωστό req.ip
    const ip = req.ip;
    const geo = geoip.lookup(ip);
    const country = geo ? geo.country : "??";
    const role = req.body?.role || req.session?.userRole;

    const allowedSet = new Set(allowedCountries);

    if ((role === "A" || role === "C") && !allowedSet.has(country)) {
        logger.warn(`Admin login attempt from ${ip} (${country}) blocked`);
        await res.flash("warning", "Η πρόσβαση για admin επιτρέπεται μόνο από επιλεγμένες χώρες.");
        return res.redirect("/login");
    }
    next();
}

module.exports = geoGuard;
