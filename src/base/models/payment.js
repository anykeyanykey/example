const mongoose = require('mongoose')
const { DefaultSchema } = require('./schemas')
const { lang, currency: { RUB } } = require('../../utils')
const { types: { PAYMENT_TYPE_QIWI } } = require('../../const')

const paymentSchema = new DefaultSchema(
	{
		// id: String,
		operationId: {
			type: String,
			required: true
		},
		sum: {
			type: Number,
			get (sum) {
				return RUB(sum)
			}
		},
		type: {
			type: String,
			default: PAYMENT_TYPE_QIWI
		},
		params: {
			type: JSON,
			default: {}
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

paymentSchema.methods.toInfo = function () {
	const arr = []

	arr.push(lang('paymentId', this.id))
	arr.push(lang('paymentSum', this.sum.format()))

	return arr.join('\n')
}

module.exports = mongoose.model('Payment', paymentSchema)
