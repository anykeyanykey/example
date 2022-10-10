const { inlineKeyboard, button } = require('telegraf/lib/markup')
const { BaseScene } = require('telegraf/lib/scenes/base')
const { backMarkup, undoBackMarkup, settings: { repostCostRequestMarkup } } = require('./../markups')
const Wizard = require('../telegraf/wizard')
const { scenes: { SCENE_ID_REPOST, SCENE_ID_GROUP, SCENE_ID_POSTS }, POST_LIFETIME, POST_LIFETIME_UNIT } = require('../const')
const { lang, markup: { backRow, undoBackRow  }, scene: { enterHandler } } = require('../utils')
const { SafeError } = require('./../errors')

const confirmRequestMarkup = (ctx) => {
	return inlineKeyboard([
		[button.callback(lang('cbYes'), `yes`)],
		undoBackRow(ctx)
	])
}

const channelRequestMarkup = (ctx, groups) => {
	return inlineKeyboard([
		...groups.map(({ id, title }) => button.callback(title, `choose_${id}`)).toChunks(1),
		[button.callback(lang('cbAddNew'), `add`)],
		backRow(ctx)
	])
}

const configExistMarkup = (ctx, { id }) => {
	return inlineKeyboard([[button.callback(lang('cbConfig'), `config_${id}`)], undoBackRow(ctx)])
}

const successRequest = async (ctx) => {
	const { from, main, wizard: { state } } = ctx
	const { repost: repostId } = state
	const repostDoc = await main.approveRepostByUserById(from, repostId)
	return main.replyWithMarkdownUpdate(ctx, [[lang('ownerWillBeSent'), repostDoc.toInfo(from)].join('\n'), backMarkup(ctx)])
}

const costRequest = (ctx) => {
	const { main } = ctx
	return main.replyWithMarkdownUpdate(ctx, [[lang('repostCostStr'), lang('chooseOrType')].join('\n'), repostCostRequestMarkup()])
}

const repostCostReply = (ctx) => {
	const { main, match, wizard: { state } } = ctx
	const sum = parseFloat(match[1].replace(/,/g, '.').substr(0, 6))
	const cost = sum && !isNaN(sum) && isFinite(sum) ? sum : 0
	if (!cost) {
		return main.replyNotify(ctx, [lang('wrongSum')])
	} else {
		state['cost'] = cost
		return scene1.go(ctx, scene2)
	}
}

const checkBlackListed = async (ctx) => {
	const { main, wizard: { state } } = ctx
	const { channel: channelId, post: postId } = state
	const postDoc = await main.getPost({ id: postId }, { populate: 'ownerSettings' })
	const { ownerSettings: { blackList } } = postDoc
	if (blackList.find(({ id }) => id === channelId)) {
		await main.replyNotify(ctx, [lang('errorChannelBlackListed')])
		return false
	}
	return true
}

const confirmRequest = async (ctx) => {
	const { main, wizard: { state } } = ctx
	const { channel: channelId, post: postId, cost: repostCost } = state

	const [groupDoc, postDoc] = await Promise.all([
		main.getGroup({ id: channelId }), main.getPost({ id: postId })
	])

	await main.refreshGroupInfoCache(groupDoc)

	const { info } = groupDoc

	const error = main.validateGroupInfoPostSum(info, postDoc, repostCost)

	if (error) {
		return main.replyWithMarkdownUpdate(ctx, [error, undoBackMarkup(ctx)])
	}

	const active = await main.getActiveRepost(channelId, postId)

	if (active) {
		return main.replyWithMarkdownUpdate(ctx, [lang('youAlreadyHaveRepost'), configExistMarkup(ctx, active)])
	}

	const { id: repostId, cost, needToPin } = await main.createRepost(channelId, postId, repostCost)

	state['repost'] = repostId

	return main.replyWithMarkdownUpdate(ctx, [
		lang('repostConfirmRequest', repostId, groupDoc.channelTitleLink(), cost.format(), needToPin, POST_LIFETIME, POST_LIFETIME_UNIT),
		{ ...confirmRequestMarkup(ctx), disable_web_page_preview: true }])
}

const channelRequest = async (ctx) => {
	const { user, from, main, wizard: { state }, chat: { id: chatId } } = ctx
	const { post } = state

	const postDoc = await main.getPost({ id: post })

	if (!postDoc.canRepost()) {
		throw new SafeError(lang('repostIsProhibitedByOwner'))
	}

	const { userId, message } = postDoc

	if (userId === from.id) {
		throw new SafeError(lang('errorCantRepostByOwner'))
	}

	await main.sendPostMessage(ctx, message, chatId)

	return main.replyWithMarkdownUpdate(ctx, [
		[lang('chooseGroup'), postDoc.toInfo(1), postDoc.toSettingsInfo()].join('\n'),
		channelRequestMarkup(ctx, await user.getActiveGroups())])
}

const scene0 = new BaseScene(0)
	.enter(async (ctx) => {
		const { from: { id: userId }, main } = ctx
		await main.deleteUnconfirmedReposts({ userId })
		await channelRequest(ctx)
		return repostWizard.goToHandler(ctx, scene0)
	})
	.action(/choose_(.+)/, async (ctx) => {
		const { wizard: { state }, match } = ctx
		state['channel'] = match[1]
		const result = await checkBlackListed(ctx)
		return result && scene0.go(ctx, scene1)
	})
	.action('add', (ctx) => {
		return ctx.scene._enter(SCENE_ID_GROUP)
	})

const scene1 = new BaseScene(1)
	.enter(async (ctx) => {
		const { from: { id: userId }, main } = ctx
		await main.deleteUnconfirmedReposts({ userId })
		await costRequest(ctx)
		return repostWizard.goToHandler(ctx, scene1)
	})
	.action(/set-cost_(.*)/, repostCostReply)
	.hears(/(.*)/, repostCostReply)

const scene2 = new BaseScene(2)
	.enter(async (ctx) => {
		await confirmRequest(ctx)
		return repostWizard.goToHandler(ctx, scene2)
	})
	.action('yes', (ctx) => {
		return successRequest(ctx)
	})
	.action(/config_(.*)/, (ctx) => {
		const { match } = ctx
		return ctx.scene._enter(SCENE_ID_POSTS, { isReposts: true, byRepostId: match[1] }, true)
	})

const repostWizard = new Wizard(
	SCENE_ID_REPOST,
	{
		enterHandlers: [enterHandler(true)],
		leaveHandlers: [async (ctx, next) => {
			const { from: { id: userId }, main } = ctx
			await main.deleteUnconfirmedReposts({ userId })
			next()
		}]
	},
	[scene0, scene1, scene2]
)

module.exports = repostWizard
