const mongoose = require('mongoose')
const { DefaultSchema, deferredSettings } = require('./schemas')
const { statuses } = require('../../const')
const { lang } = require('../../utils')
const { okMarkup } = require('../../markups')
const { SafeError } = require('../../errors')
const crypto = require('crypto')
const moment = require('moment-timezone')
const { isEqual } = require('lodash')

const deferredSchema = new DefaultSchema(
	{
		userId: {
			type: Number,
			required: true
		},
		groupId: {
			type: String,
			required: true
		},
		status: {
			type: Number,
			default: statuses.DEFERRED_STATUS_0
		},
		stopComment: {
			type: String,
			default: ''
		},
		serviceComment: {
			type: String,
			default: ''
		},
		message: {
			type: JSON,
			required: true
		},
		settings: {
			type: deferredSettings,
			default: () => ({})
		},
		postedDate: {
			type: Date,
			default: null
		},
		messages: {
			type: Array,
			default: []
		},
		chatId: {
			type: String,
			required: true
		},
		modifyRequest: {
			type: Boolean,
			default: false
		}
	},
	{
		timestamps: true
	}
)

deferredSchema.methods.modify = function (from, { message: newMessage, settings: newSettings }) {
	this.checkFrom(from)
	const { settings } = this

	if ((this.isPosting() || this.isPosted() || this.isStopping() || this.isStopped()) && ((this.isPinModified(newSettings) || this.isSilentModified(newSettings) || this.isDateModified(newSettings) ||
		this.isUrlsModified(newMessage) || this.isCaptionModified(newMessage) || this.isTextModified(newMessage) ||
		this.isGroupModified(newMessage) || this.isTypeModified(newMessage) || this.isFileModified(newMessage)))) {
		throw new SafeError(lang('errorWrongChangesStatus', this.statusText()))
	} else if (!this.isConfigurable() && (this.isButtonsModified(newMessage) || this.isLifetimeModified(newSettings))) {
		throw new SafeError(lang('errorWrongChangesStatus', this.statusText()))
	}

	if ((this.isPosting() || this.isPosted()) && this.isButtonsModified(newMessage)) {
		this.modifyRequest = true
	}

	this.message = newMessage
	delete this.message.md5
	Object.assign(settings, newSettings)
}

deferredSchema.pre('save', function () {
	const { message } = this
	if (!message.md5) {
		const text = JSON.stringify(message)
		message.md5 = crypto.createHash('md5').update(text).digest('hex');
	}
})

deferredSchema.virtual('date').get(function() {
	return this.settings.date
})

deferredSchema.virtual('needToPin').get(function() {
	return this.settings.pin
})

deferredSchema.virtual('lifeTime').get(function() {
	return this.settings.lifeTime
})

deferredSchema.virtual('silent').get(function() {
	return this.settings.silent
})

deferredSchema.virtual('lifeTimeUnit').get(function() {
	return this.settings.lifeTimeUnit
})

deferredSchema.virtual('hasUrls').get(function() {
	let { message: { entities } } = this
	entities = entities || []
	return entities.find(({ type }) => type === 'url' || type === 'text_link')
})

deferredSchema.virtual('isOverdue').get(function() {
	const { postedDate } = this
	return postedDate && moment().diff(postedDate, 'hours') > 47
})

deferredSchema.virtual('isGroup').get(function() {
	const { message: { isGroup } } = this
	return isGroup
})

deferredSchema.virtual('notifyUserId').get(function() {
	return this.userId
})

deferredSchema.virtual('postMessageId').get(function() {
	const [id] = this.messages
	return id
})

deferredSchema.methods.postTitleLink = function (title) {
	const { chatId, postMessageId } = this
	return `[${title}](https://t.me/c/${/-100(.*)/.exec(chatId)[1]}/${postMessageId})`
}

deferredSchema.methods.statusText = function () {
	const { status } = this
	if (statuses.DEFERRED_KNOWN_STATUSES.indexOf(status) > -1) {
		return lang(`DEFERRED_STATUS_${status}`)
	}
	return lang('STATUS_UNKNOWN', status)
}

deferredSchema.methods.isWaiting = function () {
	const { status } = this
	return status === statuses.DEFERRED_STATUS_0
}

deferredSchema.methods.isPosting = function () {
	const { status } = this
	return status === statuses.DEFERRED_STATUS_10
}

