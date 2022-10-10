const { inlineKeyboard, button } = require('telegraf/lib/markup')
const { BaseScene } = require('telegraf/lib/scenes/base')
const Wizard = require('../telegraf/wizard')
const { scenes: { SCENE_ID_POSTS, SCENE_ID_GROUP_ITEM, SCENE_ID_DEFERRED } } = require('../const')
const { markup: { backRow }, scene: { enterHandler }, lang } = require('../utils')
const { yesNoMenuMarkup } = require('./../markups')

const groupMarkup = (ctx, groupDoc) => {
	const { from } = ctx
	const { id } = groupDoc
	const commands = []
	groupDoc.canViewReposts(from) && commands.push([button.callback(lang('cbReposts'), `reposts_${id}`)])
	groupDoc.canManageDeferred(from) &&	commands.push([button.callback(lang('cbDeferred'), `deferred_${id}`)])
	groupDoc.canActivate(from) && commands.push([button.callback(lang('cbActivate'), `activate_${id}`)])
	groupDoc.canStop(from) && commands.push([button.callback(lang('cbStop'), `stop_${id}`)])
	groupDoc.canDelete(from) &&	commands.push([button.callback(lang('cbDelete'), `delete_${id}`)])
	const buttons = [
		...commands,
		backRow(ctx)
	]
	return inlineKeyboard(buttons)
}

const groupRequest = async (ctx) => {
	const { from: { id: ownerId }, main, wizard: { state: { groupId } } } = ctx
	let group = await main.getGroup({ id: groupId, ownerId })
	group = await main.refreshGroupInfoCache(group, false)
	return main.replyWithMarkdownUpdate(ctx, [
		await group.toInfoStat(),
		groupMarkup(ctx, group)
	])
}

const stopRequest = (ctx, groupId) => {
	const { main } = ctx
	return main.replyWithMarkdownUpdate(ctx, [lang('sureStopGroup'), yesNoMenuMarkup(groupId)])
}

const deleteRequest = (ctx, groupId) => {
	const { main } = ctx
	return main.replyWithMarkdownUpdate(ctx, [lang('sureDeleteGroup'), yesNoMenuMarkup(groupId)])
}

const scene0 = new BaseScene(0)
	.enter(async (ctx) => {
		await groupRequest(ctx)
		return groupItemWizard.goToHandler(ctx, scene0)
	})
	.action(/activate_(.+)/, async (ctx) => {
		const { from, match, main } = ctx
		await main.activateGroupById(from, match[1])
		return scene0.reenter(ctx)
	})
	.action(/stop_(.+)/, (ctx) => {
		const { match, wizard: { state } } = ctx
		state['isDeleting'] = false
		state['isStopping'] = true
		return stopRequest(ctx, match[1])
	})
	.action(/delete_(.+)/, (ctx) => {
		const { match, wizard: { state } } = ctx
		state['isDeleting'] = true
		state['isStopping'] = false
		return deleteRequest(ctx, match[1])
	})
	.action(/reposts_(.+)/, (ctx) => {
		const { match } = ctx
		return ctx.scene._enter(SCENE_ID_POSTS, { isReposts: true, byGroup: match[1] })
	})
	.action(/deferred_(.+)/, (ctx) => {
		const { match } = ctx
		return ctx.scene._enter(SCENE_ID_DEFERRED, { groupId: match[1] })
	})
	.action([/(agree)_(.+)/, /(undo)_(.+)/], async (ctx) => {
		const { from, main, match, wizard: { state: { isDeleting } } } = ctx
		const isAgree = match[1] === 'agree'
		if (isAgree) {
			const handler = isDeleting ? main.deleteGroupById : main.stopGroupById
			await handler.call(main, from, match[2])
		}
		return scene0.reenter(ctx)
	})

const groupItemWizard = new Wizard(
	SCENE_ID_GROUP_ITEM,
	{
		enterHandlers: [enterHandler()]
	},
	[scene0]
)

module.exports = groupItemWizard
