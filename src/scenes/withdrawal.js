const { inlineKeyboard, button } = require('telegraf/lib/markup')
const { BaseScene } = require('telegraf/lib/scenes/base')
const Wizard = require('../telegraf/wizard')
const { scenes: { SCENE_ID_WITHDRAWAL } } = require('../const')
const { lang, markup: { backRow, undoBackRow }, scene: { enterHandler }, currency: { RUB } } = require('../utils')
const { backMarkup, undoBackMarkup } = require('./../markups')

const welcomeRequestMarkup = (ctx, paySystems) => {
	return inlineKeyboard([
		...paySystems.map(({ id, name }) => button.callback(name, `choose-system_${id}`)).toChunks(2),
		backRow(ctx)
	])
}

const sumRequestMarkup = (ctx, balance) => {
	const commands = []
	balance.value && commands.push([button.callback(balance.format(), `choose_${balance.value}`)])
	return inlineKeyboard([
		...commands,
		undoBackRow(ctx)
	])
}

const accountRequestMarkup = (account) => {
	const accounts = []
	account && accounts.push([button.callback(account, `choose-account_${account}`)])
	return inlineKeyboard([
		...accounts,
		undoBackRow()
	])
}

const welcomeRequest = async (ctx) => {
	const { main, user: { balance } } = ctx
	const paySystems = await main.getPaySystems()
	return main.replyWithMarkdownUpdate(ctx, [lang('welcomeWithdrawal', balance.format()),
		welcomeRequestMarkup(ctx, paySystems)])
}

const sumRequest = async (ctx) => {
	const { main, user: { balance } } = ctx
	return main.replyWithMarkdownUpdate(ctx, [lang('withdrawalSumRequest', balance.format()),
		sumRequestMarkup(ctx, balance)])
}

const sumReply = (ctx) => {
	const { user: { balance }, wizard: { state }, match } = ctx
	const sum = parseFloat(match[1].replace(/,/g, '.'))
	state['sum'] = sum && !isNaN(sum) && isFinite(sum) ? sum : balance.value
	return scene1.go(ctx, scene2)
}

const accountRequest = async (ctx) => {
	const { from, main, wizard: { state }, user: { balance } }  = ctx
	const { paySystemId, sum } = state
	const paySystem = await main.getPaySystem(paySystemId)
	const { sum_min: { RUB: minSumStr }, account: { example, name, description } } = paySystem
	const minRUB = RUB(Number(minSumStr))
	const sumRUB = RUB(sum)
	state['skipAccountReply'] = false
	if (sumRUB.value < minRUB.value) {
		state['skipAccountReply'] = true
		return main.replyWithMarkdownUpdate(ctx, [lang('errorNotEnoughMoneyWithdrawal', minRUB.format(), sumRUB.format()), undoBackMarkup()])
	} else if (sumRUB.value > balance.value) {
		state['skipAccountReply'] = true
		return main.replyWithMarkdownUpdate(ctx, [lang('errorToManyMoneyWithdrawal'), undoBackMarkup()])
	}
	const last = await main.getLastSuccessWithdrawal(from, paySystemId)
	const account = last ? last.account : null
	const arr = [name, lang('example', example)]
	description && arr.push(description)
	return main.replyWithMarkdownUpdate(ctx, [arr.join('\n'), accountRequestMarkup(account)])
}

const accountReply = async (ctx, account) => {
	const { from, main, wizard: { state: { paySystemId, sum } } } = ctx
	const { account: { reg_expr } } = await main.getPaySystem(paySystemId)
	let valid = !reg_expr
	if (!valid) {
		if (Array.isArray(reg_expr)) {
			valid = reg_expr.some((expr) => expr instanceof RegExp ? expr.test(account) : new RegExp(expr).test(account))
		} else {
			valid = reg_expr instanceof RegExp ? reg_expr.test(account) : new RegExp(reg_expr).test(account)
		}
	}
	if (valid) {
		const { withdrawal, user: { balance } } = await main.createWithdrawal({ account, from, paySystemId, sum })
		return main.replyWithMarkdownUpdate(ctx, [[
			lang('infoWithdrawalRequestCreated'),
			withdrawal.toInfo(),
			lang('balance', balance.format())
		].join('\n'), backMarkup(ctx)])
	}
	return main.replyNotify(ctx, [lang('wrongFormat')])
}

const scene0 = new BaseScene(0)
	.enter(async (ctx) => {
		await welcomeRequest(ctx)
		return withdrawalWizard.goToHandler(ctx, scene0)
	})
	.action(/choose-system_(.+)/, (ctx) => {
		const { wizard: { state }, match } = ctx
		state['paySystemId'] = match[1]
		return scene0.go(ctx, scene1)
	})

const scene1 = new BaseScene(1)
	.enter(async (ctx) => {
		await sumRequest(ctx)
		return withdrawalWizard.goToHandler(ctx, scene1)
	})
	.action(/choose_(.*)/, sumReply)
	.hears(/(.*)/, sumReply)

const scene2 = new BaseScene(2)
	.enter(async (ctx) => {
		await accountRequest(ctx)
		return withdrawalWizard.goToHandler(ctx, scene2)
	})
	.action(/choose-account_(.+)/, (ctx) => {
		const { match } = ctx
		return accountReply(ctx, match[1])
	})
	.hears(/(.*)/, (ctx) => {
		const { match, wizard: { state: { skipAccountReply } } } = ctx
		if (!skipAccountReply) {
			return accountReply(ctx, match[1])
		}
	})

const withdrawalWizard = new Wizard(
	SCENE_ID_WITHDRAWAL,
	{
		enterHandlers: [enterHandler()]
	},
	[scene0, scene1, scene2]
)

module.exports = withdrawalWizard
