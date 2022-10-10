const { lang } = require('./utils')
const { okMarkup } = require('./markups')
const { scenes: { SCENE_ID_POSTS } } = require('./const')

module.exports = {
	async onCallbackQuery(ctx, next) {

		const { update: { callback_query: { data, message } } } = ctx
		const s = data.split('_')
		const command = s[0]
		const param = s[1]

		switch (command) {
		case 'post-info':
			return this.safeReplyCb(ctx, this, this.getPostShortInfoById, (text) => {
				return ctx.answerCbQuery(text, { show_alert: true })
			}, param)
		}

		ctx.answerCbQuery()

		switch (command) {
		case 'nav-back':
		case 'nav-menu':
			const isBack = command === 'nav-back'
			if (isBack) {
				return ctx.scene._back(ctx)
			} else {
				return ctx.scene._menu(ctx)
			}
		case 'self-delete':
			if (message) {
				const { message_id } = message
				ctx.deleteMessage(message_id)
			}
			return
		case 'config-post':
		case 'config-repost':
			if (message) {
				const { message_id } = message
				ctx.deleteMessage(message_id)
			}
			const isRepost = command === 'config-repost'
			const state = { }
			if (isRepost) {
				state['isReposts'] = true
				state['byRepostId'] = param
				return ctx.scene._enter(SCENE_ID_POSTS, state)
			} else {
				state['isReposts'] = false
				state['byPostId'] = param
				return ctx.scene._enter(SCENE_ID_POSTS, state)
			}
		}

		return next();
	},

	async onCommandBankrupt(ctx) {
		const { update: { message: { text } } } = ctx
		const s = text.split(' ')
		const userId = Number(s[1])
		const { balance } = await this.bankruptUserById(userId)
		return this.reply(ctx, [balance.format(), okMarkup()])
	},

	async onCommandRich(ctx) {
		const { update: { message: { text } } } = ctx
		const s = text.split(' ')
		const userId = Number(s[1])
		const sum = Number(s[2])
		const { balance } = await this.richUserById(userId, sum)
		return this.reply(ctx, [balance.format(), okMarkup()])
	},

	async onCommandBan(ctx) {
		const { update: { message: { text } } } = ctx
		const s = text.split(' ')
		const ban = s[0] === '/ban'
		const userId = Number(s[1])
		await this.banUserById(userId, ban)
		return this.reply(ctx, [lang('infoSuccess'), okMarkup()])
	},

	async onCommandMimicry(ctx) {
		const { adminUser, update: { message: { text } } } = ctx
		const s = text.split(' ')
		const userId = Number(s[1])
		userId && await this.getUser({ id: userId })
		adminUser.mimicry = userId || 0
		await adminUser.save()
		return this.reply(ctx, [lang('infoSuccess'), okMarkup()])
	},

	async onCommandStat(ctx) {
		return this.messagePoolPush({
			ctx,
			command: 'replyWithMarkdown',
			args: [lang('infoSuccess')]
		})
	},

	async onCommandTest(ctx) {
		return this.messagePoolPush({
			ctx,
			command: 'replyWithMarkdown',
			args: [lang('infoSuccess')]
		})
	}
}
