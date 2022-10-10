const Wizard = require('../telegraf/wizard')
const { BaseScene } = require('telegraf/lib/scenes/base')
const { TG_CHANNEL_NAME, TG_CHANNEL_LINK, URL_REGEXP, scenes: { SCENE_ID_ADS, SCENE_ID_PAYMENT }, POST_COST } = require('../const')
const { lang, reply: { postReply, buttonUrlRequest, buttonTextRequest }, markup: { backRow, undoBackRow }, scene: { enterHandler }, currency: { RUB } } = require('../utils')
const { inlineKeyboard, button } = require('telegraf/lib/markup')
const { backMarkup, undoBackMarkup, settings: { maxCostRequestMarkup, costRequestMarkup, limitFromRequestMarkup, limitToRequestMarkup, pinRequestMarkup } } = require('./../markups')
const { PostSettingsModel } = require('./../base/models')

const welcomeRequestMarkup = (ctx, canStart) => {
	const rows = []
	if (canStart) {
		rows.push(button.callback(lang('cbStart'), 'send'))
	} else {
		rows.push(button.callback(lang('cbRefill'), 'payment'))
	}
	return inlineKeyboard([
		rows,
		backRow(ctx)
	])
}

const buttonRequestMarkup = () => {
	return inlineKeyboard([
		[button.callback(lang('cbYes'), 'button-yes'), button.callback(lang('cbNo'), 'button-no')],
		undoBackRow()
	])
}

const hideUrlRequestMarkup = () => {
	return inlineKeyboard([
		[button.callback(lang('cbYes'), 'hide-yes'), button.callback(lang('cbNo'), 'hide-no')],
		undoBackRow()
	])
}

const settingsRequestMarkup = () => {
	return inlineKeyboard([
		[button.callback(lang('cbTune'), 'settings-yes'), button.callback(lang('cbLeave'), 'settings-no')],
		undoBackRow()
	])
}

const confirmRequestMarkup = () => {
	return inlineKeyboard([
		[button.callback(lang('allRight'), 'right')],
		undoBackRow()
	])
}

const postRequest = (ctx) => {
	const { main } = ctx
	return main.replyWithMarkdownUpdate(ctx, [lang('makePost'), undoBackMarkup(ctx)])
}

const hideUrlRequest = (ctx) => {
	const { main } = ctx
	return main.replyWithMarkdownUpdate(ctx, [lang('hideUrlQuestion'), hideUrlRequestMarkup()])
}

const buttonRequest = (ctx) => {
	const { main } = ctx
	return main.replyWithMarkdownUpdate(ctx, [lang('buttonQuestion'), buttonRequestMarkup()])
}

const successRequest = (ctx, { post, user: { balance } }) => {
	const { main } = ctx
	return main.replyWithMarkdownUpdate(ctx, [[
		lang('postSuccess'), post.toInfo(), lang('balance', balance.format())].join('\n'), backMarkup(ctx)])
}

const confirmRequest = async (ctx) => {
	const { main, from: { id: userId }, wizard: { state } } = ctx
	const { configSettings, configSettingsMaxCost,
		configSettingsPin, configSettingsFromLimit, configSettingsToLimit, configSettingsCoefficient } = state
	const arr = []
	arr.push(lang('postAllRight'))
	let settingsModel
	if (configSettings) {
		settingsModel = new PostSettingsModel({
			limitFrom: configSettingsFromLimit,
			limitTo: configSettingsToLimit,
			coefficient: configSettingsCoefficient,
			maxCost: configSettingsMaxCost,
			pin: configSettingsPin
		})
		await settingsModel.validate()
	} else {
		const { postSettings } = await main.getSettings({ userId })
		settingsModel = postSettings
	}

	arr.push(settingsModel.toInfo(1))

	arr.push(lang('postSettingsAllRight'))
	arr.push(lang('publishQuestion'))

	// todo faq

	state['settings'] = settingsModel.toJSON()

	return main.replyWithMarkdownUpdate(ctx, [arr.join('\n'), confirmRequestMarkup()])
}

const costRequest = (ctx) => {
	const { main } = ctx
	return main.replyWithMarkdownUpdate(ctx, [lang('repostRewardStr'), costRequestMarkup()])
}

const maxCostRequest = (ctx) => {
	const { main } = ctx
	return main.replyWithMarkdownUpdate(ctx, [[lang('repostMaxCostStr'), lang('chooseOrType')].join('\n'), maxCostRequestMarkup()])
}

