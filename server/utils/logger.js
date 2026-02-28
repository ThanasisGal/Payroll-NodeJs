// const { createLogger, format, transports } = require("winston");

// const logger = createLogger({
//   level: process.env.NODE_ENV === "development" ? "debug" : "info",
//   format: format.combine(
//     format.colorize(),
//     format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
//     format.printf(({ timestamp, level, message }) => {
//       return `[${timestamp}] ${level}: ${message}`;
//     })
//   ),
//   transports: [
//     new transports.Console()
//   ],
// });

// module.exports = logger;

const { createLogger, format, transports } = require('winston');
const path = require('path');
const fs = require('fs');

// ✅ Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

const logger = createLogger({
    level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
    format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.errors({ stack: true }),
        format.splat(),
        format.json()
    ),
    transports: [
        // ✅ Console output (with colors)
        new transports.Console({
            format: format.combine(
                format.colorize(),
                format.printf(({ timestamp, level, message, ...meta }) => {
                    let msg = `[${timestamp}] ${level}: ${message}`;

                    // ✅ Add metadata if exists
                    if (Object.keys(meta).length > 0) {
                        msg += `\n${JSON.stringify(meta, null, 2)}`;
                    }

                    return msg;
                })
            )
        }),

        // ✅ File output (all logs)
        new transports.File({
            filename: path.join(logsDir, 'app.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            format: format.combine(format.timestamp(), format.json())
        }),

        // ✅ Error-only file
        new transports.File({
            filename: path.join(logsDir, 'error.log'),
            level: 'error',
            maxsize: 5242880,
            maxFiles: 5
        })
    ]
});

// ✅ Add daily rotation (optional but recommended)
// Uncomment if you install winston-daily-rotate-file:
// npm install winston-daily-rotate-file
/*
const DailyRotateFile = require('winston-daily-rotate-file');

logger.add(new DailyRotateFile({
  filename: path.join(logsDir, 'app-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d'
}));
*/

module.exports = logger;
