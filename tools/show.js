// const parseDbf = require('parsedbf')
// const fs = require('fs')
const env = require('../lib/env')
const postgres = require('postgres')

let sql = postgres(env.db)

const main = async () => {
    let data = await sql`SELECT a.ls, full_address(s.type, s.name, b.number, b.housing, a.number, a.part),
    m.mid, m.service, m.last_month||'-'||m.last_year as last_date, m.last_value
    FROM apartments AS a
    LEFT JOIN buildings AS b ON b.id=a.building_id
    LEFT JOIN streets AS s ON s.id=b.street_id
    LEFT JOIN meters AS m ON m.ls=a.ls
    WHERE a.supplier_id=1 LIMIT 100`

    let a = data.reduce((t, v) => {
        if (!t.hasOwnProperty(v.ls)) {

        }
    }, {})

}

main()
