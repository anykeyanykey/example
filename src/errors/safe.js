class SafeError extends Error {
	constructor (message) {
		super(message)
		this.name = 'SafeError'
	}
}

module.exports = SafeError
