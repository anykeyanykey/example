const mongoose = require('mongoose')
const { DefaultSchema, postSettings } = require('./schemas')
const { statuses, flow: { MF_REPOST, MF_UNFREEZE }, REPOST_COMMISSION } = require('../../const')
const { lang, currency: { RUB } } = require('../../utils')
const { configMarkup, okMarkup } = require('../../markups')
const { SafeError } = require('../../errors')
const crypto = require('crypto')

const POSTED_STATUSES = Object.freeze([
	statuses.POST_STATUS_20, statuses.POST_STATUS_40,
	statuses.POST_STATUS_50, statuses.POST_STATUS_60
])

const postSchema = new DefaultSchema(
	{
		userId: {
			type: Number,
			required: true
		},
		cost: {
			type: Number,
			required: true,
			get(bet) {
				return RUB(bet)
			}
		},
		settings: {
			type: postSettings,
			default: () => ({})
		},
		status: {
			type: Number,
			default: statuses.POST_STATUS_10
		},
		message: {
			type: JSON,
			required: true
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
			required: false
		}
	},
	{
		timestamps: true
	}
)

postSchema.virtual('ownerSettings', {
	ref: 'Settings',
	localField: 'userId',
	foreignField: 'userId',
	options: {
		populate: ['blackList']
	},
	justOne: true
})

postSchema.pre('save', function () {
	const { message } = this
	if (!message.md5) {
		const text = JSON.stringify(message)
		message.md5 = crypto.createHash('md5').update(text).digest('hex');
	}
})

postSchema.virtual('requirements').get(function() {
	return this.settings.requirements
})

postSchema.virtual('limitFrom').get(function() {
	return this.settings.limitFrom
})

postSchema.virtual('limitTo').get(function() {
	return this.settings.limitTo
})

postSchema.virtual('maxCost').get(function() {
	return this.settings.maxCost
})

postSchema.virtual('coefficient').get(function() {
	return this.settings.coefficient
})

postSchema.virtual('needToPin').get(function() {
	return this.settings.pin
})

postSchema.virtual('notifyOwnerId').get(function() {
	return this.userId
})

postSchema.virtual('postMessageId').get(function() {
	const [id] = this.messages
	return id
})

postSchema.methods.postTitleLink = function (title) {
	const { chatId, postMessageId } = this
	return `[${title}](https://t.me/c/${/-100(.*)/.exec(chatId)[1]}/${postMessageId})`
}

postSchema.methods.statusText = function () {
	const { status } = this
	if (statuses.POST_KNOWN_STATUSES.indexOf(status) > -1) {
		return lang(`POST_STATUS_${status}`)
	}
	return lang('STATUS_UNKNOWN', status)
}

postSchema.methods.isPosted = function () {
	const { status } = this
	return POSTED_STATUSES.indexOf(status) !== -1
}

postSchema.methods.repostCost = function (repostCost) {
	const cost = RUB(repostCost)
	return {
		cost,
		ownerCost: cost.add(cost.multiply(REPOST_COMMISSION))
	}
}

postSchema.methods.toInfo = function (mode = 0) {
	const { id } = this
	const arr = []
	arr.push(lang('postId', id))
	switch (mode) {
	case 0:
		arr.push(lang('status', this.statusText()))
		break
	}
	return arr.join('\n')
}

postSchema.methods.toShortInfo = function () {
	const arr = []
	if (this.canRepost()) {
		return this.toSettingsInfo(2)
	} else {
		arr.push(lang('repostIsProhibitedByOwner'))
	}
	return arr.join('\n')
}

postSchema.methods.informOwnerMessageText = function () {
	const { id, status } = this
	switch (status) {
	case statuses.POST_STATUS_20: // опубликован
		return {
			text: this.toInfo(),
			markup: configMarkup(id, false, true)
		}
	case statuses.POST_STATUS_30: // ошибка публикации
		return {
			text: [
				this.toInfo(),
				lang('cashBack')
			].join('\n'),
			markup: configMarkup(id, false, true)
		}
	case statuses.POST_STATUS_90: // удален
		return {
			text: this.toInfo(),
			markup: okMarkup()
		}
	}
	return {}
}

postSchema.methods.getReposts = function (opts = {}) {
	const { id: postId } = this
	return this.model('Repost').find({ ...opts, postId });
}

postSchema.methods.toInfoStat = async function () {
	return [
		this.toInfo(),
		await this.toStat(),
		this.toSettingsInfo(1)
	].join('\n')
}

