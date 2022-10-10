const mongoose = require('mongoose')

module.exports = new mongoose.Schema({
	settings: JSON,
	message: JSON,
	messages: Array,
	chatId: String
})
