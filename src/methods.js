const moment = require('moment-timezone')
const { MIN_WITHDRAWAL, PHONE_REGEXP, MAIL_REGEXP, DIGITS_REGEXP, TG_ADMINS } = require('./const')
const { lang, logger } = require('./utils')
const { SafeError } = require('./errors')
const { withdrawal } = require('./services')

const paymentSystems = Object.freeze([
	{
		name: 'QIWI',
		displayName: 'QIWI + карта'
	}, {
		name: 'Yoomoney',
		displayName: 'Yoomoney + карта'
	}, {
		name: 'Payeer',
		displayName: 'Payeer'
	}
])

const paySystems = Object.freeze([{
	id: "q",
	name: 'QIWI',
	sum_min: {
		'RUB': `${MIN_WITHDRAWAL}`
	},
	account: {
		name: lang('phoneNumber'),
		reg_expr: PHONE_REGEXP,
		example: '+79012345678',
		description: lang('verifiedMust')
	}
}, {
	id: "y",
	name: 'Yoomoney',
	sum_min: {
		'RUB': `${MIN_WITHDRAWAL}`
	},
	account: {
		name: lang('accountYoomoney'),
		reg_expr: [MAIL_REGEXP, DIGITS_REGEXP],
		example: '4100117569890121, +79012345678, mail@example.com',
		description: ''
	}
}])

let cachedPaySystems = [...paySystems]

module.exports = {

	getPaymentSystems() {
		return paymentSystems
	},

	async getPaySystems(cached = false) {
		const { __date } = cachedPaySystems
		if (cached || (__date && __date + 10 * 1000 > Date.now())) {
			return cachedPaySystems
		}
		let _paySystems = [...paySystems]
		try {
			const { list: _list = {} } = await withdrawal.getPaySystems()
			_paySystems.push(...Object.keys(_list).reduce((result, key) => {
				const {
					id, name, sum_min, currencies,
					r_fields: {
						ACCOUNT_NUMBER: { example, name: _name = '', reg_expr = '' }
					} = {}
				} = _list[key]
				if (currencies.indexOf('RUB') !== -1) {
					result.push({
						id,
						name,
						sum_min,
						account: {
							name: JSON.parse(`"${_name}"`),
							reg_expr: reg_expr.replace(/^#/, '').replace(/#$/, ''),
							example
						}
					})
				}
				return result
			}, []))
			cachedPaySystems = _paySystems
			cachedPaySystems.__date = Date.now()
		} catch ({ message }) {
			logger.error(message)
		}
		return _paySystems
	},

	async getPaySystem(paySystemId, safe = true) {
		const paySystems = await this.getPaySystems(true)
		const paySystem = paySystems.find(({ id }) => id === paySystemId)
		if (!paySystem && safe) {
			throw new SafeError(lang('errorNoPaySystem'))
		}
		return paySystem
	},

	isAdmin({ id }) {
		return TG_ADMINS.indexOf(id) !== -1
	},

	async getAvailablePostDates() {
		const start = moment().ceil(15, 'minutes')
		return Array.from({ length: 47 }).reduce((res) => {
			res.push(res[res.length - 1].clone().add(15, 'minutes'))
			return res
		}, [start])
	}
}
