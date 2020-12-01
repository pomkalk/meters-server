const conf = require('./lib/conf')
const postgres = require('postgres')

const a = ['users.*', 'meters.ced', 'import.f']


const getRequiredPermissions = (p) => {
    let a = p.split('.')
    if (a.length === 0) return new Error('Required permission cannot be empty.')
    if (a.length === 1) {
        return [a[0]+'.', ['a']]
    } else {
        return [a[0]+'.', a[1].split('')]
    }
}

const can = (p) => {
    const [g, n] = getRequiredPermissions(p)
    console.log(g, n)
    const s = a.find(x => x.startsWith(g))
    console.log(s)
    if (s) {
        const [gs, ns] = getRequiredPermissions(s)
        console.log(gs, ns)
        if (ns[0] === '*') return true
        return n.every(x=>ns.includes(x))
    } else {
        return false
    }
}

const main = async () => {
    console.log(can('import.f'))
}

main()