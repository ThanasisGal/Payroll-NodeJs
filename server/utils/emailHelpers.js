/**
 * Email Helper Functions for WPS Payroll System
 * Provides time-based greetings and email utilities
 */

// ═══════════════════════════════════════════════════════════════════
// OPTION 1: Simple 2-Period Greeting (Καλημέρα / Καλησπέρα)
// ═══════════════════════════════════════════════════════════════════

/**
 * Get simple time-based greeting (2 options)
 * @returns {string} "Καλημέρα" or "Καλησπέρα"
 */
const getSimpleGreeting = () => {
    const hour = new Date().getHours();
    return hour >= 12 ?  'Καλησπέρα' : 'Καλημέρα';
};

// ═══════════════════════════════════════════════════════════════════
// OPTION 2: Detailed 4-Period Greeting
// ═══════════════════════════════════════════════════════════════════

/**
 * Get detailed time-based greeting (4 options)
 * @returns {string} "Καλημέρα" | "Καλό απόγευμα" | "Καλησπέρα" | "Καλό βράδυ"
 */
const getDetailedGreeting = () => {
    const hour = new Date().getHours();
    
    if (hour >= 5 && hour < 12) {
        return 'Καλημέρα';
    } else if (hour >= 12 && hour < 17) {
        return 'Καλό απόγευμα';
    } else if (hour >= 17 && hour < 21) {
        return 'Καλησπέρα';
    } else {
        return 'Καλό βράδυ';
    }
};

// ═══════════════════════════════════════════════════════════════════
// OPTION 3: Greeting with Emoji
// ═══════════════════════════════════════════════════════════════════

/**
 * Get greeting with appropriate emoji
 * @returns {object} { text: string, emoji: string }
 */
const getGreetingWithEmoji = () => {
    const hour = new Date().getHours();
    
    if (hour >= 5 && hour < 12) {
        return { text: 'Καλημέρα', emoji: '🌅' };
    } else if (hour >= 12 && hour < 17) {
        return { text: 'Καλό απόγευμα', emoji: '☀️' };
    } else if (hour >= 17 && hour < 21) {
        return { text: 'Καλησπέρα', emoji: '🌆' };
    } else {
        return { text: 'Καλό βράδυ', emoji: '🌙' };
    }
};

// ═══════════════════════════════════════════════════════════════════
// OPTION 4: Greeting for Specific Timezone
// ═══════════════════════════════════════════════════════════════════

/**
 * Get greeting based on user's timezone
 * @param {string} timezone - IANA timezone (e.g., 'Europe/Athens')
 * @returns {string} Time-appropriate greeting
 */
const getGreetingForTimezone = (timezone = 'Europe/Athens') => {
    try {
        const now = new Date();
        const options = { 
            hour: 'numeric', 
            hour12: false,
            timeZone: timezone 
        };
        const hourString = now.toLocaleString('en-US', options);
        const hour = parseInt(hourString.split(',')[1] || hourString, 10);
        
        if (hour >= 5 && hour < 12) {
            return 'Καλημέρα';
        } else if (hour >= 12 && hour < 17) {
            return 'Καλό απόγευμα';
        } else if (hour >= 17 && hour < 21) {
            return 'Καλησπέρα';
        } else {
            return 'Καλό βράδυ';
        }
    } catch (error) {
        console.error('Timezone error, using default:', error);
        return getDetailedGreeting();
    }
};

// ═══════════════════════════════════════════════════════════════════
// OPTION 5: Greeting with Full Name & Title
// ═══════════════════════════════════════════════════════════════════

/**
 * Get personalized greeting with user details
 * @param {object} user - User object { firstName, lastName, gender }
 * @param {boolean} formal - Use formal address (Κύριε/Κυρία)
 * @returns {string} Full personalized greeting
 */
const getPersonalizedGreeting = (user, formal = false) => {
    const timeGreeting = getDetailedGreeting();
    
    if (formal && user.gender) {
        const title = user.gender === 'male' ?  'Κύριε' : 'Κυρία';
        return `${timeGreeting} ${title} ${user.lastName}`;
    }
    
    return `${timeGreeting} ${user.firstName}`;
};

// ═══════════════════════════════════════════════════════════════════
// OPTION 6: Contextual Greeting (based on email type)
// ═══════════════════════════════════════════════════════════════════

/**
 * Get contextual greeting based on email purpose
 * @param {string} context - Email context ('welcome', 'reset', 'notification', 'alert')
 * @returns {string} Context-appropriate greeting
 */
