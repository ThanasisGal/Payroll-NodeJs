/**
 * ============================================================================
 * textLoader.js - STRICT MODE (NO FALLBACK)
 * ============================================================================
 * 
 * ΛΟΓΙΚΗ:
 * - Διαβάζει ΜΟΝΟ το `prefix` πεδίο από MongoDB
 * - ΑΝ δεν υπάρχει prefix → ERROR (δεν συνεχίζει)
 * - ΑΝ δεν υπάρχει eidikh_kathgoria → Παραλείπει το template
 * ============================================================================
 */

const cacheManager = require('./textCacheManager');
const mongoose = require('mongoose');

// ✅ Import EidikesKathgoriesModel από stathera_arxeia
const Models_A = require('../models/stathera_arxeia');
const { EidikesKathgoriesModel } = Models_A;

/**
 * ============================================================================
 * CATEGORIES: Διαθέσιμες κατηγορίες templates
 * ============================================================================
 */
const CATEGORIES = {
    SYMBASH: "symbash",
    ANHLIKOI: "anhlikoi",
    ALLODAPOI: "allodapoi",
    PROSOPIKO_UPDATE: "prosopikoReqsUpdate",
    APOLYSH: "apolysh"
};

/**
 * ============================================================================
 * DYNAMIC MAPPINGS (από MongoDB - STRICT)
 * ============================================================================
 */
let CATEGORY_CODE_MAP = {}; // kodikos → prefix
let CATEGORY_INFO_MAP = {}; // kodikos → { prefix, perigrafh }

/**
 * ============================================================================
 * initializeConditionsMap()
 * ============================================================================
 * 
 * Φορτώνει τις Ειδικές Κατηγορίες από MongoDB (STRICT MODE)
 * 
 * VALIDATION:
 * - Κάθε εγγραφή ΠΡΕΠΕΙ να έχει prefix
 * - Αν λείπει prefix → SKIP με warning
 * - Αν δεν υπάρχουν εγγραφές → ERROR
 */
async function initializeConditionsMap() {
    try {
        console.log('🔄 Loading Eidikes Kathgories from MongoDB (STRICT MODE)...');
        
        // ✅ Wait for MongoDB connection
        if (mongoose.connection.readyState !== 1) {
            console.log('⏳ Waiting for MongoDB connection...');
            await new Promise((resolve, reject) => {
                if (mongoose.connection.readyState === 1) {
                    resolve();
                } else {
                    mongoose.connection.once('open', resolve);
                    mongoose.connection.once('error', reject);
                    
                    // Timeout after 10 seconds
                    setTimeout(() => reject(new Error('MongoDB connection timeout')), 10000);
                }
            });
            console.log('✅ MongoDB connected');
        }
        
        // Fetch όλες τις ειδικές κατηγορίες
        const categories = await EidikesKathgoriesModel.find({})
            .select('kodikos perigrafh prefix')
            .sort({ kodikos: 1 })
            .lean();
        
        if (!categories || categories.length === 0) {
            throw new Error('❌ CRITICAL: No eidikes kathgories found in MongoDB! Text loading will not work.');
        }
        
        // console.log(`📊 Found ${categories.length} eidikes kathgories\n`);
        
        // Reset maps
        CATEGORY_CODE_MAP = {};
        CATEGORY_INFO_MAP = {};
        
        let validCount = 0;
        let skippedCount = 0;
        
        // Δημιουργία mappings (STRICT)
        for (const category of categories) {
            // ✅ STRICT VALIDATION: Prefix ΠΡΕΠΕΙ να υπάρχει
            if (!category.prefix || category.prefix.trim() === '') {
                console.error(`❌ SKIPPED kodikos ${category.kodikos} ("${category.perigrafh}"): Missing prefix!`);
                console.error(`   → Please add prefix to MongoDB for this category`);
                skippedCount++;
                continue; // Παράλειψε αυτή την κατηγορία
            }
            
            // Normalize το prefix
            const prefix = normalizePrefix(category.prefix);
            
            if (!prefix) {
                console.error(`❌ SKIPPED kodikos ${category.kodikos}: Invalid prefix after normalization`);
                skippedCount++;
                continue;
            }
            
            // Αποθήκευση στα maps
            CATEGORY_CODE_MAP[category.kodikos] = prefix;
            CATEGORY_INFO_MAP[category.kodikos] = {
                prefix: prefix,
                perigrafh: category.perigrafh,
                kodikos: category.kodikos
            };
            
            // console.log(`  ✅ ${category.kodikos} → ${prefix} (${category.perigrafh})`);
            validCount++;
        }
        
        // console.log('\n' + '='.repeat(60));
        // console.log(`✅ Valid categories: ${validCount}`);
        // if (skippedCount > 0) {
        //     console.warn(`⚠️  Skipped categories: ${skippedCount} (missing prefix)`);
        // }
        // console.log('='.repeat(60) + '\n');
        
        // Final validation
        if (validCount === 0) {
            throw new Error('❌ CRITICAL: No valid categories loaded! All categories are missing prefix field.');
        }
        
    } catch (error) {
        console.error('❌ FATAL ERROR loading eidikes kathgories:', error.message);
        console.error('❌ Stack:', error.stack);
        throw error; // Critical error - app should NOT start
    }
}

