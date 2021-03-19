const { createLogger } = require('../logger')
const BaseApi = require('./base')
const permissions = require('../../permissions')
const env = require('../env')

class DashboardApi extends BaseApi {
    init () {
        this.setLogger('dashboard')
        this.bindAuth('dashboard.chart.get', this.getChart, 'dashboard')
        this.bindAuth('dashboard.stat.get', this.getStat, 'dashboard')
    }

    async getStat (res) {
        let [[mobile], [all], [devices]] = await Promise.all([
            this.sql`SELECT COUNT(DISTINCT ls) AS count FROM meters WHERE src=-1`,
            this.sql`SELECT COUNT(DISTINCT ls) AS count FROM meters WHERE new_value IS NOT NULL`,
            this.sql`select count(info->'deviceName') as count from devices;`
        ])
        res({
            date: (new Date()).toTimeString(), 
            mobile: mobile.count,
            all: all.count,
            devices: devices.count,
        })
    }

    async getChart (res) {
        let data = await this.sql`
            SELECT p.id, p.month, p.year, COUNT(DISTINCT mh.ls)
            FROM periods AS p, meters_history AS mh 
            WHERE mh.period_id=p.id AND mh.new_value IS NOT NULL
            GROUP BY p.id, p.month, p.year
            UNION
            SELECT p.id, p.month, p.year, COUNT(DISTINCT m.ls)
            FROM periods AS p, meters AS m
            WHERE m.period_id=p.id AND m.new_value IS NOT NULL
            GROUP BY p.id, p.month, p.year
            ORDER BY year DESC, month DESC
            LIMIT 15
        `
        data = data.reverse().map(x=>{
            return {
                label: `${this.getMonthByNum(x.month)} ${x.year}`,
                value: x.count
            }
        })
        res({
            date: (new Date()).toTimeString(),
            data
        })
    }

}

module.exports = DashboardApi
