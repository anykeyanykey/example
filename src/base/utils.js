const { MONGODB_URI } = require('../const')
const mongoose = require('mongoose')

const db = mongoose.connection

const initBase = (bool = true) => {
	if (bool) {
		return mongoose.connect(MONGODB_URI, {
			useNewUrlParser: true,
			retryWrites: true,
			useUnifiedTopology: true,
			useCreateIndex: true,
			useFindAndModify: false
		})
	} else {
		return mongoose.disconnect()
	}
}

module.exports = {
	db,
	initBase
}
