const mongoose = require('mongoose')
const { deferredSettings } = require('./schemas')

module.exports = mongoose.model('DeferredSettings', deferredSettings)
