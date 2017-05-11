const MongoClient = require('mongodb').MongoClient
const config = require('./config.json')

const mongoConnected = new Promise((res, rej) => {
    MongoClient.connect(config.mongodb_url, (err, db) => {
        if (err) rej(err)
        console.log('Connected correctly to server')
        res(db)
    })
})

mongoConnected.catch(err => console.error(err.stack))

module.exports = mongoConnected
