const { inlineKeyboard, button } = require('telegraf/lib/markup')
const { BaseScene } = require('telegraf/lib/scenes/base')
const Wizard = require('../telegraf/wizard')
const { scenes: { SCENE_ID_TIMEZONE } } = require('../const')
const { markup: { undoBackRow, backRow }, scene: { enterHandler }, lang } = require('../utils')
const { backMarkup } = require('./../markups')
const { uniq } = require('lodash')
const moment = require('moment-timezone')

const welcomeRequestMarkup = (ctx, items) => {
	const commands = items.map((item) => button.callback(item, `set-offset_${item}`))
	const buttons = [
		...commands.toChunks(4),
		backRow(ctx)
	]
	return inlineKeyboard(buttons)
}

const timezoneRequestMarkup = (ctx, items) => {
	const commands = items.map((item) => button.callback(item, `set-timezone_${item}`))
	const buttons = [
		...commands.toChunks(2),
		undoBackRow(ctx)
	]
	return inlineKeyboard(buttons)
}

const welcomeRequest = async (ctx) => {
	const { main } = ctx
	const items = uniq(moment.tz.names().map(zone => moment().tz(zone).format('Z'))).sort()
	return main.replyWithMarkdownUpdate(ctx, [lang('timezoneOffsetQuestion'), welcomeRequestMarkup(ctx, items)])
}

const timezoneRequest = async (ctx) => {
	const { main, wizard: { state } } = ctx
	const { offset } = state
	const items = moment.tz.names().filter((zone) => moment().tz(zone).format('Z') === offset).sort()
	return main.replyWithMarkdownUpdate(ctx, [lang('timezoneQuestion'), timezoneRequestMarkup(ctx, items)])
}

const successRequest = (ctx, settingsDoc) => {
	const { main } = ctx
	return main.replyWithMarkdownUpdate(ctx, [
		[lang('settingsAreSaved'), settingsDoc.toInfo(1)].join('\n'), backMarkup(ctx)])
}

const scene0 = new BaseScene(0)
	.enter(async (ctx) => {
		await welcomeRequest(ctx)
		return timezoneWizard.goToHandler(ctx, scene0)
	})
	.action(/set-offset_(.*)/, (ctx) => {
		const { match, wizard: { state } } = ctx
		state['offset'] = match[1]
		return scene0.go(ctx, scene1)
	})

const scene1 = new BaseScene(1)
	.enter(async (ctx) => {
		await timezoneRequest(ctx)
		return timezoneWizard.goToHandler(ctx, scene1)
	})
	.action(/set-timezone_(.*)/, async (ctx) => {
		const { from, main, match } = ctx
		const settingsDoc = await main.updateSettings({ from, settings: { timezone: match[1] } })
		return successRequest(ctx, settingsDoc)
	})


const timezoneWizard = new Wizard(
	SCENE_ID_TIMEZONE,
	{
		enterHandlers: [enterHandler()]
	},
	[scene0, scene1]
)

module.exports = timezoneWizard
