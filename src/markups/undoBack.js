const { inlineKeyboard } = require('telegraf/lib/markup')
const { markup:{ undoBackRow } } = require('../utils')

module.exports = () => {
	return inlineKeyboard(undoBackRow())
}
