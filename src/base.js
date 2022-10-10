const { DeferredModel, FlowModel, GroupModel, PostModel, RepostModel, UserModel, WithdrawalModel, SettingsModel } = require("./base/models");
const { db } = require('./base/utils')
const { lang, logger, currency: { RUB } } = require('./utils')
const {
	POST_COST, TG_BANK_ADMIN, TG_CHANNEL_NAME, TG_CHANNEL_LINK,
	flow: { MF_WITHDRAWAL, MF_POST, MF_PAYMENT, MF_PROFIT, MF_REPOST }
} = require('./const')
const { SafeError } = require('./errors')

module.exports = {

	async getUser(opts, session, safe = true) {
		let playerDoc = await UserModel.findOne(opts).session(session)
		if (!playerDoc && safe) {
			throw new SafeError(lang('errorUserNotFound'))
		}
		return playerDoc
	},

	async getOrCreateUser({ id }, session) {
		let playerDoc = await this.getUser({ id }, session, false)
		if (!playerDoc) {
			return this.createUser(id, session)
		}
		return playerDoc
	},

	async getGroup(opts, session, safe = true) {
		const groupDoc = await GroupModel.findOne(opts).session(session)
		if (!groupDoc && safe) {
			throw new SafeError(lang('errorGroupNotFound'))
		}
		return groupDoc
	},

	async getPost(filter, opts, session, safe = true) {
		const postDoc = await PostModel.findOne(filter, null, opts).session(session)
		if (!postDoc && safe) {
			throw new SafeError(lang('errorPostNotFound'))
		}
		return postDoc
	},

	async getRepost(filter, opts, session, safe = true) {
		const repostDoc = await RepostModel.findOne(filter, null, opts).session(session)
		if (!repostDoc && safe) {
			throw new SafeError(lang('errorRepostNotFound'))
		}
		return repostDoc
	},

	async getSettings(filter, opts, session, safe = true) {
		const settingsDoc = await SettingsModel.findOne(filter, null, opts).session(session)
		if (!settingsDoc && safe) {
			throw new SafeError(lang('errorSettingsNotFound'))
		}
		return settingsDoc
	},

	async getBankAdmin(session) {
		return this.getOrCreateUser({ id: TG_BANK_ADMIN }, session)
	},

	async getPostSkip(opts = {}, skip = 0) {
		return PostModel.findOne(opts).sort({ 'createdAt': -1 }).skip(skip).exec()
	},

	async getPostCount(opts = {}) {
		return PostModel.countDocuments(opts)
	},

	async getGroupCount(opts = {}) {
		return GroupModel.countDocuments(opts)
	},

	async getGroupSkip(opts = {}, skip = 0) {
		return GroupModel.findOne(opts).sort({ 'createdAt': -1 }).skip(skip).exec()
	},

	async getRepostSkip(filter = {}, opts, skip = 0) {
		return RepostModel.findOne(filter, null, opts).sort({ 'createdAt': -1 }).skip(skip).exec()
	},

	async getRepostMany(filter, opts) {
		return RepostModel.find(filter, null, opts).sort({ 'createdAt': 1 }).exec()
	},

	async getRepostCountByPostId(postId) {
		const postDoc = await PostModel.findOne({ id: postId })
		return postDoc.getRepostCount()
	},

	async getRepostSkipByPostId(postId, skip = 0) {
		const postDoc = await PostModel.findOne({ id: postId })
		return postDoc.getRepostSkip(skip)
	},

	async getRepostCount(opts = {}) {
		return RepostModel.countDocuments(opts)
	},

	async getFlowCount(filter = {}) {
		return FlowModel.countDocuments(filter)
	},

	async getFlowsSkip(filter, opts = {}) {
		return FlowModel.find(filter, null, opts).sort({ 'createdAt': -1 }).exec()
	},

	async createUser(id, session) {
		let userDoc = new UserModel({ id })
		userDoc.settings = await this.createSettings(id, session)
		await userDoc.save({ session })
		if (!this.isAdmin({ id })) {
			userDoc = await this.richUserById(id, 1)
		}
		logger.info(`User created, id: ${id}`)
		return userDoc
	},

	async createSettings(userId, session) {
		const settingsDoc = await new SettingsModel({ userId }).save({ session })
		logger.info(`Settings created, userId: ${userId}`)
		return settingsDoc
	},

	getActiveRepost(groupId, postId, session) {
		return RepostModel.getActiveRepost({
			groupId,
			postId
		}, session)
	},

	deleteUnconfirmedReposts(opts) {
		return RepostModel.deleteUnconfirmed(opts)
	},

	async createRepost(groupId, postId, repostCost) {
		let repostDoc
		await db.transaction(async (session) => {
			const groupDoc = await this.getGroup({ id: groupId }, session)
			const postDoc = await this.getPost({ id: postId }, { populate: 'ownerSettings' }, session)
			const { ownerId: userId, info } = groupDoc
			const { userId: ownerId } = postDoc
			const { ownerSettings: { blackList } } = postDoc
			const error = this.validateGroupInfoPostSum(info, postDoc, repostCost)
			if (error) {
				throw new SafeError(error)
			}
			if (blackList.find(({ id }) => id === groupId)) {
				throw new SafeError(lang('errorChannelBlackListed'))
			}
			if (ownerId === userId) {
				throw new SafeError(lang('errorCantRepostByOwner'))
			}
			const active = await this.getActiveRepost(groupId, postId, session)
			if (active) {
				throw new SafeError(lang('youAlreadyHaveRepost'))
			}
			const { cost, ownerCost } = postDoc.repostCost(repostCost)
			repostDoc = await new RepostModel({
				userId,
				ownerId,
				postId,
				postInfo: {
					...postDoc
				},
				groupInfo: {
					...info
				},
				cost: cost.value,
				ownerCost: ownerCost.value,
				groupId
			}).save({ session })
		})
		logger.info(`Repost created, id: ${repostDoc.id}`)
		return repostDoc
	},

	async deactivatePostById(from, postId) {
		let postDoc
		await db.transaction(async (session) => {
			postDoc = await this.getPost({ id: postId }, null, session)
			postDoc.deactivate(from)
			await postDoc.save({ session })
		})
		return postDoc
	},

	async activatePostById(from, postId) {
		let postDoc
		await db.transaction(async (session) => {
			postDoc = await this.getPost({ id: postId }, null, session)
			postDoc.activate(from)
			await postDoc.save({ session })
		})
		return postDoc
	},

	async deletePostById(from, postId) {
		let postDoc
		await db.transaction(async (session) => {
			postDoc = await this.getPost({ id: postId }, null, session)
			postDoc.removeRequest(from)
			await postDoc.save({ session })
		})
		return postDoc
	},

	async stopPostById(from, postId) {
		let postDoc
		await db.transaction(async (session) => {
			postDoc = await this.getPost({ id: postId }, null, session)
			postDoc.stopRequest(from)
			await postDoc.save({ session })
		})
		return postDoc
	},

	async updateSettings({ from: { id: userId }, settings }) {
		await db.transaction(async (session) => {
			const { postSettings: newPostSettings = {} } = settings
			const { postSettings } = await this.getSettings({ userId }, null, session)
			await SettingsModel.updateOne({ userId }, {
				...settings,
				postSettings: {
					...postSettings.toJSON(),
					...newPostSettings
				}
			}, { session, runValidators: true })
		})
		return this.getSettings({ userId })
	},

	async setPostRequirementsById({ from, postId, requirements }) {
		let postDoc
		await db.transaction(async (session) => {
			postDoc = await this.getPost({ id: postId }, null, session)
			postDoc.setRequirements(from, requirements)
			await postDoc.save({ session })
		})
		return postDoc
	},

	async setPostPinById({ from, postId, pin }) {
		let postDoc
		await db.transaction(async (session) => {
			postDoc = await this.getPost({ id: postId }, null, session)
			postDoc.setPin(from, pin)
			await postDoc.save({ session })
		})
		return postDoc
	},

	async setPostLimitFromById({ from, postId, limitFrom }) {
		let postDoc
		await db.transaction(async (session) => {
			postDoc = await this.getPost({ id: postId }, null, session)
			postDoc.setLimitFrom(from, limitFrom)
			await postDoc.save({ session })
		})
		return postDoc
	},

	async setPostLimitToById({ from, postId, limitTo }) {
		let postDoc
		await db.transaction(async (session) => {
			postDoc = await this.getPost({ id: postId }, null, session)
			postDoc.setLimitTo(from, limitTo)
			await postDoc.save({ session })
		})
		return postDoc
	},

	async setPostCoefficientById({ from, postId, coefficient }) {
		let postDoc
		await db.transaction(async (session) => {
			postDoc = await this.getPost({ id: postId }, null, session)
			postDoc.setCoefficient(from, coefficient)
			await postDoc.save({ session })
		})
		return postDoc
	},

	async setPostMaxCostById({ from, postId, maxCost }) {
		let postDoc
		await db.transaction(async (session) => {
			postDoc = await this.getPost({ id: postId }, null, session)
			postDoc.setMaxCost(from, maxCost)
			await postDoc.save({ session })
		})
		return postDoc
	},

	async deleteGroupById(from, groupId) {
		let groupDoc
		await db.transaction(async (session) => {
			groupDoc = await this.getGroup({ id: groupId }, session)
			groupDoc.leaveRequest(from)
			await groupDoc.save({ session })
		})
		return groupDoc
	},

	async stopGroupById(from, groupId) {
		let groupDoc
		await db.transaction(async (session) => {
			groupDoc = await this.getGroup({ id: groupId }, session)
			groupDoc.stopRequest(from)
			await groupDoc.save({ session })
		})
		return groupDoc
	},

	async activateGroupById(from, groupId) {
		let groupDoc
		await db.transaction(async (session) => {
			groupDoc = await this.getGroup({ id: groupId }, session)
			groupDoc.activate(from)
			await groupDoc.save({ session })
		})
		return groupDoc
	},

	async undoRepostById(from, repostId) {
		let repostDoc
		await db.transaction(async (session) => {
			repostDoc = await this.getRepost({ id: repostId }, null, session)
			repostDoc.undoRequest(from)
			await repostDoc.save({ session })
		})
		return repostDoc
	},

	async approveRepostByUserById(from, repostId) {
		let repostDoc
		await db.transaction(async (session) => {
			repostDoc = await this.getRepost({ id: repostId }, null, session)
			repostDoc.approveByUser(from)
			await repostDoc.save({ session })
		})
		return repostDoc
	},

	async tryApproveRepost(from, repostDoc, session) {
		const { id: repostId } = repostDoc
		const ownerDoc = await repostDoc.getOwner(session)
		const { ownerCost } = repostDoc
		const { balance } = ownerDoc
		if (ownerCost.value > balance.value) {
			throw new SafeError(lang('noMoneyApproveRepost', ownerCost.format()))
		}
		await ownerDoc.modifyBalance(ownerCost, MF_REPOST, { repostId }, true, session)
		repostDoc.approveByOwner(from)
		await repostDoc.save({ session })
	},

	async approveRepostById(from, repostId) {
		let repostDoc
		await db.transaction(async (session) => {
			repostDoc = await this.getRepost({ id: repostId }, null, session)
			await this.tryApproveRepost(from, repostDoc, session)
		})
		return repostDoc
	},

	async rejectRepostById(from, repostId) {
		let repostDoc
		await db.transaction(async (session) => {
			repostDoc = await this.getRepost({ id: repostId }, null, session)
			repostDoc.rejectByOwner(from)
			await repostDoc.save({ session })
		})
		return repostDoc
	},

	async setDateRepostById(from, repostId, date) {
		let repostDoc
		await db.transaction(async (session) => {
			repostDoc = await this.getRepost({ id: repostId }, null, session)
			repostDoc.setDate(from, date)
			await repostDoc.save({ session })
		})
		return repostDoc
	},

	async bankruptUserById(userId) {
		let playerDoc
		await db.transaction(async (session) => {
			playerDoc = await this.getUser({ id: userId }, session)
			const { balance } = playerDoc
			if (balance.value <= 0) {
				throw new SafeError(lang('errorAlreadyBankrupt'))
			}
			await playerDoc.modifyBalance(balance, MF_WITHDRAWAL, { withdrawalId: 0 }, true, session)
		})
		return playerDoc
	},

	async richUserById(userId, sum) {
		let playerDoc
		if (!sum || isNaN(sum) || !isFinite(sum)) {
			throw new SafeError(lang('errorWrongSum'))
		}
		await db.transaction(async (session) => {
			playerDoc = await this.getUser({ id: userId }, session)
			await playerDoc.modifyBalance(sum, MF_PAYMENT, { paymentId: 0 }, false, session)
		})
		return playerDoc
	},

	async banUserById(userId, ban) {
		let playerDoc
		await db.transaction(async (session) => {
			playerDoc = await this.getUser({ id: userId }, session)
			playerDoc.banned = ban
			await playerDoc.save({ session })
		})
		return playerDoc
	},

	async richUserByUser(userFromDoc, userToDoc, sum, typeFromUser, typeToUser, params, session) {
		const isSame = userFromDoc.isSame(userToDoc)
		if (isSame) {
			await userFromDoc.modifyBalance(sum, typeFromUser, params, true, session)
			await userFromDoc.modifyBalance(sum, typeToUser, params, false, session)
		} else {
			await userFromDoc.modifyBalance(sum, typeFromUser, params, true, session)
			await userToDoc.modifyBalance(sum, typeToUser, params, false, session)
		}
		return isSame
	},

	async getPostShortInfoById(postId) {
		const post = await this.getPost({ id: postId })
		return post.toShortInfo()
	},

	async renewPostById(from, postId) {
		const repost = await this.getPost({ id: postId })
		const { message, settings } = repost
		const index = await repost.getIndex()
		if (index === 0) {
			throw new SafeError(lang('errorRenewIndex', TG_CHANNEL_NAME, TG_CHANNEL_LINK))
		}
		return this.createPost(from, message, settings)
	},

	async whiteListByRepostId({ id: userId }, repostId, reverse = false) {
		await db.transaction(async (session) => {
			const settingsDoc = await this.getSettings({ userId }, null, session)
			const repostDoc = await this.getRepost({ id: repostId }, null, session)
			const groupDoc = await repostDoc.getGroup(session)
			if (groupDoc) {
				const blackList = reverse ? 'whiteList' : 'blackList'
				const whiteList = reverse ? 'blackList' : 'whiteList'
				const founded = settingsDoc[blackList].find(({ _id }) => _id.toString() === groupDoc._id.toString())
				if (founded) {
					settingsDoc[blackList].splice(settingsDoc[blackList].indexOf(founded), 1)
				}
				if (!settingsDoc[whiteList].find(({ _id }) => _id.toString() === groupDoc._id.toString())) {
					settingsDoc[whiteList].push(groupDoc)
					await settingsDoc.save({ session })
				}
			}
		})
	},

	async removeFromListByGroupId({ id: userId }, groupId) {
		await db.transaction(async (session) => {
			const settings = await this.getSettings({ userId }, null, session)
			const { whiteList, blackList } = settings
			const groupDoc = await this.getGroup({ id: groupId }, session, false)
			if (groupDoc) {
				let founded = whiteList.find((id) => id.toString() === groupDoc._id.toString())
				if (founded) {
					whiteList.splice(whiteList.indexOf(founded), 1)
				}
				founded = blackList.find((id) => id.toString() === groupDoc._id.toString())
				if (founded) {
					blackList.splice(blackList.indexOf(founded), 1)
				}
				await settings.save({ session })
			}
		})
	},

	async blackListByRepostId(...args) {
		return this.whiteListByRepostId.apply(this, [...args, true])
	},

	async createGroup(ownerId, info) {
		const { id: chatId } = info
		let groupDoc
		await db.transaction(async (session) => {
			groupDoc = await this.getGroup({ 'info.id': chatId }, session, false)
			if (groupDoc) {
				const { ownerId: _ownerId } = groupDoc
				if (ownerId !== _ownerId) {
					throw new SafeError(lang('errorGroupAnotherOwner'))
				}
				groupDoc.info = info
				await groupDoc.save({ session })
			} else {
				groupDoc = await new GroupModel({
					ownerId,
					info
				}).save({ session })
			}
		})
		return groupDoc
	},

	async getLastSuccessWithdrawal({ id: userId }, paySystemId) {
		const type = WithdrawalModel.paySystemToType(paySystemId)
		return WithdrawalModel.findOne({ userId, type, done: true }).sort({ createdAt: -1 })
	},

	async createWithdrawal({ account, from, paySystemId, sum }) {
		const paySystem = await this.getPaySystem(paySystemId)
		const result = {
			withdrawal: null,
			user: null
		}
		await db.transaction(async (session) => {
			const { id: userId } = from
			let userDoc = await UserModel.findOne({ id: userId }, null, { session })
			const { balance } = userDoc
			sum = sum ? RUB(sum) : balance
			const { sum_min: { RUB: minSumStr } } = paySystem
			const min = RUB(Number(minSumStr))
			if (sum.value < min.value) {
				throw new SafeError(lang('errorNotEnoughMoneyWithdrawal', min.format()))
			}
			if (sum.value > balance.value) {
				throw new SafeError(lang('errorToManyMoneyWithdrawal'))
			}
			const type = WithdrawalModel.paySystemToType(paySystemId)
			const withdrawalDoc = await new WithdrawalModel({
				sum: sum.value,
				type,
				userId,
				paySystemId,
				account
			}).save({ session })
			const { id: withdrawalId } = withdrawalDoc
			await userDoc.modifyBalance(sum, MF_WITHDRAWAL, { withdrawalId }, true, session)
			logger.warn(`Withdrawal created, from: ${userId}, sum: ${sum.format()}, account: ${account}`)
			result.withdrawal = withdrawalDoc
			result.user = userDoc
		})
		return result
	},

	async createPost(from, message, settings) {
		let postDoc
		let userDoc
		await db.transaction(async (session) => {
			const { id: userId } = from
			userDoc = await this.getUser({ id: userId }, session)
			const { balance } = userDoc
			const postCost = RUB(POST_COST)
			if (balance.value < postCost.value) {
				throw new SafeError(lang('errorNotEnoughMoneyPost'))
			}
			if (this.isAdmin(userDoc)) {
				throw new SafeError(lang('errorAdminCantPost'))
			}
			if (!settings) {
				const { postSettings } = await SettingsModel.findOne({ userId }).session(session) || {}
				settings = postSettings
			}
			postDoc = await new PostModel({
				cost: POST_COST,
				userId,
				settings,
				message
			}).save({ session })
			const { id: postId } = postDoc
			await this.richUserByUser(userDoc, await this.getBankAdmin(session), postCost, MF_POST, MF_PROFIT, { postId }, session)
		})
		const { id: postId } = postDoc
		logger.info(`Post created, postId: ${postId}`)
		return {
			post: postDoc,
			user: userDoc
		}
	},

	async getDeferred(filter, opts, session, safe = true) {
		const deferredDoc = await DeferredModel.findOne(filter, null, opts).session(session)
		if (!deferredDoc && safe) {
			throw new SafeError(lang('errorDeferredNotFound'))
		}
		return deferredDoc
	},

	async getDeferredMany(filter, opts) {
		return DeferredModel.find(filter, null, opts).sort({ 'createdAt': 1 }).exec()
	},

	async getDeferredSkip(filter, opts, skip = 0) {
		return DeferredModel.findOne(filter, null, opts).sort({ 'createdAt': -1 }).skip(skip).exec()
	},

	async getDeferredCount(opts = {}) {
		return DeferredModel.countDocuments(opts)
	},

	async deleteDeferredById(from, deferredId) {
		let postDoc
		await db.transaction(async (session) => {
			postDoc = await this.getDeferred({ id: deferredId }, null, session)
			postDoc.checkFrom(from)
			postDoc.delete(from)
			await postDoc.remove({ session })
		})
		return postDoc
	},

	async stopDeferredById(from, deferredId) {
		let postDoc
		await db.transaction(async (session) => {
			postDoc = await this.getDeferred({ id: deferredId }, null, session)
			postDoc.stopRequest(from)
			await postDoc.save({ session })
		})
		return postDoc
	},

	async modifyDeferred(from, filter, update) {
		await db.transaction(async (session) => {
			const postDoc = await this.getDeferred(filter, null, session)
			postDoc.modify(from, update)
			await postDoc.save({ session })
		})
		return this.getDeferred(filter)
	},

	async createDeferred({ from, message, settings = {}, groupId }) {
		let postDoc
		await db.transaction(async (session) => {
			const { id: userId } = from
			const groupDoc = await this.getGroup({ id: groupId }, session)
			const { chatId } = groupDoc
			if (!groupDoc.isOwner(from)) {
				throw new SafeError(lang('errorOnlyUser'))
			}
			postDoc = await new DeferredModel({
				userId,
				groupId,
				settings,
				message,
				chatId
			}).save({ session })
		})
		const { id: postId } = postDoc
		logger.info(`Deferred created, postId: ${postId}`)
		return postDoc
	}
}
