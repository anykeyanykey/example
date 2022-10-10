const moment = require('moment-timezone')
const {	TG_CHANNEL_ID, TG_BOT_LINK, REQUEST_LIFETIME, REQUEST_LIFETIME_UNIT, POST_LIFETIME, POST_LIFETIME_UNIT, flow: { MF_PROFIT } } = require('./const')
const { DeferredModel, GroupModel, PostModel, RepostModel } = require("./base/models");
const { RPCError } = require("telegram/errors/RPCBaseErrors")
const { db } = require('./base/utils')
const { logger, lang } = require('./utils')
const { adsMarkup } = require('./markups')

module.exports = {
	async check(type) {
		const toInformOwner = []
		const toInformUser = []
		const toRemove = []
		switch (type) {
		case 'groups':
			let groupDocs = await GroupModel.getLeaveRequested()
			for (let i = 0; i < groupDocs.length; i++) {
				const group = groupDocs[i]
				const { id, info: { id: chatId } } = group
				logger.info('Processing leave request, groupId: %s', id)
				try {
					await this.leaveChat([chatId])
					logger.info('Leave success, groupId: %s', id)
				} catch ({ message }) {
					logger.info('Leave error, groupId: %s', id)
					logger.error(message)
				}
				group.deleteRequest({ admin: true })
				await group.save()
			}
			await db.transaction(async (session) => {
				const groupDocs = await GroupModel.getStopRequested(session)
				for (let i = 0; i < groupDocs.length; i++) {
					const group = groupDocs[i]
					const { id } = group
					logger.info('Processing stop request, groupId: %s', id)
					const reposts = await group.getCanUndoReposts(session)
					for (let j = 0; j < reposts.length; j++) {
						const repost = reposts[j]
						repost.undoRequest({ admin: true }, lang('reasonCanceledByUser'), 'Group stopped')
						await repost.save({ session })
					}
					group.stop({ admin: true })
					await group.save({ session })
				}
			})
			await db.transaction(async (session) => {
				toInformOwner.length = 0
				const groupDocs = await GroupModel.getDeleteRequested(session)
				for (let i = 0; i < groupDocs.length; i++) {
					const group = groupDocs[i]
					const { id } = group
					logger.info('Processing delete request, groupId: %s', id)
					group.delete({ admin: true })
					await group.deleteDeferred(session)
					await group.remove({ session })
					toInformOwner.push(group)
				}
			})
			toInformOwner.forEach((group) => this.informOwner(group))
			break
		case 'posts':
			let postDocs = await PostModel.getPostRequested()
			for (let i = 0; i < postDocs.length; i++) {
				const doc = postDocs[i]
				const { message } = doc
				let messages
				try {
					messages = await this.sendPost(message, TG_CHANNEL_ID, adsMarkup(doc, TG_BOT_LINK))
				} catch (e) {
					await db.transaction(async (session) => {
						doc.errorPost({ admin: true })
						await doc.compensateOwner(session)
						await doc.save({ session })
					})
					this.informOwner(doc)
					continue
				}
				doc.messages = messages
				doc.chatId = TG_CHANNEL_ID
				doc.postedDate = moment().toDate()
				doc.activate({ admin: true })
				await doc.save()
				this.informOwner(doc)
			}
			postDocs = await PostModel.getRemoveRequested()
			for (let i = 0; i < postDocs.length; i++) {
				const doc = postDocs[i]
				const { id, chatId, messages } = doc
				logger.info('Processing remove request, postId: %s', id)
				try {
					for (let i = 0; i < messages.length; i++) {
						const message_id = messages[i]
						const success = await this.deleteMessage([chatId, message_id])
						logger.info('Remove messageId: %s, success: %s', message_id, success)
					}
				} catch ({ message }) {
					logger.error(message)
				}
				doc.deleteRequest({ admin: true })
				await doc.save()
			}
			await db.transaction(async (session) => {
				toInformOwner.length = 0
				const postDocs = await PostModel.getStopRequested(session)
				for (let i = 0; i < postDocs.length; i++) {
					const post = postDocs[i]
					const { id } = post
					logger.info('Processing stop request, postId: %s', id)
					const reposts = await post.getCanUndoReposts(session)
					for (let j = 0; j < reposts.length; j++) {
						const repost = reposts[j]
						repost.undoRequest({ admin: true }, lang('reasonCanceledByOwner'), 'Post stopped')
						await repost.save({ session })
					}
					post.stop({ admin: true })
					await post.save({ session })
				}
			})
			await db.transaction(async (session) => {
				toInformOwner.length = 0
				const postDocs = await PostModel.getDeleteRequested(session)
				for (let i = 0; i < postDocs.length; i++) {
					const post = postDocs[i]
					const { id } = post
					logger.info('Processing delete request, postId: %s', id)
					post.delete({ admin: true })
					await post.remove({ session })
					toInformOwner.push(post)
				}
			})
			toInformOwner.forEach((post) => this.informOwner(post))
			break
		case 'deferred':
			toRemove.length = 0
			await db.transaction(async (session) => {
				toInformOwner.length = 0
				const deferredDocs = await DeferredModel.getReadyForPost(session)
				for (let i = 0; i < deferredDocs.length; i++) {
					const post = deferredDocs[i]
					const { id, date } = post
					const dateNow = moment()
					if (moment(date).isSameOrBefore(dateNow)) {
						logger.info('Processing ready for post, deferredId: %s', id)
						post.setPubInProgress({ admin: true })
						await post.save({ session })
					}
				}
			})
			let deferredDocs = await DeferredModel.getReadyForPubNow()
			for (let i = 0; i < deferredDocs.length; i++) {
				const doc = deferredDocs[i]
				const { id, message, chatId, needToPin, silent, isGroup } = doc
				logger.info('Processing ready to pub now, deferredId: %s', id)
				const groupDoc = await doc.getGroup()
				if (!groupDoc) {
					doc.stopRequest({ admin: true }, lang('reasonGroupRemoved'))
					await doc.save()
					continue
				} else {
					const { isActive } = groupDoc
					if (!isActive) {
						doc.stopRequest({ admin: true }, lang('reasonGroupStopped'))
						await doc.save()
						continue
					}
				}
				let messages
				try {
					messages = await this.sendPost(message, chatId, { disable_notification: silent })
					doc.messages = messages
					if (needToPin) {
						let [message_id] = messages
						if (isGroup) {
							const { items } = message
							const index = items.indexOf(items.find(({ caption }) => !!caption))
							if (index !== -1) {
								message_id = messages[index].message_id || message_id
							}
						}
						await this.messagePoolPush({
							ctx: this.bot.telegram,
							command: 'pinChatMessage',
							args: [chatId, message_id, { disable_notification: true }],
							needResult: true
						})
					}
				} catch ({ message }) {
					logger.error(message)
					doc.stopRequest({ admin: true }, lang('reasonPublicationError'), message)
					await doc.save()
					continue
				}
				doc.postedDate = moment().toDate()
				doc.setPublished({ admin: true })
				await doc.save()
				this.informUser(doc)
			}
			await db.transaction(async (session) => {
				toInformOwner.length = 0
				const deferredDocs = await DeferredModel.getPublished(session)
				for (let i = 0; i < deferredDocs.length; i++) {
					const post = deferredDocs[i]
					const { id, postedDate, lifeTime, lifeTimeUnit } = post
					const _postedDate = moment(postedDate).subtract(2, 'minutes')
					if (lifeTime && moment().diff(_postedDate, lifeTimeUnit, true) >= lifeTime) {
						logger.info('Processing end of lifetime, deferredId: %s', id)
						post.stopRequest({ admin: true }, lang('reasonEndPostLifetime'))
						await post.save({ session })
					}
				}
			})
			deferredDocs = await DeferredModel.getModifyRequested()
			for (let i = 0; i < deferredDocs.length; i++) {
				const post = deferredDocs[i]
				const { id, message, chatId, messages } = post
				logger.info('Processing modify request, deferredId: %s', id)
				const [message_id] = messages
				try {
					await this.editPostMessageMarkupMsg(message, chatId, message_id)
				} catch ({ message }) {
					logger.error(message)
				} finally {
					post.modifyRequest = false
					await post.save()
				}
			}
			await db.transaction(async (session) => {
				toInformUser.length = 0
				const deferredDocs = await DeferredModel.getStopRequested(session)
				for (let i = 0; i < deferredDocs.length; i++) {
					const post = deferredDocs[i]
					const { id } = post
					logger.info('Processing stop request, deferredId: %s', id)
					post.stop({ admin: true })
					await post.save({ session })
					toRemove.push(post)
					toInformUser.push(post)
				}
			})
			toInformUser.forEach((post) => this.informUser(post))
			for (let i = 0; i < toRemove.length; i++) {
				const { chatId, messages } = toRemove[i]
				if (chatId && messages && messages.length) {
					for (let k = 0; k < messages.length; k++) {
						const message_id = messages[k]
						logger.info('Removing deferred chatId: %s, message_id: %s', chatId, message_id)
						try {
							await this.deleteMessage([chatId, message_id])
						} catch ({ message }) {
							logger.error(message)
						}
					}
				}
			}
			break
		case 'reposts':
			toRemove.length = 0
			await db.transaction(async (session) => {
				toInformOwner.length = 0
				toInformUser.length = 0
				const repostDocs = await RepostModel.getApprovedByUser(session)
				for (let i = 0; i < repostDocs.length; i++) {
					const repost = repostDocs[i]
					const { id, isWhiteListed } = repost
					logger.info('Processing approved by user repost, repostId: %s', id)
					let approved = false
					if (isWhiteListed) {
						logger.info('Is whitelisted, try approve, repostId: %s', id)
						try {
							await this.tryApproveRepost({ admin: true }, repost, session)
							approved = true
							logger.info('Whitelisted repost approved, repostId: %s', id)
						} catch ({ message }) {
							logger.error(message)
						}
					}
					if (!approved) {
						repost.setOwnerSent({ admin: true })
						await repost.save({ session })
						toInformOwner.push(repost)
					}
				}
			})
			toInformOwner.forEach((repost) => this.informOwner(repost))
			await db.transaction(async (session) => {
				toInformOwner.length = 0
				toInformUser.length = 0
				const repostDocs = await RepostModel.getSentToOwner(session)
				for (let i = 0; i < repostDocs.length; i++) {
					const repost = repostDocs[i]
					const { id, ownerSentDate } = repost
					if (moment().diff(moment(ownerSentDate), REQUEST_LIFETIME_UNIT) >= REQUEST_LIFETIME) {
						logger.info('Processing sent to owner repost, repostId: %s', id)
						repost.undoRequest({ admin: true }, lang('reasonOwnerOverdue'), 'Confirm request overdue')
						await repost.save({ session })
					}
				}
			})
			await db.transaction(async (session) => {
				toInformOwner.length = 0
				toInformUser.length = 0
				const repostDocs = await RepostModel.getRejectedByOwner(session)
				for (let i = 0; i < repostDocs.length; i++) {
					const repost = repostDocs[i]
					const { id } = repost
					logger.info('Processing rejected by owner repost, repostId: %s', id)
					repost.undoRequest({ admin: true }, lang('reasonOwnerReject'), 'Rejected by owner')
					await repost.save({ session })
				}
			})
			await db.transaction(async (session) => {
				toInformOwner.length = 0
				toInformUser.length = 0
				const repostDocs = await RepostModel.getApprovedByOwner(session)
				for (let i = 0; i < repostDocs.length; i++) {
					const repost = repostDocs[i]
					const { id } = repost
					logger.info('Processing approved by owner repost, repostId: %s', id)
					repost.setUserSent({ admin: true })
					await repost.save({ session })
					toInformUser.push(repost)
				}
			})
			toInformUser.forEach((repost) => this.informUser(repost))
			await db.transaction(async (session) => {
				toInformOwner.length = 0
				toInformUser.length = 0
				const repostDocs = await RepostModel.getSentToUser(session)
				for (let i = 0; i < repostDocs.length; i++) {
					const repost = repostDocs[i]
					const { id, userSentDate } = repost
					if (moment().diff(moment(userSentDate), REQUEST_LIFETIME_UNIT) >= REQUEST_LIFETIME) {
						logger.info('Processing sent to user repost, repostId: %s', id)
						repost.undoRequest({ admin: true }, lang('reasonUserOverdue'), 'Date request overdue')
						await repost.save({ session })
					}
				}
			})
			await db.transaction(async (session) => {
				toInformOwner.length = 0
				toInformUser.length = 0
				const repostDocs = await RepostModel.getDateSet(session)
				for (let i = 0; i < repostDocs.length; i++) {
					const repost = repostDocs[i]
					const { id } = repost
					logger.info('Processing date is set repost, repostId: %s', id)
					repost.setReadyForPub({ admin: true })
					await repost.save({ session })
					toInformOwner.push(repost)
				}
			})
			toInformOwner.forEach((repost) => {
				const { date } = repost
				if (moment(date).diff(moment(), 'minutes') >= 1) {
					this.informOwner(repost)
				}
			})
			await db.transaction(async (session) => {
				toInformOwner.length = 0
				toInformUser.length = 0
				const repostDocs = await RepostModel.getReadyForPub(session)
				for (let i = 0; i < repostDocs.length; i++) {
					const repost = repostDocs[i]
					const { id, date } = repost
					const dateNow = moment()
					if (moment(date).isSameOrBefore(dateNow)) {
						logger.info('Processing ready for pub repost, repostId: %s', id)
						repost.setPubInProgress({ admin: true })
						await repost.save({ session })
					}
				}
			})
			let repostDocs = await RepostModel.getReadyForPubNow()
			for (let i = 0; i < repostDocs.length; i++) {
				const repost = repostDocs[i]
				const { message: post, chatId, needToPin } = repost
				let messages
				try {
					messages = await this.sendPost(post, chatId)
					repost.messages = messages
					const [message_id] = messages
					needToPin && await this.messagePoolPush({
						ctx: this.bot.telegram,
						command: 'pinChatMessage',
						args: [chatId, message_id, { disable_notification: true }],
						needResult: true
					})
				} catch ({ message }) {
					logger.error(message)
					repost.undoRequest({ admin: true }, lang('reasonCantRepost'), message)
					await repost.save()
					continue
				}
				repost.postedDate = new Date()
				repost.setPublished({ admin: true })
				await repost.save()
				this.informUser(repost)
				this.informOwner(repost)
			}
			const violated = []
			const valid = []
			repostDocs = await RepostModel.getPublished()
			for (let i = 0; i < repostDocs.length; i++) {
				const repost = repostDocs[i]
				const { id: repostId, chatId, messages, needToPin } = repost
				try {
					const { messages: msgs, chats } = await this.getMessageInfoClient({ chatId, messages })
					const [message] = msgs
					const { pinned, views, editDate, editHide, className } = message
					const [chat] = chats
					const error = this.validateGroupInfoClient(chat)
					if (className !== 'Message') {
						violated.push({ repost, reason: lang('reasonViolationRepost', 1), service: 'Post deleted' })
					} else if (needToPin && !pinned) {
						violated.push({ repost, reason: lang('reasonViolationRepost', 2), service: 'Post unpinned' })
					} else if (editDate && !editHide) {
						violated.push({ repost, reason: lang('reasonViolationRepost', 3), service: 'Post edited' })
					} else if (error) {
						violated.push({ repost, reason: lang('reasonViolationRepost', 4), service: error })
					} else {
						valid.push({ repost, views })
					}
				} catch (e) {
					const { code, message } = e
					logger.info('Violation check error request, repostId: %s', repostId)
					logger.error('code: %s, message: %s', code, message)
					if (e instanceof RPCError) {
						const { code } = e
						if (code >= 400 && code < 500) {
							violated.push({ repost, reason: lang('reasonViolationRepost', 5), service: message })
						}
					}
				}
			}
			await db.transaction(async (session) => {
				toInformOwner.length = 0
				toInformUser.length = 0
				const repostDocs = await RepostModel.getPublished(session)
				for (let i = 0; i < repostDocs.length; i++) {
					const repost = repostDocs[i]
					const { id, postedDate } = repost
					let v = violated.find(({ repost: { id: _id } }) => id === _id)
					if (v) {
						const { reason, service } = v
						repost.undoRequest({ admin: true }, reason, service)
						await repost.save({ session })
						continue
					}
					v = valid.find(({ repost: { id: _id } }) => id === _id)
					if (v) {
						const { views } = v
						repost.views = views
						if (moment().diff(moment(postedDate), POST_LIFETIME_UNIT) >= POST_LIFETIME) {
							repost.doneRequest({ admin: true })
						}
						await repost.save({ session })
					}
				}
			})
			await db.transaction(async (session) => {
				toInformOwner.length = 0
				toInformUser.length = 0
				const repostDocs = await RepostModel.getUndoRequested(session)
				for (let i = 0; i < repostDocs.length; i++) {
					const repost = repostDocs[i]
					const { id, paid } = repost
					logger.info('Processing undo request, repostId: %s', id)
					repost.undo({ admin: true })
					if (paid) {
						await repost.compensateOwner(session)
					}
					await repost.save({ session })
					toRemove.push(repost)
					toInformOwner.push(repost)
					toInformUser.push(repost)
				}
			})
			toInformOwner.forEach((repost) => this.informOwner(repost))
			toInformUser.forEach((repost) => this.informUser(repost))
			await db.transaction(async (session) => {
				toInformOwner.length = 0
				toInformUser.length = 0
				const repostDocs = await RepostModel.getDoneRequested(session)
				for (let i = 0; i < repostDocs.length; i++) {
					const repost = repostDocs[i]
					const { id: repostId, adminProfit } = repost
					logger.info('Processing done request, repostId: %s', repostId)
					repost.done({ admin: true })
					await repost.grantUser(session)
					const admin = await this.getBankAdmin(session)
					await admin.modifyBalance(adminProfit, MF_PROFIT, { repostId }, false, session)
					await repost.save({ session })
					toInformOwner.push(repost)
					toInformUser.push(repost)
					toRemove.push(repost)
				}
			})
			toInformOwner.forEach((repost) => this.informOwner(repost))
			toInformUser.forEach((repost) => this.informUser(repost))
			for (let i = 0; i < toRemove.length; i++) {
				const { chatId, messages } = toRemove[i]
				if (chatId && messages && messages.length) {
					for (let k = 0; k < messages.length; k++) {
						const message_id = messages[k]
						logger.info('Removing repost chatId: %s, message_id: %s', chatId, message_id)
						try {
							await this.deleteMessage([chatId, message_id])
						} catch ({ message }) {
							logger.error(message)
						}
					}
				}
			}
			break
		}
	},

	async informUser(doc) {
		const { notifyUserId } = doc
		const { text, markup } = await doc.informUserMessageText()
		text && this.sendMessage([notifyUserId, text, { parse_mode: 'Markdown', ...markup }])
	},

	async informOwner(doc) {
		const { notifyOwnerId } = doc
		const { text, markup } = await doc.informOwnerMessageText()
		text && this.sendMessage([notifyOwnerId, text, { parse_mode: 'Markdown', ...markup }])
	}
}
