const { keyboard, button } = require('telegraf/lib/markup')
const { BaseScene } = require('telegraf/lib/scenes/base')
const { scenes: { SCENE_ID_MENU, SCENE_ID_ADS, SCENE_ID_REPOST, SCENE_ID_USER, SCENE_ID_ERROR }, MENU_IMAGE_URL, FAQ_URL } = require('../const')
const { UserModel } = require('../base/models')
const { lang } = require('../utils')

const menuScene = new BaseScene(SCENE_ID_MENU)

menuScene.enter(async (ctx) => {

	const { from, main, message: { text = '' } = { } } = ctx

	main.deleteLastMessages(ctx, true, true)

	const s = text.split(' ')
	let command, param
	if (s[1]) {
		const split = s[1].split('_')
		command = split[0]
		param = split[1]
	}

	await main.replyWithPhoto(ctx, [MENU_IMAGE_URL, {
		caption: lang('welcomeMenu', UserModel.getUserName(from, 1), FAQ_URL),
		parse_mode: 'Markdown',
		...keyboard([
			[button.text(lang('cbCreateAds')), button.text(lang('cbDeferred'))],
			[button.text(lang('cbMyAds')), button.text(lang('cbMyChannels'))],
			[button.text(lang('cbFinances')), button.text(lang('cbSettings'))],
		]).resize() }], false, true)

	switch (command) {
	case 'post':
		if (main.isAdmin(from)) {
			return ctx.scene._enter(SCENE_ID_ERROR, { error: lang('errorAdminCantPost') })
		}
		return ctx.scene._enter(SCENE_ID_ADS)
	case 'repost':
		if (main.isAdmin(from)) {
			const { userId } = await main.getPost({ id: param })
			return ctx.scene._enter(SCENE_ID_USER, { user: userId })
		} else {
			return ctx.scene._enter(SCENE_ID_REPOST, { post: param })
		}
	}
})

module.exports = menuScene
