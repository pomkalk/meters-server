const permissions = [
    {
        name: 'dashboard',
        title: 'Доступ к Dashboard',
    },
    {
        name: 'meters',
        title: 'Ввод показаний счетчиков'
    },
    {
        name: 'import',
        title: 'Импрот базы данных'
    },
    {
        name: 'news',
        title: 'Новости'
    },
    {
        name: 'notify',
        title: 'Уведомления'
    },
    {
        name: 'feeds',
        title: 'Отзывы'
    },
    {
        name: 'users',
        title: 'Пользователи',
        access: {
            c: 'Создание',
            e: 'Редактирование',
            d: 'Удаление',
            b: 'Блокировка'
        }
    },
    {
        name: 'config',
        title: 'Переменные среды',
        access: {
            'e': 'Редактирование переменных'
        }
    },
    {
        name: 'suppliers',
        title: 'Обслуживающие организации',
        access: {
            c: 'Создание',
            e: 'Редактирование',
            d: 'Удаление'
        }
    }
]

module.exports = {
    get: () => permissions,
    forRoot: () => permissions.reduce((t, v) => {
        return { ...t, [v.name]: (v.access ? Object.keys(v.access) : ['*'])}
    }, {})
}