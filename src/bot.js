const { TelegramError } = require("telegraf/lib/core/network/error");
const { StringSession } = require("telegram/sessions");
const LocalSession = require('telegraf-session-local')
const { Api, TelegramClient } = require("telegram");
const moment = require('moment-timezone')
const { Telegraf } = require('telegraf')
const _ = require('lodash')
const { TG_APP_ID, TG_APP_API_HASH, TG_BOT_TOKEN, TG_BANK_ADMIN, scenes: { SCENE_ID_ERROR } } = require('./const')
const { adbMarkup, okMarkup } = require("./markups");
const { lang, logger, currency: { RUB } } = require('./utils')
const { SafeError } = require('./errors')

class Bot {
	constructor() {
		this.telegramDB = new LocalSession({
			database: 'telegram.json',
			storage: LocalSession.storageFileSync
		})
		const { stringSession } = this.telegramDB.getSession('telegram')
		this.client = new TelegramClient(
			new StringSession(stringSession),
			TG_APP_ID,
			TG_APP_API_HASH,
			{ baseLogger: logger, connectionRetries: 5 }
		);
		this.bot = new Telegraf(TG_BOT_TOKEN)
		this.messagePool = []
		this.messageSimplePool = []
		this.msgPromiseMap = {}
		this.interval = null
		this.intervalMsg = null
		this._stopPooling = false
		this.lastNotifyAdminMsgs = []
	}

	pushLastMessage(ctx, result, hold = false, menu = false, notify = false) {
		const { message_id, message_md5 } = result
		const { session } = ctx
		if (hold) {
			if (!session.__hold_messages) {
				session.__hold_messages = [{ message_id, message_md5 }]
			} else {
				session.__hold_messages.push({ message_id, message_md5 })
			}
		} else if (menu) {
			if (!session.__menu_messages) {
				session.__menu_messages = [{ message_id, message_md5 }]
			} else {
				session.__menu_messages.push({ message_id, message_md5 })
			}
		} else if (notify) {
			if (!session.__notify_messages) {
				session.__notify_messages = [{ message_id, message_md5 }]
			} else {
				session.__notify_messages.push({ message_id, message_md5 })
			}
		} else {
			if (!session.__last_messages) {
				session.__last_messages = [{ message_id, message_md5 }]
			} else {
				session.__last_messages.push({ message_id, message_md5 })
			}
		}
		return result
	}

	getLastTrivialMessage(ctx, pop = false) {
		const { session: { __last_messages = [] } } = ctx
		return pop ? __last_messages.pop() : __last_messages[__last_messages.length - 1]
	}

	getLastHoldMessage(ctx, pop = false) {
		const { session: { __hold_messages = [] } } = ctx
		return pop ? __hold_messages.pop() : __hold_messages[__hold_messages.length - 1]
	}

	getLastMenuMessage(ctx, pop = false) {
		const { session: { __menu_messages = [] } } = ctx
		return pop ? __menu_messages.pop() : __menu_messages[__menu_messages.length - 1]
	}

	getLastNotifyMessage(ctx, pop = false) {
		const { session: { __notify_messages = [] } } = ctx
		return pop ? __notify_messages.pop() : __notify_messages[__notify_messages.length - 1]
	}

	deleteNotifyMessages(ctx) {
		const { chat: { id: chatId } } = ctx
		let result = this.getLastNotifyMessage(ctx, true)
		while (result) {
			const { message_id } = result
			this.deleteMessage([chatId, message_id])
			result = this.getLastNotifyMessage(ctx, true)
		}
	}

	deleteTrivialMessages(ctx) {
		const { chat: { id: chatId } } = ctx
		this.deleteNotifyMessages(ctx)
		let result = this.getLastTrivialMessage(ctx, true)
		while (result) {
			const { message_id } = result
			this.deleteMessage([chatId, message_id])
			result = this.getLastTrivialMessage(ctx, true)
		}
	}

	deleteHoldMessages(ctx) {
		const { chat: { id: chatId } } = ctx
		let result = this.getLastHoldMessage(ctx, true)
		while (result) {
			const { message_id } = result
			this.deleteMessage([chatId, message_id])
			result = this.getLastHoldMessage(ctx, true)
		}
	}

