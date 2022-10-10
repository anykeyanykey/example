const { POST_COST } = require("../const");
const { inlineKeyboard, button } = require('telegraf/lib/markup')
const { BaseScene } = require('telegraf/lib/scenes/base')
const Wizard = require('../telegraf/wizard')
const { TG_CHANNEL_NAME, TG_CHANNEL_LINK, scenes: { SCENE_ID_ADS, SCENE_ID_POSTS, SCENE_ID_POST_SETTINGS, SCENE_ID_PAYMENT } } = require('../const')
const { lang, reply: { dateRequest, hourRequest, timeRequest }, markup: { backRow, insertNavButtons, undoBackRow }, currency: { RUB }, scene: { enterHandler } } = require('../utils')
const { backMarkup, yesNoMenuMarkup } = require('./../markups')
const moment = require('moment-timezone')

const postMarkup = (ctx, post, skip, count) => {
	const { from } = ctx
	const { id } = post
	const commands = []
	post.canViewReposts(from) && commands.push([button.callback(lang('cbReposts'), `reposts-post_${id}`)])
	post.canActivate(from) && commands.push([button.callback(lang('cbActivate'), `activate-post_${id}`)])
	post.canDeactivate(from) && commands.push([button.callback(lang('cbDeactivate'), `deactivate-post_${id}`)])
	post.canStop(from) && commands.push([button.callback(lang('cbStop'), `stop-post_${id}`)])
	post.canDelete(from) &&	commands.push([button.callback(lang('cbDelete'), `delete-post_${id}`)])
	post.canConfig(from) &&	commands.push([button.callback(lang('cbSettings'), `settings-post_${id}`)])
	post.canRenew(from) && commands.push([button.callback(lang('cbRenew'), `renew-post_${id}`)])
	const buttons = [
		...commands,
		backRow(ctx)
	]
	return inlineKeyboard(insertNavButtons(buttons, commands.length, skip, count))
}

const confirmMarkup = () => {
	return inlineKeyboard([
		[button.callback(lang('allRight'), 'right')],
		undoBackRow()
	])
}

const noMoneyMarkup = () => {
	const commands = []
	commands.push([button.callback(lang('cbRefill'), `payment`)])
	const buttons = [
		...commands,
		undoBackRow()
	]
	return inlineKeyboard(buttons)
}

const noItemsRequestMarkup = (ctx, create = false) => {
	const commands = []
	create && commands.push([button.callback(lang('cbCreateAds'), `create-ads`)])
	const buttons = [
		...commands,
		backRow(ctx)
	]
	return inlineKeyboard(buttons)
}

const repostMarkup = (ctx, repost, skip, count) => {
	const { from } = ctx
	const { id } = repost
	const commands = []
	repost.canApproveByUser(from) && commands.push([button.callback(lang('cbConfirm'), `approve-repost-by-user_${id}`)])
	repost.canApproveByOwner(from) && commands.push([button.callback(lang('cbApprove'), `approve-repost_${id}`)])
	repost.canSetDate(from) && commands.push([button.callback(lang('cbChooseTime'), `date-repost_${id}`)])
	repost.canUndo(from) && commands.push([button.callback(lang('cbUndo'), `undo-repost_${id}`)])
	repost.canWhiteList(from) && commands.push([button.callback(lang('cbInWhiteList'), `whitelist_${id}`)])
	repost.canBlackList(from) && commands.push([button.callback(lang('cbInBlackList'), `blacklist_${id}`)])
	const buttons = [
		...commands,
		backRow(ctx)
	]
	return inlineKeyboard(insertNavButtons(buttons, commands.length, skip, count))
}

const renewMarkup = (ctx, canStart) => {
	const row = []
	if (canStart) {
		row.push(button.callback(lang('cbPost'), 'renew-agree'))
	} else {
		row.push(button.callback(lang('cbRefill'), 'payment'))
	}
	return inlineKeyboard([
		row,
		undoBackRow(ctx)
	])
}

