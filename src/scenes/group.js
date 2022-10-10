const { TelegramError } = require("telegraf/lib/core/network/error");
const Wizard = require("../telegraf/wizard");
const { RPCError } = require("telegram/errors/RPCBaseErrors")
const { BaseScene } = require('telegraf/lib/scenes/base')
const { scenes: { SCENE_ID_GROUP }, TG_BOT_USERNAME } = require('../const')
const { lang, scene: { enterHandler } } = require('../utils')
const { backMarkup } = require('./../markups')

const mediaGroups = { }

const welcomeRequest = async (ctx) => {
	const { main } = ctx
	await main.replyWithMarkdownUpdate(ctx, [lang('welcomeGroup', TG_BOT_USERNAME), backMarkup(ctx)])
}

const listenRequest = async (ctx) => {
	const { main, from: { id: ownerId }, message: { forward_from_chat, media_group_id } = { } } = ctx
	if (!forward_from_chat) {
		return main.replyNotify(ctx, [lang('sendFromChannel')])
	}
	if (media_group_id) {
		if (mediaGroups[media_group_id]) {
			return
		} else {
			mediaGroups[media_group_id] = true
		}
	}
	const { id: groupId } = forward_from_chat
	try {
		const chat = await main.getGroupInfoClient(groupId)
		const error = main.validateGroupInfoClient(chat)
		if (error) {
			return main.replyNotify(ctx, [error])
		}
		const groupInfo = await main.getGroupInfo(groupId)
		main.validateGroupInfo(groupInfo)
		const groupDoc = await main.createGroup(ownerId, groupInfo)
		main.deleteLastMessages(ctx, true)
		return main.replyWithMarkdown(ctx, [lang('channelAdded', groupDoc.channelTitleLink()), backMarkup(ctx)])
	} catch (e) {
		if (e instanceof RPCError) {
			const { code } = e
			if (code === 400) {
				return main.replyNotify(ctx, [lang('botIsNotAMember')])
			}
		} else if (e instanceof TelegramError) {
			const { response } = e
			if (response) {
				const { error_code } = response
				if (error_code === 403) {
					return main.replyNotify(ctx, [lang('botIsNotAMember')])
				}
			}
		}
		throw e
	}
}

const scene0 = new BaseScene(0)
	.enter(async (ctx) => {
		await welcomeRequest(ctx)
		return groupWizard.goToHandler(ctx, scene0)
	})
	.use(listenRequest)

const groupWizard = new Wizard(
	SCENE_ID_GROUP,
	{
		enterHandlers: [enterHandler()]
	},
	[scene0]
)

module.exports = groupWizard
