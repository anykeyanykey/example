const moment = require('moment-timezone')
const { inlineKeyboard, button } = require('telegraf/lib/markup')
const { BaseScene } = require('telegraf/lib/scenes/base')
const { undoBackMarkup, yesNoMenuMarkup } = require('./../markups')
const Wizard = require('../telegraf/wizard')
const { URL_REGEXP, scenes: { SCENE_ID_DEFERRED } } = require('../const')
const { lang, reply: { postReply, buttonTextRequest, buttonUrlRequest, dateRequest, hourRequest, timeRequest }, markup: { backRow, undoBackRow, insertNavButtons  }, scene: { enterHandler } } = require('../utils')
const { RepostModel, DeferredSettingsModel } = require('./../base/models')

const timeoutMap = {}

const lifeTimeRequestMarkup = (ctx) => {
	const commands = Array.from({ length: 48 }).map((item, i) => {
		const k = (i + 1)
		return button.callback(k, `lifetime_${k}`)
	}).toChunks(8)
	const buttons = [
		[button.callback(lang('cbDoNotRemove'), `lifetime_0`)],
		...commands,
		undoBackRow(ctx)
	]
	return inlineKeyboard(buttons)
}

const welcomeRequestMarkup = (ctx) => {
	const buttons = [
		[button.callback(lang('cbPostNow'), `now`)],
		[button.callback(lang('cbManagement'), `plan`)],
		[button.callback(lang('cbDrafts'), `draft`)],
		[button.callback(lang('cbCreateDraft'), `create-draft`)],
		backRow(ctx)
	]
	return inlineKeyboard(buttons)
}

const buttonsRequestMarkup = (ctx) => {
	const { wizard: { state: { post: { buttons = [] } } } } = ctx
	let commands = []
	buttons.length && commands.push(button.callback(lang('cbChange'), `change-button`))
	buttons.length && commands.push(button.callback(lang('cbRemove'), `delete-button`))
	buttons.length < 5 && commands.push(button.callback(lang('cbAdd'), `add-button`))
	const actions = [
		...commands.toChunks(2),
		undoBackRow(ctx)
	]
	return inlineKeyboard(actions)
}

const noItemsRequestMarkup = (ctx) => {
	const commands = []
	commands.push([button.callback('Создать', `create-draft`)])
	const buttons = [
		...commands,
		undoBackRow(ctx)
	]
	return inlineKeyboard(buttons)
}

const postSettingsRequestMarkup = (ctx, postDoc) => {
	const { from, wizard: { state } } = ctx
	const { settings, post, draftMode, skip, count, sendNow } = state
	const { pin, silent } = settings
	const { disable_web_page_preview } = post
	const { id } = postDoc
	let commands = []
	postDoc.canHideUrls(from) && commands.push(button.callback(disable_web_page_preview ? lang('cbShowUrls') : lang('cbHideUrls'), disable_web_page_preview ? `show-urls` : 'hide-urls'))
	postDoc.canChangeButtons(from) && commands.push(button.callback(lang('cbButtons'), `set-buttons`))
	postDoc.canSetLifetime(from) && commands.push(button.callback(lang('cbAutoDelete'), `set-lifetime`))
	postDoc.canSetNeedPin(from) && commands.push(button.callback(pin ? lang('cbDontNeedToPeenPin') : lang('cbNeedToPeenPin'), `set-pin`))
	postDoc.canSetSilent(from) && commands.push(button.callback(silent ? lang('cbNotSilent') : lang('cbSilent'), `set-silent`))
	!sendNow && postDoc.canChangeDate(from) && commands.push(button.callback(lang('cbTime'), `set-date`))
	postDoc.canDelete(from) && commands.push(button.callback(lang('cbDelete'), `delete-post_${id}`))
	postDoc.canStop(from) && commands.push(button.callback(lang('cbStop'), `stop-post_${id}`))
	postDoc.isConfigurable() && postDoc.isBeenModified(post, settings) && commands.push(button.callback(lang('cbSave'), `save`))
	commands = commands.toChunks(2)
	sendNow && postDoc.canPostNow(from) && commands.push([button.callback(lang('cbPublish'), `send-post_${id}`)])
	const actions = [
		...commands,
		undoBackRow(ctx)
	]
	if (draftMode) {
		return inlineKeyboard(insertNavButtons(actions, commands.length, skip, count))
	}
	return inlineKeyboard(actions)
}

