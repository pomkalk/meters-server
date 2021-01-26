const env = require('../lib/env')
const bcrypt = require('bcrypt')
const postgres = require('postgres')
const { createLogger } = require('../lib/logger')
const fs = require('fs')
const parseDbf = require('parsedbf')
const logger = createLogger('system')
const password = '$2b$10$mdn2xZLfZcaznJ8ZfPM/E.bo7LIhFOczZHaCRXFD2Qkikx9hpIMgi'
let sql = postgres(env.db)
const progress = require('progress')


const authenticateDb = async sql => {
    try {
        await sql`SELECT 1+1`
        return true
    } catch (e) {
        return false
    }
}

const root = {
    name: 'Администратор',
    username: 'pomkalk',
    password
}

const options = [
    {n: 1, key: 'site_on', valb: true },
    {n: 2, key: 'siteoff_msg', valt: 'На сайте ведутся технические работы.'},
    {n: 3, key: 'meters_period', valt: '17,08:00,25,23:59'},
    {n: 4, key: 'meters_msg', valt: 'Здравствуйте, ввод показаний доступен в период с 08:00 17 числа по 23:59 25 числа каждого месяца.'},
    {n: 5, key: 'meters_block', valt: 'Уточнить причину блокировки или приостановки счетчика вы можете по телефону в абонентском отделе ООО «УЕЗ ЖКУ г. Ленинска-Кузнецкого» - 49-2-49. Наиболее частая причина блокировки является истечение сроков поверки счетчиков.'},
    {n: 6, key: 'current', vali: null}
]

function getPeriod (m, y) {
    return {
        month: m,
        year: y,
        p_start: new Date(y, m-1, 17, 8, 0),
        p_end: new Date(y, m-1, 25, 23, 59)
    }
}

function getSupplierId (s, name) {
    let a = s.find(x => {
        return x.name === name
    })
    if (!a) return new Error(`NO SPUPPLIER, ${name}`)
    return a.id
}

function getServiceType (name) {
    let types = ['Холодная вода', 'Горячая вода', 'Электроэнергия', 'Отопление']
    return types.findIndex(x => x===name)+1
}

const loadDBF = (month, year) => {
    let addr = parseDbf(fs.readFileSync(`./import-data/${year}/${month}/S_ADDR.DBF`), 'cp866')
    let sc = parseDbf(fs.readFileSync(`./import-data/${year}/${month}/S_SC.DBF`), 'cp866')
    let values = null
    let valuestype = null
    if (fs.existsSync(`./import-data/${year}/${month}/data.csv`)) {
        valuestype = 1
        values = fs.readFileSync(`./import-data/${year}/${month}/data.csv`).toString().split('\r\n').reduce((t, x) => {
            if (x.length==0) return t
            return [...t, x.split(';')]
        }, [])
    }
    if (fs.existsSync(`./import-data/${year}/${month}/data2.csv`)) {
        valuestype = 2
        values = fs.readFileSync(`./import-data/${year}/${month}/data2.csv`).toString().split('\n').reduce((t, x) => {
            if (x.length==0) return t
            return [...t, x.split(';')]
        }, [])
    }
    return [addr, sc, values, valuestype]
}

