const withdrawal = require('./withdrawal')
const payment = require('./payment')
const check = require('./check')

const jobs = []

const start = (main) => {
	jobs.push(
		withdrawal.start(main), // todo
		payment.start(main),
		check.start(main)
	)
}

const stop = () => {
	for (let i = 0; i < jobs.length; i++) {
		jobs[i].stop()
	}
	jobs.length = 0
}

module.exports = {
	start,
	stop,
	withdrawal
}
