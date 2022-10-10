const mongoose = require('mongoose')
const { customAlphabet } = require('nanoid')

class DefaultSchema extends mongoose.Schema {
	constructor(...args) {
		args[0] = {
			id: {
				type: String,
				unique: true
			}, ...args[0]
		}
		super(...args);
		this.pre('save', function () {
			const { id } = this
			if (!id) {
				this.id = customAlphabet('1234567890ABCDEF', 12)()
			}
		})
	}
}

module.exports = DefaultSchema
