const { logger, cron: { createJob } } = require('../utils')
const { CHECK_CRON } = require('../const')

const start = (main) => {
	return createJob(CHECK_CRON, async () => {
		if (!main.semaphore.check) {
			main.semaphore.check = true
			try {
				await main.check('groups')
			} catch ({ message }) {
				logger.error(message)
				main.notifyAdmin(`Groups check error: ${message}`)
			}
			try {
				await main.check('posts')
			} catch ({ message }) {
				logger.error(message)
				main.notifyAdmin(`Posts check error: ${message}`)
			}
			try {
				await main.check('reposts')
			} catch ({ message }) {
				logger.error(message)
				main.notifyAdmin(`Reposts check error: ${message}`)
			}
			try {
				await main.check('deferred')
			} catch ({ message }) {
				logger.error(message)
				main.notifyAdmin(`Deferred check error: ${message}`)
			}
			main.semaphore.check = false
		}
	})
}

module.exports = {
	start
}
