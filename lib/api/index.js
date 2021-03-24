const { createLogger } = require('../logger')
const BaseApi = require('./base')
const LoginApi = require('./auth')
const ConfigApi = require('./config')
const SubscribeApi = require('./subscribe')
const DatabaseApi = require('./databese')
const DashboardApi = require('./dashboard')
const FeedbacksApi = require('./feedbacks')
const NewsApi = require('./news')
const MetersApi = require('./meters')

class Api extends BaseApi {
    static create (socket, app) {
        return new Api(socket, app)
    }

    init () {
        this.log = this.setLogger('app')
        this.extends(LoginApi)
        this.extends(ConfigApi)
        this.extends(SubscribeApi)
        this.extends(DatabaseApi)
        this.extends(DashboardApi)
        this.extends(FeedbacksApi)
        this.extends(NewsApi)
        this.extends(MetersApi)
    }
}

module.exports = Api
