const { CronJob } = require('cron')
const { MOMENT_TIMEZONE } = require('../const')

const createJob = (cronTime, cb) => {
	return new CronJob(
		cronTime,
		cb,
		null,
		true,
		MOMENT_TIMEZONE,
		null,
		false
	)
}

module.exports = {
	createJob
}
