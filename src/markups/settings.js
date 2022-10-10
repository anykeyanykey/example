const { inlineKeyboard, button } = require('telegraf/lib/markup')
const { undoBackRow } = require('../utils/markup')
const { lang, currency: { RUB } } = require('../utils')

module.exports = {

	repostCostRequestMarkup(ctx) {
		const buttons = Array.from({ length: 8 }).map((item, i) => {
			const k = (i + 1) * 2 * 100
			return button.callback(RUB(k).format(), `set-cost_${k}`)
		}).toChunks(4)
		return inlineKeyboard([
			...buttons,
			undoBackRow(ctx)
		])
	},

	maxCostRequestMarkup(ctx) {
		const buttons = Array.from({ length: 8 }).map((item, i) => {
			const k = (i + 1) * 2 * 100
			return button.callback(RUB(k).format(), `set-max-cost_${k}`)
		}).toChunks(4)
		return inlineKeyboard([
			[button.callback(lang('anyMaxCost'), `set-max-cost_0`)],
			...buttons,
			undoBackRow(ctx)
		])
	},

	costRequestMarkup(ctx) {
		const buttons = Array.from({ length: 8 }).map((item, i) => {
			const k = (0.02 * (i + 1)).toFixed(2)
			return button.callback(RUB(k * 1000).format(), `set-cost_${k}`)
		}).toChunks(4)
		return inlineKeyboard([
			...buttons,
			undoBackRow(ctx)
		])
	},

	pinRequestMarkup(ctx) {
		return inlineKeyboard([
			[
				button.callback(lang('cbYes'), `set-pin-yes`),
				button.callback(lang('cbNo'), `set-pin-no`)
			],
			undoBackRow(ctx)
		])
	},

	limitFromRequestMarkup(ctx) {
		const buttons = Array.from({ length: 8 }).map((item, i) => {
			let limit = 100
			switch (i) {
			case 1:
				limit = 300
				break
			case 2:
				limit = 500
				break
			case 3:
				limit = 1000
				break
			case 4:
				limit = 2000
				break
			case 5:
				limit = 3000
				break
			case 6:
				limit = 4000
				break
			case 7:
				limit = 5000
				break
			}
			return button.callback(`>=${limit}`, `set-limit-from_${limit}`)
		}).toChunks(4)
		return inlineKeyboard([
			[button.callback(lang('cbNoLimit'), `set-limit-from_0`)],
			...buttons,
			undoBackRow(ctx)
		])
	},

	limitToRequestMarkup(ctx) {
		const buttons = Array.from({ length: 8 }).map((item, i) => {
			let limit = 300
			switch (i) {
			case 1:
				limit = 500
				break
			case 2:
				limit = 1000
				break
			case 3:
				limit = 2000
				break
			case 4:
				limit = 3000
				break
			case 5:
				limit = 10000
				break
			case 6:
				limit = 20000
				break
			case 7:
				limit = 50000
				break
			}
			return button.callback(`<=${limit}`, `set-limit-to_${limit}`)
		}).toChunks(4)
		return inlineKeyboard([
			[button.callback(lang('cbNoLimit'), `set-limit-to_0`)],
			...buttons,
			undoBackRow(ctx)
		])
	},

	limitsRequestMarkup(ctx) {
		const actions = []
		actions.push([button.callback(lang('cbLimitFrom'), 'limit-from'), button.callback(lang('cbLimitTo'), 'limit-to')])
		return inlineKeyboard([
			...actions,
			undoBackRow(ctx)
		]).resize()
	}
}
