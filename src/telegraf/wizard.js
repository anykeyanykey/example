const { WizardScene } = require('telegraf/lib/scenes/wizard/index')

class Wizard extends WizardScene {
	constructor(id, options, scenes) {
		super(id, options, ...scenes.reduce((result, scene) => {
			result.push(scene.enterHandler, scene.handler)
			return result
		}, []))
		this.scenes = scenes
		const go = function(ctx, scene, skip = false) {
			const { id } = this
			const { wizard: { state } } = ctx
			if (!state.__wizardPrevs) {
				state.__wizardPrevs = []
			}
			!skip && state.__wizardPrevs.push(id)
			const { id: nextId } = scene
			if (state.__wizardPrevs[state.__wizardPrevs.length - 1] === nextId) {
				state.__wizardPrevs.pop()
			}
			return scene.enterMiddleware()(ctx)
		}
		const reenter = function(ctx) {
			return this.enterMiddleware()(ctx)
		}
		this.scenes.forEach((scene) => {
			scene.go = go
			scene.reenter = reenter
		})
		this.on('callback_query', async (ctx, next) => {
			const { update: { callback_query: { data } } } = ctx
			if (data === 'back') {
				return this.goBack(ctx)
			}
			return next()
		})
	}

	getCurrentScene(ctx) {
		const { wizard: { cursor } } = ctx
		return this.scenes[Math.floor(cursor / 2)]
	}

	async goBack(ctx, scene = { }) {
		const { wizard: { state: { __wizardPrevs = [] } } } = ctx
		const last = __wizardPrevs[__wizardPrevs.length - 1]
		const sceneId = scene.id !== void 0 ? scene.id : last
		if (sceneId === void 0) {
			return
		}
		const leaveScenes = __wizardPrevs.splice(__wizardPrevs.indexOf(sceneId)).reverse()
		await this.getCurrentScene(ctx).leaveMiddleware()(ctx, () => Promise.resolve());
		for (let i = 0; i < leaveScenes.length - 1; i++) {
			const scene = this.scenes.find(({ id }) => id === leaveScenes[i])
			await scene.leaveMiddleware()(ctx, () => Promise.resolve());
		}
		return this.scenes.find(({ id }) => id === sceneId).enterMiddleware()(ctx)
	}

	goToHandler(ctx, scene) {
		const index = this.scenes.indexOf(scene)
		ctx.wizard.selectStep(index * 2 + 1)
	}
}

module.exports = Wizard