/**
 * ============================================================================
 * normalizePrefix()
 * ============================================================================
 * 
 * Κανονικοποιεί το prefix format (validation only)
 * 
 * @param {string} prefix - Raw prefix από ΒΔ
 * @returns {string} Normalized prefix
 * 
 * VALIDATION RULES:
 * 1. Uppercase
 * 2. Trim whitespace
 * 3. Μόνο A-Z, 0-9, _
 * 4. Ξεκινάει και τελειώνει με _
 * 
 * ΠΑΡΑΔΕΙΓΜΑΤΑ:
 * "HOTEL" → "_HOTEL_"
 * "_HOTEL" → "_HOTEL_"
 * "HOTEL_" → "_HOTEL_"
 * "_HOTEL_" → "_HOTEL_" (no change)
 * "hotel" → "_HOTEL_"
 * " _HOTEL_ " → "_HOTEL_"
 */
function normalizePrefix(prefix) {
    if (!prefix) return null;
    
    let normalized = prefix.trim().toUpperCase();
    
    // Αφαίρεση ειδικών χαρακτήρων (κρατά μόνο A-Z, 0-9, _)
    normalized = normalized.replace(/[^A-Z0-9_]/g, '');
    
    // Πολλαπλά underscores → ένα
    normalized = normalized.replace(/_+/g, '_');
    
    // Ensure ξεκινάει με _
    if (!normalized.startsWith('_')) {
        normalized = '_' + normalized;
    }
    
    // Ensure τελειώνει με _
    if (!normalized.endsWith('_')) {
        normalized = normalized + '_';
    }
    
    // Τελικός έλεγχος
    if (normalized === '__' || normalized.length < 3) {
        console.error(`❌ Invalid prefix after normalization: "${prefix}" → "${normalized}"`);
        return null;
    }
    
    return normalized;
}

/**
 * ============================================================================
 * getCategoryPrefix()
 * ============================================================================
 * 
 * Επιστρέφει το prefix για έναν kodikos
 * 
 * @param {string} code - Ο κωδικός (π.χ. "0009")
 * @returns {string|null} Το prefix ή null
 */
function getCategoryPrefix(code) {
    if (!code) {
        console.warn(`⚠️ getCategoryPrefix called with empty code`);
        return null;
    }
    
    const prefix = CATEGORY_CODE_MAP[code];
    
    if (!prefix) {
        console.warn(`⚠️ No prefix found for eidikh_kathgoria: ${code}`);
        console.warn(`   → Available codes: ${Object.keys(CATEGORY_CODE_MAP).join(', ')}`);
        return null;
    }
    
    return prefix;
}

/**
 * ============================================================================
 * getCategoryInfo()
 * ============================================================================
 * 
 * Επιστρέφει πλήρεις πληροφορίες για μία κατηγορία
 */
function getCategoryInfo(code) {
    return CATEGORY_INFO_MAP[code] || null;
}

/**
 * ============================================================================
 * buildFilename()
 * ============================================================================
 * 
 * Δημιουργεί filename από kodikos + number
 * 
 * @throws {Error} Αν δεν υπάρχει prefix για το kodikos
 */
function buildFilename(eidikh_kathgoria, number) {
    if (!eidikh_kathgoria) {
        throw new Error('buildFilename: eidikh_kathgoria is required');
    }
    
    const prefix = getCategoryPrefix(eidikh_kathgoria);
    
    if (!prefix) {
        throw new Error(`Cannot build filename: Unknown eidikh_kathgoria "${eidikh_kathgoria}". Please add prefix to MongoDB.`);
    }
    
    // Ensure number is padded (π.χ. "1" → "0001")
    const paddedNumber = String(number).padStart(4, '0');
    
    return `${prefix}${paddedNumber}`;
}

/**
 * ============================================================================
 * loadText()
 * ============================================================================
 */
function loadText(team, companyFolder, category, filename) {
    try {
        return cacheManager.getText(team, companyFolder, category, filename);
    } catch (error) {
        console.error(`Error loading text: ${team}/${companyFolder}/${category}/${filename}`, error);
        return "";
    }
}

/**
 * ============================================================================
 * loadTextByNumber()
 * ============================================================================
 */
function loadTextByNumber(team, companyFolder, category, eidikh_kathgoria, number) {
    try {
        // Validation
        if (!eidikh_kathgoria) {
            console.warn('⚠️ loadTextByNumber: eidikh_kathgoria is empty, skipping');
            return "";
        }
        
        const filename = buildFilename(eidikh_kathgoria, number);
        return loadText(team, companyFolder, category, filename);
    } catch (error) {
        console.error(`Error loading text by number:`, error.message);
        return "";
    }
}

