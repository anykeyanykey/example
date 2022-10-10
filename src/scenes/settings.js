const { inlineKeyboard, button } = require('telegraf/lib/markup')
const { BaseScene } = require('telegraf/lib/scenes/base')
const Wizard = require('../telegraf/wizard')
const { TG_ADMIN_LINK, scenes: { SCENE_ID_SETTINGS, SCENE_ID_POST_SETTINGS, SCENE_ID_LIST, SCENE_ID_TIMEZONE } } = require('../const')
const { markup: { backRow }, scene: { enterHandler }, lang } = require('../utils')
const { undoBackMarkup } = require('../markups')

const welcomeMarkup = (ctx) => {
	const actions = []
	actions.push(button.callback(lang('cbTimezone'), 'timezone'))
	actions.push(button.callback(lang('cbAds'), 'post-settings'))
	actions.push(button.callback(lang('cbWhiteList'), 'white-list'))
	actions.push(button.callback(lang('cbBlackList'), 'black-list'))
	return inlineKeyboard([
		...actions.toChunks(2),
		[button.callback(lang('cbFeedback'), 'feedback')],
		backRow(ctx)
	]).resize()
}

const welcomeSettings = async (ctx) => {
	const { from: { id, timezone }, main } = ctx
	return main.replyWithMarkdownUpdate(ctx, [
		[lang('welcomeSettings', id), lang('timezone', timezone)].join('\n'), welcomeMarkup(ctx)])
}

const feedbackReply = async (ctx) => {
	const { from: { id }, main } = ctx
	return main.replyWithMarkdownUpdate(ctx, [
		lang('feedbackWelcome', TG_ADMIN_LINK, id), undoBackMarkup(ctx)])
}

const scene0 = new BaseScene(0)
	.enter(async (ctx) => {
		await welcomeSettings(ctx)
		return settingsWizard.goToHandler(ctx, scene0)
	})
	.action('timezone', (ctx) => {
		return ctx.scene._enter(SCENE_ID_TIMEZONE)
	})
	.action('post-settings', (ctx) => {
		return ctx.scene._enter(SCENE_ID_POST_SETTINGS, { isDefault: true })
	})
	.action([/(white)-list/, /(black)-list/], (ctx) => {
		const { match } = ctx
		return ctx.scene._enter(SCENE_ID_LIST, { white: match[1] === 'white' })
	})
	.action(/feedback/, (ctx) => {
		return scene0.go(ctx, scene1)
	})

const scene1 = new BaseScene(1)
	.enter(async (ctx) => {
		await feedbackReply(ctx)
		return settingsWizard.goToHandler(ctx, scene1)
	})

const settingsWizard = new Wizard(
	SCENE_ID_SETTINGS,
	{
		enterHandlers: [enterHandler()]
	},
	[scene0, scene1]
)

module.exports = settingsWizard
