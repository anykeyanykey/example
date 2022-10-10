const lang = require('./lang')
const { TG_BOT_LINK, DEFERRED_SLOT_SIZE, emoji: { SMALL_BLUE_DIAMOND, WHITE_MEDIUM_SMALL_SQUARE, SMALL_ORANGE_DIAMOND } } = require('./../const')
const moment = require('moment-timezone')
const { uniqBy } = require('lodash')
const { undoBackRow } = require('./markup')
const { inlineKeyboard, button } = require('telegraf/lib/markup')

const cloneMessage = (message) => {
	const { text, media_group_id, animation, audio, photo: photos, sticker, video, video_note, voice, document, caption, entities, caption_entities } = message
	const [photo] = photos || []
	const isText = !!text

	const type = isText ? 'text' :
		animation ? 'animation' :
			audio ? 'audio' :
				photo ? 'photo' :
					sticker ? 'sticker' :
						video ? 'video' :
							video_note ? 'video_note' :
								voice ? 'voice' :
									document ? 'document' : 'unknown'

	const file_id = animation ? animation.file_id :
		audio ? audio.file_id :
			photo ? photo.file_id  :
				sticker ? sticker.file_id :
					video ? video.file_id :
						video_note ? video_note.file_id :
							voice ? voice.file_id :
								document ? document.file_id : 'unknown'
	return {
		media_group_id,
		item: {
			type,
			file_id,
			media: file_id,
			caption,
			entities,
			caption_entities,
			text
		}
	}
}

const dateRequestMarkup = (ctx, items, postMode, canSendToDraft) => {
	const commands = items.map(({ count, date, text }) =>
		button.callback(`${text} (${count})`, `date_${date.format()}`))
	const buttons = [
		...commands.toChunks(2),
		undoBackRow(ctx)
	]
	const upRow = []
	postMode && upRow.push(button.callback(lang('cbNearestTime'), 'nearest'))
	canSendToDraft && upRow.unshift(button.callback(lang('cbToDraft'), 'to-draft'))
	buttons.unshift(upRow)
	return inlineKeyboard(buttons)
}

const hourRequestMarkup = (ctx, items) => {
	const commands = items.map(({ count, date }) =>
		button.callback(`${date.format('HH:mm')} (${count})`, `hour_${date.format()}`))
	const buttons = [
		...commands.toChunks(4),
		undoBackRow(ctx)
	]
	return inlineKeyboard(buttons)
}

const timeRequestMarkup = (ctx, items) => {
	const commands = items.map(({ repostCount, deferredCount, date }) =>
		button.callback(`${ deferredCount ? SMALL_BLUE_DIAMOND : repostCount ? SMALL_ORANGE_DIAMOND : WHITE_MEDIUM_SMALL_SQUARE } ${date.format('HH:mm')}`, `time_${date.format()}`))
	const buttons = [
		...commands.toChunks(4),
		undoBackRow(ctx)
	]
	return inlineKeyboard(buttons)
}