const repostMarkup = (ctx, repost) => {
	const { from, wizard: { state: { settings: { date: resultDate } } } } = ctx
	const { id, date } = repost
	const commands = []
	repost.canSetDate(from) && commands.push([button.callback(lang('cbChooseTime'), `date-repost_${id}`)])
	repost.canUndo(from) && commands.push([button.callback(lang('cbUndo'), `undo-repost_${id}`)])
	const isDateModified = resultDate && !moment(date).isSame(resultDate)
	isDateModified && commands.push([button.callback(lang('cbSave'), `save`)])
	const buttons = [
		...commands,
		undoBackRow(ctx)
	]
	return inlineKeyboard(buttons)
}

const undoRequest = async (ctx, repostId) => {
	const { main } = ctx
	const repost = await main.getRepost({ id: repostId })
	const isPosted = repost.isPosted()
	return main.replyWithMarkdownUpdate(ctx, [lang('sureUndoRepost', isPosted), yesNoMenuMarkup(repostId)])
}

const postRequest = async (ctx) => {
	const { from: { timezone }, main, wizard: { state: { draftMode, groupInfo, resultDate } } } = ctx
	let prependInfo
	if (draftMode) {
		prependInfo = groupInfo
	} else {
		prependInfo = [groupInfo, lang('postDate', moment(resultDate).tz(timezone).format('LLL'), timezone)].join('\n')
	}
	return main.replyWithMarkdownUpdate(ctx, [lang('makePostDeferred', draftMode, prependInfo), {
		disable_web_page_preview: true, ...undoBackMarkup()
	}])
}

const welcomeRequest = async (ctx) => {
	const { main, wizard: { state } } = ctx
	const { groupId } = state
	const group = await main.getGroup({ id: groupId })
	state['groupInfo'] = group.toInfo(2)
	return main.replyWithMarkdownUpdate(ctx, [[
		state['groupInfo'],
		lang('welcomeDeferred'),
	].join('\n'), { disable_web_page_preview: true, ...welcomeRequestMarkup(ctx) }])
}

const getPostInfo = async (ctx) => {
	const { main, wizard: { state } } = ctx
	const { postId, isRepost } = state
	const post = isRepost ? await main.getRepost({ id: postId }) : await main.getDeferred({ id: postId })
	const { message, settings } = post
	state['post'] = state['post'] || message
	state['settings'] = state['settings'] || (settings ? settings.toJSON() : { })
	return post
}

const postSettingsRequest = async (ctx) => {
	const { from, main, wizard: { state }, chat: { id: chatId } } = ctx
	const post = await getPostInfo(ctx)
	const { settings, isRepost } = state
	const { message } = post
	const settingsModel = new DeferredSettingsModel(settings)
	await main.sendPostMessage(ctx, message, chatId)
	if (isRepost) {
		return main.replyWithMarkdownUpdate(ctx, [post.toInfoStat(from), repostMarkup(ctx, post)])
	}
	const isDraft = !settings.date
	return main.replyWithMarkdownUpdate(ctx, [[post.toInfo(from, isDraft), settingsModel.toInfo(from)].join('\n'), postSettingsRequestMarkup(ctx, post)])
}

const buttonsRequest = (ctx) => {
	const { main } = ctx
	return main.replyWithMarkdownUpdate(ctx, [lang('yoCanAssignFiveButtons'), buttonsRequestMarkup(ctx)])
}

const deleteRequest = (ctx, postId) => {
	const { main } = ctx
	return main.replyWithMarkdownUpdate(ctx, [lang('sureDeleteDeferred'), yesNoMenuMarkup(postId)])
}

const stopRequest = (ctx, postId) => {
	const { main } = ctx
	return main.replyWithMarkdownUpdate(ctx, [lang('sureStopDeferred'), yesNoMenuMarkup(postId)])
}

const lifeTimeRequest = (ctx) => {
	const { main } = ctx
	return main.replyWithMarkdownUpdate(ctx, [lang('lifeTimeQuestion'), lifeTimeRequestMarkup(ctx)])
}

const initialSet = async (ctx) => {
	const { main, wizard: { state } } = ctx
	const { groupId } = state
	state['count'] = await main.getDeferredCount({ groupId, 'settings.date': null })
	state['skip'] = state['skip'] || 0
}

const noItemsRequest = async (ctx) => {
	const { main } = ctx
	main.deleteHoldMessages(ctx)
	return main.replyWithMarkdownUpdate(ctx, [lang('noDrafts'), noItemsRequestMarkup(ctx)])
}

const changePostId = (ctx, postId, isRepost = false) => {
	const { wizard: { state } } = ctx
	const { postId: oldPostId } = state
	if (oldPostId !== postId) {
		delete state['post']
		delete state['settings']
	}
	state['postId'] = postId
	state['isRepost'] = isRepost
}

