const { inlineKeyboard } = require('telegraf/lib/markup')
const { markup: { backRow } } = require('../utils')

module.exports = (ctx) => {
	return inlineKeyboard(backRow(ctx))
}
