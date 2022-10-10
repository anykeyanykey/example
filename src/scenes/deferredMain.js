const { inlineKeyboard, button } = require('telegraf/lib/markup')
const { BaseScene } = require('telegraf/lib/scenes/base')
const Wizard = require('../telegraf/wizard')
const { scenes: { SCENE_ID_GROUP, SCENE_ID_DEFERRED, SCENE_ID_DEFERRED_MAIN } } = require('../const')
const { lang, markup: { backRow }, scene: { enterHandler } } = require('../utils')

const channelRequestMarkup = (ctx, groups) => {
	return inlineKeyboard([
		...groups.map(({ id, title }) => button.callback(title, `choose_${id}`)).toChunks(1),
		[button.callback(lang('cbAddNew'), `add`)],
		backRow(ctx)
	])
}

const welcomeRequest = async (ctx) => {
	const { main, user } = ctx
	return main.replyWithMarkdownUpdate(ctx, [lang('chooseDeferredGroup'),
		channelRequestMarkup(ctx, await user.getGroups())])
}

const scene0 = new BaseScene(0)
	.enter(async (ctx) => {
		await welcomeRequest(ctx)
		return deferredMainWizard.goToHandler(ctx, scene0)
	})
	.action(/choose_(.+)/, (ctx) => {
		const { match } = ctx
		return ctx.scene._enter(SCENE_ID_DEFERRED, { groupId: match[1] })
	})
	.action('add', (ctx) => {
		return ctx.scene._enter(SCENE_ID_GROUP)
	})

const deferredMainWizard = new Wizard(
	SCENE_ID_DEFERRED_MAIN,
	{
		enterHandlers: [enterHandler()]
	},
	[scene0]
)

module.exports = deferredMainWizard
