const { BaseScene } = require('telegraf/lib/scenes/base')
const { scenes: { SCENE_ID_ERROR }, emoji: { EMOJI_STOP_SIGN } } = require('../const')
const { menuMarkup } = require('../markups')

const errorScene = new BaseScene(SCENE_ID_ERROR)

errorScene.enter((ctx) => {
	const { main, scene: { state: { error } } } = ctx
	main.deleteLastMessages(ctx, true)
	return main.replyWithMarkdown(ctx, [`${EMOJI_STOP_SIGN} ${error}`, { disable_web_page_preview: true, ...menuMarkup() }])
})

module.exports = errorScene
