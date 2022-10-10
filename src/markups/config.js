const { inlineKeyboard, button } = require('telegraf/lib/markup')
const { okRow } = require('../utils/markup')
const lang = require('../utils/lang')

module.exports = (id, isRepost, ok = false) => {
	const action = isRepost ? `config-repost_${id}` : `config-post_${id}`
	const arr = [button.callback(lang('cbConfig'), action)]
	ok && arr.unshift(...okRow())
	return inlineKeyboard(arr)
}
