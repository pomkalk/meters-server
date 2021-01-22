const BaseApi = require('./base')
const permissions = require('../../permissions')
const env = require('../env')
const parsedbf = require('parsedbf')
const fs = require('fs')

class DatabaseApi extends BaseApi {
    init () {
        this.setLogger('database')
        this.uploading = false
        this.status = null

        this.bindAuth('database.periods.get', this.getPeriods, 'import')
        this.bindAuth('database.period.delete', this.deletePeriod, 'import.d')
        this.bindAuth('database.periods.move', this.moveData, 'import.m')
        this.bindAuth('database.status.get', this.getStatus, 'import')
        this.bindAuth('database.config.get', this.getConfig, 'import.i')
        this.bindAuth('database.import.start', this.startImport, 'import.i')
        this.bindAuth('database.download', this.download, 'import.r')
    }

    async moveData (req) {
        
    }

    async download(req, res) {
        try {
            let [period] = await this.sql`SELECT * FROM periods
            WHERE deleted_at IS NULL
            ORDER BY year desc, month desc
            LIMIT 1`
            let data = null
            if (period.id===req.period_id) {
                data = await this.sql`SELECT m.id, m.ls, m.mid, CONCAT(s.type, '. ', s.name, ', д. ', 
                CONCAT_WS('/', b.number, NULLIF(b.housing, '')), ', кв. ', CONCAT_WS('/', a.number, NULLIF(a.part, ''))) as address, 
                m.service AS service_code, m.period_id, m.new_date as date, m.new_value as value, m.src, COALESCE(u.username, '') as username, COALESCE(sp.title, 'site') as supplier
                FROM meters AS m
                LEFT JOIN apartments AS a ON a.ls=m.ls
                LEFT JOIN buildings AS b ON b.id=a.building_id
                LEFT JOIN streets AS s ON s.id=b.street_id
                LEFT JOIN users AS u ON u.id=m.src
                LEFT JOIN suppliers AS sp ON sp.id=u.supplier_id
                WHERE m.period_id=${req.period_id} AND m.new_value IS NOT NULL
                ORDER BY s.name, s.type, b.number, b.housing, a.number, a.part, m.ls, m.service`
            } else {
                data = await this.sql`SELECT m.id, m.ls, m.mid, CONCAT(s.type, '. ', s.name, ', д. ', 
                CONCAT_WS('/', b.number, NULLIF(b.housing, '')), ', кв. ', CONCAT_WS('/', a.number, NULLIF(a.part, ''))) as address, 
                m.service AS service_code, m.period_id, m.new_date as date, m.new_value as value, m.src, COALESCE(u.username, '') as username, COALESCE(sp.title, 'site') as supplier
                FROM meters_history AS m
                LEFT JOIN apartments AS a ON a.ls=m.ls
                LEFT JOIN buildings AS b ON b.id=a.building_id
                LEFT JOIN streets AS s ON s.id=b.street_id
                LEFT JOIN users AS u ON u.id=m.src
                LEFT JOIN suppliers AS sp ON sp.id=u.supplier_id
                WHERE m.period_id=${req.period_id} AND m.new_value IS NOT NULL
                ORDER BY s.name, s.type, b.number, b.housing, a.number, a.part, m.ls, m.service`
            }
            
            if (data.length === 0) {
                this.socket.emit('msg', {type: 'info', message: 'Нет данных для скачивания'})
                return res(null)
            }
            let a = data.reduce((t, v) => {
                let s = [v.ls, v.mid, v.username, v.supplier, v.address, v.service_code, this.getServiceName(v.service_code), this.parseDate(v.date), v.value]
                return `${t}\n${s.join(';')}`
            }, 'ls;mid;user;src;address;service_code;service_name;date;value')
            res(`${req.name}.csv`, a)
        } catch (e) {
            this.log.error('download data error', e)
            this.emitError('Ошибка при формировании данных для скачивания')
            res(null)
        }
    }