deferredSchema.methods.isPosted = function () {
	const { status } = this
	return status === statuses.DEFERRED_STATUS_20
}

deferredSchema.methods.isStopping = function () {
	const { status } = this
	return status === statuses.DEFERRED_STATUS_30
}
deferredSchema.methods.isStopped = function () {
	const { status } = this
	return status === statuses.DEFERRED_STATUS_40
}

deferredSchema.methods.isConfigurable = function () {
	const { isOverdue } = this
	return !isOverdue && (this.isWaiting() || this.isPosting() || this.isPosted())
}

deferredSchema.methods.isDraft = function () {
	const { date } = this
	return !date
}

deferredSchema.methods.isUser = function (from) {
	const { userId } = this
	const { id } = from
	return id === userId
}

deferredSchema.methods.toInfo = function (from, isDraft = false) {
	const { id, stopComment } = this
	const arr = []
	arr.push(lang('postId', id))
	if (isDraft || this.isDraft()) {
		arr.push(lang('draft'))
	} else {
		arr.push(lang('status', this.statusText()))
		if (stopComment) {
			arr.push(lang('reasonForStop', stopComment))
		}
	}
	return arr.join('\n')
}

deferredSchema.methods.toSettingsInfo = function (mode = 0) {
	const { settings } = this
	return settings.toInfo(mode)
}

deferredSchema.methods.informUserMessageText = function () {
	const { status } = this
	switch (status) {
	case statuses.DEFERRED_STATUS_40: // остановлен
		return {
			text: this.toInfo(),
			markup: okMarkup()
		}
	}
	return {}
}

deferredSchema.methods.checkFrom = function(from, safe = true) {
	const { userId } = this
	const { admin, id } = from
	if (!admin && userId !== id) {
		if (safe) {
			throw new SafeError(lang('errorOnlyUser'))
		} else {
			return false
		}
	}
	return true
}

deferredSchema.methods.checkStatus = function (from, newStatus, safe = true) {
	if (!this.checkFrom(from, safe)) {
		return false
	}
	const { status } = this
	let wrongStatus = true
	switch (newStatus) {
	case statuses.DEFERRED_STATUS_10:
		wrongStatus = [statuses.DEFERRED_STATUS_0].indexOf(status) === -1
		break
	case statuses.DEFERRED_STATUS_20:
		wrongStatus = [statuses.DEFERRED_STATUS_10].indexOf(status) === -1
		break
	case statuses.DEFERRED_STATUS_30:
		wrongStatus = [statuses.DEFERRED_STATUS_10, statuses.DEFERRED_STATUS_20].indexOf(status) === -1
		break
	case statuses.DEFERRED_STATUS_40:
		wrongStatus = status !== statuses.DEFERRED_STATUS_30
		break
	case statuses.DEFERRED_STATUS_50:
		wrongStatus = [statuses.DEFERRED_STATUS_0, statuses.DEFERRED_STATUS_40].indexOf(status) === -1
		break
	}
	if (wrongStatus) {
		if (safe) {
			throw new SafeError(lang('errorWrongStatus', this.statusText()))
		} else {
			return false
		}
	}
	return true
}

deferredSchema.methods.getGroup = function (session) {
	const { groupId } = this
	return this.model('Group').findOne({ id: groupId }).session(session)
}

deferredSchema.methods.isBeenModified = function (message, settings) {
	return this.isButtonsModified(message) || this.isPinModified(settings) || this.isSilentModified(settings) || this.isDateModified(settings) ||
		this.isLifetimeModified(settings) || this.isUrlsModified(message) || this.isCaptionModified(message) ||
		this.isTextModified(message) || this.isGroupModified(message) || this.isTypeModified(message) ||
		this.isFileModified(message)
}

deferredSchema.methods.isButtonsModified = function (message) {
	let { message: { buttons } } = this
	buttons = buttons || []
	return !isEqual(buttons, (message.buttons || []))
}

deferredSchema.methods.isPinModified = function (settings) {
	const { settings: { pin } } = this
	return pin !== settings.pin
}

deferredSchema.methods.isSilentModified = function (settings) {
	const { settings: { silent } } = this
	return silent !== settings.silent
}

deferredSchema.methods.isDateModified = function (settings) {
	const { settings: { date } } = this
	return (date && !moment(date).isSame(settings.date) || (!date && settings.date))
}

deferredSchema.methods.isLifetimeModified = function (settings) {
	const { settings: { lifeTime } } = this
	return lifeTime !== settings.lifeTime
}

