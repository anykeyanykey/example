const winston = require('winston')
const DailyRotateFile = require('winston-daily-rotate-file')
const { format } = winston

const myFormat = format.printf(({ level, message, timestamp }) => {
	return `${timestamp} [${level}] : ${message}`
})

const logger = winston.createLogger({
	transports: [
		new winston.transports.Console({
			format: format.combine(format.colorize(), format.timestamp(), format.splat(), myFormat),
			level: 'verbose'
		}),
		new DailyRotateFile({
			filename: 'logs/application-%DATE%.log',
			datePattern: 'YYYY-MM-DD-HH',
			zippedArchive: false,
			maxSize: '20m',
			maxFiles: '14d',
			format: format.combine(format.timestamp(), format.splat(), myFormat)
		})
	]
})

module.exports = logger
