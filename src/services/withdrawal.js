const AbortController = require('abort-controller');
const fetch = require('node-fetch')
const { WithdrawalModel } = require('../base/models')
const { okMarkup } = require("../markups");
const { db } = require('../base/utils')
const { logger, lang, cron: { createJob } } = require('../utils')
const {
	types: { WITHDRAWAL_TYPE_QIWI, WITHDRAWAL_TYPE_YOOMONEY, WITHDRAWAL_TYPE_PAYEER },
	flow: { MF_RETURN },
	QIWI_TOKEN, PAYEER_ACCOUNT, YOOMONEY_TOKEN, TG_BOT_NAME,
	PAYEER_API_ID, PAYEER_API_PASS, WITHDRAWAL_CRON
} = require('../const')

const commissionPayment = async (sum, account) => {
	const controller = new AbortController();
	setTimeout(() => {
		controller.abort();
	}, 2000);
	const response = await fetch(
		'https://edge.qiwi.com/sinap/providers/99/onlineCommission',
		{
			method: 'POST',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
				Authorization: `Bearer ${QIWI_TOKEN}`
			},
			body: JSON.stringify(
				{
					account,
					purchaseTotals: {
						total: {
							amount: sum,
							currency: '643'
						}
					},
					paymentMethod: {
						type: 'Account',
						accountId: '643'
					}
				}),
			signal: controller.signal
		}
	)
	if (!response.ok) {
		const { status, statusText } = response
		let text = await response.text()
		throw new Error(`${status}: ${statusText} ${text}`)
	}
	return response.json()
}

const doPayment = async (sum, account, comment) => {
	const controller = new AbortController();
	setTimeout(() => {
		controller.abort();
	}, 2000);
	const response = await fetch(
		'https://edge.qiwi.com/sinap/api/v2/terms/99/payments',
		{
			method: 'POST',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
				Authorization: `Bearer ${QIWI_TOKEN}`
			},
			body: JSON.stringify(
				{
					id: `${Date.now()}`,
					sum: {
						amount: sum,
						currency: '643'
					},
					paymentMethod: {
						type: 'Account',
						accountId: '643'
					},
					comment,
					fields: {
						account
					}
				}),
			signal: controller.signal
		}
	)
	if (!response.ok) {
		const { status, statusText } = response
		let text = await response.text()
		throw new Error(`${status}: ${statusText} ${text}`)
	}
	return response.json()
}

const getPaySystems = async () => {
	const controller = new AbortController();
	setTimeout(() => {
		controller.abort();
	}, 2000);
	const response = await fetch(
		'https://payeer.com/ajax/api/api.php',
		{
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: new URLSearchParams({
				account: PAYEER_ACCOUNT,
				apiId: PAYEER_API_ID,
				apiPass: PAYEER_API_PASS,
				action: 'getPaySystems'
			}),
			signal: controller.signal
		}
	)
	if (!response.ok) {
		const { status, statusText } = response
		let text = await response.text()
		throw new Error(`${status}: ${statusText} ${text}`)
	}
	return response.json()
}

const doPaymentPayeer = async (sum, account, comment, paySystemId) => {
	const controller = new AbortController();
	setTimeout(() => {
		controller.abort();
	}, 2000);
	const response = await fetch(
		'https://payeer.com/ajax/api/api.php',
		{
			method: 'POST',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: new URLSearchParams({
				account: PAYEER_ACCOUNT,
				apiId: PAYEER_API_ID,
				apiPass: PAYEER_API_PASS,
				action: 'payout',
				ps: paySystemId,
				sumIn: sum,
				curIn: 'RUB',
				// sumOut: sum,
				curOut: 'RUB',
				param_ACCOUNT_NUMBER: account,
				comment,
				referenceId: comment
			}),
			signal: controller.signal
		}
	)
	if (!response.ok) {
		const { status, statusText } = response
		let text = await response.text()
		throw new Error(`${status}: ${statusText} ${text}`)
	}
	return response.json()
}

const doPaymentCheckYoomoney = async (amount, account, comment) => {
	const controller = new AbortController();
	setTimeout(() => {
		controller.abort();
	}, 2000);
	const params = {
		pattern_id: 'p2p',
		to: account,
		amount,
		comment,
		label: TG_BOT_NAME,
		message: comment
	}
	const response = await fetch(
		`https://yoomoney.ru/api/request-payment`,
		{
			method: 'POST',
			body: new URLSearchParams(params),
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/x-www-form-urlencoded',
				Authorization: `Bearer ${YOOMONEY_TOKEN}`
			}
		}
	)
	if (!response.ok) {
		const { status, statusText } = response
		let text = await response.text()
		throw new Error(`${status}: ${statusText} ${text}`)
	}
	return response.json()
}

