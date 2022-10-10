const { inlineKeyboard, button } = require('telegraf/lib/markup')
const { BaseScene } = require('telegraf/lib/scenes/base')
const Wizard = require('../telegraf/wizard')
const { QIWI_PAYMENT_LINK, YOOMONEY_PAYMENT_LINK, PAYEER_ACCOUNT, scenes: { SCENE_ID_PAYMENT } } = require('../const')
const { lang, markup: { backRow, undoBackRow }, scene: { enterHandler } } = require('../utils')

const welcomeRequestMarkup = (ctx, systems) => {
	const arr = []
	systems.forEach(({ name, displayName }) => {
		arr.push([button.callback(displayName, `choose_${name}`)])
	})
	return inlineKeyboard([
		...arr,
		backRow(ctx)
	])
}

const resultRequestMarkup = (ctx, link) => {
	const arr = [undoBackRow(ctx)]
	link &&	arr.unshift([button.url(lang('cbRefill'), link)])
	return inlineKeyboard(arr)
}

const welcomeRequest = async (ctx) => {
	const { main, user: { balance } } = ctx
	return main.replyWithMarkdownUpdate(ctx, [lang('choosePaySystem', balance.format()),
		welcomeRequestMarkup(ctx, main.getPaymentSystems())])
}

const resultRequest = async (ctx) => {
	const { user, main, wizard: { state: { system } } } = ctx
	let text, link
	if (/qiwi/i.test(system)) {
		text = lang('refillSystem', system, true)
		link = QIWI_PAYMENT_LINK
	} else if (/yoomoney/i.test(system)) {
		text = lang('refillSystem', system, true)
		link = YOOMONEY_PAYMENT_LINK
	} else if (/payeer/i.test(system)) {
		text = [
			lang('refillSystem', system, false),
			lang('enrollmentAccount', PAYEER_ACCOUNT)
		].join('\n')
	}
	const arr = [text]
	const { id } = user
	arr.push(lang('welcomePayment', id))
	return main.replyWithMarkdownUpdate(ctx, [arr.join('\n'), resultRequestMarkup(ctx, link)])
}

const scene0 = new BaseScene(0)
	.enter(async (ctx) => {
		await welcomeRequest(ctx)
		return paymentWizard.goToHandler(ctx, scene0)
	})
	.action(/choose_(.+)/, (ctx) => {
		const { match, wizard: { state } } = ctx
		state['system'] = match[1]
		return scene0.go(ctx, scene1)
	})

const scene1 = new BaseScene(1)
	.enter(resultRequest)

const paymentWizard = new Wizard(
	SCENE_ID_PAYMENT,
	{
		enterHandlers: [enterHandler()]
	},
	[scene0, scene1]
)

module.exports = paymentWizard