    async deletePeriod (period_id) {
        try {
            if (this.uploading) {
                return this.socket.emit('msg', {type: 'warn', message: 'Невозможно удалить период, пока идет импорт'})
            }
            let [[last], [current]] = await Promise.all([
                this.sql`SELECT month, year FROM periods WHERE deleted_at IS NULL ORDER BY year DESC, month DESC LIMIT 1`,
                this.sql`SELECT month, year FROM periods WHERE deleted_at IS NULL AND id=${period_id} ORDER BY year DESC, month DESC LIMIT 1`
            ])
            if (last.month===current.month&&last.year===current.year) {
                await this.sql.begin(async sql=> {
                    await sql`UPDATE periods SET deleted_at=NOW() WHERE id=${period_id}`
                    let [period] = await sql`SELECT * FROM periods
                    WHERE deleted_at IS NULL
                    ORDER BY year desc, month desc
                    LIMIT 1`
                    await sql`UPDATE config SET vali=${period.id} WHERE key='current'`

                    await sql`INSERT INTO meters_history SELECT * FROM meters`
                    await sql`DELETE FROM meters`
                    await sql`INSERT INTO meters SELECT * FROM meters_history WHERE period_id=${period.id}`
                })
                
                this.emitEvent('event.periods-updated')
                this.socket.emit('msg', {type: 'success', message: 'Период удален'})
            } else {
                this.emitError('Удалить можно только последний месяц')
            }
        } catch (e) {
            this.log.error('delete period error', e)
            this.emitError('Ошибка при удалении периода')
        }
    }

    setStatus (status) {
        this.status = status
        this.io.to('event.database-importing').emit('database.status', this.status)
    }

