module.exports = {
	enterHandler(hasPost = false) {
		return (ctx, next) => {
			const { main } = ctx
			const _hasHost = typeof hasPost === 'function' ? hasPost(ctx) : hasPost
			if (!_hasHost) {
				main.deleteHoldMessages(ctx)
			}
			return next()
		}
	}
}
