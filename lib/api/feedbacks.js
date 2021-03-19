const { createLogger } = require('../logger')
const BaseApi = require('./base')
const permissions = require('../../permissions')
const env = require('../env')

class FeedbacksApi extends BaseApi {
    init () {
        this.setLogger('feedback')

        this.bindAuth('feedbacks.count.get', this.getCount, 'feeds')
        this.bindAuth('feedbacks.data.get', this.getFeedbacks, 'feeds')
        this.bindAuth('feedbacks.message.get', this.getMessage, 'feeds')
        this.bindAuth('feedbacks.extra.get', this.getMessageExtra, 'feeds')
    }

    async getMessageExtra (id) {
        try {
            let [feedback] = await this.sql`SELECT * FROM feedbacks WHERE id=${id}`
            
            let [feedbacks, meters] = await Promise.all([
                this.sql`SELECT id, body, created_at FROM feedbacks WHERE ls=${feedback.ls} ORDER BY created_at DESC`,
                this.sql`SELECT * FROM meters WHERE ls=${feedback.ls} ORDER BY service`
            ])

            this.socket.emit('feedbacks.extra', 'feedbacks', feedbacks)
            this.socket.emit('feedbacks.extra', 'meters', meters)
        } catch (e) {
            this.log.error(e)
            this.emitError('Ошибка получения extra отзыва.')
        }
    }

    async getMessage (id) {
        try {
            let [res] = await this.sql`SELECT f.id, f.ls, f.body, f.read, f.created_at, CONCAT(s.type, '. ', s.name, ', д. ', CONCAT_WS('/', b.number, NULLIF(b.housing, '')), ', кв. ', CONCAT_WS('/', a.number, NULLIF(a.part, ''))) as address
            FROM feedbacks AS f
            LEFT JOIN apartments AS a ON a.ls=f.ls
            LEFT JOIN buildings AS b ON b.id=a.building_id
            LEFT JOIN streets AS s on s.id=b.street_id
            WHERE f.id=${id}
            ORDER BY f.created_at DESC`
            await this.sql`UPDATE feedbacks SET read=${this.socket.user.id} WHERE id=${id}`
            await this.getCount()
            this.emitEvent('event.feedbacks-updated')
            this.socket.emit('feedbacks.message', res)
        } catch (e) {
            this.log.error(e)
            this.emitError('Ошибка получения отзыва.')
        }
    }

    async getCount () {
        try {
            let [res] = await this.sql`SELECT COUNT(*) FROM feedbacks WHERE read IS NULL`
            this.socket.emit('feedbacks.count', res.count)
        } catch (e) {
            this.log.error(e)
        }
    }

    async getFeedbacks (params) {
        try {
            const [[total], data] = await Promise.all([
                this.sql`SELECT COUNT(*) FROM feedbacks`,
                this.sql`SELECT f.id, f.ls, CASE WHEN LENGTH(f.body)>40 THEN left(f.body, 40)||'...' ELSE f.body END as body, f.read, f.created_at, CONCAT(s.type, '. ', s.name, ', д. ', CONCAT_WS('/', b.number, NULLIF(b.housing, '')), ', кв. ', CONCAT_WS('/', a.number, NULLIF(a.part, ''))) as address
                FROM feedbacks AS f
                LEFT JOIN apartments AS a ON a.ls=f.ls
                LEFT JOIN buildings AS b ON b.id=a.building_id
                LEFT JOIN streets AS s on s.id=b.street_id
                ORDER BY f.created_at DESC
                LIMIT ${params.pageSize} OFFSET ${(params.page-1)*params.pageSize}
                `
            ])


            this.socket.emit('feedbacks.data', {
                data,
                page: params.page,
                pageSize: params.pageSize,
                total: total.count
            })
        } catch (e) {
            this.log.error(e)
            this.emitError('Ошибка получения отзывов.')
        }
    }
}

module.exports = FeedbacksApi
