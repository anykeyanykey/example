const mongoose = require('mongoose')
const { DefaultSchema, groupInfo } = require('./schemas')
const { statuses, flow: { MF_PROFIT } } = require('../../const')
const { lang, currency: { RUB } } = require('../../utils')
const { okMarkup } = require('../../markups')
const { SafeError } = require('./../../errors')

const groupSchema = new DefaultSchema(
	{
		info: {
			type: groupInfo,
			required: true
		},
		status: {
			type: Number,
			default: 0
		},
		ownerId: {
			type: Number,
			required: true
		}
	},
	{
		timestamps: true
	}
)

groupSchema.virtual('chatId').get(function() {
	return this.info.id
})

groupSchema.virtual('title').get(function() {
	return this.info.title
})

groupSchema.virtual('username').get(function() {
	return this.info.username
})

groupSchema.virtual('inviteLink').get(function() {
	return this.info.invite_link
})

groupSchema.virtual('membersCount').get(function() {
	return this.info.members_count
})

groupSchema.virtual('notifyOwnerId').get(function() {
	return this.ownerId
})

groupSchema.virtual('isActive').get(function() {
	const { status } = this
	return status === statuses.GROUP_STATUS_0
})

groupSchema.methods.isOwner = function (from) {
	const { ownerId } = this
	const { id } = from
	return id === ownerId
}

groupSchema.methods.isAdmin = function (from) {
	const { admin } = from
	return admin
}

groupSchema.methods.informOwnerMessageText = function () {
	const { status } = this
	switch (status) {
	case statuses.GROUP_STATUS_50: // удалена
		return {
			text: this.toInfo(),
			markup: okMarkup()
		}
	}
	return {}
}

