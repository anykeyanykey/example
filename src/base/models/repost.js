const moment = require('moment-timezone')
const mongoose = require('mongoose')
const { DefaultSchema } = require('./schemas')
const { lang, currency: { RUB } } = require('../../utils')
const { REQUEST_LIFETIME, REQUEST_LIFETIME_UNIT, POST_LIFETIME_UNIT, POST_LIFETIME, statuses, flow: { MF_PROFIT, MF_UNFREEZE } } = require('../../const')
const { groupInfo, postInfo } = require('./schemas')
const { SafeError } = require('./../../errors')
const { configMarkup } = require('./../../markups')

const canUndoByOwnerStatuses = Object.freeze([
	statuses.REPOST_STATUS_0, statuses.REPOST_STATUS_10,
	statuses.REPOST_STATUS_20, statuses.REPOST_STATUS_30,
	statuses.REPOST_STATUS_40, statuses.REPOST_STATUS_50,
	statuses.REPOST_STATUS_60, statuses.REPOST_STATUS_70
])

const canUndoByUserStatuses = Object.freeze([
	...canUndoByOwnerStatuses,
	statuses.REPOST_STATUS_90
])

const canUndoByAdminStatuses = Object.freeze([
	...canUndoByUserStatuses,
	statuses.REPOST_STATUS_80
])

const repostSchema = new DefaultSchema(
	{
		userId: {
			type: Number,
			required: true
		},
		ownerId: {
			type: Number,
			required: true
		},
		postId: {
			type: String,
			required: true
		},
		groupId: {
			type: String,
			required: true
		},
		postInfo: {
			type: postInfo,
			required: true
		},
		groupInfo: {
			type: groupInfo,
			required: true
		},
		cost: {
			type: Number,
			required: true,
			validate: {
				validator(v) {
					return typeof v === 'number' && isFinite(v) && v > 0;
				},
				message: props => `Repost cost is not a valid number: ${props.value}`
			},
			get(bet) {
				return RUB(bet)
			}
		},
		ownerCost: {
			type: Number,
			required: true,
			get(bet) {
				return RUB(bet)
			}
		},
		paid: {
			type: Boolean,
			default: false
		},
		prevStatus: {
			type: Number,
			default: 0
		},
		status: {
			type: Number,
			default: 0,
			set(value) {
				if (value !== statuses.REPOST_STATUS_130) {
					this.prevStatus = this.status
				}
				return value
			}
		},
		undoById: {
			type: Number,
			default: null
		},
		postedDate: {
			type: Date,
			default: null
		},
		ownerSentDate: {
			type: Date,
			default: null
		},
		userSentDate: {
			type: Date,
			default: null
		},
		undoComment: {
			type: String,
			default: ''
		},
		serviceComment: {
			type: String,
			default: ''
		},
		messages: {
			type: Array,
			default: []
		},
		views: {
			type: Number,
			default: 0
		},
		date: {
			type: Date,
			default: null,
			set(value) {
				this.prevDate = this.date
				return value
			}
		},
		prevDate: {
			type: Date,
			default: null
		}
	},
	{
		timestamps: true
	}
)

repostSchema.pre(['findOne', 'find'], function(next) {
	this.populate('ownerSettings')
	next();
})

repostSchema.virtual('ownerSettings', {
	ref: 'Settings',
	localField: 'ownerId',
	foreignField: 'userId',
	options: {
		populate: ['whiteList', 'blackList']
	},
	justOne: true
})

repostSchema.virtual('isWhiteListed').get(function() {
	const { ownerSettings, groupId } = this
	return ownerSettings && ownerSettings.whiteList.find(({ id }) => id === groupId)
})

repostSchema.virtual('isBlackListed').get(function() {
	const { ownerSettings, groupId } = this
	return ownerSettings && ownerSettings.blackList.find(({ id }) => id === groupId)
})

repostSchema.virtual('message').get(function() {
	return this.postInfo.message
})

repostSchema.virtual('chatId').get(function() {
	return this.groupInfo.id
})

repostSchema.virtual('sourcePostChatId').get(function() {
	return this.postInfo.chatId
})

repostSchema.virtual('sourcePostMessageId').get(function() {
	const [id] = this.postInfo.messages
	return id
})

repostSchema.virtual('targetPostChatId').get(function() {
	return this.groupInfo.id
})

repostSchema.virtual('targetPostMessageId').get(function() {
	const { messages } = this
	const [message_id] = messages
	return message_id
})

