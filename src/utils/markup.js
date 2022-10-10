const { button } = require('telegraf/lib/markup')
const { scenes: { SCENE_ID_MENU }, emoji: { DOWNWARDS, UPWARDS } } = require('../const')
const lang = require('./lang')

module.exports = {
	backRow(ctx) {
		const { session: { __prevs = [] } } = ctx
		const prev = __prevs[__prevs.length - 1]
		const rows = []
		if (!prev || prev.scene === SCENE_ID_MENU) {
			rows.push(button.callback(lang('cbMenu'), 'nav-menu'))
		} else {
			rows.push(button.callback(lang('cbBack'), 'nav-back'), button.callback(lang('cbMenu'), 'nav-menu'))
		}
		return rows
	},
	undoBackRow() {
		return [button.callback(lang('cbBack'), 'back'), button.callback(lang('cbMenu'), 'nav-menu')]
	},
	menuRow() {
		return [button.callback(lang('cbMenu'), 'nav-menu')]
	},
	okRow() {
		return [button.callback(lang('cbOk'), `self-delete`)]
	},
	insertNavButtons(buttons, index, skip, count, page = 1) {
		if (count > 1) {
			const nav = []
			if (skip !== 0) {
				nav.push(button.callback(UPWARDS, `prev`))
			}
			if (count - skip > page) {
				nav.push(button.callback(DOWNWARDS, `next`))
			}
			buttons.splice(index, 0, nav)
		}
		return buttons
	}
}