groupSchema.methods.checkStatus = function (from, newStatus, safe = true) {
	const { ownerId, status } = this
	const { id, admin } = from
	if (!admin && ownerId !== id) {
		if (safe) {
			throw new SafeError(lang('errorOnlyUser'))
		} else {
			return false
		}
	}
	let wrongStatus = true
	switch (newStatus) {
	case statuses.GROUP_STATUS_0: // запрос на активацию
		wrongStatus = [statuses.GROUP_STATUS_10, statuses.GROUP_STATUS_20].indexOf(status) === -1
		break
	case statuses.GROUP_STATUS_10: // запрос на стоп
		wrongStatus = status !== statuses.GROUP_STATUS_0
		break
	case statuses.GROUP_STATUS_20: // стоп
		wrongStatus = status !== statuses.GROUP_STATUS_10
		break
	case statuses.GROUP_STATUS_30: // запрос на leave
		wrongStatus = status !== statuses.GROUP_STATUS_20 // остановлена
		break
	case statuses.GROUP_STATUS_40: // запрос на удаление
		wrongStatus = status !== statuses.GROUP_STATUS_30 // запрос на leave
		break
	case statuses.GROUP_STATUS_50: // удалена
		wrongStatus = status !== statuses.GROUP_STATUS_40 // запрос на удаление
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

groupSchema.methods.statusText = function () {
	const { status } = this
	if (statuses.GROUP_KNOWN_STATUSES.indexOf(status) > -1) {
		return lang(`GROUP_STATUS_${status}`)
	}
	return lang('STATUS_UNKNOWN', status)
}

groupSchema.methods.channelLink = function () {
	const { username, inviteLink } = this
	return username ? `https://t.me/${username}` : inviteLink
}

groupSchema.methods.channelTitleLink = function () {
	const { title } = this
	return `[${title}](${this.channelLink()})`
}

groupSchema.methods.toInfo = function (mode = 0) {
	const { id, isActive } = this
	const arr = []
	arr.push(lang('groupId', id))
	arr.push(this.channelTitleLink())
	switch (mode) {
	case 0:
		arr.push(lang('status', this.statusText()))
		break
	case 2:
		if (!isActive) {
			arr.push(lang('isGroupStopped'))
		}
		break
	}
	return arr.join('\n')
}

groupSchema.methods.toInfoStat = async function () {
	return [
		this.toInfo(),
		await this.toStat(),
		await this.toDeferredStat()
	].join('\n')
}

groupSchema.methods.toDeferredStat = async function () {
	const arr = []
	const deferredDocs = await this.getDeferred()
	const all = deferredDocs.length;
	arr.push(lang('deferred', all))
	let draft = 0
	let posted = 0
	let waiting = 0
	let other = 0
	for (let i = 0; i < deferredDocs.length; i++) {
		const doc = deferredDocs[i]
		if (doc.isDraft()) {
			draft++
		} else if (doc.isPosted()) {
			posted++
		} else if (doc.isWaiting()) {
			waiting++
		} else {
			other++
		}
	}
	arr.push(`\t- ` + lang('draftDeferred', draft))
	arr.push(`\t- ` + lang('waitingDeferred', waiting))
	arr.push(`\t- ` + lang('postedDeferred', posted))
	arr.push(`\t- ` + lang('inactive', other))
	return arr.join('\n')
}

groupSchema.methods.toStat = async function () {
	const arr = []
	const reposts = await this.getReposts()
	const owner = await this.getOwner()
	const all = reposts.length;
	let posted = 0
	let waiting = 0
	let success = 0
	let canceled = 0
	let toBeAgreed = 0
	let other = 0
	let profit = RUB(0)
	arr.push(lang('earned', profit.format()))
	arr.push(lang('reposts', all))
	for (let i = 0; i < reposts.length; i++) {
		const repost = reposts[i]
		const { id: repostId } = repost
		if (repost.isPosted()) {
			posted++
		} else if (repost.isWaiting()) {
			waiting++
		} else if (repost.isSuccess()) {
			success++
			profit = profit.add(await owner.getFlowSumByRepostId(repostId, MF_PROFIT))
		} else if (repost.isCanceled()) {
			canceled++
		} else if (repost.isToBeAgreed()) {
			toBeAgreed++
		} else {
			other++
		}
	}
	arr.push(`\t- ` + lang('toBeAgreed', toBeAgreed))
	arr.push(`\t- ` + lang('published', posted))
	arr.push(`\t- ` + lang('awaitingPublication', waiting))
	arr.push(`\t- ` + lang('successfullyCompleted', success))
	arr.push(`\t- ` + lang('canceled', canceled))
	arr.push(`\t- ` + lang('other', other))
	return arr.join('\n')
}

groupSchema.methods.canViewReposts = function (from) {
	const { status } = this
	return this.isOwner(from) && [
		statuses.GROUP_STATUS_0, statuses.GROUP_STATUS_10, statuses.GROUP_STATUS_20
	].indexOf(status) !== -1
}

groupSchema.methods.canActivate = function (from) {
	return this.checkStatus(from, statuses.GROUP_STATUS_0, false)
}

groupSchema.methods.activate = function (from) {
	this.checkStatus(from, statuses.GROUP_STATUS_0)
	this.status = statuses.GROUP_STATUS_0
}

groupSchema.methods.canDelete = function (from) {
	return this.checkStatus(from, statuses.GROUP_STATUS_30, false)
}

groupSchema.methods.canManageDeferred = function (from) {
	const { status } = this
	return this.isOwner(from) && [statuses.GROUP_STATUS_0, statuses.GROUP_STATUS_10, statuses.GROUP_STATUS_20].indexOf(status) !== -1
}

groupSchema.methods.leaveRequest = function (from) {
	this.checkStatus(from, statuses.GROUP_STATUS_30)
	this.status = statuses.GROUP_STATUS_30
}

groupSchema.methods.canStop = function (from) {
	return this.checkStatus(from, statuses.GROUP_STATUS_10, false)
}

groupSchema.methods.stopRequest = function (from) {
	this.checkStatus(from, statuses.GROUP_STATUS_10)
	this.status = statuses.GROUP_STATUS_10
}

groupSchema.methods.stop = function (from) {
	this.checkStatus(from, statuses.GROUP_STATUS_20)
	this.status = statuses.GROUP_STATUS_20
}

groupSchema.methods.deleteRequest = function (from) {
	this.checkStatus(from, statuses.GROUP_STATUS_40)
	this.status = statuses.GROUP_STATUS_40 // запрос на удаление
}

groupSchema.methods.delete = function (from) {
	this.checkStatus(from, statuses.GROUP_STATUS_50)
	this.status = statuses.GROUP_STATUS_50 // удалена
}

groupSchema.methods.getDeferred = function (opts = {}, session) {
	const { id: groupId } = this
	return this.model('Deferred').find({ ...opts, groupId }).session(session);
}

groupSchema.methods.getReposts = function (opts = {}, session) {
	const { chatId } = this
	return this.model('Repost').find({ ...opts, 'groupInfo.id': chatId }).session(session);
}

groupSchema.methods.getOwner = function (session) {
	const { ownerId } = this
	return this.model('User').findOne({ id: ownerId }).session(session);
}

groupSchema.methods.getCanUndoReposts = function (session) {
	const { chatId } = this
	return this.model('Repost').getCanUndoByUser({ 'groupInfo.id': chatId }, session)
}

groupSchema.methods.deleteDeferred = function (session) {
	const { id: groupId } = this
	return this.model('Deferred').deleteMany({ groupId }, session)
}

groupSchema.statics.getActive = function (opts = {}, session) {
	return this.find({ ...opts, status: statuses.GROUP_STATUS_0 }).session(session)
}

groupSchema.statics.getStopRequested = function (session) {
	return this.find({ status: statuses.GROUP_STATUS_10 }).session(session)
}

groupSchema.statics.getLeaveRequested = function (session) {
	return this.find({ status: statuses.GROUP_STATUS_30 }).session(session)
}

groupSchema.statics.getDeleteRequested = function (session) {
	return this.find({ status: statuses.GROUP_STATUS_40 }).session(session)
}

module.exports = mongoose.model('Group', groupSchema)