const createDeferred = async (ctx) => {
	const { from, main, wizard: { state } } = ctx
	const { draftMode, post: message, settings = { }, groupId, resultDate } = state
	const { id: postId } = await main.createDeferred({ from, message, settings: { date: draftMode ? null : resultDate, ...settings }, groupId })
	changePostId(ctx, postId)
}

const scene0 = new BaseScene(0)
	.enter(enterHandler(), async (ctx) => {
		console.log('scene0')
		await welcomeRequest(ctx)
		return deferredWizard.goToHandler(ctx, scene0)
	})
	.action(/now/, (ctx) => {
		const { wizard: { state } } = ctx
		state['sendNow'] = true
		state['draftMode'] = false
		return scene0.go(ctx, scene4)
	})
	.action(/create-draft/, (ctx) => {
		const { wizard: { state } } = ctx
		state['sendNow'] = false
		state['draftMode'] = true
		return scene0.go(ctx, scene4)
	})
	.action(/draft/, (ctx) => {
		const { wizard: { state } } = ctx
		state['sendNow'] = false
		state['draftMode'] = true
		return scene0.go(ctx, scene5)
	})
	.action(/plan/, (ctx) => {
		const { wizard: { state } } = ctx
		state['sendNow'] = false
		state['draftMode'] = false
		return scene0.go(ctx, scene1)
	})

const scene1 = new BaseScene(1)
	.leave((ctx) => {
		const { wizard: { state } } = ctx
		const { postMode } = state
		if (postMode) {
			delete state['postDate']
		} else {
			delete state['date']
		}
	})
	.enter(enterHandler((ctx) => {
		const { wizard: { state } } = ctx
		return state['postMode']
	}), async (ctx) => {
		const { wizard: { state: { draftMode, isRepost, postMode, groupInfo, sendNow } } } = ctx
		const canSendToDraft = postMode && !isRepost && !draftMode && !sendNow
		await dateRequest(ctx, postMode, groupInfo, canSendToDraft)
		return deferredWizard.goToHandler(ctx, scene1)
	})
	.action([/nearest/, /to-draft/], (ctx) => {
		const { match, wizard: { state: { settings } } } = ctx
		settings.date = match[0] === 'nearest' ? moment().format() : null
		return deferredWizard.goBack(ctx, scene5)
	})
	.action(/date_(.*)/, (ctx) => {
		const { match, wizard: { state } } = ctx
		const { postMode } = state
		if (postMode) {
			state['postDate'] = match[1]
		} else {
			state['date'] = match[1]
		}
		return scene1.go(ctx, scene2)
	})

const scene2 = new BaseScene(2)
	.leave((ctx) => {
		const { wizard: { state } } = ctx
		const { postMode } = state
		if (postMode) {
			delete state['postHour']
		} else {
			delete state['hour']
		}
	})
	.enter(enterHandler((ctx) => {
		const { wizard: { state } } = ctx
		return state['postMode']
	}), async (ctx) => {
		const { wizard: { state } } = ctx
		await hourRequest(ctx, state['postMode'], state['groupInfo'])
		return deferredWizard.goToHandler(ctx, scene2)
	})
	.action(/hour_(.*)/, (ctx) => {
		const { match, wizard: { state } } = ctx
		const { postMode } = state
		if (postMode) {
			state['postHour'] = match[1]
		} else {
			state['hour'] = match[1]
		}
		return scene2.go(ctx, scene3)
	})

const scene3 = new BaseScene(3)
	.leave((ctx) => {
		const { wizard: { state } } = ctx
		delete state['resultDate']
	})
	.enter(enterHandler((ctx) => {
		const { wizard: { state } } = ctx
		return state['postMode']
	}), async (ctx) => {
		const { wizard: { state: { postMode, groupInfo } } } = ctx
		await timeRequest(ctx, postMode, groupInfo)
		return deferredWizard.goToHandler(ctx, scene3)
	})
	.action(/time_(.*)/, async (ctx) => {
		const { main, match, wizard: { state } } = ctx
		const { groupId, postMode, settings } = state
		const timeM = moment(match[1])
		const resultM = timeM.clone()
		state['resultDate'] = resultM.format()
		if (postMode) {
			settings.date = state['resultDate']
			return deferredWizard.goBack(ctx, scene5)
		} else {
			const post = await main.getDeferred({ groupId, 'settings.date': { $eq: resultM.toDate() } }, null, null, false) ||
				await main.getRepost({ groupId, date: { $eq: resultM.toDate() } }, null, null, false)
			if (post) {
				const { id: postId } = post
				changePostId(ctx, postId, post instanceof RepostModel)
				return scene3.go(ctx, scene5)
			}
			return scene3.go(ctx, scene4)
		}
	})

