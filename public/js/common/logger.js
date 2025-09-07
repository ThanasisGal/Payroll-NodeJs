// public/js/common/logger.js

(function (global) {
  const env = window.RUNTIME_ENV || "development";

  const levels = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
  };

  // σε development δείχνουμε και debug, σε production μέχρι info
  const currentLevel = env === "development" ? levels.debug : levels.info;

  function log(level, ...args) {
    if (levels[level] <= currentLevel) {
      // τυπώνουμε ανάλογα με το επίπεδο
      switch (level) {
        case "error":
          console.error(`[${level.toUpperCase()}]`, ...args);
          break;
        case "warn":
          console.warn(`[${level.toUpperCase()}]`, ...args);
          break;
        case "info":
          console.info(`[${level.toUpperCase()}]`, ...args);
          break;
        default:
          console.log(`[${level.toUpperCase()}]`, ...args);
      }
    }
  }

  global.logger = {
    error: (...args) => log("error", ...args),
    warn: (...args) => log("warn", ...args),
    info: (...args) => log("info", ...args),
    debug: (...args) => log("debug", ...args),
  };
})(window);