const postRequest = async (ctx) => {
	const { from, main, chat: { id: chatId }, wizard: { state } } = ctx
	const { id: userId } = from
	const { count, skip, byPostId } = state
	const post = !byPostId ? await main.getPostSkip({ userId }, skip) : await main.getPost({ id: byPostId })
	const { id: postId, message } = post
	state['post'] = postId
	await main.sendPostMessage(ctx, message, chatId)
	return main.replyWithMarkdownUpdate(ctx, [await post.toInfoStat(), postMarkup(ctx, post, skip, count)])
}

const repostRequest = async (ctx) => {
	const { main, chat: { id: chatId }, wizard: { state }, from } = ctx
	const { count, skip, byPost, byGroup, byRepostId } = state
	let repost
	if (!byRepostId) {
		repost = byPost ? await main.getRepostSkipByPostId(byPost, skip) :
			await main.getRepostSkip({ groupId: byGroup }, null, skip)
	} else {
		repost = await main.getRepost({ id: byRepostId })
	}
	const { id: repostId, message, groupId } = repost
	state['repost'] = repostId
	state['groupId'] = groupId
	await main.sendPostMessage(ctx, message, chatId)
	return main.replyWithMarkdownUpdate(ctx, [
		repost.toInfoStat(from), repostMarkup(ctx, repost, skip, count)])
}

const noItemsRequest = async (ctx) => {
	const { main, wizard: { state } } = ctx
	const { isReposts, byPostId, byRepostId, byPost } = state
	if (!isReposts && !byPost) {
		main.deleteLastMessages(ctx, true)
	}
	const msg = byPostId ? lang('errorPostNotFound') : byRepostId ? lang('errorRepostNotFound') :
		isReposts ? lang('noReposts') : lang('noPosts')
	const noPosts = !byPostId && !byRepostId && !isReposts
	return main.replyWithMarkdownUpdate(ctx, [msg, noItemsRequestMarkup(ctx, noPosts)])
}

const renewSuccessRequest = async (ctx, { post, user: { balance } }) => {
	const { main } = ctx
	return main.replyWithMarkdownUpdate(ctx, [
		[lang('postSuccess'), post.toInfo(), lang('balance', balance.format())].join('\n'), backMarkup(ctx)])
}

const renewRequest = async (ctx) => {
	const { main, user: { balance } } = ctx
	const cost = RUB(POST_COST)
	const canStart = balance.value >= cost.value
	return main.replyWithMarkdownUpdate(ctx, [lang('welcomeRenew', cost.format(), balance.format(), TG_CHANNEL_NAME, TG_CHANNEL_LINK), {
		disable_web_page_preview: true,
		...renewMarkup(ctx, canStart)
	}])
}

const deactivateRequest = async (ctx, postId) => {
	const { main } = ctx
	return main.replyWithMarkdownUpdate(ctx, [lang('sureDeactivatePost'), yesNoMenuMarkup(postId)])
}

const stopRequest = async (ctx, postId) => {
	const { main } = ctx
	return main.replyWithMarkdownUpdate(ctx, [lang('sureStopPost'), yesNoMenuMarkup(postId)])
}

const deleteRequest = async (ctx, postId) => {
	const { main } = ctx
	return main.replyWithMarkdownUpdate(ctx, [lang('sureDeletePost', TG_CHANNEL_NAME, TG_CHANNEL_LINK),
		{ disable_web_page_preview: true, ...yesNoMenuMarkup(postId) }])
}

const whiteListRequest = async (ctx, repostId) => {
	const { main } = ctx
	return main.replyWithMarkdownUpdate(ctx, [lang('sureWhiteList', TG_CHANNEL_NAME, TG_CHANNEL_LINK), yesNoMenuMarkup(repostId)])
}

const blackListRequest = async (ctx, repostId) => {
	const { main } = ctx
	return main.replyWithMarkdownUpdate(ctx, [lang('sureBlackList', TG_CHANNEL_NAME, TG_CHANNEL_LINK), yesNoMenuMarkup(repostId)])
}