postSchema.methods.toStat = async function () {
	const { cost } = this
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
	let views = 0
	let loss = RUB(cost)
	arr.push(lang('publicationCost', cost.format()))
	if (this.isPosted()) {
		const index = await this.getIndex()
		arr.push(lang('channelIndex', this.postTitleLink(index + 1)))
	}
	arr.push(lang('reposts', all))
	for (let i = 0; i < reposts.length; i++) {
		const repost = reposts[i]
		const { id: repostId, paid, views: _views } = repost
		if (paid) {
			loss = loss.add(await owner.getFlowSumByRepostId(repostId, MF_REPOST))
		}
		if (repost.isPosted()) {
			posted++
			views += _views
		} else if (repost.isWaiting()) {
			waiting++
			views += _views
		} else if (repost.isSuccess()) {
			success++
			views += _views
		} else if (repost.isCanceled()) {
			canceled++
			views += _views
			loss = loss.subtract(await owner.getFlowSumByRepostId(repostId, MF_UNFREEZE))
		} else if (repost.isToBeAgreed()) {
			toBeAgreed++
			views += _views
		} else {
			other++
			views += _views
		}
	}
	arr.push(`\t- ` + lang('toBeAgreed', toBeAgreed))
	arr.push(`\t- ` + lang('published', posted))
	arr.push(`\t- ` + lang('awaitingPublication', waiting))
	arr.push(`\t- ` + lang('successfullyCompleted', success))
	arr.push(`\t- ` + lang('canceled', canceled))
	arr.push(`\t- ` + lang('other', other))
	arr.push(lang('views', views))
	arr.push(lang('spent', loss))
	return arr.join('\n')
}

postSchema.methods.toSettingsInfo = function (mode = 0) {
	const { settings } = this
	return settings.toInfo(mode)
}

postSchema.methods.checkFrom = function(from, safe = true) {
	const { userId } = this
	const { admin, id } = from
	if (!admin && userId !== id) {
		if (safe) {
			throw new SafeError(lang('errorOnlyOwner'))
		} else {
			return false
		}
	}
	return true
}

