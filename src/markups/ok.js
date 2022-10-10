const { inlineKeyboard } = require('telegraf/lib/markup')
const { okRow } = require('../utils/markup')

module.exports = () => {
	return inlineKeyboard(okRow())
}
