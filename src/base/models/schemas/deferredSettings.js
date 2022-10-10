const mongoose = require('mongoose')
const moment = require('moment-timezone')
const { lang } = require('../../../utils')

const deferredSettingsSchema = new mongoose.Schema({
	pin: {
		type: Boolean,
		default: false
	},
	silent: {
		type: Boolean,
		default: false
	},
	lifeTime: {
		type: Number,
		default: 0
	},
	lifeTimeUnit: {
		type: String,
		default: 'hours'
	},
	date: {
		type: Date,
		default: null
	}
})

deferredSettingsSchema.methods.toInfo = function (from) {
	const { pin, lifeTime, lifeTimeUnit, date, silent } = this
	const { timezone } = from
	const arr = []
	const dateFormat = moment(date).tz(timezone).format('LLL')
	date && arr.push(lang('postDate', dateFormat, timezone))
	// !date && arr.push('Время не задано')
	arr.push(lang('repostPinShort', 0, pin))
	arr.push(lang('autoDelete', `${lifeTime ? lang(lifeTimeUnit, lifeTime) : lang('no')}`))
	arr.push(lang('notification', silent))
	return arr.join('\n')
}

module.exports = deferredSettingsSchema
