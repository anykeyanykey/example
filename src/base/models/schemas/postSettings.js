const mongoose = require('mongoose')
const { lang, currency: { RUB } } = require('../../../utils')
const { REPOST_MULTIPLIER, REPOST_MAX_COST } = require('../../../const')

const postSettingsSchema = new mongoose.Schema({
	requirements: {
		type: String,
		default: ''
	},
	limitFrom: {
		type: Number,
		default: 0
	},
	limitTo: {
		type: Number,
		default: 0
	},
	coefficient: {
		type: Number,
		default: REPOST_MULTIPLIER
	},
	maxCost: {
		type: Number,
		default: REPOST_MAX_COST,
		get(bet) {
			return RUB(bet)
		}
	},
	pin: {
		type: Boolean,
		default: false
	}
})

postSettingsSchema.virtual('cost').get(function() {
	const { coefficient } = this
	return RUB(coefficient * 1000)
})

postSettingsSchema.methods.toInfo = function (mode = 0) {
	const { limitFrom, limitTo, pin, maxCost } = this
	const arr = []
	switch (mode) {
	case 0:
		arr.push(lang('repostMaxCost', maxCost))
		// arr.push(lang('repostReward', cost.format()))
		arr.push(lang('repostLimit', limitFrom, limitTo))
		arr.push(lang('repostPin', pin))
		break
	case 1:
		arr.push(lang('repostMaxCostShort', 0, maxCost))
		// arr.push(lang('repostRewardShort', 0, cost.format()))
		arr.push(lang('repostLimitShort', 0, limitFrom, limitTo))
		arr.push(lang('repostPinShort', 0, pin))
		break
	case 2:
		arr.push(lang('repostMaxCostShort', 1, maxCost))
		// arr.push(lang('repostRewardShort', 1, cost.format()))
		arr.push(lang('repostLimitShort', 1, limitFrom, limitTo))
		arr.push(lang('repostPinShort', 1, pin))
		break
	case 3:
		arr.push(lang('repostLimit', limitFrom, limitTo))
		break
	}

	return arr.join('\n')
};

postSettingsSchema.path('limitFrom').validate(function(value) {
	if (this.limitTo && this.limitTo <= value) {
		this.limitFrom = 0;
	}
	return true;
});

module.exports = postSettingsSchema