deferredSchema.methods.isUrlsModified = function (message) {
	const { message: { disable_web_page_preview = false } } = this
	return disable_web_page_preview !== (message.disable_web_page_preview || false)
}

deferredSchema.methods.isCaptionModified = function (message) {
	let { message: { caption, caption_entities } } = this
	caption = caption || ''
	caption_entities = caption_entities || []
	return caption !== (message.caption || '') || !isEqual(caption_entities, (message.caption_entities || []))
}

deferredSchema.methods.isTextModified = function (message) {
	let { message: { text, entities } } = this
	text = text || ''
	entities = entities || []
	return text !== (message.text || '') || !isEqual(entities, (message.entities || []))
}

deferredSchema.methods.isGroupModified = function (message) {
	let { message: { isGroup = false, items } } = this
	items = items || []
	return isGroup !== message.isGroup || !isEqual(items, (message.items || []))
}

deferredSchema.methods.isTypeModified = function (message) {
	const { message: { type } } = this
	return type !== message.type
}

deferredSchema.methods.isFileModified = function (message) {
	const { message: { file_id } } = this
	return file_id !== message.file_id
}

deferredSchema.methods.canDelete = function (from) {
	return this.checkFrom(from, false) && (this.isDraft() || this.isWaiting() || this.isStopped())
}

deferredSchema.methods.canStop = function (from) {
	return this.checkFrom(from, false) && this.isPosted()
}

deferredSchema.methods.canSetLifetime = function (from) {
	return this.checkFrom(from, false) && this.isConfigurable()
}

deferredSchema.methods.canSetNeedPin = function (from) {
	return this.checkFrom(from, false) && this.isWaiting()
}

deferredSchema.methods.canSetSilent = function (from) {
	return this.checkFrom(from, false) && this.isWaiting()
}

deferredSchema.methods.canChangeDate = function (from) {
	return this.checkFrom(from, false) && this.isWaiting()
}

deferredSchema.methods.canPostNow = function (from) {
	const { date } = this
	return this.checkFrom(from, false) && !date
}

deferredSchema.methods.canChangeButtons = function (from) {
	const { isGroup } = this
	return this.checkFrom(from, false) && !isGroup && this.isConfigurable()
}

deferredSchema.methods.canHideUrls = function (from) {
	const { hasUrls } = this
	return this.checkFrom(from, false) && hasUrls && this.isWaiting()
}

deferredSchema.methods.stopRequest = function (from, reason, serviceComment = '') {
	this.checkStatus(from, statuses.DEFERRED_STATUS_30)
	this.status = statuses.DEFERRED_STATUS_30
	this.stopComment = reason || lang('reasonCanceledByUser')
	this.serviceComment = serviceComment
}

deferredSchema.methods.stop = function (from) {
	this.checkStatus(from, statuses.DEFERRED_STATUS_40)
	this.status = statuses.DEFERRED_STATUS_40
}

deferredSchema.methods.delete = function (from) {
	this.checkStatus(from, statuses.DEFERRED_STATUS_50)
	this.status = statuses.DEFERRED_STATUS_50
}

deferredSchema.methods.setPubInProgress = function (from) {
	this.checkStatus(from, statuses.DEFERRED_STATUS_10)
	this.status = statuses.DEFERRED_STATUS_10
}

deferredSchema.methods.setPublished = function (from) {
	this.checkStatus(from, statuses.REPOST_STATUS_20)
	this.status = statuses.REPOST_STATUS_20
}

deferredSchema.statics.getReadyForPost = function (session) {
	return this.find({ status: statuses.DEFERRED_STATUS_0, 'settings.date': { $ne: null } }).session(session)
}

deferredSchema.statics.getReadyForPubNow = function (session) {
	return this.find({ status: statuses.DEFERRED_STATUS_10 }).session(session)
}

deferredSchema.statics.getPublished = function (session) {
	return this.find({ status: statuses.DEFERRED_STATUS_20 }).session(session)
}

deferredSchema.statics.getModifyRequested = function (session) {
	return this.find({ status: statuses.DEFERRED_STATUS_20, modifyRequest: true }).session(session)
}

deferredSchema.statics.getStopRequested = function (session) {
	return this.find({ status: statuses.DEFERRED_STATUS_30 }).session(session)
}

module.exports = mongoose.model('Deferred', deferredSchema)
