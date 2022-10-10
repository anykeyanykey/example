const { lang } = require('../const')

const LANG = 'ru'

const replace = (str, args) => {
	return str.replace(/{(\d)}/g, function (a1, a2) {
		return args[parseInt(a2)]
	})
}

module.exports = function (shortcut, ...args) {
	const result = typeof lang[LANG][shortcut] === 'function'
		? lang[LANG][shortcut](...args) || ''
		: lang[LANG][shortcut] || ''
	return replace(result, args)
}
