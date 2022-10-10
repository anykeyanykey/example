const mongoose = require('mongoose')
const { postSettings } = require('./schemas')

module.exports = mongoose.model('PostSettings', postSettings)
