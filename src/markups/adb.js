const { inlineKeyboard, button } = require('telegraf/lib/markup')

module.exports = (buttons) => {
	return inlineKeyboard(buttons.map(({ text, url }) => [button.url(text, url)]))
}