const undoRequest = async (ctx, repostId) => {
	const { main } = ctx
	const repost = await main.getRepost({ id: repostId })
	const isPosted = repost.isPosted()
	return main.replyWithMarkdownUpdate(ctx, [lang('sureUndoRepost', isPosted), yesNoMenuMarkup(repostId)])
}

const confirmDateRequest = (ctx) => {
	const { from: { timezone }, main, wizard: { state: { nearest, resultDate } } } = ctx
	return main.replyWithMarkdownUpdate(ctx, [nearest ? lang('confirmDateNearest') :
		lang('confirmDate', moment(resultDate).tz(timezone).format('LLL'), timezone), confirmMarkup()])
}

const approveRequest = async (ctx, repostId) => {
	const { main, from: { id: userId } } = ctx
	const { ownerCost } = await main.getRepost({ id: repostId })
	const { balance } = await main.getUser({ id: userId })
	if (balance.value < ownerCost.value) {
		return main.replyWithMarkdownUpdate(ctx, [lang('noMoneyApproveRepost', ownerCost.format()), noMoneyMarkup()])
	} else {
		return main.replyWithMarkdownUpdate(ctx, [lang('sureApproveRepost', ownerCost.format()), yesNoMenuMarkup(repostId)])
	}
}

const initialSet = async (ctx) => {
	const { from, main, wizard: { state } } = ctx
	const { id: userId } = from
	const { isReposts, byPost, byGroup, byPostId, byRepostId } = state
	if (byPostId) {
		state['count'] = await main.getPostCount({ id: byPostId })
	} else if (byRepostId) {
		state['count'] = await main.getRepostCount({ id: byRepostId })
	} else if (isReposts) {
		if (byPost) {
			state['count'] = await main.getRepostCountByPostId(byPost)
		} else {
			state['count'] = await main.getRepostCount({ groupId: byGroup })
		}
	} else {
		state['count'] = await main.getPostCount({ userId })
	}
	state['skip'] = state['skip'] || 0
}

const scene0 = new BaseScene(0)
	.enter(async (ctx) => {
		const { wizard: { state } } = ctx
		await initialSet(ctx)
		const { count, skip } = state
		if (count === 0) {
			await noItemsRequest(ctx)
			return postsWizard.goToHandler(ctx, scene0)
		} else if (skip) {
			if (skip >= count) {
				state['skip'] = count - 1
			} else {
				state['skip'] = skip
			}
		}
		return scene0.go(ctx, scene1, true)
	})
	.action(/create-ads/, (ctx) => {
		return ctx.scene._enter(SCENE_ID_ADS)
	})

const scene1 = new BaseScene(1)
	.leave((ctx) => {
		const { wizard: { state } } = ctx
		delete state['groupId']
	})
	.enter(async (ctx) => {
		const { wizard: { state: { isReposts } }  } = ctx
		const handler = isReposts ? repostRequest : postRequest
		await handler(ctx)
		return postsWizard.goToHandler(ctx, scene1)
	})
	.action(/renew-post_(.+)/, (ctx) => {
		return scene1.go(ctx, scene11)
	})
	.action([/(whitelist)_(.+)/, /(blacklist)_(.*)/], (ctx) => {
		const { match } = ctx
		if (match[1] === 'whitelist') {
			return scene1.go(ctx, scene12)
		} else {
			return scene1.go(ctx, scene13)
		}
	})
	.action(/reposts-post_(.+)/, (ctx) => {
		const { match } = ctx
		return ctx.scene._enter(SCENE_ID_POSTS, { isReposts: true, byPost: match[1] })
	})
	.action(/deactivate-post_(.+)/, (ctx) => {
		return scene1.go(ctx, scene8)
	})
	.action(/stop-post_(.+)/, (ctx) => {
		return scene1.go(ctx, scene9)
	})
	.action(/delete-post_(.+)/, (ctx) => {
		return scene1.go(ctx, scene10)
	})
	.action(/activate-post_(.+)/, async (ctx) => {
		const { from, main, match } = ctx
		await main.activatePostById(from, match[1])
		return scene1.reenter(ctx)
	})
	.action(/settings-post_(.+)/, (ctx) => {
		const { match } = ctx
		return ctx.scene._enter(SCENE_ID_POST_SETTINGS, { post: match[1] })
	})
	.action(/date-repost_(.+)/, (ctx) => {
		return scene1.go(ctx, scene4)
	})
	.action(/undo-repost_(.+)/, (ctx) => {
		return scene1.go(ctx, scene2)
	})
	.action(/approve-repost-by-user_(.*)/, async (ctx) => {
		const { from, main, match } = ctx
		await main.approveRepostByUserById(from, match[1])
		return scene1.reenter(ctx)
	})
	.action([/(approve-repost)_(.+)/, /(reject-repost)_(.+)/], async (ctx) => {
		const { from, main, match } = ctx
		const isApprove = match[1] === 'approve-repost'
		if (isApprove) {
			return scene1.go(ctx, scene3)
		} else {
			await main.rejectRepostById(from, match[2])
			return scene1.reenter(ctx)
		}
	})
	.action(['prev', 'next'], (ctx) => {
		const { match, wizard: { state } } = ctx
		state['skip'] = match[0] === 'next' ? ++state['skip'] : --state['skip']
		return scene1.go(ctx, scene0)
	})

