const { Stage } = require('telegraf/lib/scenes/stage')
const LocalSession = require('telegraf-session-local')
const { initBase } = require('./base/utils')
const { lang, logger } = require('./utils')
const {
	TG_BOT_TOKEN, TG_ADMIN_LINK, scenes: { SCENE_ID_DEFERRED_MAIN, SCENE_ID_POSTS, SCENE_ID_FINANCE, SCENE_ID_WITHDRAWAL, SCENE_ID_ADS, SCENE_ID_PAYMENT,
		SCENE_ID_GROUPS, SCENE_ID_GROUP_ITEM, SCENE_ID_MENU, SCENE_ID_SETTINGS, SCENE_ID_ERROR, SCENE_ID_USER }
} = require('./const')
const { groupItemWizard, deferredMainWizard, timezoneWizard, userWizard, historyWizard, groupsWizard, settingsWizard, menuWizard, errorWizard, financeWizard, repostWizard, postsWizard,
	groupWizard, paymentWizard, withdrawalWizard, adsWizard, postSettingsWizard, listWizard, deferredWizard } = require('./scenes')
const { start: startServices, stop: stopServices } = require('./services')
const Bot = require('./bot')
const check = require('./check')
const base = require('./base')
const methods = require('./methods')
const commands = require('./commands')

class Main extends Bot {

	constructor() {
		super()
		this._initialized = false
		const handler = {
			set: function(obj, prop, value) {
				obj[prop] = value;
				const idle = !obj.payment && !obj.check && !obj.withdrawal
				if (idle) {
					const { _resolve } = obj
					_resolve && _resolve()
				}
				return true;
			}
		}
		this.semaphore = new Proxy({
			withdrawal: false,
			payment: false,
			check: false,
			getIdle() {
				return new Promise((resolve) => {
					this._resolve = resolve
				})
			}
		}, handler);
	}

	async start() {
		if (!this._initialized) {
			this.init()
			this._initialized = true
		}
		await initBase()
		startServices(this)
		await this.bot.launch()
		const { telegramDB, client } =this
		await client.start({ botAuthToken: TG_BOT_TOKEN })
		await telegramDB.saveSession('telegram', {
			stringSession: client.session.save()
		})
		this.startPooling(this.sessionDB)
		logger.info('Started')
	}

