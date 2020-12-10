const { createLogger } = require('../logger')
const BaseApi = require('./base')
const LoginApi = require('./auth')
const ConfigApi = require('./config')
const SubscribeApi = require('./subscribe')

class Api extends BaseApi {
    static create (socket, app) {
        return new Api(socket, app)
    }

    init () {
        this.extends(LoginApi)
        this.extends(ConfigApi)
        this.extends(SubscribeApi)
    }
}

module.exports = Api