    async startImport (data) {
        try {
            this.uploading = true
            this.setStatus('Start import')
            await this.sql.begin(async sql => {
                let addr = parsedbf(fs.readFileSync(data.files.addr), 'cp866')
                let sc = parsedbf(fs.readFileSync(data.files.sc), 'cp866')

                let dbsuppliers = await sql`select * from suppliers`
                let suppliers = new Set()
                addr.forEach(x => {
                    suppliers.add(x.ORG)
                })
                suppliers = [...suppliers].reduce((t, v) => {
                    let s = dbsuppliers.find(x=>x.name===v)
                    if (s) {
                        return t
                    }
                    return { name: v, title: v }
                }, [])
                if (suppliers.length > 0) {
                    suppliers = await sql`INSERT INTO suppliers ${ sql(suppliers) } RETURNING *`
                    suppliers.forEach(x=> {
                        this.log.info('Supplier created:', x.id, x.name)
                        
                    })
                }
                suppliers = await sql`select * from suppliers`
                this.setStatus('Suppliers imported')


                let dbstreets = await sql`select * from streets`
                let streets = addr.reduce((t, v) => {
                    let x = {type: v.VID, name: v.NAM}
                    let f = t.find(i => {
                        return i.type===x.type&&i.name===x.name
                    })
                    if (f) {
                        return t
                    } else {
                        return [...t, x]
                    }
                }, [])
            
                streets = streets.reduce((t, v) => {
                    let a = dbstreets.findIndex(x => {
                        return x.type===v.type&&x.name===v.name
                    })
            
                    if (a >=0 ) {
                        return t
                    }
                    return [...t, v]
                }, [])
                if (streets.length > 0) {
                    streets = await sql`INSERT INTO streets ${ sql(streets) } RETURNING *`
                    streets.forEach(x => {
                        this.log.info(`Streets added: ${x.type}. ${x.name}`)
                    })
                }
                streets = await sql`SELECT * FROM streets`
                this.setStatus('Streets imported')


                let dbbuildings = await sql`select * from buildings`
                let buildings = streets.reduce((t, v) => {
                    let x = addr.reduce((tt, vv) => {
                        if (v.type === vv.VID) {
                            if (v.name === vv.NAM) {
                                let f = tt.find(xx => {
                                    return xx.street_id===v.id&&xx.number===vv.DOM&&xx.housing===vv.KRP
                                })  
                                if (f) {
                                    return tt
                                }
                                return [...tt, {
                                    street_id: v.id,
                                    number: vv.DOM,
                                    housing: vv.KRP
                                }]
                            }
                        } 
                        return tt
                    }, [])
                    return [...t, ...x]
                }, [])
            
                buildings = buildings.reduce((t, v) => {
                    let a = dbbuildings.findIndex(x => {
                        return x.street_id===v.street_id&&x.number===v.number&&x.housing===v.housing
                    })
                    if (a>=0) {
                        return t
                    }
                    return [...t, v]
                }, [])
                if (buildings.length > 0) {
                    buildings = (await sql`INSERT INTO buildings ${ sql(buildings) } RETURNING *`).map(x => x.id)
                    buildings = await sql`select s.type, s.name, b.number, b.housing
                    FROM buildings as b
                    LEFT JOIN streets as s ON b.street_id=s.id WHERE b.id IN (${ sql(buildings) }) ORDER BY s.name, s.type, b.number, b.housing`
                    buildings.forEach(x => {
                        this.log.info(`Building added: ${x.type}. ${x.name}, д. ${x.number}${x.housing.length>0?'/'+x.housing:''}`)
                    })
                }
                this.setStatus('Buildings imported')

                buildings = await sql`SELECT b.id as bid, s.type, s.name, b.number, b.housing 
                FROM streets as s, buildings as b
                WHERE s.id=b.street_id
                ORDER BY s.name, s.type, b.number, b.housing`
                let apartments = await sql`SELECT a.ls, a.name, a.phone, a.space, a.live, sp.id as spid, sp.name as spname
                FROM apartments as a
                LEFT JOIN suppliers as sp ON a.supplier_id=sp.id`
        
                let updates = addr.reduce((t, v) => {
                    let ls = apartments.find(x => x.ls===v.CK)
                    if (ls) {
                        let lsupdate = []
                        if (ls.name !== `${v.XF} ${v.XI} ${v.XO}`.trim()) {
                            lsupdate = [...lsupdate, { ls: ls.ls, field: 'name', from: ls.name, to: `${v.XF} ${v.XI} ${v.XO}`.trim()}]
                        }
                        if (ls.phone !== v.TLF) {
                            lsupdate = [...lsupdate, { ls: ls.ls, field: 'phone', from: ls.phone, to: v.TLF}]
                        }
                        if (ls.space !== v.OP) {
                            lsupdate = [...lsupdate, { ls: ls.ls, field: 'space', from: ls.space, to: v.OP}]
                        }
                        if (ls.live !== v.JL) {
                            lsupdate = [...lsupdate, { ls: ls.ls, field: 'live', from: ls.live, to: v.JL}]
                        }
                        if (ls.spname !== v.ORG) {
                            lsupdate = [...lsupdate, { ls: ls.ls, field: 'supplier_id', from: ls.spid, to: this.getSupplierId(suppliers, v.ORG)}]
                        }
                        return { ...t, update: [...t.update, ...lsupdate]}
                    } else {
                        if (v.ORG.length > 0) {
                            let b = buildings.find(x=>x.type===v.VID&&x.name===v.NAM&&x.number===v.DOM&&x.housing===v.KRP)
                            return { ...t, insert: [...t.insert, {
                                ls: v.CK,
                                name: `${v.XF} ${v.XI} ${v.XO}`.trim(),
                                phone: v.TLF,
                                building_id: b.bid,
                                number: v.KVR,
                                part: v.SKV,
                                space: v.OP,
                                porch: v.PORCH,
                                live: v.JL,
                                supplier_id: this.getSupplierId(suppliers, v.ORG)
                            }]}
                        } else {
                            this.log.warn('BAD IMPORT LS', v)
                        }
                    }
                    return t
                }, {update: [], insert: []})
                
                let chunkSize = 1000
                let m = Math.ceil(updates.insert.length/chunkSize)
                
                for (let i=0;i<m;i++) {
                    let chunk = updates.insert.splice(0, chunkSize)
                    await sql`INSERT INTO apartments ${ sql(chunk) }`
                    chunk.forEach(x => {
                        this.log.info(`ls importder: ${x.ls}`)
                    })
                }
        
                for (let x of updates.update) {
                    let a = {
                        [x.field]: x.to
                    }
                    await sql`UPDATE apartments SET ${ sql(a) } WHERE ls=${x.ls}`
                    this.log.info(`Apartment updated ${x.ls}: ${x.field} from ${x.from} -> ${x.to}`)
                }
        
                let [period] = await sql`INSERT INTO periods ${ sql(this.getPeriod(data.period.month, data.period.year)) } RETURNING *`
                let meters = sc.map(x => {
                    return {
                        period_id: period.id,
                        src: null,
                        ls: x.CK,
                        mid: x.ID,
                        service: this.getServiceType(x.USL),
                        status: x.STATUS,
                        last_month: x.DTM,
                        last_year: x.DTY,
                        last_value: x.VAL,
                        new_value: null,
                        new_date: null
                    }
                })

                await sql`INSERT INTO meters_history SELECT * FROM meters`
                await sql`DELETE FROM meters`

                m = Math.ceil(meters.length/chunkSize)
                for (let i=0;i<m;i++) {
                    await sql`INSERT INTO meters ${ sql(meters.splice(0, chunkSize)) }`
                }
                this.log.info(`Meters data updated`)

                await sql`UPDATE config SET vali=${period.id} WHERE key='current'`
            })
            this.setStatus(null)
            this.uploading = false
            this.socket.emit('msg', { type: 'success', message: `Импорт периода ${data.period.month}-${data.period.year} завершен.`})
            this.emitEvent('event.periods-updated')
        } catch (e) {
            this.log.error('get import config error', e)
            this.emitError('Ошибка импорта')
            this.uploading = false
            this.setStatus(null)
        } finally {
            this.uploading = false
            this.setStatus(null)
        }
    }

