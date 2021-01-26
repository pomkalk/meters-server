const { createLogger } = require('../logger')
const BaseApi = require('./base')
const permissions = require('../../permissions')
const env = require('../env')

class NewsApi extends BaseApi {
    init () {
        this.setLogger('news')

        this.bindAuth('news.get', this.getNews, 'news')
    }

    async getNews () {
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


}

module.exports = NewsApi