	deleteMenuMessages(ctx) {
		const { chat: { id: chatId } } = ctx
		let result = this.getLastMenuMessage(ctx, true)
		while (result) {
			const { message_id } = result
			this.deleteMessage([chatId, message_id])
			result = this.getLastMenuMessage(ctx, true)
		}
	}

	deleteLastMessages(ctx, all = false, menu = false) {
		menu && this.deleteMenuMessages(ctx)
		all && this.deleteHoldMessages(ctx)
		this.deleteTrivialMessages(ctx)
	}

	async reply(ctx, args, hold = false, menu = false, notify = false) {
		return this.pushLastMessage(ctx, await this.messagePoolPush({
			ctx,
			command: 'reply',
			args,
			needResult: true
		}), hold, menu, notify)
	}

	async replyNotify(ctx, args) {
		this.deleteNotifyMessages(ctx)
		return this.pushLastMessage(ctx, await this.messagePoolPush({
			ctx,
			command: 'reply',
			args,
			needResult: true
		}), false, false, true)
	}

	async replyUpdate(ctx, args, hold = false, menu = false) {
		this.deleteTrivialMessages(ctx)
		return this.reply(ctx, args, hold, menu)
	}

	async replyWithMarkdown(ctx, args, hold = false, menu = false) {
		return this.pushLastMessage(ctx, await this.messagePoolPush({
			ctx,
			command: 'replyWithMarkdown',
			args,
			needResult: true
		}), hold, menu)
	}

	async replyWithMarkdownUpdate(ctx, args, hold = false, menu = false) {
		const { message, callbackQuery, chat: { id: chatId } } = ctx
		const message_id = message ? message.message_id : callbackQuery ? callbackQuery.message.message_id : null
		const { message_id: last_message_id } = this.getLastTrivialMessage(ctx) || {}
		if (message_id === last_message_id) {
			const [text, extra] = args
			this.deleteNotifyMessages(ctx)
			return this.editMessageText([chatId, message_id, void 0, text, { parse_mode: 'Markdown', ...extra }])
		}
		this.deleteTrivialMessages(ctx)
		return this.replyWithMarkdown(ctx, args, hold, menu)
	}

	async replyWithPhoto(ctx, args, hold = false, menu = false) {
		return this.pushLastMessage(ctx, await this.messagePoolPush({
			ctx,
			command: 'replyWithPhoto',
			args,
			needResult: true
		}), hold, menu)
	}

	notifyAdmin(message) {
		const last = this.lastNotifyAdminMsgs[this.lastNotifyAdminMsgs.length - 1]
		if (last !== message) {
			this.lastNotifyAdminMsgs.push(message)
			this.messagePoolPush({
				ctx: this.bot.telegram,
				command: 'sendMessage',
				args: [TG_BANK_ADMIN, message, okMarkup()]
			})
		}
	}

	sendMessage(args) {
		return this.messagePoolPush({ ctx: this.bot.telegram, command: 'sendMessage', args })
	}

	deleteMessage(args) {
		return this.messagePoolPush({ ctx: this.bot.telegram, command: 'deleteMessage', args })
	}

	editMessageText(args, extra = {}) {
		return this.messagePoolPush({ ctx: this.bot.telegram, command: 'editMessageText', args, ...extra })
	}

	editMessageCaption(args) {
		return this.messagePoolPush({ ctx: this.bot.telegram, command: 'editMessageCaption', args })
	}

	editMessageReplyMarkup(args) {
		return this.messagePoolPush({ ctx: this.bot.telegram, command: 'editMessageReplyMarkup', args })
	}

	leaveChat(args) {
		return this.messagePoolPush({ ctx: this.bot.telegram, command: 'leaveChat', args })
	}

	async editPostMessageMarkupMsg(message, chatId, message_id) {
		const { buttons = [] } = _.cloneDeep(message)
		const { reply_markup } = buttons.length ? adbMarkup(buttons) : {}
		return this.editMessageReplyMarkup([chatId, message_id, void 0, reply_markup])
	}

	async editPostMessageMarkup(ctx, message, chatId) {
		const { message_id } = this.getLastHoldMessage(ctx) || {}
		return this.editPostMessageMarkupMsg(message, chatId, message_id)
	}

