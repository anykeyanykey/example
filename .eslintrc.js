module.exports = {
	env: {
		node: true,
		commonjs: true,
		es2021: true
	},
	extends: [
		'eslint:recommended'
	],
	parserOptions: {
		ecmaVersion: 12
	},
	rules: {
		'no-unsafe-finally': 'off',
		'no-case-declarations': 'off',
		'object-curly-spacing': ['error', 'always'],
		'indent': ['error', 'tab']
	}
}
