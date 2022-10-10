const mongoose = require('mongoose')
const { lang, currency: { RUB } } = require('../../utils')
const { flow: { MF_PROFIT, MF_PAYMENT, MF_WITHDRAWAL, MF_RETURN, MF_POST, MF_REPOST, MF_UNFREEZE } } = require('../../const')

const userSchema = new mongoose.Schema(
	{
		id: {
			type: Number,
			unique: true,
			required: true
		},
		mimicry: {
			type: Number,
			required: false
		},
		balance: {
			type: Number,
			default: 0,
			get (balance) {
				return RUB(balance)
			}
		},
		banned: {
			type: Boolean,
			default: false
		},
		admin: {
			type: Boolean,
			default: false
		},
		settings: { type: mongoose.Types.ObjectId, ref: 'Settings' }
	},
	{
		timestamps: true
	}
)

userSchema.methods.isSame = function ({ id }) {
	const { id: _id } = this
	return id === _id
}

userSchema.methods.getGroups = function (opts = {}) {
	const { id: ownerId } = this
	return this.model('Group').find({ ...opts, ownerId });
}

userSchema.methods.getProfit = function () {
	const { id: userId } = this
	return this.model('Flow').find({ userId, type: MF_PROFIT }).reduce((result, { sum }) => {
		result = result.add(sum)
		return result
	}, RUB(0));
}

userSchema.methods.modifyBalance = function (sum, type, params = {}, subtract = false, session) {
	const { id: userId, balance } = this
	this.balance = subtract ? balance.subtract(sum).value : balance.add(sum).value
	const { balance: { value: newBalance } } = this
	return Promise.all([new (this.model('Flow'))({
		sum,
		type,
		balance: newBalance,
		subtract,
		params,
		userId
	}).save({ session }), this.save({ session })])
}

userSchema.methods.getActiveGroups = function () {
	const { id: ownerId } = this
	return this.model('Group').getActive({ ownerId })
}

userSchema.methods.getGroups = function () {
	const { id: ownerId } = this
	return this.model('Group').find({ ownerId })
}

userSchema.methods.isFlowValid = async function () {
	const { id: userId, balance } = this
	const flows = await this.model('Flow').find({ userId })
	const result = flows.reduce((result, { sum, subtract }) => {
		if (subtract) {
			result = result.subtract(sum)
		} else {
			result = result.add(sum)
		}
		return result
	}, RUB(0))
	return result.value === balance.value
}

userSchema.methods.getFlowSumByRepostId = async function (repostId, type) {
	const { id: userId } = this
	const flowDoc = await this.model('Flow').findOne({ userId, 'params.repostId': repostId, type })
	if (flowDoc) {
		const { sum } = flowDoc
		return sum
	}
	return RUB(0)
}

userSchema.methods.buildFinanceInfo = async function () {
	const { id: userId, balance } = this
	const flowDocs = await this.model('Flow').find({ userId })
	let inValue = RUB(0)
	let outValue = RUB(0)
	let profitValue = RUB(0)
	let lossValue = RUB(0)
	let postLossValue = RUB(0)
	let repostLossValue = RUB(0)
	for (let i = 0; i < flowDocs.length; i++) {
		const flowDoc = flowDocs[i]
		const { type, sum } = flowDoc
		switch (type) {
		case MF_PAYMENT:
			inValue = inValue.add(sum)
			break
		case MF_WITHDRAWAL:
			outValue = outValue.add(sum)
			break
		case MF_RETURN:
			outValue = outValue.subtract(sum)
			break
		case MF_PROFIT:
			profitValue = profitValue.add(sum)
			break
		case MF_POST:
			lossValue = lossValue.add(sum)
			postLossValue = postLossValue.add(sum)
			break
		case MF_REPOST:
			lossValue = lossValue.add(sum)
			repostLossValue = repostLossValue.add(sum)
			break
		case MF_UNFREEZE:
			lossValue = lossValue.subtract(sum)
			repostLossValue = repostLossValue.subtract(sum)
			break
		}
	}
	const arr = []
	arr.push(lang('refills', inValue.format()))
	arr.push(lang('spent', lossValue.format()))
	arr.push('\t- ' + lang('forAdvertising', postLossValue.format()))
	arr.push('\t- ' + lang('paymentForReposts', repostLossValue.format()))
	arr.push(lang('earned', profitValue.format()))
	arr.push(lang('withdrawal', outValue.format()))
	arr.push(lang('balance', balance.format()))
	return arr.join('\n')
}

userSchema.statics.getUserName = (from, mode = 0) => {
	const { first_name: firstName, last_name: lastName, username } = from
	const fullName = [firstName, lastName].join(' ').trim()
	switch (mode) {
	case 0:
		return username ? `@${username}` : fullName
	case 1:
		return fullName
	default:
		return username ? `${fullName} (@${username})` : fullName
	}
}

module.exports = mongoose.model('User', userSchema)
