const { inlineKeyboard, button } = require('telegraf/lib/markup')
const { lang } = require('../utils')

module.exports = (post, link, short = false) => {
	const { id } = post
	const buttons = [
		[
			button.callback(lang('cbInfo'), `post-info_${id}`),
			button.url(lang('cbRepost'), `${link}?start=repost_${id}`)
		]
	]
	if (!short) {
		buttons.push([button.url(lang('cbCreateAds'), `${link}?start=post`)])
	}
	return inlineKeyboard(buttons)
}
