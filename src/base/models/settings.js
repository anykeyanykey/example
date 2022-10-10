const mongoose = require('mongoose')
const { MOMENT_TIMEZONE } = require('./../../const')
const { lang } = require('./../../utils')
const { DefaultSchema, postSettings } = require('./schemas')

const settingsSchema = new DefaultSchema(
	{
		userId: {
			type: Number,
			required: true
		},
		postSettings: {
			type: postSettings,
			default: () => ({})
		},
		timezone: {
			type: String,
			default: MOMENT_TIMEZONE
		},
		whiteList: [{ type: mongoose.Types.ObjectId, ref: 'Group' }],
		blackList: [{ type: mongoose.Types.ObjectId, ref: 'Group' }]
	},
	{
		timestamps: true
	}
)

settingsSchema.virtual('whiteListCount', {
	ref: 'Group',
	localField: 'whiteList._id',
	foreignField: '_id',
	count: true
})

settingsSchema.virtual('blackListCount', {
	ref: 'Group',
	localField: 'blackList._id',
	foreignField: '_id',
	count: true
})

settingsSchema.virtual('requirements').get(function() {
	return this.postSettings.requirements
})

settingsSchema.virtual('limitFrom').get(function() {
	return this.postSettings.limitFrom
})

settingsSchema.virtual('limitTo').get(function() {
	return this.postSettings.limitTo
})

settingsSchema.virtual('coefficient').get(function() {
	return this.postSettings.coefficient
})

settingsSchema.virtual('pin').get(function() {
	return this.postSettings.pin
})

settingsSchema.methods.toInfo = function (mode = 0) {
	const { postSettings, timezone } = this
	const arr = []
	switch (mode) {
	case 0:
		arr.push(postSettings.toInfo())
		break
	case 1:
		arr.push(lang('timezone', timezone))
		break
	}
	// todo время ответа
	return arr.join('\n')
}

module.exports = mongoose.model('Settings', settingsSchema)