repostSchema.virtual('adminProfit').get(function() {
	const { cost, ownerCost } = this
	return ownerCost.subtract(cost)
})

repostSchema.virtual('needToPin').get(function() {
	return this.postInfo.settings.pin
})

repostSchema.virtual('username').get(function() {
	return this.groupInfo.username
})

repostSchema.virtual('inviteLink').get(function() {
	return this.groupInfo.invite_link
})

repostSchema.virtual('title').get(function() {
	return this.groupInfo.title
})

repostSchema.virtual('notifyOwnerId').get(function() {
	return this.ownerId
})

repostSchema.virtual('notifyUserId').get(function() {
	return this.userId
})

repostSchema.virtual('isDateModified').get(function() {
	const { prevDate } = this
	return !!prevDate
})

repostSchema.methods.toInfo = function (from) {
	const { id, cost, ownerCost, paid, needToPin, undoComment, postedDate, date, views, isWhiteListed, isBlackListed } = this
	const { timezone } = from
	const isOwner = this.isOwner(from)
	const _cost = isOwner ? ownerCost : cost
	const arr = []
	arr.push(lang('repostId', id))
	arr.push(lang('channel', this.channelTitleLink()))
	if (isOwner) {
		if (isWhiteListed) {
			arr.push(`\`${lang('whiteListed')}\``)
		} else if (isBlackListed) {
			arr.push(`\`${lang('blackListed')}\``)
		}
	}
	arr.push(lang('pin', needToPin))
	if (this.isPostedAndAfter()) {
		arr.push(lang('views', views))
	}
	if (this.isPosted()) {
		arr.push(lang('repost', this.targetPostTitleLink('пост')))
		arr.push(lang('deleteDate', moment(postedDate).tz(timezone).add(POST_LIFETIME, POST_LIFETIME_UNIT).format('LLL'), timezone))
	} else if (this.isWaiting()) {
		arr.push(lang('postDate', moment(date).tz(timezone).format('LLL'), timezone))
	}
	arr.push(lang('reward', _cost.format()))
	if (this.isSuccess()) {
		arr.push(lang('paymentMade'))
	} else if (this.isCanceled()) {
		arr.push(lang('paymentNotMade'))
	} else if (paid) {
		arr.push(lang('fundsAreFrozen'))
	}
	arr.push(lang('status', this.statusText()))
	if (undoComment) {
		arr.push(lang('reasonForCancellation', undoComment))
	}
	return arr.join('\n')
}

repostSchema.methods.toInfoStat = function (from) {
	return this.toInfo(from)
}

repostSchema.methods.statusText = function () {
	const { status } = this
	if (statuses.REPOST_KNOWN_STATUSES.indexOf(status) > -1) {
		return lang(`REPOST_STATUS_${status}`)
	}
	return lang('STATUS_UNKNOWN', status)
}

repostSchema.methods.isPosted = function () {
	const { postedDate, status } = this
	return postedDate && [statuses.REPOST_STATUS_90].indexOf(status) !== -1
}

repostSchema.methods.isWaiting = function () {
	const { status } = this
	return [statuses.REPOST_STATUS_60, statuses.REPOST_STATUS_70, statuses.REPOST_STATUS_80].indexOf(status) !== -1
}

repostSchema.methods.isPostedAndAfter = function () {
	const { status } = this
	return [statuses.REPOST_STATUS_90, statuses.REPOST_STATUS_100, statuses.REPOST_STATUS_110,
		statuses.REPOST_STATUS_120, statuses.REPOST_STATUS_130].indexOf(status) !== -1
}

repostSchema.methods.isSuccess = function () {
	const { status } = this
	return status === statuses.REPOST_STATUS_110
}

repostSchema.methods.isCanceled = function () {
	const { status } = this
	return status === statuses.REPOST_STATUS_130
}

repostSchema.methods.isCancellation = function () {
	const { status } = this
	return [statuses.REPOST_STATUS_120, statuses.REPOST_STATUS_130].indexOf(status) !== -1
}

repostSchema.methods.isToBeAgreed = function () {
	const { status } = this
	return [statuses.REPOST_STATUS_10, statuses.REPOST_STATUS_20,
		statuses.REPOST_STATUS_30, statuses.REPOST_STATUS_40,
		statuses.REPOST_STATUS_50].indexOf(status) !== -1
}

repostSchema.methods.isUser = function (from) {
	const { userId } = this
	const { id } = from
	return id === userId
}

repostSchema.methods.isOwner = function (from) {
	const { ownerId } = this
	const { id } = from
	return id === ownerId
}