const doPaymentYoomoney = async (request_id) => {
	const controller = new AbortController();
	setTimeout(() => {
		controller.abort();
	}, 2000);
	const params = {
		request_id
	}
	const response = await fetch(
		`https://yoomoney.ru/api/process-payment`,
		{
			method: 'POST',
			body: new URLSearchParams(params),
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/x-www-form-urlencoded',
				Authorization: `Bearer ${YOOMONEY_TOKEN}`
			}
		}
	)
	if (!response.ok) {
		const { status, statusText } = response
		let text = await response.text()
		throw new Error(`${status}: ${statusText} ${text}`)
	}
	return response.json()
}

const processWithdrawals = async (main, docs) => {
	for (let i = 0; i < docs.length; i++) {
		const withdrawalDoc = docs[i]
		const { userId, id: withdrawalId, account, type, paySystemId, sum } = withdrawalDoc
		logger.verbose('Processing withdrawal: withdrawalId: %s, userId: %s, sum: %s, account: %s', withdrawalId, userId, sum.format(), account)
		let success = false
		let errorMsg = ''
		const userDoc = await withdrawalDoc.getUser()
		if (userDoc) {
			const valid = await userDoc.isFlowValid()
			if (!valid) {
				const msg = `User balance mistake: withdrawalId: ${withdrawalId}, userId: ${userId}, sum: ${sum.format()}`
				logger.error(msg)
				withdrawalDoc.error = true
				withdrawalDoc.errorMsg = 'User balance mistake'
				await withdrawalDoc.save()
				main.notifyAdmin(msg)
				continue
			}
		} else {
			const msg = `User not found: withdrawalId: ${withdrawalId}, userId: ${userId}`
			logger.error(msg)
			withdrawalDoc.error = true
			withdrawalDoc.errorMsg = 'User not found'
			await withdrawalDoc.save()
			main.notifyAdmin(msg)
			continue
		}
		try {
			switch (type) {
			case WITHDRAWAL_TYPE_PAYEER:
				const { errors } = await doPaymentPayeer(sum.value, account, withdrawalId, paySystemId)
				success = !errors || errors.length === 0
				if (!success) {
					errorMsg = JSON.stringify(errors)
				}
				break
			case WITHDRAWAL_TYPE_YOOMONEY:
				const check = await doPaymentCheckYoomoney(sum.value, account, withdrawalId, paySystemId)
				const { status, error, error_description = '' } = check
				if (error) {
					errorMsg = `${error}: ${error_description}`
				} else if (status === 'success') {
					const { request_id } = check
					const result = await doPaymentYoomoney(request_id)
					const { status, error, error_description = '' } = result
					if (error) {
						errorMsg = `${error}: ${error_description}`
					} else {
						success = status === 'success'
					}
				}
				break
			case WITHDRAWAL_TYPE_QIWI:
				const result = await commissionPayment(sum.value, account)
				const { withdrawSum: { amount: wAmount }, enrollmentSum: { amount: eAmount } } = result
				const diff = (eAmount / wAmount) || 1
				const diffRounded = parseFloat(diff.toFixed(2))
				const newSum = sum.multiply(diffRounded)
				const commission = sum.subtract(newSum)
				logger.verbose(`Commission: ${commission.format()}`)
				await doPayment(newSum.value, account, `${withdrawalId} QIWI commission ${commission.format()}`)
				success = true
				break
			}
		} catch ({ message }) {
			errorMsg = message
		} finally {
			if (success) {
				withdrawalDoc.done = true
				await withdrawalDoc.save()
				logger.verbose('Withdrawal completed: withdrawalId: %s', withdrawalId)
				main.sendMessage([userId, [lang('withdrawalSuccess'), withdrawalDoc.toInfo()].join('\n'), { parse_mode: 'Markdown', ...okMarkup() }])
			} else {
				await db.transaction(async (session) => {
					withdrawalDoc.error = true
					withdrawalDoc.errorMsg = errorMsg
					const userDoc = await withdrawalDoc.getUser(session)
					await userDoc.modifyBalance(sum, MF_RETURN, { withdrawalId: withdrawalId }, false, session)
					await withdrawalDoc.save({ session })
				})
				logger.error('Withdrawal error: withdrawalId: %s, error: %s', withdrawalId, errorMsg)
				main.sendMessage([userId, [lang('withdrawalError'), withdrawalDoc.toInfo(), lang('cashBack')].join('\n'), { parse_mode: 'Markdown', ...okMarkup() }])
			}
		}
	}
}

const fetchWithdrawals = async () => {
	const docs = await WithdrawalModel.find({ done: false, error: false, request: false })
	const ids = docs.map(({ id }) => id)
	await WithdrawalModel.updateMany({ id: { $in: ids } }, { request: true })
	return docs;
}

const start = (main) => {
	return createJob(WITHDRAWAL_CRON, async () => {
		if (!main.semaphore.withdrawal) {
			main.semaphore.withdrawal = true
			try {
				await processWithdrawals(main, await fetchWithdrawals())
			} catch ({ message }) {
				logger.error(message)
				main.notifyAdmin(`Process Withdrawals error: ${message}`)
			}
			main.semaphore.withdrawal = false
		}
	})
}

module.exports = {
	start,
	getPaySystems
}
