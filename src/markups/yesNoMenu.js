const { inlineKeyboard, button } = require('telegraf/lib/markup')
const { lang, markup: { menuRow } } = require('../utils')

module.exports = (entityId) => {
	return inlineKeyboard([
		[
			button.callback(lang('cbYes'), `agree_${entityId}`),
			button.callback(lang('cbNo'), `undo_${entityId}`)
		],
		menuRow()
	])
}