const scene2 = new BaseScene(2)
	.enter(async (ctx) => {
		const { wizard: { state: { repost: repostId } } } = ctx
		await undoRequest(ctx, repostId)
		return postsWizard.goToHandler(ctx, scene2)
	})
	.action([/(agree)_(.+)/, /(undo)_(.+)/], async (ctx) => {
		const { from, main, match } = ctx
		const isAgree = match[1] === 'agree'
		if (isAgree) {
			await main.undoRepostById(from, match[2])
		}
		return postsWizard.goBack(ctx)
	})

const scene3 = new BaseScene(3)
	.enter(async (ctx) => {
		const { wizard: { state: { repost: repostId } } } = ctx
		await approveRequest(ctx, repostId)
		return postsWizard.goToHandler(ctx, scene3)
	})
	.action('payment', (ctx) => {
		return ctx.scene._enter(SCENE_ID_PAYMENT)
	})
	.action([/(agree)_(.+)/, /(undo)_(.+)/], async (ctx) => {
		const { from, main, match } = ctx
		const isAgree = match[1] === 'agree'
		if (isAgree) {
			await main.approveRepostById(from, match[2])
		}
		return postsWizard.goBack(ctx)
	})

const scene4 = new BaseScene(4)
	.enter(async (ctx) => {
		const { wizard: { state } } = ctx
		delete state['nearest']
		delete state['postDate']
		delete state['resultDate']
		await dateRequest(ctx, true)
		return postsWizard.goToHandler(ctx, scene4)
	})
	.action(/nearest/, (ctx) => {
		const { wizard: { state } } = ctx
		state['nearest'] = true
		state['resultDate'] = moment().format()
		return scene4.go(ctx, scene7)
	})
	.action(/date_(.*)/, (ctx) => {
		const { match, wizard: { state } } = ctx
		state['postDate'] = match[1]
		return scene4.go(ctx, scene5)
	})

const scene5 = new BaseScene(5)
	.enter(async (ctx) => {
		const { wizard: { state } } = ctx
		delete state['postHour']
		await hourRequest(ctx, true)
		return postsWizard.goToHandler(ctx, scene5)
	})
	.action(/hour_(.*)/, (ctx) => {
		const { match, wizard: { state } } = ctx
		state['postHour'] = match[1]
		return scene5.go(ctx, scene6)
	})

const scene6 = new BaseScene(6)
	.enter(async (ctx) => {
		await timeRequest(ctx, true)
		return postsWizard.goToHandler(ctx, scene6)
	})
	.action(/time_(.*)/, async (ctx) => {
		const { match, wizard: { state } } = ctx
		const { postHour } = state
		const timeM = moment(match[1])
		const resultM = moment(postHour).clone().minutes(timeM.minutes())
		state['resultDate'] = resultM.format()
		return scene6.go(ctx, scene7)
	})

