const { createLogger } = require('../logger')
const BaseApi = require('./base')
const permissions = require('../../permissions')
const env = require('../env')

class DashboardApi extends BaseApi {
    init () {
        this.setLogger('dashboard')

    }


}

module.exports = DashboardApi
