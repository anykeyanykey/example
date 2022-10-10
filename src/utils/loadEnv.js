const path = require('path')
const dotenv = require('dotenv')
const dotenvExpand = require('dotenv-expand')

const loadEnv = mode => {
	const basePath = path.resolve(__dirname, '../../', `.env${mode ? `.${mode}` : ''}`)
	const localPath = `${basePath}.local`

	const load = envPath => {
		try {
			const env = dotenv.config({ path: envPath })
			dotenvExpand(env)
		}
		catch (err) {
			// Ignore error if file is not found
		}
	}

	load(localPath)
	load(basePath)
}

const loadEnvs = (mode = process.env.NODE_ENV) => {
	if (mode) {
		loadEnv(mode)
	}
	// Load base .env
	loadEnv()
}

module.exports = loadEnvs