const scene7 = new BaseScene(7)
	.enter(async (ctx) => {
		await confirmDateRequest(ctx)
		return postsWizard.goToHandler(ctx, scene7)
	})
	.action('right', async (ctx) => {
		const { from, main, wizard: { state } } = ctx
		const { resultDate, repost: repostId } = state
		await main.setDateRepostById(from, repostId, resultDate)
		return postsWizard.goBack(ctx, scene1)
	})

const scene8 = new BaseScene(8)
	.enter(async (ctx) => {
		const { wizard: { state: { post: postId } } } = ctx
		await deactivateRequest(ctx, postId)
		return postsWizard.goToHandler(ctx, scene8)
	})
	.action([/(agree)_(.+)/, /(undo)_(.+)/], async (ctx) => {
		const { from, main, match } = ctx
		const isAgree = match[1] === 'agree'
		if (isAgree) {
			await main.deactivatePostById(from, match[2])
		}
		return postsWizard.goBack(ctx)
	})

const scene9 = new BaseScene(9)
	.enter(async (ctx) => {
		const { wizard: { state: { post: postId } } } = ctx
		await stopRequest(ctx, postId)
		return postsWizard.goToHandler(ctx, scene9)
	})
	.action([/(agree)_(.+)/, /(undo)_(.+)/], async (ctx) => {
		const { from, main, match } = ctx
		const isAgree = match[1] === 'agree'
		if (isAgree) {
			await main.stopPostById(from, match[2])
		}
		return postsWizard.goBack(ctx)
	})

const scene10 = new BaseScene(10)
	.enter(async (ctx) => {
		const { wizard: { state: { post: postId } } } = ctx
		await deleteRequest(ctx, postId)
		return postsWizard.goToHandler(ctx, scene10)
	})
	.action([/(agree)_(.+)/, /(undo)_(.+)/], async (ctx) => {
		const { from, main, match } = ctx
		const isAgree = match[1] === 'agree'
		if (isAgree) {
			await main.deletePostById(from, match[2])
		}
		return postsWizard.goBack(ctx)
	})

const scene11 = new BaseScene(11)
	.enter(async (ctx) => {
		await renewRequest(ctx)
		return postsWizard.goToHandler(ctx, scene11)
	})
	.action(/renew-agree/, async (ctx) => {
		const { from, main, wizard: { state } } = ctx
		const { post: postId } = state
		const result = await main.renewPostById(from, postId)
		return renewSuccessRequest(ctx, result)
	})
	.action(/payment/, (ctx) => {
		return ctx.scene._enter(SCENE_ID_PAYMENT)
	})

const scene12 = new BaseScene(12)
	.enter(async (ctx) => {
		const { wizard: { state: { repost: repostId } } } = ctx
		await whiteListRequest(ctx, repostId)
		return postsWizard.goToHandler(ctx, scene12)
	})
	.action([/(agree)_(.+)/, /(undo)_(.+)/], async (ctx) => {
		const { from, main, match } = ctx
		const isAgree = match[1] === 'agree'
		if (isAgree) {
			await main.whiteListByRepostId(from, match[2])
		}
		return postsWizard.goBack(ctx)
	})

const scene13 = new BaseScene(13)
	.enter(async (ctx) => {
		const { wizard: { state: { repost: repostId } } } = ctx
		await blackListRequest(ctx, repostId)
		return postsWizard.goToHandler(ctx, scene13)
	})
	.action([/(agree)_(.+)/, /(undo)_(.+)/], async (ctx) => {
		const { from, main, match } = ctx
		const isAgree = match[1] === 'agree'
		if (isAgree) {
			await main.blackListByRepostId(from, match[2])
		}
		return postsWizard.goBack(ctx)
	})

const postsWizard = new Wizard(
	SCENE_ID_POSTS,
	{
		enterHandlers: [enterHandler(true)]
	},
	[scene0, scene1, scene2, scene3, scene4, scene5, scene6, scene7, scene8, scene9, scene10, scene11, scene12, scene13]
)

module.exports = postsWizard
