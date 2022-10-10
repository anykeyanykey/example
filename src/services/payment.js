const fetch = require('node-fetch')
const moment = require('moment-timezone')
const querystring = require('querystring')
const { okMarkup } = require("../markups");
const { PaymentModel, UserModel } = require('../base/models')
const { db } = require('../base/utils')
const { logger, lang, cron: { createJob }, currency: { RUB } } = require('../utils')
const { flow: { MF_PAYMENT }, QIWI_WALLET, QIWI_TOKEN, PAYMENT_CRON, PAYEER_ACCOUNT, PAYEER_API_ID, PAYEER_API_PASS,
	YOOMONEY_TOKEN, types: { PAYMENT_TYPE_QIWI, PAYMENT_TYPE_YOOMONEY, PAYMENT_TYPE_PAYEER } } = require('../const')

const fetchPayments = async () => {
	const params = {
		rows: 50,
		operation: 'IN'
	}
	const lastPaymentDoc = await PaymentModel.findOne({ type: PAYMENT_TYPE_QIWI }).sort({ createdAt: -1 }).exec()
	if (lastPaymentDoc) {
		const { params: { date } } = lastPaymentDoc
		const pmDate = moment(date)
		const now = moment()
		const result = now.diff(pmDate, 'days') > 20 ? now.add(-20, 'days').startOf('day') : pmDate
		params.startDate = result.format()
		logger.verbose(`startDate: %s`, params.startDate)
	} else {
		params.startDate = moment().startOf('day').format()
	}
	params.endDate = moment().format()
	const response = await fetch(
		`https://edge.qiwi.com/payment-history/v2/persons/${QIWI_WALLET}/payments?${querystring.encode(params)}`,
		{
			method: 'GET',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/x-www-form-urlencoded',
				Authorization: `Bearer ${QIWI_TOKEN}`
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

const fetchPaymentsYoomoney = async () => {
	const params = {
		details: true,
		type: 'deposition',
		records: 100
	}
	const lastPaymentDoc = await PaymentModel.findOne({ type: PAYMENT_TYPE_YOOMONEY }).sort({ createdAt: -1 }).exec()
	if (lastPaymentDoc) {
		const { params: { datetime } } = lastPaymentDoc
		const pmDate = moment(datetime)
		const now = moment()
		const result = now.diff(pmDate, 'days') > 20 ? now.add(-20, 'days').startOf('day') : pmDate
		params.from = result.format()
	} else {
		params.from = moment().startOf('day').format()
	}
	const response = await fetch(
		`https://yoomoney.ru/api/operation-history`,
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

const fetchPaymentsPayeer = async () => {
	const params = {
		account: PAYEER_ACCOUNT,
		apiId: PAYEER_API_ID,
		apiPass: PAYEER_API_PASS,
		action: 'history',
		type: 'incoming',
		count: 1000
	}
	const lastPaymentDoc = await PaymentModel.findOne({ type: PAYMENT_TYPE_PAYEER }).sort({ createdAt: -1 }).exec()
	if (lastPaymentDoc) {
		const { params: { date } } = lastPaymentDoc
		const pmDate = moment(date)
		const now = moment()
		const result = now.diff(pmDate, 'days') > 20 ? now.add(-20, 'days').startOf('day') : pmDate
		params.from = result.format('YYYY-MM-DD HH:mm:ss')
	} else {
		params.from = moment().startOf('day').format('YYYY-MM-DD HH:mm:ss')
	}
	const response = await fetch(
		`https://payeer.com/ajax/api/api.php`,
		{
			method: 'POST',
			body: new URLSearchParams(params),
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/x-www-form-urlencoded'
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

const processPaymentsQIWI = async (main, { data: operations }) => {
	logger.verbose(`Processing payments type ${PAYMENT_TYPE_QIWI}...`)
	for (let i = 0; i < operations.length; i++) {
		const operation = operations[i]
		const { trmTxnId, status, sum, comment } = operation
		const { amount, currency } = sum
		if (status !== 'SUCCESS' || currency !== 643 || !comment) {
			continue
		}
		const userId = Number(comment)
		if (!userId) {
			logger.error('Wrong payment comment: %s', comment)
			continue
		}
		await processPayment(main, trmTxnId, userId, amount, PAYMENT_TYPE_QIWI, operation)
	}
}

const processPaymentsYoomoney = async (main, { operations }) => {
	logger.verbose(`Processing payments type ${PAYMENT_TYPE_YOOMONEY}...`)
	for (let i = 0; i < operations.length; i++) {
		const operation = operations[i]
		const { message, details, operation_id, amount, direction, status, type, amount_currency } = operation
		if (status !== 'success' || amount_currency !== 'RUB' || (!message && !details) || (type !== 'deposition' && type !== 'incoming-transfer') || direction !== 'in') {
			continue
		}
		const comment = message || details
		const userId = Number(comment)
		if (!userId) {
			logger.error('Wrong payment comment: %s', comment)
			continue
		}
		await processPayment(main, operation_id, userId, amount, PAYMENT_TYPE_YOOMONEY, operation)
	}
}

const processPaymentsPayeer = async (main, data) => {
	logger.verbose(`Processing payments type ${PAYMENT_TYPE_PAYEER}...`)
	const { errors, history } = data
	let success = !errors || errors.length === 0
	if (!success) {
		const errorMsg = JSON.stringify(errors)
		logger.error(errorMsg)
		return
	}
	const operations = Object.keys(history).reduce((arr, key) => {
		arr.push(history[key])
		return arr
	}, [])
	for (let i = 0; i < operations.length; i++) {
		const operation = operations[i]
		const { id, status, creditedAmount,  creditedCurrency, protect, comment, type } = operation
		if (status !== 'success' || creditedCurrency !== 'RUB' || !comment || type !== 'transfer' || protect !== 'N') {
			continue
		}
		const userId = Number(comment)
		if (!userId) {
			logger.error('Wrong payment comment: %s', comment)
			continue
		}
		const amount = Number(creditedAmount)
		if (!amount) {
			logger.error('Wrong payment amount: %s', creditedAmount)
			continue
		}
		await processPayment(main, id, userId, amount, PAYMENT_TYPE_PAYEER, operation)
	}
}

const processPayment = async (main, operationId, userId, amount, type, params) => {

	try {

		let userDoc = null
		let paymentDoc

		await db.transaction(async (session) => {
			paymentDoc = await PaymentModel.findOne({ operationId, type }, null, { session })
			if (!paymentDoc) {
				userDoc = await UserModel.findOne({ id: userId }, null, { session })
				if (!userDoc) {
					throw new Error(`User not found by comment, comment: ${userId}`)
				}
				const amountRUB = RUB(amount)
				paymentDoc = await new PaymentModel({
					operationId,
					sum: amountRUB.value,
					type,
					params,
					userId: userDoc.id
				}).save({ session })
				const { id: paymentId } = paymentDoc
				await userDoc.modifyBalance(amount, MF_PAYMENT, { paymentId }, false, session)
			}
		})

		if (userDoc && paymentDoc) {
			const { id: userSendId, balance } = userDoc
			const { sum } = paymentDoc
			logger.verbose('Payment completed, userId: %s sum: %s', userId, sum.format())
			main.sendMessage([userSendId, lang('paymentSuccess', sum.format(), balance.format()), { parse_mode: 'Markdown', ...okMarkup() }])
		}

	} catch ({ message }) {
		logger.error(message)
		main.notifyAdmin(`Process payment error: ${message}`)
	}
}

const start = (main) => {
	return createJob(PAYMENT_CRON, async () => {
		if (!main.semaphore.payment) {
			main.semaphore.payment = true
			try {
				await processPaymentsQIWI(main, await fetchPayments())
			} catch ({ message }) {
				logger.error(message)
				main.notifyAdmin(`Process payments QIWI error: ${message}`)
			}
			try {
				await processPaymentsYoomoney(main, await fetchPaymentsYoomoney())
			} catch ({ message }) {
				logger.error(message)
				main.notifyAdmin(`Process payments Yoomoney error: ${message}`)
			}
			try {
				await processPaymentsPayeer(main, await fetchPaymentsPayeer())
			} catch ({ message }) {
				logger.error(message)
				main.notifyAdmin(`Process payments Payeer error: ${message}`)
			}
			main.semaphore.payment = false
		}
	})
}

module.exports = {
	start
}
