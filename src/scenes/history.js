const { inlineKeyboard } = require('telegraf/lib/markup')
const { BaseScene } = require('telegraf/lib/scenes/base')
const Wizard = require('../telegraf/wizard')
const { scenes: { SCENE_ID_HISTORY } } = require('../const')
const { markup: { backRow, insertNavButtons }, scene: { enterHandler }, lang } = require('../utils')
const { backMarkup } = require('./../markups')

const PAGE_SIZE = 5

const itemsRequestMarkup = (ctx, skip, count) => {
	const buttons = [backRow(ctx)]
	return inlineKeyboard(insertNavButtons(buttons, 0, skip, count, PAGE_SIZE))
}

const itemsRequest = async (ctx) => {
	const { from, main, wizard: { state } } = ctx
	const { id: userId, timezone } = from
	const { count, skip, user } = state
	const _userId = user || userId
	const items = await main.getFlowsSkip({ userId: _userId }, { skip, limit: PAGE_SIZE })
	return main.replyWithMarkdownUpdate(ctx, [
		[lang('timezone', timezone), ...items.map((item) => item.toInfo(from))].join('\n'),
		itemsRequestMarkup(ctx, skip, count)
	])
}

const noItemsRequest = async (ctx) => {
	const { main } = ctx
	return main.replyWithMarkdownUpdate(ctx, [lang('noItems'), backMarkup(ctx)])
}

const initialSet = async (ctx) => {
	const { from, main, wizard: { state } } = ctx
	const { user } = state
	const { id: userId } = from
	const _userId = user || userId
	state['count'] = await main.getFlowCount({ userId: _userId })
	state['skip'] = state['skip'] || 0
}

const scene0 = new BaseScene(0)
	.enter(async (ctx) => {
		const { wizard: { state } } = ctx
		await initialSet(ctx)
		const { count } = state
		if (count === 0) {
			return noItemsRequest(ctx)
		} else {
			return scene0.go(ctx, scene1, true)
		}
	})

const scene1 = new BaseScene(1)
	.enter(async (ctx) => {
		await itemsRequest(ctx)
		return historyWizard.goToHandler(ctx, scene1)
	})
	.action(['prev', 'next'], (ctx) => {
		const { match, wizard: { state } } = ctx
		state['skip'] = match[0] === 'next' ? state['skip'] + PAGE_SIZE : state['skip'] - PAGE_SIZE
		return scene1.go(ctx, scene0)
	})

const historyWizard = new Wizard(
	SCENE_ID_HISTORY,
	{
		enterHandlers: [enterHandler()]
	},
	[scene0, scene1]
)

module.exports = historyWizard
