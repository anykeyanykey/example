const Wizard = require('../telegraf/wizard')
const { BaseScene } = require('telegraf/lib/scenes/base')
const { scenes: { SCENE_ID_POST_SETTINGS } } = require('../const')
const { markup: { backRow }, scene: { enterHandler }, lang } = require('../utils')
const { inlineKeyboard, button } = require('telegraf/lib/markup')
const { undoBackMarkup, settings: { maxCostRequestMarkup, costRequestMarkup, limitFromRequestMarkup, limitToRequestMarkup, pinRequestMarkup, limitsRequestMarkup } } = require('./../markups');

const welcomeMarkup = (ctx, post) => {
	const { from } = ctx
	const actions = []
	if (!post || post.canSetMaxCost(from))
		actions.push([button.callback(lang('cbCost'), 'cost')])
	if (!post || post.canSetLimit(from))
		actions.push([button.callback(lang('cbLimits'), 'limits')])
	if (!post || post.canSetPin(from))
		actions.push([button.callback(lang('cbPin'), 'pin')])
	return inlineKeyboard([
		...actions,
		backRow(ctx)
	]).resize()
}

const welcomeSettings = async (ctx) => {
	const { from: { id: userId },  main, chat: { id: chatId }, wizard: { state } } = ctx
	const { post: postId } = state
	let msg, postDoc
	if (postId) {
		postDoc = await main.getPost({ id: postId })
		const { message } = postDoc
		await main.sendPostMessage(ctx, message, chatId)
		msg = postDoc.toSettingsInfo()
	} else {
		const settingsDoc = await main.getSettings({ userId })
		msg = [lang('setDefaultSettings'), settingsDoc.toInfo()].join('\n')
	}
	return main.replyWithMarkdownUpdate(ctx, [msg, welcomeMarkup(ctx, postDoc)])
}

const costRequest = async (ctx) => {
	const { main } = ctx
	return main.replyWithMarkdownUpdate(ctx, [lang('repostRewardStr'), costRequestMarkup(ctx)])
}

const maxCostRequest = async (ctx) => {
	const { main } = ctx
	return main.replyWithMarkdownUpdate(ctx, [[lang('repostMaxCostStr'), lang('chooseOrType')].join('\n'), maxCostRequestMarkup(ctx)])
}

const limitsRequest = async (ctx) => {
	const { from: { id: userId }, main, wizard: { state } } = ctx
	const { post: postId } = state
	let msg, postDoc
	if (postId) {
		postDoc = await main.getPost({ id: postId })
		msg = postDoc.toSettingsInfo(3)
	} else {
		const { postSettings } = await main.getSettings({ userId })
		msg = postSettings.toInfo(3)
	}
	return main.replyWithMarkdownUpdate(ctx, [msg, limitsRequestMarkup(ctx)])
}

const limitFromRequest = async (ctx) => {
	const { main } = ctx
	return main.replyWithMarkdownUpdate(ctx, [lang('repostLimitFromStr'), limitFromRequestMarkup(ctx)])
}

const limitToRequest = async (ctx) => {
	const { main } = ctx
	return main.replyWithMarkdownUpdate(ctx, [lang('repostLimitToStr'), limitToRequestMarkup(ctx)])
}

const requirementsRequest = async (ctx) => {
	const { main } = ctx
	return main.replyWithMarkdownUpdate(ctx, [lang('repostRequirementsStr'), undoBackMarkup(ctx)])
}

const pinRequest = async (ctx) => {
	const { main } = ctx
	return main.replyWithMarkdownUpdate(ctx, [lang('repostPinStr'), pinRequestMarkup(ctx)])
}

const maxCostReply = async (ctx) => {
	const { from, main, match, wizard: { state } } = ctx
	const { post: postId } = state
	const sum = parseFloat(match[1].replace(/,/g, '.').substr(0, 6))
	const maxCost = sum && !isNaN(sum) && isFinite(sum) ? sum : 0
	const handler = !postId ? main.updateSettings : main.setPostMaxCostById
	await handler.call(main, !postId ? { from, settings: { postSettings: { maxCost } } } : { from, postId, maxCost })
	return postSettingsWizard.goBack(ctx)
}

const scene0 = new BaseScene(0)
	.enter(async (ctx) => {
		await welcomeSettings(ctx)
		return postSettingsWizard.goToHandler(ctx, scene0)
	})
	.action('cost', (ctx) => {
		return scene0.go(ctx, scene7)
	})
	.action('limits', (ctx) => {
		return scene0.go(ctx, scene2)
	})
	.action('requirements', (ctx) => {
		return scene0.go(ctx, scene3)
	})
	.action('pin', (ctx) => {
		return scene0.go(ctx, scene4)
	})