module.exports = {
	postReply(ctx, allowGroups = false) {

		const { message, wizard: { state } } = ctx

		const cloned = cloneMessage(message)

		const { media_group_id, item } = cloned
		const { type, file_id, caption, text, entities, caption_entities } = item

		const isMediaGroup = !!media_group_id

		if (isMediaGroup) {
			if (!allowGroups) {
				const now = state[media_group_id]
				state[media_group_id] = true
				return now
			} else {
				if (!state[media_group_id]) {
					state[media_group_id] = []
				}
				state[media_group_id].push(cloned)
				return media_group_id
			}
		}

		state['post'] = {
			isGroup: false,
			type,
			text,
			file_id,
			entities,
			caption_entities,
			disable_web_page_preview: false,
			caption
		}

		state['hasUrls'] = entities && entities.find(({ type }) => type === 'url' || type === 'text_link')

		return false
	},

	buttonTextRequest(ctx, markup) {
		const { main } = ctx
		return main.replyWithMarkdownUpdate(ctx, [lang('buttonTextQuestion'), markup])
	},

	buttonUrlRequest(ctx, markup) {
		const { main } = ctx
		return main.replyWithMarkdownUpdate(ctx, [lang('buttonUrlQuestion', 'https://t.me/joinchat/Hc5q9qqdfzk1ZTRi', TG_BOT_LINK, 'https://google.com'), markup])
	},

	async dateRequest(ctx, postMode, prependInfo, canSendToDraft = false) {
		const { from: { timezone }, main, wizard: { state: { groupId } } } = ctx
		const now = moment().tz(timezone)
		const yesterday = now.clone().add(-1, 'day').startOf('day')
		const tomorrow = now.clone().add(1, 'day').startOf('day')
		const today = now.clone().startOf('day')
		let start = now.clone().startOf('day').add(-1, 'day')
		let end = start.clone().add(10, 'days').endOf('day')
		let cursor = start.clone()
		let fifteen = [start]
		while (true) {
			cursor.add(DEFERRED_SLOT_SIZE, 'minutes')
			if (cursor.isBefore(end)) {
				fifteen.push(cursor.clone())
			} else {
				break
			}
		}
		const posts = await main.getDeferredMany({ groupId, 'settings.date': { $gte: start.toDate(), $lte: end.toDate(), $ne: null } })
		const reposts = await main.getRepostMany({ groupId, date: { $gte: start.toDate(), $lte: end.toDate(), $ne: null } })
		const fn = (isRepost, date, _startOfDay, _endOfDay, _endOfFifteen, result, item) => {
			const { date: postDate } = item
			const postDateM = moment(postDate).tz(date.tz())
			if (postDateM.isSameOrAfter(_startOfDay) && postDateM.isSameOrBefore(_endOfDay)) {
				result.count++
			}
			if (postDateM.isSameOrAfter(date) && postDateM.isSameOrBefore(_endOfFifteen)) {
				result.countFifteen++
			}
			return result
		}
		const items = uniqBy(fifteen.reduce((result, date) => {
			const _startOfDay = date.clone().startOf('day')
			const _endOfDay = date.clone().endOf('day')
			const _endOfFifteen = date.clone().add(DEFERRED_SLOT_SIZE - 1, 'minutes').endOf('minute')
			const { count, countFifteen } = reposts.reduce(fn.bind(this, true, date, _startOfDay, _endOfDay, _endOfFifteen),
				posts.reduce(fn.bind(this, false, date, _startOfDay, _endOfDay, _endOfFifteen), { count: 0, countFifteen: 0 }))
			if ((postMode && countFifteen === 0 && date.isAfter(now)) || (!postMode && (count > 0 || date.isSameOrAfter(today)))) {
				const text = _startOfDay.isSame(yesterday) ? lang('yesterday') : _startOfDay.isSame(today) ? lang('today') : _startOfDay.isSame(tomorrow) ? lang('tomorrow') : _startOfDay.format('D MMMM')
				result.push({ count, date: _startOfDay, text })
			}
			return result
		}, []), ({ date }) => date.format())
		const msg = []
		prependInfo && msg.push(prependInfo)
		!postMode && msg.push(lang('scheduledAndPostedPostsByDay'))
		postMode && msg.push(lang('choiceOfPlacementDate'))
		return main.replyWithMarkdownUpdate(ctx, [msg.join('\n'), {
			disable_web_page_preview: true, ...dateRequestMarkup(ctx, items, postMode, canSendToDraft) }])
	},

	async hourRequest(ctx, postMode, prependInfo) {
		const { from: { timezone }, main, wizard: { state: { groupId, date, postDate } } } = ctx
		const now = moment().tz(timezone)
		let start = moment(postMode ? postDate : date).tz(timezone)
		let end = start.clone().endOf('day')
		let cursor = start.clone()
		let fifteen = [start]
		while (true) {
			cursor.add(DEFERRED_SLOT_SIZE, 'minutes')
			if (cursor.isBefore(end)) {
				fifteen.push(cursor.clone())
			} else {
				break
			}
		}
		const posts = await main.getDeferredMany({ groupId, 'settings.date': { $gte: start.toDate(), $lte: end.toDate(), $ne: null } })
		const reposts = await main.getRepostMany({ groupId, date: { $gte: start.toDate(), $lte: end.toDate(), $ne: null } })
		const fn = (isRepost, date, _startOfHour, _endOfHour, _endOfFifteen, result, item) => {
			const { date: postDate } = item
			const postDateM = moment(postDate).tz(date.tz())
			if (postDateM.isSameOrAfter(_startOfHour) && postDateM.isSameOrBefore(_endOfHour)) {
				result.count++
			}
			if (postDateM.isSameOrAfter(date) && postDateM.isSameOrBefore(_endOfFifteen)) {
				result.countFifteen++
			}
			return result
		}
		const items = uniqBy(fifteen.reduce((result, date) => {
			const _startOfHour = date.clone().startOf('hour')
			const _endOfHour = date.clone().endOf('hour')
			const _endOfFifteen = date.clone().add(DEFERRED_SLOT_SIZE - 1, 'minutes').endOf('minute')
			const { count, countFifteen } = reposts.reduce(fn.bind(this, true, date, _startOfHour, _endOfHour, _endOfFifteen),
				posts.reduce(fn.bind(this, false, date, _startOfHour, _endOfHour, _endOfFifteen), { count: 0, countFifteen: 0 }))
			if ((postMode && countFifteen === 0 && date.isAfter(now)) || (!postMode && (count > 0 || date.isAfter(now)))) {
				result.push({ count, date: _startOfHour })
			}
			return result
		}, []), ({ date }) => date.format())
		const msg = []
		prependInfo && msg.push(prependInfo)
		postMode && msg.push(lang('choiceOfPlacementTime'))
		!postMode && msg.push(lang('scheduledAndPostedPostsByHour'))
		msg.push(lang('date', start.format('LL'), timezone))
		return main.replyWithMarkdownUpdate(ctx, [msg.join('\n'), {
			disable_web_page_preview: true, ...hourRequestMarkup(ctx, items) }])
	},

	async timeRequest(ctx, postMode, prependInfo) {
		const { from: { timezone }, main, wizard: { state: { groupId, hour, postHour } } } = ctx
		const now = moment().tz(timezone)
		let start = moment(postMode ? postHour : hour).tz(timezone)
		let end = start.clone().endOf('hour')
		let cursor = start.clone()
		let fifteen = [start]
		while (true) {
			cursor.add(DEFERRED_SLOT_SIZE, 'minutes')
			if (cursor.isBefore(end)) {
				fifteen.push(cursor.clone())
			} else {
				break
			}
		}
		const posts = await main.getDeferredMany({ groupId, 'settings.date': { $gte: start.toDate(), $lte: end.toDate(), $ne: null } })
		const reposts = await main.getRepostMany({ groupId, date: { $gte: start.toDate(), $lte: end.toDate(), $ne: null } })
		const fn = (isRepost, date, _endOfFifteen, result, item) => {
			const { date: postDate } = item
			const postDateM = moment(postDate).tz(date.tz())
			if(postDateM.isSameOrAfter(date) && postDateM.isSameOrBefore(_endOfFifteen)) {
				if (isRepost) {
					result.repostDocs.push(item)
				} else {
					result.deferredDocs.push(item)
				}
			}
			return result
		}
		const items = fifteen.reduce((result, date) => {
			const _endOfFifteen = date.clone().add(DEFERRED_SLOT_SIZE - 1, 'minutes').endOf('minute')
			const { repostDocs, deferredDocs } = reposts.reduce(fn.bind(this, true, date, _endOfFifteen),
				posts.reduce(fn.bind(this, false, date, _endOfFifteen), { repostDocs: [], deferredDocs: [] }))
			const repostCount = repostDocs.length
			const deferredCount = deferredDocs.length
			const count = repostCount + deferredCount
			if (postMode && count === 0 && date.isAfter(now)) {
				result.push({ repostCount, deferredCount, date })
			} else if (!postMode && (count > 0 || date.isAfter(now))) {
				if (count === 0) {
					result.push({ repostCount, deferredCount , date })
				} else {
					repostDocs.forEach(({ date: postDate }) => {
						result.push({ repostCount: 1, deferredCount: 0, date: moment(postDate).tz(date.tz()) })
					})
					deferredDocs.forEach(({ date: postDate }) => {
						result.push({ repostCount: 0, deferredCount: 1, date: moment(postDate).tz(date.tz()) })
					})
				}
			}
			return result
		}, [])
		const msg = []
		prependInfo && msg.push(prependInfo)
		postMode && msg.push(lang('choiceOfPlacementTime'))
		!postMode && msg.push(lang('scheduledAndPostedPosts'))
		msg.push(lang('date', start.format('LLL'), timezone))
		postMode && msg.push(lang('choiceFreeSlot'))
		!postMode && msg.push(lang('freeAndOccupiedSlots'))
		return main.replyWithMarkdownUpdate(ctx, [msg.join('\n'), { disable_web_page_preview: true, ...timeRequestMarkup(ctx, items) }])
	}
}