const firstImport = async (month, year) => {
            
    if (!await authenticateDb(sql)) return console.log('Auth error')
    let [user] = await sql`INSERT INTO users ${ sql(root) } RETURNING *`
    logger.info('Root user created', {...user, password: '*****' })
    await sql`INSERT INTO config ${ sql(options.map(x => Object.assign({valt: null, valj: null, valb: null, vali: null}, x))) }`
    logger.info('Default site configuration created')
    let [addr, sc, newvalues] = loadDBF(month, year)
    
    let suppliers = new Set()
    addr.forEach(x => {
        suppliers.add(x.ORG)
    })
    suppliers = [...suppliers].map(x=>{
        return { name: x, title: x }
    })
    suppliers = await sql`INSERT INTO suppliers ${ sql(suppliers) } RETURNING *`
    logger.info('Suppliers imported')
    let [period] = await sql`INSERT INTO periods ${ sql(getPeriod(month, year)) } RETURNING *`
    logger.info('Period created', month, year)

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

    streets = await sql`INSERT INTO streets ${ sql(streets) } RETURNING *`
    logger.info('Streets imported')

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

    await sql`INSERT INTO buildings ${ sql(buildings) }`
    logger.info('Buildings imported')

    buildings = await sql`SELECT b.id as bid, s.type, s.name, b.number, b.housing 
    FROM streets as s, buildings as b
    WHERE s.id=b.street_id
    ORDER BY s.name, s.type, b.number, b.housing`

    let apartments = buildings.reduce((t, v) => {
        let x = addr.reduce((tt, vv) => {
            if (vv.VID === v.type) {
                if (vv.NAM === v.name) {
                    if (vv.DOM === v.number) {
                        if (vv.KRP === v.housing) {
                            if (vv.ORG.length > 0) {
                                return [...tt, {
                                    ls: vv.CK,
                                    name: `${vv.XF} ${vv.XI} ${vv.XO}`.trim(),
                                    phone: vv.TLF,
                                    building_id: v.bid,
                                    number: vv.KVR,
                                    part: vv.SKV,
                                    space: vv.OP,
                                    porch: vv.PORCH,
                                    live: vv.JL,
                                    supplier_id: getSupplierId(suppliers, vv.ORG)
                                }]
                            }
                        }
                    }
                }
            }

            return tt
        }, [])
        return [...t, ...x]
    }, [])

    let chunkSize = 1000
    let m = Math.ceil(apartments.length/chunkSize)
    
    for (let i=0;i<m;i++) {
        await sql`INSERT INTO apartments ${ sql(apartments.splice(0, chunkSize)) }`
    }
    logger.info('Apartments imported')
    
    let meters = sc.map(x => {
        return {
            period_id: period.id,
            src: null,
            ls: x.CK,
            mid: x.ID,
            service: getServiceType(x.USL),
            status: x.STATUS,
            last_month: x.DTM,
            last_year: x.DTY,
            last_value: x.VAL,
            new_value: null,
            new_date: null
        }
    })

    if (newvalues) {
        newvalues = newvalues.slice(1).map(x => {
            let d = x[9].split('.')
            return {
                ls: parseInt(x[7]),
                mid: parseInt(x[8]),
                new_date: new Date(parseInt(d[2]), parseInt(d[1])-1, parseInt(d[0])),
                new_value: parseFloat(x[10])
            }
        })

        newvalues.forEach(x => {
            let i = meters.findIndex(y => y.ls===x.ls&&y.mid===x.mid)
            if (i >=0 ) {
                meters[i].new_value = x.new_value
                meters[i].new_date = x.new_date
                meters[i].src = 0
            }
        })
    }

    m = Math.ceil(meters.length/chunkSize)
    for (let i=0;i<m;i++) {
        await sql`INSERT INTO meters ${ sql(meters.splice(0, chunkSize)) }`
    }
    logger.info('Meters imported')
    await sql`UPDATE config SET vali=${period.id} WHERE key='current'`
}