const scene4 = new BaseScene(4)
	.enter(enterHandler(), async (ctx) => {
		await postRequest(ctx)
		return deferredWizard.goToHandler(ctx, scene4)
	})
	.use(async (ctx) => {
		const { wizard: { state } } = ctx
		const result = await postReply(ctx, true)
		if (typeof result === 'string') {
			clearTimeout(timeoutMap[result])
			timeoutMap[result] = setTimeout(async () => {
				const items = state[result].map(({ item }) => item)
				state['post'] = {
					isGroup: true,
					items
				}
				delete state[result]
				await createDeferred(ctx)
				return scene4.go(ctx, scene5, true)
			}, 1000)
		} else if (result === false) {
			await createDeferred(ctx)
			return scene4.go(ctx, scene5, true)
		}
	})

const scene5 = new BaseScene(5)
	.leave((ctx) => {
		const { wizard: { state } } = ctx
		delete state['postMode']
		delete state['skip']
		delete state['postId']
		delete state['isRepost']
		delete state['settings']
		delete state['post']
	})
	.enter(async (ctx) => {
		const { main, wizard: { state } } = ctx
		const { draftMode } = state
		state['postMode'] = true
		if (draftMode) {
			await initialSet(ctx)
			const { groupId, count, skip } = state
			if (count === 0) {
				await noItemsRequest(ctx)
				return deferredWizard.goToHandler(ctx, scene5)
			} else if (skip) {
				if (skip >= count) {
					state['skip'] = count - 1
				} else {
					state['skip'] = skip
				}
			}
			const { id: postId } = await main.getDeferredSkip({ groupId, 'settings.date': { $eq: null } }, null, state['skip'])
			changePostId(ctx, postId)
		}
		await postSettingsRequest(ctx)
		return deferredWizard.goToHandler(ctx, scene5)
	})
	.action(/undo-repost_(.+)/, (ctx) => {
		return scene5.go(ctx, scene12)
	})
	.action(/date-repost_(.+)/, (ctx) => {
		return scene5.go(ctx, scene1)
	})
	.action(/set-lifetime/, (ctx) => {
		return scene5.go(ctx, scene10)
	})
	.action(/set-buttons/, async (ctx) => {
		return scene5.go(ctx, scene11)
	})
	.action(/set-date/, async (ctx) => {
		return scene5.go(ctx, scene1)
	})
	.action(/delete-post_(.*)/, (ctx) => {
		return scene5.go(ctx, scene8)
	})
	.action(/stop-post_(.*)/, (ctx) => {
		return scene5.go(ctx, scene9)
	})
	.action(/send-post_(.*)/, async (ctx) => {
		const { from, main, wizard: { state: { postId, settings, post: message } } } = ctx
		settings.date = moment().format()
		await main.modifyDeferred(from, { id: postId }, { message, settings })
		return scene5.reenter(ctx)
	})
	.action(/set-pin/, (ctx) => {
		const { wizard: { state: { settings } } } = ctx
		settings['pin'] = !settings['pin']
		return scene5.reenter(ctx)
	})
	.action(/set-silent/, (ctx) => {
		const { wizard: { state: { settings } } } = ctx
		settings['silent'] = !settings['silent']
		return scene5.reenter(ctx)
	})
	.action([/hide-urls/, /show-urls/], async (ctx) => {
		const { main, chat: { id: chatId }, match, wizard: { state: { post } } } = ctx
		post['disable_web_page_preview'] = match[0] === 'hide-urls'
		await main.editPostMessage(ctx, post, chatId)
		return scene5.reenter(ctx)
	})
	.action(/save/, async (ctx) => {
		const { from, main, wizard: { state: { postId, post: message, settings, isRepost } } } = ctx
		if (isRepost) {
			const { date } = settings
			await main.setDateRepostById(from, postId, date)
		} else {
			await main.modifyDeferred(from, { id: postId }, { message, settings })
		}
		return scene5.reenter(ctx)
	})
	.action(/create-draft/, (ctx) => {
		return scene5.go(ctx, scene4)
	})
	.action(['prev', 'next'], (ctx) => {
		const { match, wizard: { state } } = ctx
		state['skip'] = match[0] === 'next' ? ++state['skip'] : --state['skip']
		return scene5.reenter(ctx)
	})

const scene6 = new BaseScene(6)
	.leave((ctx) => {
		const { wizard: { state } } = ctx
		delete state['button_text']
	})
	.enter(async (ctx) => {
		await buttonTextRequest(ctx, undoBackMarkup())
		return deferredWizard.goToHandler(ctx, scene6)
	})
	.use((ctx) => {
		const { message: { text }, wizard: { state } } = ctx
		state['button_text'] = text
		return scene6.go(ctx, scene7)
	})

