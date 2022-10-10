const Wizard = require('../telegraf/wizard')
const { BaseScene } = require('telegraf/lib/scenes/base')
const { scenes: { SCENE_ID_HISTORY, SCENE_ID_USER } } = require('../const')
const { inlineKeyboard, button } = require('telegraf/lib/markup')
const { lang, scene: { enterHandler }, markup: { backRow } } = require('../utils')
const { yesNoMenuMarkup } = require('../markups')

const welcomeMarkup = (ctx, { banned }) => {
	return inlineKeyboard([
		[button.callback(lang('cbHistory'), 'history')],
		(banned ? [button.callback(lang('cbUnban'), 'unban')] : [button.callback(lang('cbBan'), 'ban')]),
		backRow(ctx)
	])
}

const welcomeRequest = async (ctx) => {
	const { main, wizard: { state: { user } } } = ctx
	const userDoc = await main.getUser({ id: user })
	return main.replyWithMarkdownUpdate(ctx, [[lang('userId', user),
		await userDoc.buildFinanceInfo()].join('\n'), welcomeMarkup(ctx, userDoc)])
}

const banRequest = async (ctx) => {
	const { main, wizard: { state: { user } } } = ctx
	return main.replyWithMarkdownUpdate(ctx, [lang('sureBan'), yesNoMenuMarkup(user)])
}

const scene0 = new BaseScene(0)
	.enter(async (ctx) => {
		await welcomeRequest(ctx)
		return userWizard.goToHandler(ctx, scene0)
	})
	.action('history', (ctx) => {
		const { wizard: { state: { user } } } = ctx
		return ctx.scene._enter(SCENE_ID_HISTORY, { user })
	})
	.action([/^ban/, /^unban/], (ctx) => {
		const { wizard: { state }, match } = ctx
		state['ban'] = match[0] === 'ban'
		return scene0.go(ctx, scene1)
	})

const scene1 = new BaseScene(1)
	.enter(async (ctx) => {
		await banRequest(ctx)
		return userWizard.goToHandler(ctx, scene1)
	})
	.action([/(agree)_(.+)/, /(undo)_(.+)/], async (ctx) => {
		const { main, match, wizard: { state } } = ctx
		const isAgree = match[1] === 'agree'
		if (isAgree) {
			await main.banUserById(Number(match[2]), state['ban'])
		}
		return userWizard.goBack(ctx)
	})

const userWizard = new Wizard(
	SCENE_ID_USER,
	{
		enterHandlers: [enterHandler()]
	},
	[scene0, scene1]
)

module.exports = userWizard