	async editPostMessageMsg(message, chatId, message_id) {
		const { type, caption = '', text = '', entities = [], caption_entities = [], buttons = [], disable_web_page_preview } = _.cloneDeep(message)
		const isText = type === 'text'
		const extra = buttons.length ? adbMarkup(buttons) : {}
		if (isText) {
			return this.editMessageText([chatId, message_id, void 0, text, {
				entities,
				disable_web_page_preview, ...extra
			}])
		} else {
			return this.editMessageCaption([chatId, message_id, void 0, caption, {
				caption_entities,
				disable_web_page_preview, ...extra
			}])
		}
	}

	async editPostMessage(ctx, message, chatId) {
		const { message_id } = this.getLastHoldMessage(ctx) || {}
		return this.editPostMessageMsg(message, chatId, message_id)
	}

	async sendPostMessage(ctx, message, chatId, force = false) {
		const { message_md5 } = this.getLastHoldMessage(ctx) || {}
		const { md5 } = message
		if (force || message_md5 !== md5) {
			this.deleteLastMessages(ctx, true)
			const messages = await this.sendPost(message, chatId)
			messages.forEach((message_id) => {
				this.pushLastMessage(ctx, { message_id, message_md5: md5 }, true)
			})
		}
	}

	async sendPost(message, chatId, extra = {}) {

		const { isGroup, items = [], type, file_id, caption = '', text = '', entities = [], caption_entities = [], buttons = [], disable_web_page_preview } = _.cloneDeep(message)

		// todo ID

		extra.disable_web_page_preview = disable_web_page_preview

		const { reply_markup: { inline_keyboard } = {} } = extra

		if (buttons.length) {
			const { reply_markup: { inline_keyboard: inln_kbrd } = {} } = adbMarkup(buttons)
			if (inline_keyboard) {
				inline_keyboard.unshift(...inln_kbrd)
			} else {
				extra = { ...extra, ...adbMarkup(buttons) }
			}
		}

		const isText = type === 'text'
		const isAnimation = type === 'animation'
		const isAudio = type === 'audio'
		const isPhoto = type === 'photo'
		const isSticker = type === 'sticker'
		const isVideo = type === 'video'
		const isVideoNote = type === 'video_note'
		const isVoice = type === 'voice'
		const isDocument = type === 'document'

		let messages

		if (isText) {
			const { message_id } = await this.messagePoolPush({
				ctx: this.bot.telegram,
				command: 'sendMessage',
				args: [chatId, text, { entities, ...extra }],
				needResult: true
			})
			messages = [message_id]
		} else if (isGroup) {
			const msgs = await this.messagePoolPush({
				ctx: this.bot.telegram,
				command: 'sendMediaGroup',
				args: [chatId, items, { ...extra }],
				needResult: true
			})
			messages = msgs.map(({ message_id }) => message_id)
		} else if (isAnimation) {
			const { message_id } = await this.messagePoolPush({
				ctx: this.bot.telegram,
				command: 'sendAnimation',
				args: [chatId, file_id, { caption, caption_entities, ...extra }],
				needResult: true
			})
			messages = [message_id]
		} else if (isAudio) {
			const { message_id } = await this.messagePoolPush({
				ctx: this.bot.telegram,
				command: 'sendAudio',
				args: [chatId, file_id, { caption, caption_entities, ...extra }],
				needResult: true
			})
			messages = [message_id]
		} else if (isPhoto) {
			const { message_id } = await this.messagePoolPush({
				ctx: this.bot.telegram,
				command: 'sendPhoto',
				args: [chatId, file_id, { caption, caption_entities, ...extra }],
				needResult: true
			})
			messages = [message_id]
		} else if (isSticker) {
			const { message_id } = await this.messagePoolPush({
				ctx: this.bot.telegram,
				command: 'sendSticker',
				args: [chatId, file_id, { ...extra }],
				needResult: true
			})
			messages = [message_id]
		} else if (isVideo) {
			const { message_id } = await this.messagePoolPush({
				ctx: this.bot.telegram,
				command: 'sendVideo',
				args: [chatId, file_id, { caption, caption_entities, ...extra }],
				needResult: true
			})
			messages = [message_id]
		} else if (isVideoNote) {
			const { message_id } = await this.messagePoolPush({
				ctx: this.bot.telegram,
				command: 'sendVideoNote',
				args: [chatId, file_id, { ...extra }],
				needResult: true
			})
			messages = [message_id]
		} else if (isVoice) {
			const { message_id } = await this.messagePoolPush({
				ctx: this.bot.telegram,
				command: 'sendVoice',
				args: [chatId, file_id, { caption, caption_entities, ...extra }],
				needResult: true
			})
			messages = [message_id]
		} else if (isDocument) {
			const { message_id } = await this.messagePoolPush({
				ctx: this.bot.telegram,
				command: 'sendDocument',
				args: [chatId, file_id, { caption, caption_entities, ...extra }],
				needResult: true
			})
			messages = [message_id]
		} else {
			throw new SafeError(lang('wrongPostData'))
		}

		return messages
	}