const limitFromRequest = async (ctx) => {
	const { main } = ctx
	return main.replyWithMarkdownUpdate(ctx, [lang('repostLimitFromStr'), limitFromRequestMarkup(ctx)])
}

const limitToRequest = async (ctx) => {
	const { main } = ctx
	return main.replyWithMarkdownUpdate(ctx, [lang('repostLimitToStr'), limitToRequestMarkup(ctx)])
}
const pinRequest = (ctx) => {
	const { main } = ctx
	return main.replyWithMarkdownUpdate(ctx, [lang('repostPinStr'), pinRequestMarkup()])
}

const settingsRequest = async (ctx) => {
	const { from: { id: userId }, main } = ctx
	const { postSettings } = await main.getSettings({ userId })
	return main.replyWithMarkdownUpdate(ctx, [
		[
			lang('configOrLeave'),
			postSettings.toInfo(1)
		].join('\n'), settingsRequestMarkup()])
}

const welcomeRequest = async (ctx) => {
	const { user: { balance }, main } = ctx
	const cost = RUB(POST_COST)
	const canStart = balance.value >= cost.value
	return main.replyWithMarkdownUpdate(ctx,
		[lang('welcomeAds', cost.format(), balance.format(), TG_CHANNEL_NAME, TG_CHANNEL_LINK), {
			disable_web_page_preview: true,
			...welcomeRequestMarkup(ctx, canStart)
		}])
}

const maxCostReply = (ctx) => {
	const { match, wizard: { state } } = ctx
	const sum = parseFloat(match[1].replace(/,/g, '.').substr(0, 6))
	state['configSettingsMaxCost'] = sum && !isNaN(sum) && isFinite(sum) ? sum : 0
	return scene12.go(ctx, scene8)
}

const scene0 = new BaseScene(0)
	.enter(async (ctx) => {
		await welcomeRequest(ctx)
		return adsWizard.goToHandler(ctx, scene0)
	})
	.action(/send/, (ctx) => {
		return scene0.go(ctx, scene1)
	})
	.action(/payment/, (ctx) => {
		return ctx.scene._enter(SCENE_ID_PAYMENT)
	})

const scene1 = new BaseScene(1)
	.enter(enterHandler(), async (ctx) => {
		await postRequest(ctx)
		return adsWizard.goToHandler(ctx, scene1)
	})
	.use(async (ctx) => {
		const { main, chat: { id: chatId }, wizard: { state } } = ctx
		const result = await postReply(ctx)
		if (result === void 0) {
			return main.replyNotify(ctx, [lang('mediaGroupsNotSupported')])
		} else if (result === false) {
			const { post, hasUrls } = state
			await main.sendPostMessage(ctx, post, chatId, true)
			if (hasUrls) {
				return scene1.go(ctx, scene2)
			} else {
				return scene1.go(ctx, scene3)
			}
		}
	})

const scene2 = new BaseScene(2)
	.enter(async (ctx) => {
		await hideUrlRequest(ctx)
		return adsWizard.goToHandler(ctx, scene2)
	})
	.action(['hide-yes', 'hide-no'], async (ctx) => {
		const { main, chat: { id: chatId }, wizard: { state: { post } }, match } = ctx
		const prev = post['disable_web_page_preview'] || false
		post['disable_web_page_preview'] = match[0] === 'hide-yes'
		if (prev !== post['disable_web_page_preview']) {
			await main.editPostMessage(ctx, post, chatId)
		}
		return scene2.go(ctx, scene3)
	})

const scene3 = new BaseScene(3)
	.enter(async (ctx) => {
		await buttonRequest(ctx)
		return adsWizard.goToHandler(ctx, scene3)
	})
	.action(['button-yes', 'button-no'], async (ctx) => {
		const { main, chat: { id: chatId }, wizard: { state }, match } = ctx
		const { post } = state
		const prev = state['hasButton'] || false
		const hasButton = match[0] === 'button-yes'
		state['hasButton'] = hasButton
		if (prev !== state['hasButton'] && !state['hasButton'] && post.buttons && post.buttons.length) {
			post.buttons = []
			await main.editPostMessageMarkup(ctx, post, chatId)
		}
		if (hasButton) {
			state['prev_button_text'] = state['button_text'] = state['button_url'] = void 0
			return scene3.go(ctx, scene4)
		} else {
			return scene3.go(ctx, scene6)
		}
	})