/**
 * ============================================================================
 * loadTextsByPrefix()
 * ============================================================================
 */
function loadTextsByPrefix(team, companyFolder, category, prefix) {
    try {
        if (!prefix) {
            console.warn('⚠️ loadTextsByPrefix: prefix is empty');
            return {};
        }
        
        const results = {};
        const pathPrefix = `txt/${team}/${companyFolder}/${category}/`;
        
        for (const [key, value] of cacheManager.memoryCache.entries()) {
            if (key.startsWith(pathPrefix)) {
                const filename = key
                    .substring(pathPrefix.length)
                    .replace('.txt', '');
                
                if (filename.startsWith(prefix)) {
                    results[filename] = value;
                }
            }
        }
        
        return results;
        
    } catch (error) {
        console.error(`Error loading texts by prefix: ${prefix}`, error);
        return {};
    }
}

/**
 * ============================================================================
 * loadTextsByCategory()
 * ============================================================================
 * 
 * ΚΥΡΙΑ FUNCTION για φόρτωση templates
 * 
 * @param {string} eidikh_kathgoria - Κωδικός (REQUIRED)
 * @returns {Object} Templates ή {} αν δεν υπάρχει prefix
 */
function loadTextsByCategory(team, companyFolder, category, eidikh_kathgoria) {
    try {
        // Validation
        if (!eidikh_kathgoria) {
            console.warn('⚠️ loadTextsByCategory: eidikh_kathgoria is empty, skipping');
            return {};
        }
        
        const prefix = getCategoryPrefix(eidikh_kathgoria);
        
        if (!prefix) {
            console.warn(`⚠️ loadTextsByCategory: No prefix for ${eidikh_kathgoria}, skipping`);
            return {};
        }
        
        return loadTextsByPrefix(team, companyFolder, category, prefix);
        
    } catch (error) {
        console.error('Error in loadTextsByCategory:', error);
        return {};
    }
}

/**
 * ============================================================================
 * loadAllTexts()
 * ============================================================================
 */
function loadAllTexts(team, companyFolder, category) {
    try {
        const results = {};
        const pathPrefix = `txt/${team}/${companyFolder}/${category}/`;
        
        for (const [key, value] of cacheManager.memoryCache.entries()) {
            if (key.startsWith(pathPrefix)) {
                const filename = key
                    .substring(pathPrefix.length)
                    .replace('.txt', '');
                
                results[filename] = value;
            }
        }
        
        return results;
        
    } catch (error) {
        console.error(`Error loading all texts for ${category}`, error);
        return {};
    }
}

/**
 * ============================================================================
 * combineTexts()
 * ============================================================================
 */
function combineTexts(textsInput, separator = "\n\n") {
    try {
        let textsArray;
        
        if (Array.isArray(textsInput)) {
            textsArray = textsInput;
        } else if (typeof textsInput === 'object' && textsInput !== null) {
            textsArray = Object.values(textsInput);
        } else {
            return String(textsInput || '');
        }
        
        return textsArray
            .filter(Boolean)
            .filter(text => String(text).trim().length > 0)
            .join(separator);
            
    } catch (error) {
        console.error('Error combining texts:', error);
        return "";
    }
}

/**
 * ============================================================================
 * Debug/Admin Functions
 * ============================================================================
 */

function getCategoryCodeMap() {
    return { ...CATEGORY_CODE_MAP };
}

function getCategoryInfoMap() {
    return { ...CATEGORY_INFO_MAP };
}

/**
 * ============================================================================
 * Cache Management
 * ============================================================================
 */

async function refreshCache() {
    try {
        return await cacheManager.refresh();
    } catch (error) {
        console.error('Error refreshing cache:', error);
        return { success: false, error: error.message };
    }
}

function getCacheStats() {
    try {
        return cacheManager.getStats();
    } catch (error) {
        console.error('Error getting cache stats:', error);
        return { totalFiles: 0, teams: {}, error: error.message };
    }
}

async function healthCheck() {
    try {
        return await cacheManager.healthCheck();
    } catch (error) {
        console.error('Error checking cache health:', error);
        return { status: 'error', error: error.message };
    }
}

// ============================================================================
// Exports
// ============================================================================
module.exports = {
    // Initialization (CRITICAL!)
    initializeConditionsMap,
    
    // Main loading functions
    loadTextByNumber,
    loadTextsByCategory,
    
    // Basic loading
    loadText,
    loadTextsByPrefix,
    loadAllTexts,
    
    // Helpers
    buildFilename,
    getCategoryPrefix,
    getCategoryInfo,
    combineTexts,
    normalizePrefix,
    
    // Debug/admin
    getCategoryCodeMap,
    getCategoryInfoMap,
    
    // Cache management
    refreshCache,
    getCacheStats,
    healthCheck,
    
    // Constants
    CATEGORIES
};