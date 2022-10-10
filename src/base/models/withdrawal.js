const mongoose = require('mongoose')
const { DefaultSchema } = require('./schemas')
const { types: { WITHDRAWAL_TYPE_QIWI, WITHDRAWAL_TYPE_YOOMONEY, WITHDRAWAL_TYPE_PAYEER } } = require('../../const')
const { lang, currency: { RUB } } = require('../../utils')

const withdrawalSchema = new DefaultSchema(
	{
		sum: {
			type: Number,
			get (sum) {
				return RUB(sum)
			}
		},
		type: {
			type: String,
			default: WITHDRAWAL_TYPE_QIWI
		},
		userId: {
			type: Number,
			required: true
		},
		account: {
			type: String,
			required: true
		},
		paySystemId: {
			type: String,
			required: true
		},
		done: {
			type: Boolean,
			default: false
		},
		error: {
			type: Boolean,
			default: false
		},
		request: {
			type: Boolean,
			default: false
		},
		errorMsg: {
			type: String,
			default: ''
		}
	},
	{
		timestamps: true
	}
)

withdrawalSchema.methods.getUser = function (session) {
	const { userId } = this
	return this.model('User').findOne({ id: userId }).session(session)
}

withdrawalSchema.methods.toInfo = function () {
	const arr = []
	arr.push(lang('withdrawalId', this.id))
	arr.push(lang('withdrawalSum', this.sum.format()))
	return arr.join('\n')
}

withdrawalSchema.statics.paySystemToType = function(paySystemId) {
	return paySystemId === 'q' ? WITHDRAWAL_TYPE_QIWI : paySystemId === 'y' ? WITHDRAWAL_TYPE_YOOMONEY : WITHDRAWAL_TYPE_PAYEER
}

module.exports = mongoose.model('Withdrawal', withdrawalSchema)