	async refreshGroupInfoCache(groupDoc, safe = true) {
		const { updatedAt } = groupDoc
		if (moment().diff(moment(updatedAt), 'minutes') > 0) {
			return this.refreshGroupInfo(groupDoc, safe)
		}
		return groupDoc
	}

	async refreshGroupInfo(groupDoc, safe = true) {
		const { chatId } = groupDoc
		try {
			groupDoc.info = await this.getGroupInfo(chatId)
			return groupDoc.save()
		} catch (e) {
			if (safe) {
				throw new SafeError(lang('errorUnableGetChannelInfo'))
			}
		}
		return groupDoc
	}

	validateGroupInfo(groupInfo) {
		const { type } = groupInfo
		if (type !== 'channel') {
			throw new SafeError(lang('errorOnlyChannels'))
		}
	}

	validateGroupInfoPostSum(groupInfo, postDoc, repostCost) {
		const { members_count, type } = groupInfo
		if (type !== 'channel') {
			return lang('errorOnlyChannels')
		}
		const { limitFrom, limitTo, maxCost } = postDoc
		if (maxCost.value && RUB(repostCost).value > maxCost.value) {
			return lang('errorRepostCostLimit')
		} else if ((limitFrom && members_count < limitFrom) || (limitTo && members_count > limitTo)) {
			return lang('errorChannelMembersLimit')
		}
	}

	validateGroupInfoClient(chat) {
		const { broadcast, adminRights } = chat
		if (!broadcast) {
			return lang('errorOnlyChannels')
		}
		if (!adminRights) {
			return lang('errorBotRightsAdmin')
		}
		if (!adminRights.postMessages) {
			return lang('errorBotRightsPost')
		}
		if (!adminRights.editMessages) {
			return lang('errorBotRightsEdit')
		}
		if (!adminRights.inviteUsers) {
			return lang('errorBotRightsInvite')
		}
	}

	async getGroupInfo(groupId) {
		let result = await this.messagePoolPush({
			ctx: this.bot.telegram,
			command: 'getChat',
			args: [groupId]
		})
		let { id, type, username, title, invite_link, photo, description } = result
		const members_count = await this.messagePoolPush({
			ctx: this.bot.telegram,
			command: 'getChatMembersCount',
			args: [groupId]
		})
		if (!username && !invite_link) {
			invite_link = await this.messagePoolPush({
				ctx: this.bot.telegram,
				command: 'exportChatInviteLink',
				args: [groupId]
			})
		}
		return { id, type, username, title, invite_link, members_count, photo, description }
	}

	async getGroupInfoClient(groupId) {
		const { chats } = await this.client.invoke(
			new Api.channels.GetChannels({
				id: [groupId]
			})
		);
		const [chat] = chats
		return chat
	}

	async getMessageInfoClient({ chatId, messages }) {
		return this.client.invoke(
			new Api.channels.GetMessages({
				channel: chatId,
				id: messages
			})
		)
	}

	messagePoolPush(arg) {

		const { args, needResult } = arg
		const [arg0] = args

		if (/^-/.test(arg0) || needResult) {
			arg.promise = new Promise((resolve, reject) => {
				arg.resolve = resolve
				arg.reject = reject
			})
			this.messagePool.push(arg)
			return arg.promise
		} else {
			this.messageSimplePool.push(arg)
			return Promise.resolve({})
		}
	}