postSchema.methods.checkStatus = function (from, newStatus, safe = true) {
	if (!this.checkFrom(from, safe)) {
		return false
	}
	const { status } = this
	let wrongStatus = true
	switch (newStatus) {
	case statuses.POST_STATUS_20: // post/activate
		wrongStatus = [statuses.POST_STATUS_10, statuses.POST_STATUS_40, statuses.POST_STATUS_50, statuses.POST_STATUS_60].indexOf(status) === -1
		break
	case statuses.POST_STATUS_30: // error post
		wrongStatus = status !== statuses.POST_STATUS_10 // запрос на post
		break
	case statuses.POST_STATUS_40: // deactivate
		wrongStatus = status !== statuses.POST_STATUS_20 // запрос на post
		break
	case statuses.POST_STATUS_50: // stop request
		wrongStatus = [statuses.POST_STATUS_20, statuses.POST_STATUS_40].indexOf(status) === -1
		break
	case statuses.POST_STATUS_60: // stop
		wrongStatus = status !== statuses.POST_STATUS_50
		break
	case statuses.POST_STATUS_70: // удаление из канала
		wrongStatus = status !== statuses.POST_STATUS_60
		break
	case statuses.POST_STATUS_80: // удаление реквест
		wrongStatus = status !== statuses.POST_STATUS_70
		break
	case statuses.POST_STATUS_90: // удален
		wrongStatus = status !== statuses.POST_STATUS_80
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

postSchema.methods.canRepost = function () {
	const { status } = this
	return status === statuses.POST_STATUS_20
}

postSchema.methods.canRenew = function (from) {
	return this.checkFrom(from, false) && this.isPosted()
}

postSchema.methods.canViewReposts = function (from) {
	return this.canRenew(from)
}

postSchema.methods.canStop = function (from) {
	return this.checkStatus(from, statuses.POST_STATUS_50, false)
}

postSchema.methods.stopRequest = function (from) {
	this.checkStatus(from, statuses.POST_STATUS_50)
	this.status = statuses.POST_STATUS_50
}

postSchema.methods.stop = function (from) {
	this.checkStatus(from, statuses.POST_STATUS_60)
	this.status = statuses.POST_STATUS_60
}

postSchema.methods.canDelete = function (from) {
	return this.checkStatus(from, statuses.POST_STATUS_70, false)
}

postSchema.methods.removeRequest = function (from) {
	this.checkStatus(from, statuses.POST_STATUS_70)
	this.status = statuses.POST_STATUS_70
}

postSchema.methods.deleteRequest = function (from) {
	this.checkStatus(from, statuses.POST_STATUS_80)
	this.status = statuses.POST_STATUS_80
}

postSchema.methods.delete = function (from) {
	this.checkStatus(from, statuses.POST_STATUS_90)
	this.status = statuses.POST_STATUS_90
}

postSchema.methods.canDeactivate = function (from) {
	return this.checkStatus(from, statuses.POST_STATUS_40, false)
}

postSchema.methods.deactivate = function (from) {
	this.checkStatus(from, statuses.POST_STATUS_40)
	this.status = statuses.POST_STATUS_40
}

postSchema.methods.canActivate = function (from) {
	const { status } = this
	return this.checkFrom(from, false) && (status === statuses.POST_STATUS_40 ||
		status === statuses.POST_STATUS_50 ||
		status === statuses.POST_STATUS_60)
}

postSchema.methods.activate = function (from) {
	this.checkStatus(from, statuses.POST_STATUS_20)
	this.status = statuses.POST_STATUS_20
}

postSchema.methods.errorPost = function (from) {
	this.checkStatus(from, statuses.POST_STATUS_30)
	this.status = statuses.POST_STATUS_30
}

postSchema.methods.canConfig = function (from) {
	const { status } = this
	return this.checkFrom(from, false) &&
		[...POSTED_STATUSES, statuses.POST_STATUS_10].indexOf(status) !== - 1
}

postSchema.methods.canSetRequirements = function (from) {
	return this.canConfig(from)
}

postSchema.methods.setRequirements = function (from, requirements) {
	this.settings.requirements = requirements
}

postSchema.methods.canSetPin = function (from) {
	return this.canConfig(from)
}

postSchema.methods.setPin = function (from, pin) {
	this.settings.pin = pin
}

postSchema.methods.canSetLimit = function (from) {
	return this.canConfig(from)
}

postSchema.methods.setLimitFrom = function (from, limitFrom) {
	this.settings.limitFrom = limitFrom
}

postSchema.methods.setLimitTo = function (from, limitTo) {
	this.settings.limitTo = limitTo
}

postSchema.methods.canSetCoefficient = function (from) {
	return this.canConfig(from)
}

postSchema.methods.setCoefficient = function (from, coefficient) {
	this.settings.coefficient = coefficient
}

postSchema.methods.canSetMaxCost = function (from) {
	return this.canConfig(from)
}

postSchema.methods.setMaxCost = function (from, maxCost) {
	this.settings.maxCost = maxCost
}

postSchema.methods.compensateOwner = async function (session) {
	const { id: postId, cost } = this
	const userDoc = await this.getOwner(session)
	return userDoc.modifyBalance(cost, MF_UNFREEZE, { postId }, false, session)
}

postSchema.methods.getIndex = function (session) {
	const { postedDate } = this
	return this.model('Post')
		.countDocuments({ status: { $in: POSTED_STATUSES }, postedDate: { $gt: postedDate } }).session(session)
}

postSchema.methods.getOwner = function (session) {
	const { userId } = this
	return this.model('User').findOne({ id: userId }).session(session)
}

postSchema.methods.getReposts = function (opts = {}, session) {
	const { id: postId } = this
	return this.model('Repost').find({ ...opts, postId }).session(session);
}

postSchema.methods.getRepostSkip = function (skip, session) {
	const { id: postId } = this
	return this.model('Repost').getStartedByUser({ postId }, { skip, sort: { createdAt: -1 } }, session)
}

postSchema.methods.getRepostCount = function (session) {
	const { id: postId } = this
	return this.model('Repost').getStartedByUserCount({ postId }, session)
}

postSchema.methods.getCanUndoReposts = function (session) {
	const { id: postId } = this
	return this.model('Repost').getCanUndoByOwner({ postId }, session);
}

postSchema.statics.getPostRequested = function (session) {
	return this.find({ status: statuses.POST_STATUS_10 }).session(session)
}

postSchema.statics.getStopRequested = function (session) {
	return this.find({ status: statuses.POST_STATUS_50 }).session(session)
}

postSchema.statics.getRemoveRequested = function (session) {
	return this.find({ status: statuses.POST_STATUS_70 }).session(session)
}

postSchema.statics.getDeleteRequested = function (session) {
	return this.find({ status: statuses.POST_STATUS_80 }).session(session)
}

module.exports = mongoose.model('Post', postSchema)