const scene4 = new BaseScene(4)
	.enter(async (ctx) => {
		await buttonTextRequest(ctx, undoBackMarkup())
		return adsWizard.goToHandler(ctx, scene4)
	})
	.use((ctx) => {
		const { message: { text }, wizard: { state } } = ctx
		state['prev_button_text'] = state['button_text']
		state['button_text'] = text
		return scene4.go(ctx, scene5)
	})

const scene5 = new BaseScene(5)
	.enter(async (ctx) => {
		await buttonUrlRequest(ctx, undoBackMarkup())
		return adsWizard.goToHandler(ctx, scene5)
	})
	.use(async (ctx) => {
		const { main, chat: { id: chatId }, message: { text: url }, wizard: { state } } = ctx
		const { post, prev_button_text, button_text, button_url } = state
		if (URL_REGEXP.test(url)) {
			state['button_url'] = url
			post.buttons = [{ text: button_text, url }]
			if (button_url !== url || button_text !== prev_button_text) {
				await main.editPostMessageMarkup(ctx, post, chatId)
			}
			return scene5.go(ctx, scene6)
		}
		return main.replyNotify(ctx, [lang('wrongFormat')])
	})

const scene6 = new BaseScene(6)
	.enter(async (ctx) => {
		await settingsRequest(ctx)
		return adsWizard.goToHandler(ctx, scene6)
	})
	.action(['settings-yes', 'settings-no'], (ctx) => {
		const { wizard: { state }, match } = ctx
		const configSettings = match[0] === 'settings-yes'
		state['configSettings'] = configSettings
		if (configSettings) {
			return scene6.go(ctx, scene12)
		} else {
			return scene6.go(ctx, scene11)
		}
	})

const scene7 = new BaseScene(7)
	.enter(async (ctx) => {
		await costRequest(ctx)
		return adsWizard.goToHandler(ctx, scene7)
	})
	.action(/set-cost_(.*)/, (ctx) => {
		const { match, wizard: { state } } = ctx
		state['configSettingsCoefficient'] = parseFloat(match[1])
		return scene7.go(ctx, scene8)
	})

const scene8 = new BaseScene(8)
	.enter(async (ctx) => {
		await limitFromRequest(ctx)
		return adsWizard.goToHandler(ctx, scene8)
	})
	.action(/set-limit-from_(.*)/, (ctx) => {
		const { match, wizard: { state } } = ctx
		state['configSettingsFromLimit'] = parseFloat(match[1])
		return scene8.go(ctx, scene9)
	})

const scene9 = new BaseScene(9)
	.enter(async (ctx) => {
		await limitToRequest(ctx)
		return adsWizard.goToHandler(ctx, scene9)
	})
	.action(/set-limit-to_(.*)/, (ctx) => {
		const { match, wizard: { state } } = ctx
		state['configSettingsToLimit'] = parseFloat(match[1])
		return scene9.go(ctx, scene10)
	})

const scene10 = new BaseScene(10)
	.enter(async (ctx) => {
		await pinRequest(ctx)
		return adsWizard.goToHandler(ctx, scene10)
	})
	.action([/set-pin-yes/, /set-pin-no/], (ctx) => {
		const { match, wizard: { state } } = ctx
		state['configSettingsPin'] = match[0] === 'set-pin-yes'
		return scene10.go(ctx, scene11)
	})

const scene11 = new BaseScene(11)
	.enter(async (ctx) => {
		await confirmRequest(ctx)
		return adsWizard.goToHandler(ctx, scene11)
	})
	.action('right', async (ctx) => {
		const { from, main, wizard: { state: { post, settings } } } = ctx
		const result = await main.createPost(from, post, settings)
		return successRequest(ctx, result)
	})

const scene12 = new BaseScene(12)
	.enter(async (ctx) => {
		await maxCostRequest(ctx)
		return adsWizard.goToHandler(ctx, scene12)
	})
	.action(/set-max-cost_(.*)/, maxCostReply)
	.hears(/(.*)/, maxCostReply)

const adsWizard = new Wizard(
	SCENE_ID_ADS,
	{
		enterHandlers: [enterHandler()]
	},
	[scene0, scene1, scene2, scene3, scene4, scene5, scene6, scene7, scene8, scene9, scene10, scene11, scene12]
)

module.exports = adsWizard