const updateDb = async (month, year) => {
    let q = await sql.begin(async sql => {
        let [addr, sc, newvalues, valuestype] = loadDBF(month, year)
        
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
                logger.info('Supplier created:', x.id, x.name)
            })
        }
        suppliers = await sql`select * from suppliers`

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
                return x.type===v.type&&x.name.toLowerCase()===v.name.toLowerCase()
            })
    
            if (a >= 0) {
                return t
            }
            return [...t, v]
        }, [])
        if (streets.length > 0) {
            streets = await sql`INSERT INTO streets ${ sql(streets) } RETURNING *`
            streets.forEach(x => {
                logger.info(`Streets added: ${x.type}. ${x.name}`)
            })
        }
        streets = await sql`SELECT * FROM streets`
    
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
                logger.info(`Building added: ${x.type}. ${x.name}, д. ${x.number}${x.housing.length>0?'/'+x.housing:''}`)
            })
        }

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
                    lsupdate = [...lsupdate, { ls: ls.ls, field: 'supplier_id', from: ls.spid, to: getSupplierId(suppliers, v.ORG)}]
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
                        supplier_id: getSupplierId(suppliers, v.ORG)
                    }]}
                } else {
                    logger.warn('BAD IMPORT LS', v)
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
                logger.info(`ls importder: ${x.ls}`)
            })
        }

        for (let x of updates.update) {
            let a = {
                [x.field]: x.to
            }
            await sql`UPDATE apartments SET ${ sql(a) } WHERE ls=${x.ls}`
            logger.info(`Apartment updated ${x.ls}: ${x.field} from ${x.from} -> ${x.to}`)
        }

        let [period] = await sql`INSERT INTO periods ${ sql(getPeriod(month, year)) } RETURNING *`
        let meters = sc.map(x => {
            return {
                period_id: period.id,
                src: null,
                ls: x.CK,
                mid: x.ID,
                service: getServiceType(x.USL),
                status: x.STATUS,
                last_month: x.DTM,
                last_year: x.DTY,
                last_value: x.VAL,
                new_value: null,
                new_date: null
            }
        })
    
        if (newvalues) {
            console.log("NEW VALUES")
            newvalues = newvalues.slice(1).map(x => {
                if (valuestype ===1 ) {
                    let d = x[9].split('.')
                    return {
                        ls: parseInt(x[7]),
                        mid: parseInt(x[8]),
                        new_date: new Date(parseInt(d[2]), parseInt(d[1])-1, parseInt(d[0])),
                        new_value: parseFloat(x[10])
                    }
                }
                if (valuestype ===2 ) {
                    let d = new Date(x[7].replace(/(\d{1,2})\.(\d{1,2})\.(\d{1,2}) (\d{1,2}):(\d{1,2}):(\d{1,2})/mg, "20$3-$2-$1T$4:$5:$6"))
                    return {
                        ls: parseInt(x[0]),
                        mid: parseInt(x[1]),
                        new_date: d,
                        new_value: parseFloat(x[8])
                    }
                }
            })

            console.log(newvalues)

            newvalues.forEach(x => {
                let i = meters.findIndex(y => y.ls===x.ls&&y.mid===x.mid)
                if (i >=0 ) {
                    meters[i].new_value = x.new_value
                    meters[i].new_date = x.new_date
                    meters[i].src = 0
                }
            })
        }

        await sql`INSERT INTO meters_history SELECT * FROM meters`
        await sql`DELETE FROM meters`

        m = Math.ceil(meters.length/chunkSize)
        for (let i=0;i<m;i++) {
            await sql`INSERT INTO meters ${ sql(meters.splice(0, chunkSize)) }`
        }
        logger.info(`Meters data updated`)
        await sql`UPDATE config SET vali=${period.id} WHERE key='current'`
    })
}

const main = async () => {
    try {
        let l = Array.from({length: 12}, (v, i) => ({m: i+1, y: 2020}))
        l.push({m: 1, y: 2021})
        l = l.slice(-2)
        
        let bar = new progress('[:bar] :percent', { total: l.length, width: 80 })

        logger.info('Start import init data')
        logger.info(`Import init data: ${l[0].m}.${l[0].y}`)
        await firstImport(l[0].m, l[0].y)
        bar.tick()
        logger.info('Import nexp period data')
        for (let p of l.slice(1)) {
            logger.info(`Import period data: ${p.m}.${p.y}`)
            await updateDb(p.m, p.y)
            bar.tick()
        }
        
    }
    catch (e) {
        logger.error(e)
    }
    finally {
        logger.info('Import complete')
        await sql.end({ timeout: 5 })
    }
}
main()

const asd = async () => {
    let a = fs.readFileSync(`./import-data/2021/1/data2.csv`).toString().split('\n')
    console.log(a)
}

//asd()

// SELECT a.ls, concat(s.type, '. ', s.name, ', д. ', concat_ws('/', b.number, NULLIF(b.housing, '')), ', кв. ', concat_ws('/', a.number, NULLIF(a.part, ''))), 
// a.name, a.phone, a.space, a.porch, sp.title, m.service, m.period_id, m.last_month, m.last_year, m.last_value, m.new_value
// FROM apartments as a
// LEFT JOIN buildings as b ON b.id=a.building_id
// LEFT JOIN streets as s ON s.id=b.street_id
// LEFT JOIN suppliers as sp ON sp.id=a.supplier_id
// LEFT JOIN meters as m ON m.ls=a.ls
// WHERE a.ls=103030 and m.period_id in (select id from periods ORDER BY id desc limit 3)
// ORDER BY period_id desc
