const mongoose = require('mongoose')

const groupInfoSchema = new mongoose.Schema({
	id: Number,
	title: String,
	type: String,
	username: String,
	invite_link: String,
	members_count: Number
})

module.exports = groupInfoSchema
