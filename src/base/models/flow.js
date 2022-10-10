const mongoose = require('mongoose')
const { DefaultSchema } = require('./schemas')
const { lang, currency: { RUB } } = require('../../utils')
const moment = require('moment-timezone')

const flowSchema = new DefaultSchema(
	{
		sum: {
			type: Number,
			get (sum) {
				return RUB(sum)
			}
		},
		balance: {
			type: Number,
			get (sum) {
				return RUB(sum)
			}
		},
		params: {
			type: JSON,
			default: { }
		},
		type: {
			type: String,
			required: true
		},
		subtract: {
			type: Boolean,
			required: true
		},
		userId: {
			type: Number,
			required: true
		}
	},
	{
		timestamps: true
	}
)


flowSchema.methods.toInfo = function (from) {
	const { type, sum, balance, subtract, createdAt } = this
	const { timezone } = from
	const arr = []
	let _sum = sum
	if (subtract) {
		_sum = sum.multiply(-1)
	}
	const opts = _sum.value === 0 ? {} : { pattern: '+#!', negativePattern: '-#!' }
	arr.push(lang(type) + `: \`${_sum.format(opts)} | ${balance.format()}\``)
	arr.push(`\`${moment(createdAt).tz(timezone).format('LLL')}\``)
	return arr.join('\n')
}

module.exports = mongoose.model('Flow', flowSchema)