const scene1 = new BaseScene(1)
	.enter(async (ctx) => {
		await costRequest(ctx)
		return postSettingsWizard.goToHandler(ctx, scene1)
	})
	.action(/set-cost_(.*)/, async (ctx) => {
		const { from, main, match, wizard: { state } } = ctx
		const { post: postId } = state
		const coefficient = parseFloat(match[1])
		const handler = !postId ? main.updateSettings : main.setPostCoefficientById
		await handler.call(main, !postId ? { from, settings: { postSettings: { coefficient } } } : { from, postId, coefficient })
		return postSettingsWizard.goBack(ctx)
	})

const scene2 = new BaseScene(2)
	.enter(async (ctx) => {
		await limitsRequest(ctx)
		return postSettingsWizard.goToHandler(ctx, scene2)
	})
	.action([/limit-(from)/, /limit-(to)/], (ctx) => {
		const { match } = ctx
		if (match[1] === 'from') {
			return scene2.go(ctx, scene5)
		} else {
			return scene2.go(ctx, scene6)
		}
	})

const scene3 = new BaseScene(3)
	.enter(async (ctx) => {
		await requirementsRequest(ctx)
		return postSettingsWizard.goToHandler(ctx, scene3)
	})
	.use(async (ctx) => {
		const { from, main, message: { text: requirements }, wizard: { state } } = ctx
		const { post: postId } = state
		if (requirements.length <= 100) { // todo
			const handler = !postId ? main.updateSettings : main.setPostRequirementsById
			await handler.call(main, !postId ? { from, settings: { postSettings: { requirements } } } : { from, postId, requirements })
			return postSettingsWizard.goBack(ctx)
		}
		return main.replyNotify(ctx, ['limit'])
	})

const scene4 = new BaseScene(4)
	.enter(async (ctx) => {
		await pinRequest(ctx)
		return postSettingsWizard.goToHandler(ctx, scene4)
	})
	.action([/set-pin-yes/, /set-pin-no/], async (ctx) => {
		const { from, main, wizard: { state }, match } = ctx
		const { post: postId } = state
		const pin = match[0] === 'set-pin-yes'
		const handler = !postId ? main.updateSettings : main.setPostPinById
		await handler.call(main, !postId ? { from, settings: { postSettings: { pin } } } : { from, postId, pin })
		return postSettingsWizard.goBack(ctx)
	})

const scene5 = new BaseScene(5)
	.enter(async (ctx) => {
		await limitFromRequest(ctx)
		return postSettingsWizard.goToHandler(ctx, scene5)
	})
	.action(/set-limit-from_(.*)/, async (ctx) => {
		const { from, main, wizard: { state }, match } = ctx
		const { post: postId } = state
		const limitFrom = parseFloat(match[1])
		const handler = !postId ? main.updateSettings : main.setPostLimitFromById
		await handler.call(main, !postId ? { from, settings: { postSettings: { limitFrom } } } : { from, postId, limitFrom })
		return postSettingsWizard.goBack(ctx)
	})

const scene6 = new BaseScene(6)
	.enter(async (ctx) => {
		await limitToRequest(ctx)
		return postSettingsWizard.goToHandler(ctx, scene6)
	})
	.action(/set-limit-to_(.*)/, async (ctx) => {
		const { from, main, wizard: { state }, match } = ctx
		const { post: postId } = state
		const limitTo = parseFloat(match[1])
		const handler = !postId ? main.updateSettings : main.setPostLimitToById
		await handler.call(main, !postId ? { from, settings: { postSettings: { limitTo } } } : { from, postId, limitTo })
		return postSettingsWizard.goBack(ctx)
	})

const scene7 = new BaseScene(7)
	.enter(async (ctx) => {
		await maxCostRequest(ctx)
		return postSettingsWizard.goToHandler(ctx, scene7)
	})
	.action(/set-max-cost_(.*)/, maxCostReply)
	.hears(/(.*)/, maxCostReply)

const postSettingsWizard = new Wizard(
	SCENE_ID_POST_SETTINGS,
	{
		enterHandlers: [enterHandler((ctx) => {
			const { scene: { state } } = ctx
			return !!state.post
		})]
	},
	[scene0, scene1, scene2, scene3, scene4, scene5, scene6, scene7]
)

module.exports = postSettingsWizard
