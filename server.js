const express = require('express')
const app = express()
const routes = require('./routes.js')
const cors = require('cors')
const bodyParser = require('body-parser')
const morgan = require('morgan')
const http = require('http').Server(app)
const io = require('socket.io')(http)
const jwt = require('jsonwebtoken')
const config = require('./config.json')
const mongoConnected = require('./db.js')
const ObjectID = require('mongodb').ObjectID
const fileUpload = require('express-fileupload') // for file uploading

const socketioJwt = require('socketio-jwt')
const server_port = process.env.OPENSHIFT_NODEJS_PORT || 3000
const server_ip_address = process.env.OPENSHIFT_NODEJS_IP || 'localhost'


app.use(bodyParser.json({limit: '5mb'}))
app.use(bodyParser.urlencoded({limit: '5mb', extended: true}))
app.use(express.static('public'))
//app.use(bodyParser({limit: '50mb'}))
app.use(cors())
app.use(morgan('tiny'))
app.use(routes)

io.sockets
  .on('connection', socketioJwt.authorize({
    secret: config.jwt_secret,
    callback: false
  }))
  .on('authenticated', socket => {
    io.emit('join', {
      user: socket.decoded_token,
      time: Date.now(),
    })
    
    socket
      .on('unauthorized', unauthorizedHandler)
      .on('message', chatMessageHandler)
      .on('disconnect', disconnectHandler)
      .on('imageChanged', userChangedImage)
      .on('infoChanged', userChangedInfo)

    mongoConnected.then(db => {
      db
        .collection('users')
          .update({username: socket.decoded_token.username}, {$set: {status: 'on'}}, err => {
          if (err) io.emit('error', err)
        })
    })

    function unauthorizedHandler(error) {
      if (error.data.type == 'UnauthorizedError' || error.data.code == 'invalid_token') {
        // redirect user to login page perhaps?
        console.log("User's token has expired")
      }
    }

    function userChangedImage(what) {
      console.log(`\n\nuser changed image\n\n`)
      io.emit('imageChanged', what)
    }

    function userChangedInfo(what) {
      console.log(`\n\nuser changed info\n\n`)
      io.emit('infoChanged', what)
    }

    function chatMessageHandler(msg) {
      const msgObj = {
        msg,
        user_id: socket.decoded_token._id,
        time: Date.now()
      }
      mongoConnected.then(db => {
        db
          .collection('users').find({}, {username: 1})
          .toArray((err, users) => {
            
            db
              .collection('messages')
              .insert(msgObj, err => {
                if (err) io.emit('error', err)
              })

            io.emit('message', {
              msg: msgObj.msg,
              time: msgObj.time,
              username: users.find(u => u._id.toString() === socket.decoded_token._id).username
            })
          })
      })
    }

    function disconnectHandler() {

       mongoConnected.then(db => {
        db
          .collection('users')
          .findOne({_id: ObjectID(socket.decoded_token._id)}, {username: 1}, (err, user) => {
            io.emit('leave', {
              username: user.username,
            })
          })

        db
          .collection('users')
          .update({_id: ObjectID(socket.decoded_token._id)}, {$set: {status: 'off', lastTimeOnline: Date.now()}}, err => {
            if (err) io.emit('error', err)
          })
      })
    }
  })

function createImageFiles() {
  mongoConnected.then(db => {
    db
      .collection('users')
      .find({}, { fileContent: 1, username: 1, _id: 0 })
      .toArray((err, base64) => {
        base64.forEach(el => {
          let base64Data = el.fileContent.replace(/^data:image\/pngbase64,/, "")
          require("fs").writeFile(`images/${el.username}.png`, base64Data, 'base64', function(err) {
            console.log(err)
          })
        })
      })
  })
}
//createImageFiles()


const server = http.listen(server_port, server_ip_address, () => {
  console.log(`Auth servise running on http://${server.address().address}:${server.address().port}`)
})
