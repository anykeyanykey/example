const { inlineKeyboard, button } = require('telegraf/lib/markup')
const { BaseScene } = require('telegraf/lib/scenes/base')
const Wizard = require('../telegraf/wizard')
const { scenes: { SCENE_ID_LIST } } = require('../const')
const { markup: { backRow, insertNavButtons }, scene: { enterHandler }, lang } = require('../utils')
const { backMarkup } = require('./../markups')

const groupMarkup = (ctx, groupDoc, skip, count) => {
	const { id } = groupDoc
	const commands = []
	commands.push([button.callback(lang('cbRemove'), `remove_${id}`)])
	const buttons = [
		...commands,
		backRow(ctx)
	]
	return inlineKeyboard(insertNavButtons(buttons, commands.length, skip, count))
}

const groupRequest = async (ctx) => {
	const { from: { id: userId }, main, wizard: { state } } = ctx
	const { count, skip, white } = state
	let group
	if (white) {
		const { whiteList } = await main.getSettings({ userId },
			{ populate: { path: 'whiteList', options: { skip } } })
		const [item] = whiteList
		group = item
	} else {
		const { blackList }  = await main.getSettings({ userId },
			{ populate: { path: 'blackList', options: { skip } } })
		const [item] = blackList
		group = item
	}
	return main.replyWithMarkdownUpdate(ctx, [
		[
			group.toInfo(1),
			(white ? `${lang('whiteListed')}` : `${lang('blackListed')}`)
		].join('\n'),
		groupMarkup(ctx, group, skip, count)
	])
}

const noGroupRequest = async (ctx) => {
	const { main } = ctx
	return main.replyWithMarkdownUpdate(ctx, [lang('noChannels'), backMarkup(ctx)])
}

const initialSet = async (ctx) => {
	const { from, main, wizard: { state } } = ctx
	const { white } = state
	const { id: userId } = from
	if (white) {
		const { whiteListCount } = await main.getSettings({ userId }, { populate: 'whiteListCount' })
		state['count'] = whiteListCount
	} else {
		const { blackListCount } = await main.getSettings({ userId }, { populate: 'blackListCount' })
		state['count'] = blackListCount
	}
	state['skip'] = state['skip'] || 0
}

const scene0 = new BaseScene(0)
	.enter(async (ctx) => {
		const { wizard: { state } } = ctx
		await initialSet(ctx)
		const { count, skip } = state
		if (count === 0) {
			return noGroupRequest(ctx)
		} else if (skip) {
			if (skip >= count) {
				state['skip'] = count - 1
			} else {
				state['skip'] = skip
			}
			return scene0.go(ctx, scene1)
		} else {
			return scene0.go(ctx, scene1)
		}
	})

const scene1 = new BaseScene(1)
	.enter(async (ctx) => {
		await groupRequest(ctx)
		return listWizard.goToHandler(ctx, scene1)
	})
	.action(/remove_(.+)/, async (ctx) => {
		const { from, match, main } = ctx
		await main.removeFromListByGroupId(from, match[1])
		return listWizard.goBack(ctx)
	})
	.action(['prev', 'next'], (ctx) => {
		const { match, wizard: { state } } = ctx
		state['skip'] = match[0] === 'next' ? ++state['skip'] : --state['skip']
		return scene1.go(ctx, scene0)
	})


const listWizard = new Wizard(
	SCENE_ID_LIST,
	{
		enterHandlers: [enterHandler()]
	},
	[scene0, scene1]
)

module.exports = listWizard