    getPeriod (m, y) {
        return {
            month: m,
            year: y,
            p_start: new Date(y, m-1, 17, 8, 0),
            p_end: new Date(y, m-1, 25, 23, 59)
        }
    }

    getServiceType (name) {
        let types = ['Холодная вода', 'Горячая вода', 'Электроэнергия', 'Отопление']
        return types.findIndex(x => x===name)+1
    }

    getServiceName (i) {
        let types = ['Холодная вода', 'Горячая вода', 'Электроэнергия', 'Отопление']
        return types[i-1]
    }

    getSupplierId (s, name) {
        let a = s.find(x => {
            return x.name === name
        })
        if (!a) return new Error(`NO SPUPPLIER, ${name}`)
        return a.id
    }

    async getConfig () {
        try {
            let [[last], [interval]] = await Promise.all([
                this.sql`SELECT month, year FROM periods WHERE deleted_at IS NULL ORDER BY year DESC, month DESC LIMIT 1`,
                this.sql`SELECT key, valt AS val FROM config WHERE key='meters_period'`
            ])
            let next = {
                month: last.month+1>=13?1:last.month+1,
                year: last.month+1>=13?last.year+1:last.year
            }
            this.socket.emit('database.config', {
                period: next,
                interval: this.getMetersPeriods(interval.val.split(','), next.month, next.year)
            })
        } catch (e) {
            this.log.error('get import config error', e)
            this.emitError('Ошибка получения конфигурации для импорта')
        }
    }

    getMetersPeriods (i, m, y) {
        let sd = parseInt(i[0])
        let st = i[1].split(':').map(x=>parseInt(x))
        let ed = parseInt(i[2])
        let et = i[3].split(':').map(x=>parseInt(x))
        return [ new Date(y, m-1, sd, st[0], st[1]), new Date(y, m-1, ed, et[0], et[1])]
    }

    async getStatus () {
        this.socket.emit('database.status', this.status)
    }

    async getPeriods (params) {
        try {
            if (this.uploading) {
                this.socket.emit('database.status', this.status)
            }
            let periods
            if (params.deleted) {
                periods = await this.sql`SELECT * FROM periods ORDER BY year DESC, month DESC, created_at DESC`
            } else {
                periods = await this.sql`SELECT * FROM periods WHERE deleted_at IS NULL ORDER BY year DESC, month DESC, created_at DESC`
            }
            if (periods.length>0) {
                let i = periods.findIndex(x => x.deleted_at===null)
                if (i>=0) {
                    periods[i].deletable = true
                }
            }
            this.socket.emit('database.periods', periods)
        } catch (e) {
            this.log.error(e)
            this.emitError('Ошибка при получании данных о периодах')
        }
        
    }
}

module.exports = DatabaseApi
