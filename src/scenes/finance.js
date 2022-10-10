const { BaseScene } = require('telegraf/lib/scenes/base')
const { scenes: { SCENE_ID_FINANCE, SCENE_ID_PAYMENT, SCENE_ID_WITHDRAWAL, SCENE_ID_HISTORY } } = require('../const')
const { inlineKeyboard, button } = require('telegraf/lib/markup')
const { lang, scene: { enterHandler }, markup: { backRow } } = require('../utils')

const financeScene = new BaseScene(SCENE_ID_FINANCE, {
	enterHandlers: [enterHandler()]
})

const welcomeMarkup = (ctx) => {
	return inlineKeyboard([
		[button.callback(lang('cbRefill'), 'payment'), button.callback(lang('cbWithdraw'), 'withdrawal')],
		[button.callback(lang('cbHistory'), 'history')],
		backRow(ctx)
	])
}

const welcomeRequest = async (ctx) => {
	const { user, main } = ctx
	return main.replyWithMarkdownUpdate(ctx, [await user.buildFinanceInfo(), welcomeMarkup(ctx)])
}

financeScene.enter(async (ctx) => {
	return welcomeRequest(ctx)
})
	.action('payment', (ctx) => {
		return ctx.scene._enter(SCENE_ID_PAYMENT)
	})
	.action('withdrawal', (ctx) => {
		return ctx.scene._enter(SCENE_ID_WITHDRAWAL)
	})
	.action('history', (ctx) => {
		return ctx.scene._enter(SCENE_ID_HISTORY)
	})

module.exports = financeScene