const scene7 = new BaseScene(7)
	.enter(async (ctx) => {
		await buttonUrlRequest(ctx, undoBackMarkup())
		return deferredWizard.goToHandler(ctx, scene7)
	})
	.use(async (ctx) => {
		const { main, chat: { id: chatId }, message: { text: url }, wizard: { state } } = ctx
		const { post, button_text, button_change_mode } = state
		const { buttons = [] } = post
		const _prev = JSON.stringify(buttons)
		if (URL_REGEXP.test(url)) {
			button_change_mode && buttons.pop()
			buttons.push({ text: button_text, url })
			post.buttons = buttons
			if (_prev !== JSON.stringify(buttons)) {
				await main.editPostMessageMarkup(ctx, post, chatId)
			}
			return deferredWizard.goBack(ctx, scene11)
		}
		return main.replyNotify(ctx, [lang('wrongFormat')])
	})

const scene8 = new BaseScene(8)
	.enter(async (ctx) => {
		const { wizard: { state: { postId } } } = ctx
		await deleteRequest(ctx, postId)
		return deferredWizard.goToHandler(ctx, scene8)
	})
	.action([/(agree)_(.+)/, /(undo)_(.+)/], async (ctx) => {
		const { from, main, match, wizard: { state: { draftMode, sendNow } } } = ctx
		const isAgree = match[1] === 'agree'
		if (isAgree) {
			await main.deleteDeferredById(from, match[2])
		}
		if (sendNow && isAgree) {
			return deferredWizard.goBack(ctx, scene0)
		} else if (!draftMode && isAgree) {
			return deferredWizard.goBack(ctx, scene1)
		}
		return deferredWizard.goBack(ctx, scene5)
	})

const scene9 = new BaseScene(9)
	.enter(async (ctx) => {
		const { wizard: { state: { postId } } } = ctx
		await stopRequest(ctx, postId)
		return deferredWizard.goToHandler(ctx, scene9)
	})
	.action([/(agree)_(.+)/, /(undo)_(.+)/], async (ctx) => {
		const { from, main, match } = ctx
		const isAgree = match[1] === 'agree'
		if (isAgree) {
			await main.stopDeferredById(from, match[2])
		}
		return deferredWizard.goBack(ctx, scene5)
	})

const scene10 = new BaseScene(10)
	.enter(async (ctx) => {
		await lifeTimeRequest(ctx)
		return deferredWizard.goToHandler(ctx, scene10)
	})
	.action(/lifetime_(.+)/, (ctx) => {
		const { match, wizard: { state: { settings } } } = ctx
		settings['lifeTime'] = Number(match[1])
		return deferredWizard.goBack(ctx)
	})

const scene11 = new BaseScene(11)
	.leave((ctx) => {
		const { wizard: { state } } = ctx
		delete state['button_change_mode']
	})
	.enter(async (ctx) => {
		await buttonsRequest(ctx)
		return deferredWizard.goToHandler(ctx, scene11)
	})
	.action(/delete-button/, async (ctx) => {
		const { main, wizard: { state: { post } }, chat: { id: chatId } } = ctx
		post.buttons.pop()
		await main.editPostMessageMarkup(ctx, post, chatId)
		return scene11.reenter(ctx)
	})
	.action(/change-button/, (ctx) => {
		const { wizard: { state } } = ctx
		state['button_change_mode'] = true
		return scene11.go(ctx, scene6)
	})
	.action(/add-button/, (ctx) => {
		const { wizard: { state } } = ctx
		state['button_change_mode'] = false
		return scene11.go(ctx, scene6)
	})

const scene12 = new BaseScene(12)
	.enter(async (ctx) => {
		const { wizard: { state: { postId: repostId } } } = ctx
		await undoRequest(ctx, repostId)
		return deferredWizard.goToHandler(ctx, scene12)
	})
	.action([/(agree)_(.+)/, /(undo)_(.+)/], async (ctx) => {
		const { from, main, match } = ctx
		const isAgree = match[1] === 'agree'
		if (isAgree) {
			await main.undoRepostById(from, match[2])
		}
		return deferredWizard.goBack(ctx)
	})

const deferredWizard = new Wizard(
	SCENE_ID_DEFERRED,
	{
		enterHandlers: [enterHandler()],
	},
	[scene0, scene1, scene2, scene3, scene4, scene5, scene6, scene7, scene8, scene9, scene10, scene11, scene12]
)

module.exports = deferredWizard
