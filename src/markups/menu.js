const { inlineKeyboard } = require('telegraf/lib/markup')
const { markup: { menuRow } } = require('../utils')

module.exports = (ctx) => {
	return inlineKeyboard(menuRow(ctx))
}
