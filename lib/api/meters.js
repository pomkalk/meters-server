const { createLogger } = require('../logger')
const BaseApi = require('./base')
const permissions = require('../../permissions')
const env = require('../env')

class MetersApi extends BaseApi {
    init () {
        this.setLogger('meters')

        this.bindAuth('meters.find.ls', this.findByLS, 'meters')
        this.bindAuth('meters.find.address', this.findByAddress, 'meters')
        this.bindAuth('meters.get', this.getMeters, 'meters')
        this.bindAuth('meters.update', this.update, 'meters')
        
    }

    async update (req, res) {
        try {
            let user_id = this.socket.user.id
            if (user_id === null) throw new Error('NOT USER ID')
            let [data] = await this.sql`
                UPDATE meters SET new_value=${req.value}, new_date=NOW(), src=${user_id} WHERE id=${req.meter_id} RETURNING *
            `
            res(data)
        } catch (e) {
            this.log.error(e)
            this.emitError('xxx1')
        }
    }

    async getMeters (ls, res) {
        let [period] = await this.sql`SELECT p.id, p.month, p.year, p.p_start, p.p_end from periods AS p WHERE p.id = (SELECT vali FROM config AS c WHERE c.key='current')`
        let data = {period: { month: period.month, year: period.year}}
        let [[address], meters] = await Promise.all([
            this.sql`SELECT a.id, CONCAT(s.type, '. ', s.name, ', д. ', CONCAT_WS('/', b.number, NULLIF(b.housing, '')), ', кв. ', CONCAT_WS('/', a.number, NULLIF(a.part, ''))) as address 
            FROM apartments AS a
            LEFT JOIN buildings AS b ON b.id=a.building_id
            LEFT JOIN streets as s ON s.id=b.street_id
            WHERE a.ls=${ls}`,
            this.sql`SELECT m.id, m.service, m.status, m.last_month, m.last_year, m.last_value, m. new_value, m.new_date, m.src, u.name as user
            FROM meters as m
            LEFT JOIN users AS u ON u.id=m.src
            WHERE m.ls=${ls} AND period_id=${period.id}
            ORDER BY m.service, m.mid`
        ])
        data.address = address.address
        data.meters = meters
        res(data)
    }

    async findByLS (ls, res) {
        try {
            let data = await this.sql`
                SELECT a.ls::varchar as value, full_address(s.type, s.name, b.number, b.housing, a.number, a.part) as label
                FROM apartments AS a
                LEFT JOIN buildings AS b ON b.id=a.building_id
                LEFT JOIN streets AS s ON s.id=b.street_id
                WHERE a.ls=${ls}
            `
            res(data)
        } catch (e) {
            this.log.error(e)
            this.emitError('xxx1')
        }
    }

    async getData (query) {
        if (query === null) return null

        if (query.apartment) {
            return await this.sql`
                SELECT a.ls::varchar as value, concat(s.type, '. ', s.name, ', д. ', concat_ws('/', b.number, nullif(b.housing, '')), ', кв. ', concat_ws('/', a.number, nullif(a.part, ''))) as label
                FROM streets as s, buildings as b, apartments as a
                WHERE b.street_id=s.id AND a.building_id=b.id
                AND concat(s.type, '. ', s.name) ilike ${'%'+query.street.split(' ').join('%')+'%'}
                AND b.number::varchar(5) like ${query.building.number + '%'}
                AND b.housing ilike ${query.building.housing + '%'}
                AND a.number::varchar(5) like ${query.apartment.number + '%'}
                AND a.part like ${query.apartment.housing + '%'}
                ORDER BY s.name, b.number, b.housing, a.number, a.part
            `
        }

        if (query.building) {
            return await this.sql`
                SELECT a.ls::varchar as value, concat(s.type, '. ', s.name, ', д. ', concat_ws('/', b.number, nullif(b.housing, '')), ', кв. ', concat_ws('/', a.number, nullif(a.part, ''))) as label
                FROM streets as s, buildings as b, apartments as a
                WHERE b.street_id=s.id AND a.building_id=b.id
                AND concat(s.type, '. ', s.name) ilike ${'%'+query.street.split(' ').join('%')+'%'}
                AND b.number::varchar(5) like ${query.building.number + '%'}
                AND b.housing ilike ${query.building.housing + '%'}
                ORDER BY s.name, b.number, b.housing, a.number, a.part
                LIMIT 100
            `
        }

        if (query.street) {
            return await this.sql`
                SELECT a.ls::varchar as value, concat(s.type, '. ', s.name, ', д. ', concat_ws('/', b.number, nullif(b.housing, '')), ', кв. ', concat_ws('/', a.number, nullif(a.part, ''))) as label
                FROM streets as s, buildings as b, apartments as a
                WHERE b.street_id=s.id AND a.building_id=b.id
                AND concat(s.type, '. ', s.name) ilike ${ `%${ query.street.split(' ').join('%') }%` }
                ORDER BY s.name, b.number, b.housing, a.number, a.part
                LIMIT 50
            `
        }

        return null
    }

    async findByAddress (query, res) {
        try {
            const data = await this.getData(query)
            res(data)
        } catch (e) {
            this.log.error(e)
            this.emitError('xxx2')
        }
    }
}

module.exports = MetersApi