	init() {
		const stage = new Stage([
			withdrawalWizard,
			adsWizard,
			paymentWizard,
			postsWizard,
			repostWizard,
			menuWizard,
			settingsWizard,
			groupsWizard,
			financeWizard,
			errorWizard,
			groupWizard,
			listWizard,
			historyWizard,
			userWizard,
			timezoneWizard,
			postSettingsWizard,
			deferredWizard,
			groupItemWizard,
			deferredMainWizard
		], {
			ttl: 86400
		})

		this.bot.catch(async (e) => {
			const { name, message } = e
			const msg = `${name} ${message}`
			logger.error(msg)
			this.notifyAdmin(`Bot error: ${msg}`)
		})

		const breakAdmin = (ctx, next) => {
			const { from: { admin } } = ctx
			if (!admin) {
				return ctx.scene._enter(SCENE_ID_ERROR, { error: lang('errorAccessDenied') })
			}
			return next()
		}

		const breakFn = (ctx, next) => {
			const { chat: { type } = {}  } = ctx
			if (type !== 'private') {
				return
			}
			return next()
		}

		const rmMsgFn = (ctx, next) => {
			const { message: { message_id } = {} } = ctx
			message_id && ctx.deleteMessage(message_id)
			return next()
		}

		stage
			.use(rmMsgFn)
			.use(async (ctx, next) => {
				const { from } = ctx
				ctx.main = this
				let user = await this.getOrCreateUser(from)
				const { id, banned, mimicry } = user
				if (banned) {
					return ctx.scene._enter(SCENE_ID_ERROR, { error: lang('errorYouAreBanned', TG_ADMIN_LINK, id) })
				}
				if (this.isAdmin(from)) {
					from.admin = true
					from.id = mimicry || from.id
					ctx.adminUser = user
					if (mimicry) {
						user = await this.getOrCreateUser(from)
					}
				}
				await user.populate('settings').execPopulate();
				from.timezone = user.settings.timezone
				ctx.user = user
				return next()
			})
			.use(async (ctx, next) => {
				const { main } = ctx
				await main.safeReply(ctx, this, next, null, ctx)
			})
			.hears(lang('cbMyAds'), (ctx) => {
				return ctx.scene._enter(SCENE_ID_POSTS)
			}).hears(lang('cbCreateAds'), (ctx) => {
				return ctx.scene._enter(SCENE_ID_ADS)
			}).hears(lang('cbSettings'), (ctx) => {
				return ctx.scene._enter(SCENE_ID_SETTINGS)
			}).hears(lang('cbMyChannels'), (ctx) => {
				return ctx.scene._enter(SCENE_ID_GROUPS)
			}).hears(lang('cbFinances'), (ctx) => {
				return ctx.scene._enter(SCENE_ID_FINANCE)
			}).hears(lang('cbDeferred'), (ctx) => {
				return ctx.scene._enter(SCENE_ID_DEFERRED_MAIN)
			})

		stage.on('callback_query', this.onCallbackQuery.bind(this))

		stage.command('stat', this.onCommandStat.bind(this))
		stage.command('bankrupt', breakFn, breakAdmin, this.onCommandBankrupt.bind(this))
		stage.command('test', breakFn, breakAdmin, this.onCommandTest.bind(this))
		stage.command('ban', breakFn, breakAdmin, this.onCommandBan.bind(this))
		stage.command('unban', breakFn, breakAdmin, this.onCommandBan.bind(this))
		stage.command('rich', breakFn, breakAdmin, this.onCommandRich.bind(this))
		stage.command('mimicry', breakFn, breakAdmin, this.onCommandMimicry.bind(this))

		stage.command('start', breakFn, (ctx) => ctx.scene._enter(SCENE_ID_MENU))
		stage.command('withdrawal', breakFn, (ctx) => ctx.scene._enter(SCENE_ID_WITHDRAWAL))
		stage.command('ads', breakFn, (ctx) => ctx.scene._enter(SCENE_ID_ADS))
		stage.command('payment', breakFn, (ctx) => ctx.scene._enter(SCENE_ID_PAYMENT))
		stage.command('posts', breakFn, (ctx) => ctx.scene._enter(SCENE_ID_POSTS))
		stage.command('menu', breakFn, (ctx) => ctx.scene._enter(SCENE_ID_MENU))
		stage.command('post', breakFn, breakAdmin, (ctx) => {
			const { update: { message: { text } } } = ctx
			const s = text.split(' ')
			const byPostId = s[1]
			return ctx.scene._enter(SCENE_ID_POSTS, { byPostId })
		})
		stage.command('repost', breakFn, breakAdmin, (ctx) => {
			const { update: { message: { text } } } = ctx
			const s = text.split(' ')
			const byRepostId = s[1]
			return ctx.scene._enter(SCENE_ID_POSTS, { isReposts: true, byRepostId })
		})
		stage.command('group', breakFn, breakAdmin, (ctx) => {
			const { update: { message: { text } } } = ctx
			const s = text.split(' ')
			return ctx.scene._enter(SCENE_ID_GROUP_ITEM, { groupId: s[1] })
		})
		stage.command('user', breakFn, breakAdmin, (ctx) => {
			const { update: { message: { text } } } = ctx
			const s = text.split(' ')
			const userId = s[1]
			return ctx.scene._enter(SCENE_ID_USER, { user: userId })
		})

		const session = new LocalSession({ storage: LocalSession.storageFileSync })
		this.bot.use(session.middleware())
		this.bot.use(stage.middleware())
		const { DB } = session
		this.sessionDB = DB
	}

	async stop() {
		logger.info('Graceful stop...')
		stopServices()
		logger.info('Services stopped...')
		await this.semaphore.getIdle()
		logger.info('Idle state...')
		this.stopPooling()
		logger.info('Pooling stopped...')
		await this.bot.stop()
		logger.info('Bot stopped...')
		await this.client.disconnect()
		logger.info('Client disconnected...')
		await initBase(false)
		logger.info('Base stopped...')
	}
}

(() => {
	const all = {
		...check,
		...base,
		...methods,
		...commands,
	}
	Object.keys(all).forEach((method)=>{
		Main.prototype[method] = all[method];
	})
})()

module.exports = {
	main: new Main()
}