	async sendRetry(arg, count = 0) {
		if (count > 0) {
			logger.info('sendRetry try: %s', count)
		}
		if (count > 5) {
			throw 'asd' // todo
		}
		const { ctx, command, args } = arg
		return ctx[command](...args)
			.catch(async (e) => {
				if (e instanceof TelegramError) {
					const { response } = e
					if (response) {
						const { error_code, parameters: { retry_after } = {} } = response
						if (error_code === 429 && retry_after !== void 0) {
							logger.info('sendRetry waiting: %s', retry_after)
							await new Promise((resolve) => setTimeout(resolve, retry_after * 1000))
							return this.sendRetry(arg, ++count)
						}
					}
				}
				throw e
			})
	}

	async safeReplyCb(ctx, context, fn, cb, ...args) {
		let result, error
		try {
			result = await fn.apply(context, args)
		} catch (e) {
			const { message } = e
			if (e instanceof SafeError) {
				error = message
			} else {
				const msg = `safeReplyCbError: ${message}`
				logger.error(msg)
				this.notifyAdmin(msg)
				error = lang('botError')
			}
			return ctx.answerCbQuery(error, { show_alert: true })
		}
		return cb && cb(result)
	}

	async safeReply(ctx, context, fn, cb, ...args) {
		let result, error
		try {
			result = await fn.apply(context, args)
		} catch (e) {
			const { message } = e
			if (e instanceof SafeError) {
				error = message
			} else {
				const msg = `SafeReplyError: ${message}`
				logger.error(msg)
				this.notifyAdmin(msg)
				error = lang('botError')
			}
			return ctx.scene._enter(SCENE_ID_ERROR, { error })
		}
		return cb && cb(result)
	}

	stopPooling() {
		clearInterval(this.interval)
		clearInterval(this.intervalMsg)
		this._stopPooling = true
	}

	startPooling(sessionDB) {
		this._stopPooling = false
		this.pool()
		this.simplePool()
		this.msgPool(sessionDB)
	}

	simplePool() {
		this.interval = setInterval(() => {
			const msg = this.messageSimplePool.shift()
			if (msg) {
				const { ctx, command, args } = msg
				ctx[command](...args).catch(({ message }) => {
					logger.error(message)
				})
			}
		}, 30)
	}

	msgPool(sessionDB) {
		let pending = false
		this.intervalMsg = setInterval(async () => {
			if (pending) {
				return
			}
			pending = true
			try {
				const sessions = sessionDB.get('sessions')
				const sessionsValue = sessions.value()
				const now = Math.floor(Date.now() / 1000)
				const forRemove = []
				for (let i = 0; i < sessionsValue.length; i++) {
					const { id, data } = sessionsValue[i]
					const { __scenes: { expires } = { } } = data
					if (expires && expires > now) {
						continue
					}
					const [s1] = id.split(':')
					const arr = ['__hold_messages', '__last_messages', '__menu_messages', '__notify_messages']
					arr.forEach((key) => {
						data[key] && data[key].forEach(({ message_id }) => expires && this.deleteMessage([s1, message_id]))
					})
					forRemove.push(sessionsValue[i]['id'])
				}
				await sessions.removeWhere(({ id }) => forRemove.includes(id)).write()
			} finally {
				pending = false
			}
		}, 1000)
	}

	pool() {

		if (this._stopPooling) {
			return
		}

		let msg = this.messagePool.shift()

		if (msg) {
			const { ctx: { chat = {} }, args, resolve, reject } = msg
			const chatId = chat.id || args[0]
			if (!this.msgPromiseMap[chatId]) {
				this.msgPromiseMap[chatId] = Promise.resolve()
			}
			this.msgPromiseMap[chatId] = this.msgPromiseMap[chatId]
				.then(() => this.sendRetry(msg))
				.then(resolve)
				.catch(reject)
		}

		new Promise((resolve) => setTimeout(resolve, 30))
			.then(() => {
				this.pool()
			})
	}
}

module.exports = Bot