repostSchema.methods.isAdmin = function (from) {
	const { admin } = from
	return admin
}

repostSchema.methods.checkStatus = function (from, newStatus, safe = true) {
	const { status } = this
	let wrongStatus = true
	switch (newStatus) {
	case statuses.REPOST_STATUS_120:
		let arr = []
		if (this.isAdmin(from)) {
			arr = canUndoByAdminStatuses
		} else if (this.isUser(from)) {
			arr = canUndoByUserStatuses
		} else if (this.isOwner(from)) {
			arr = canUndoByOwnerStatuses
		}
		wrongStatus = arr.indexOf(status) === -1
		break
	case statuses.REPOST_STATUS_10:
		if (!this.isUser(from) && !this.isAdmin(from)) {
			if (!safe) {
				return false
			} else {
				throw new SafeError(lang('errorOnlyUser'))
			}
		}
		wrongStatus = status !== statuses.REPOST_STATUS_0
		break
	case statuses.REPOST_STATUS_20:
		if (!this.isAdmin(from, true, safe)) {
			if (!safe) {
				return false
			} else {
				throw new SafeError(lang('errorOnlyAdmin'))
			}
		}
		wrongStatus = status !== statuses.REPOST_STATUS_10
		break
	case statuses.REPOST_STATUS_30:
		if (!this.isOwner(from) && !this.isAdmin(from)) {
			if (!safe) {
				return false
			} else {
				throw new SafeError(lang('errorOnlyOwner'))
			}
		}
		wrongStatus = status !== statuses.REPOST_STATUS_20
		break
	case statuses.REPOST_STATUS_40:
		if (!this.isOwner(from) && !this.isAdmin(from)) {
			if (!safe) {
				return false
			} else {
				throw new SafeError(lang('errorOnlyOwner'))
			}
		}
		const valid = [statuses.REPOST_STATUS_20]
		this.isAdmin(from) && valid.push(statuses.REPOST_STATUS_10)
		wrongStatus = valid.indexOf(status) === -1
		break
	case statuses.REPOST_STATUS_50:
		if (!this.isAdmin(from)) {
			if (!safe) {
				return false
			} else {
				throw new SafeError(lang('errorOnlyAdmin'))
			}
		}
		wrongStatus = status !== statuses.REPOST_STATUS_40
		break
	case statuses.REPOST_STATUS_60:
		if (!this.isUser(from) && !this.isAdmin(from)) {
			if (!safe) {
				return false
			} else {
				throw new SafeError(lang('errorOnlyUser'))
			}
		}
		wrongStatus = [statuses.REPOST_STATUS_50, statuses.REPOST_STATUS_60, statuses.REPOST_STATUS_70].indexOf(status) === -1
		break
	case statuses.REPOST_STATUS_70:
		if (!this.isAdmin(from)) {
			if (!safe) {
				return false
			} else {
				throw new SafeError(lang('errorOnlyAdmin'))
			}
		}
		wrongStatus = status !== statuses.REPOST_STATUS_60
		break
	case statuses.REPOST_STATUS_80:
		if (!this.isAdmin(from)) {
			if (!safe) {
				return false
			} else {
				throw new SafeError(lang('errorOnlyAdmin'))
			}
		}
		wrongStatus = status !== statuses.REPOST_STATUS_70
		break
	case statuses.REPOST_STATUS_90:
		if (!this.isAdmin(from)) {
			if (!safe) {
				return false
			} else {
				throw new SafeError(lang('errorOnlyAdmin'))
			}
		}
		wrongStatus = status !== statuses.REPOST_STATUS_80
		break
	case statuses.REPOST_STATUS_100:
		if (!this.isAdmin(from)) {
			if (!safe) {
				return false
			} else {
				throw new SafeError(lang('errorOnlyAdmin'))
			}
		}
		wrongStatus = status !== statuses.REPOST_STATUS_90
		break
	case statuses.REPOST_STATUS_110:
		if (!this.isAdmin(from)) {
			if (!safe) {
				return false
			} else {
				throw new SafeError(lang('errorOnlyAdmin'))
			}
		}
		wrongStatus = status !== statuses.REPOST_STATUS_100
		break
	case statuses.REPOST_STATUS_130:
		if (!this.isAdmin(from)) {
			if (!safe) {
				return false
			} else {
				throw new SafeError(lang('errorOnlyAdmin'))
			}
		}
		wrongStatus = status !== statuses.REPOST_STATUS_120
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

repostSchema.methods.canSetDate = function (from) {
	return this.checkStatus(from, statuses.REPOST_STATUS_60, false)
}

repostSchema.methods.setDate = function (from, date) {
	this.checkStatus(from, statuses.REPOST_STATUS_60)
	this.status = statuses.REPOST_STATUS_60
	this.date = date
}

repostSchema.methods.canApproveByOwner = function (from) {
	return this.checkStatus(from, statuses.REPOST_STATUS_40, false)
}

repostSchema.methods.approveByOwner = function (from) {
	this.checkStatus(from, statuses.REPOST_STATUS_40)
	this.status = statuses.REPOST_STATUS_40
	this.paid = true
}

repostSchema.methods.canApproveByUser = function (from) {
	return this.checkStatus(from, statuses.REPOST_STATUS_10, false)
}

repostSchema.methods.approveByUser = function (from) {
	this.checkStatus(from, statuses.REPOST_STATUS_10)
	this.status = statuses.REPOST_STATUS_10
}

repostSchema.methods.setOwnerSent = function (from) {
	this.checkStatus(from, statuses.REPOST_STATUS_20)
	this.status = statuses.REPOST_STATUS_20
	this.ownerSentDate = new Date()
}

repostSchema.methods.setUserSent = function (from) {
	this.checkStatus(from, statuses.REPOST_STATUS_50)
	this.status = statuses.REPOST_STATUS_50
	this.userSentDate = new Date()
}

repostSchema.methods.setReadyForPub = function (from) {
	this.checkStatus(from, statuses.REPOST_STATUS_70)
	this.status = statuses.REPOST_STATUS_70
}

repostSchema.methods.setPubInProgress = function (from) {
	this.checkStatus(from, statuses.REPOST_STATUS_80)
	this.status = statuses.REPOST_STATUS_80
}

repostSchema.methods.setPublished = function (from) {
	this.checkStatus(from, statuses.REPOST_STATUS_90)
	this.status = statuses.REPOST_STATUS_90
}

repostSchema.methods.canRejectByOwner = function (from) {
	return this.checkStatus(from, statuses.REPOST_STATUS_30, false)
}

repostSchema.methods.rejectByOwner = function (from) {
	this.checkStatus(from, statuses.REPOST_STATUS_30)
	this.status = statuses.REPOST_STATUS_30
}

repostSchema.methods.canUndo = function (from) {
	return this.checkStatus(from, statuses.REPOST_STATUS_120, false)
}

repostSchema.methods.canWhiteList = function (from) {
	const { isWhiteListed } = this
	return !isWhiteListed && this.isOwner(from) && this.isSuccess()
}

repostSchema.methods.canBlackList = function (from) {
	const { isBlackListed } = this
	return !isBlackListed && this.isOwner(from) && this.isCanceled()
}

repostSchema.methods.doneRequest = function (from) {
	this.checkStatus(from, statuses.REPOST_STATUS_100)
	this.status = statuses.REPOST_STATUS_100
}

repostSchema.methods.undoRequest = function (from, comment, serviceComment) {
	this.checkStatus(from, statuses.REPOST_STATUS_120)
	this.date = null
	this.status = statuses.REPOST_STATUS_120
	this.undoComment = comment || (this.isOwner(from) ? lang('reasonCanceledByOwner') : this.isAdmin(from) ? lang('reasonCanceledByAdmin') : lang('reasonCanceledByUser'))
	this.serviceComment = serviceComment || 'Manual'
	if (this.isOwner(from) || this.isUser(from)) {
		this.undoById = from.id
	}
}

repostSchema.methods.undo = function (from) {
	this.checkStatus(from, statuses.REPOST_STATUS_130)
	this.status = statuses.REPOST_STATUS_130
}

repostSchema.methods.done = function (from) {
	this.checkStatus(from, statuses.REPOST_STATUS_110)
	this.status = statuses.REPOST_STATUS_110
}

repostSchema.methods.channelLink = function () {
	const { username, inviteLink } = this
	return username ? `https://t.me/${username}` : inviteLink
}

repostSchema.methods.channelTitleLink = function () {
	const { title } = this
	return `[${title}](${this.channelLink()})`
}

repostSchema.methods.sourcePostTitleLink = function (title) {
	const { sourcePostChatId, sourcePostMessageId } = this
	return `[${title}](https://t.me/c/${/-100(.*)/.exec(sourcePostChatId)[1]}/${sourcePostMessageId})`
}

repostSchema.methods.targetPostTitleLink = function (title) {
	const { targetPostChatId, targetPostMessageId } = this
	return `[${title}](https://t.me/c/${/-100(.*)/.exec(targetPostChatId)[1]}/${targetPostMessageId})`
}

repostSchema.methods.channelLink = function () {
	const { groupInfo: { username, invite_link } } = this
	return username ? `https://t.me/${username}` : invite_link
}

repostSchema.methods.channelTitleLink = function () {
	const { title } = this
	return `[${title}](${this.channelLink()})`
}

repostSchema.methods.informUserMessageText = async function () {
	const { id, userId, status, cost, needToPin, paid, postedDate, undoById } = this
	const { settings: { timezone } } = await this.getUser()
	const arr = []
	switch (status) {
	case statuses.REPOST_STATUS_0:
		break
	case statuses.REPOST_STATUS_10:
		break
	case statuses.REPOST_STATUS_20:
		break
	case statuses.REPOST_STATUS_30:
		break
	case statuses.REPOST_STATUS_40:
		break
	case statuses.REPOST_STATUS_50:
		arr.push(lang('repostId', id))
		arr.push(lang('informUser_REPOST_STATUS_50', this.sourcePostTitleLink('поста'), this.channelTitleLink()))
		arr.push(lang('pin', needToPin))
		arr.push(lang('reward', cost.format()))
		paid && arr.push(lang('fundsAreFrozen'))
		arr.push(lang('chooseTimeNow'))
		arr.push(lang('requestLifeTime', REQUEST_LIFETIME, REQUEST_LIFETIME_UNIT))
		return {
			text: arr.join('\n'),
			markup: configMarkup(id, true, true)
		}
	case statuses.REPOST_STATUS_60:
		break
	case statuses.REPOST_STATUS_70:
		break
	case statuses.REPOST_STATUS_80:
		break
	case statuses.REPOST_STATUS_90:
		arr.push(lang('repostId', id))
		arr.push(lang('informUser_REPOST_STATUS_90', this.channelTitleLink(), this.targetPostTitleLink('пост')))
		arr.push(lang('pin', needToPin))
		arr.push(lang('reward', cost.format()))
		paid && arr.push(lang('fundsAreFrozen'))
		arr.push(lang('deleteDate', moment(postedDate).tz(timezone).add(POST_LIFETIME, POST_LIFETIME_UNIT).format('LLL'), timezone))
		return {
			text: arr.join('\n'),
			markup: configMarkup(id, true, true)
		}
	case statuses.REPOST_STATUS_100:
		break
	case statuses.REPOST_STATUS_120:
		break
	case statuses.REPOST_STATUS_130:
		if (undoById !== userId) {
			return {
				text: this.toInfo({ id: userId }),
				markup: configMarkup(id, true, true)
			}
		}
		break
	case statuses.REPOST_STATUS_110:
		return {
			text: this.toInfo({ id: userId }),
			markup: configMarkup(id, true, true)
		}
	}
	return {}
}

repostSchema.methods.informOwnerMessageText = async function () {
	const { id, ownerId, status, ownerCost, needToPin, date, postedDate, undoById, isDateModified } = this
	const { settings: { timezone } } = await this.getOwner()
	const arr = []
	switch (status) {
	case statuses.REPOST_STATUS_20:
		arr.push(lang('repostId', id))
		arr.push(lang('informOwner_REPOST_STATUS_20', this.channelTitleLink(), this.sourcePostTitleLink('пост')))
		arr.push(lang('pin', needToPin))
		arr.push(lang('reward', ownerCost.format()))
		arr.push(lang('approveRejectNow'))
		arr.push(lang('requestLifeTime', REQUEST_LIFETIME, REQUEST_LIFETIME_UNIT))
		return {
			text: arr.join('\n'),
			markup: configMarkup(id, true, true)
		}
	case statuses.REPOST_STATUS_70:
		arr.push(lang('repostId', id))
		arr.push(lang('informOwner_REPOST_STATUS_70', this.channelTitleLink(), this.sourcePostTitleLink('поста'), isDateModified))
		arr.push(lang('pin', needToPin))
		arr.push(lang('reward', ownerCost.format()))
		arr.push(lang('postDate', moment(date).tz(timezone).format('LLL'), timezone))
		return {
			text: arr.join('\n'),
			markup: configMarkup(id, true, true)
		}
	case statuses.REPOST_STATUS_90:
		arr.push(lang('repostId', id))
		arr.push(lang('informOwner_REPOST_STATUS_90', this.channelTitleLink(), this.targetPostTitleLink('пост')))
		arr.push(lang('pin', needToPin))
		arr.push(lang('reward', ownerCost.format()))
		arr.push(lang('deleteDate', moment(postedDate).tz(timezone).add(POST_LIFETIME, POST_LIFETIME_UNIT).format('LLL'), timezone))
		return {
			text: arr.join('\n'),
			markup: configMarkup(id, true, true)
		}
	case statuses.REPOST_STATUS_130:
		if (undoById !== ownerId) {
			return {
				text: this.toInfo({ id: ownerId }),
				markup: configMarkup(id, true, true)
			}
		}
		break
	case statuses.REPOST_STATUS_110:
		return {
			text: this.toInfo({ id: ownerId }),
			markup: configMarkup(id, true, true)
		}
	}
	return {}
}

repostSchema.methods.getUser = function (session) {
	const { userId } = this
	return this.model('User').findOne({ id: userId }).populate('settings').session(session)
}

repostSchema.methods.getOwner = function (session) {
	const { ownerId } = this
	return this.model('User').findOne({ id: ownerId }).populate('settings').session(session)
}

repostSchema.methods.getGroup = function (session) {
	const { groupId } = this
	return this.model('Group').findOne({ id: groupId }).session(session)
}

repostSchema.methods.grantUser = async function (session) {
	const { id: repostId, cost } = this
	const userDoc = await this.getUser(session)
	return userDoc.modifyBalance(cost, MF_PROFIT, { repostId }, false, session)
}

repostSchema.methods.compensateOwner = async function (session) {
	const { id: repostId, ownerCost } = this
	const userDoc = await this.getOwner(session)
	return userDoc.modifyBalance(ownerCost, MF_UNFREEZE, { repostId }, false, session)
}

repostSchema.statics.getStartedByUser = function (filter, opts, session) {
	return this.findOne({ ...filter, status: { $gte: statuses.REPOST_STATUS_10 } }, null, opts).session(session)
}

repostSchema.statics.getStartedByUserCount = function (opts, session) {
	return this.countDocuments({ ...opts, status: { $gte: statuses.REPOST_STATUS_10 } }).session(session)
}

repostSchema.statics.getActiveRepost = function (opts, session) {
	return this.findOne({ ...opts, status: { $nin: [statuses.REPOST_STATUS_130, statuses.REPOST_STATUS_110] } }).session(session)
}

repostSchema.statics.getCanUndoByUser = function (opts, session) {
	return this.find({ ...opts, status: { $in: canUndoByUserStatuses } }).session(session)
}

repostSchema.statics.getCanUndoByOwner = function (opts, session) {
	return this.find({ ...opts, status: { $in: canUndoByOwnerStatuses } }).session(session)
}

repostSchema.statics.getApprovedByUser = function (session) {
	return this.find({ status: statuses.REPOST_STATUS_10 }).session(session)
}

repostSchema.statics.getSentToOwner = function (session) {
	return this.find({ status: statuses.REPOST_STATUS_20 }).session(session)
}

repostSchema.statics.getSentToUser = function (session) {
	return this.find({ status: statuses.REPOST_STATUS_50 }).session(session)
}

repostSchema.statics.getDoneRequested = function (session) {
	return this.find({ status: statuses.REPOST_STATUS_100 }).session(session)
}

repostSchema.statics.getUndoRequested = function (session) {
	return this.find({ status: statuses.REPOST_STATUS_120 }).session(session)
}

repostSchema.statics.getApprovedByOwner = function (session) {
	return this.find({ status: statuses.REPOST_STATUS_40 }).session(session)
}

repostSchema.statics.getRejectedByOwner = function (session) {
	return this.find({ status: statuses.REPOST_STATUS_30 }).session(session)
}

repostSchema.statics.getDateSet = function (session) {
	return this.find({ status: statuses.REPOST_STATUS_60 }).session(session)
}

repostSchema.statics.getReadyForPub = function (session) {
	return this.find({ status: statuses.REPOST_STATUS_70 }).session(session)
}

repostSchema.statics.getReadyForPubNow = function (session) {
	return this.find({ status: statuses.REPOST_STATUS_80 }).session(session)
}

repostSchema.statics.getPublished = function (session) {
	return this.find({ status: statuses.REPOST_STATUS_90 }).session(session)
}

repostSchema.statics.deleteUnconfirmed = function (opts, session) {
	return this.deleteMany({ ...opts, status: statuses.REPOST_STATUS_0 }).session(session)
}

module.exports = mongoose.model('Repost', repostSchema)
