const currency = require('currency.js')

module.exports = {
	RUB: value => currency(value, { symbol: '₽', decimal: '.', separator: ' ', pattern: '#!', negativePattern: '-#!' })
}
