const loadEnvs = require('./src/utils/loadEnv')

loadEnvs()
const { isEqual } = require('lodash')
const moment = require('moment-timezone')
moment.locale('ru');
moment.tz.setDefault("Europe/Moscow")
require('./src/utils/moment')(moment)

const { SCENE_ID_DEFERRED, SCENE_ID_MENU, SCENE_ID_POSTS, SCENE_ID_GROUP_ITEM, SCENE_ID_REPOST, SCENE_ID_POST_SETTINGS, SCENE_ID_USER, SCENE_ID_HISTORY } = require("./src/const/scenes");

const Context = require('telegraf/lib/scenes/context').default

Context.prototype._back = function (ctx) {
	const { session: { __prevs = [] } } = ctx
	const { scene, leaveState } = __prevs.pop() || {}
	return scene ? ctx.scene.enter(scene, leaveState) : null
}

Context.prototype._menu = function (ctx) {
	const { session: { __prevs = [] } } = ctx
	__prevs.length = 0
	return ctx.scene.enter(SCENE_ID_MENU)
}

Context.prototype._enter = function (scene, enterState = {}) {
	const { ctx: { session, scene: { current, state } } } = this
	if (!session.__prevs) {
		session.__prevs = []
	}
	const currentId = current && current.id
	if (currentId && (currentId !== scene || !isEqual(state, enterState))) {
		let leaveState = {}
		switch (currentId) {
		case SCENE_ID_POSTS:
			leaveState = {
				skip: state['skip'],
				isReposts: state['isReposts'],
				byRepostId: state['byRepostId'],
				byPostId: state['byPostId'],
				byGroup: state['byGroup'],
				byPost: state['byPost']
			}
			break
		case SCENE_ID_GROUP_ITEM:
			leaveState = {
				groupId: state['groupId']
			}
			break
		case SCENE_ID_HISTORY:
			leaveState = {
				skip: state['skip']
			}
			break
		case SCENE_ID_REPOST:
		case SCENE_ID_POST_SETTINGS:
			leaveState = {
				post: state['post'],
				isDefault: state['isDefault']
			}
			break
		case SCENE_ID_USER:
			leaveState = {
				user: state['user']
			}
			break
		case SCENE_ID_DEFERRED:
			leaveState = {
				groupId: state['groupId']
			}
			break
		}
		session.__prevs.push({
			scene: currentId,
			leaveState
		})
	}
	if (session.__prevs.length > 3) {
		session.__prevs.shift()
	}
	return this.enter(scene, enterState)
}

Array.prototype.toChunks = function (perChunk) {
	return this.reduce((resultArray, item, index) => {
		const chunkIndex = Math.floor(index / perChunk)
		if (!resultArray[chunkIndex]) {
			resultArray[chunkIndex] = []
		}
		resultArray[chunkIndex].push(item)
		return resultArray
	}, [])
}

const { main } = require('./src/main')

;(async () => {

	await main.start()

	process.on('message', async (msg) => {
		if (msg === 'shutdown') {
			await main.stop()
			process.exit(0)
		}
	})
})()