const getContextualGreeting = (context) => {
    const timeGreeting = getDetailedGreeting();
    
    const contextMap = {
        'welcome': 'Καλώς ήρθες',
        'farewell': 'Αντίο',
        'urgent': timeGreeting + ' (Επείγον)',
        'reminder':  timeGreeting,
        'congratulations': 'Συγχαρητήρια',
        'default': timeGreeting
    };
    
    return contextMap[context] || contextMap['default'];
};

// ═══════════════════════════════════════════════════════════════════
// OPTION 7: Greeting with Time Display
// ═══════════════════════════════════════════════════════════════════

/**
 * Get greeting with formatted time
 * @param {string} locale - Locale string (default: 'el-GR')
 * @returns {object} { greeting: string, time: string, fullGreeting: string }
 */
const getGreetingWithTime = (locale = 'el-GR') => {
    const greeting = getDetailedGreeting();
    const now = new Date();
    const time = now.toLocaleTimeString(locale, { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    const date = now.toLocaleDateString(locale, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    return {
        greeting: greeting,
        time: time,
        date: date,
        fullGreeting: `${greeting} - ${date}, ${time}`
    };
};

// ═══════════════════════════════════════════════════════════════════
// OPTION 8: Smart Greeting (considers day of week & holidays)
// ═══════════════════════════════════════════════════════════════════

/**
 * Get smart greeting that considers day of week
 * @param {boolean} includeWeekend - Include weekend-specific greetings
 * @returns {string} Smart greeting
 */
const getSmartGreeting = (includeWeekend = true) => {
    const timeGreeting = getDetailedGreeting();
    const day = new Date().getDay(); // 0 = Sunday, 6 = Saturday
    
    if (includeWeekend) {
        if (day === 6) {
            return `${timeGreeting} - Καλό Σαββατοκύριακο`;
        } else if (day === 0) {
            return `${timeGreeting} - Καλή Κυριακή`;
        } else if (day === 5) {
            return `${timeGreeting} - Καλό απόγευμα Παρασκευής`;
        } else if (day === 1) {
            return `${timeGreeting} - Καλή εβδομάδα`;
        }
    }
    
    return timeGreeting;
};

// ═══════════════════════════════════════════════════════════════════
// OPTION 9: Greeting with Weather Context (mock)
// ═══════════════════════════════════════════════════════════════════

/**
 * Get greeting with seasonal context
 * @returns {string} Seasonal greeting
 */
const getSeasonalGreeting = () => {
    const timeGreeting = getDetailedGreeting();
    const month = new Date().getMonth(); // 0-11
    
    // Seasonal additions
    if (month >= 5 && month <= 7) {
        // Summer (June-August)
        return `${timeGreeting} - Καλό καλοκαίρι`;
    } else if (month >= 11 || month <= 1) {
        // Winter (Dec-Feb)
        return `${timeGreeting} - Καλό χειμώνα`;
    }
    
    return timeGreeting;
};

// ═══════════════════════════════════════════════════════════════════
// UTILITY:  Get All Greeting Info
// ═══════════════════════════════════════════════════════════════════

/**
 * Get comprehensive greeting information
 * @param {object} user - User object (optional)
 * @returns {object} All greeting variations
 */
const getAllGreetings = (user = null) => {
    const hour = new Date().getHours();
    const greetingWithEmoji = getGreetingWithEmoji();
    const greetingWithTime = getGreetingWithTime();
    
    return {
        simple: getSimpleGreeting(),
        detailed: getDetailedGreeting(),
        withEmoji: `${greetingWithEmoji. emoji} ${greetingWithEmoji.text}`,
        withTime: greetingWithTime.fullGreeting,
        smart: getSmartGreeting(),
        seasonal: getSeasonalGreeting(),
        personalized: user ? getPersonalizedGreeting(user) : getDetailedGreeting(),
        hour: hour,
        timestamp: new Date().toISOString()
    };
};

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

module. exports = {
    // Basic greetings
    getSimpleGreeting,           // Option 1: 2 periods
    getDetailedGreeting,         // Option 2: 4 periods (RECOMMENDED)
    
    // Advanced greetings
    getGreetingWithEmoji,        // Option 3: With emoji
    getGreetingForTimezone,      // Option 4: Timezone-aware
    getPersonalizedGreeting,     // Option 5: With title/formality
    getContextualGreeting,       // Option 6: Based on email type
    getGreetingWithTime,         // Option 7: With time display
    getSmartGreeting,            // Option 8: Weekend/day aware
    getSeasonalGreeting,         // Option 9: Season-aware
    
    // Utility
    getAllGreetings              // Get all variations
};