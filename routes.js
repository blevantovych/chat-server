const express = require('express')
const router = express.Router()
const mongoConnected = require('./db.js')
const jwt = require('jsonwebtoken')
const config = require('./config.json')
const marked = require('marked')
const fs = require('fs')
const ObjectID = require('mongodb').ObjectID

let id = 0;

router.post('/login', (req, res) => {
  console.log('login');
  console.log(req.body);
  mongoConnected.then(db => {
    db
      .collection('users')
      .findOne(
      { 'username': req.body.username, 'password': req.body.password },
      { 'password': 0, 'iat': 0 },
      (err, user) => {
        if (!user || err) {
          res.status(404).send()
        } else {
          const token = jwt.sign(user, config.jwt_secret, { noTimestamp: true })

          res.status(200).json({
            user,
            token,
            tokenType: 'Bearer'
          })
        }
      }
      )
  })
})

router.post('/signup', (req, res) => {
  if (!req.body.username || !req.body.password) {
    res.status(400).json({
      status: 400,
      message: 'Please provide valid username and password.'
    })
  }

  if (req.body.file) {
    var base64Data = req.body.file.content.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");

    fs.writeFile(__dirname + `/images/${req.body.file.name}`, base64Data, 'base64', (err) => {
      if (err)
        console.log(err);
      else console.log('no err');
    })
  }
  mongoConnected.then(db => {
    db
      .collection('users')
      .insert(Object.assign({}, req.body, {status: 'on'}), (err, user) => {
        if (err) res.status(404).send(err)
        res.status(201).send()
      })
  })
})

router.post('/image', (req, res) => {

  mongoConnected.then(db => {
    db
      .collection('users').update({username: req.body.username}, {$set: {fileContent: req.body.fileContent}})
  })
  res.send(req.body)
})

router.post('/info', (req, res) => {
  mongoConnected.then(db => {
    db
      .collection('users').update({username: req.body.username}, {
        $set: {
          username: req.body.updatedInfo.username,
          bday:     req.body.updatedInfo.bday,
          email:    req.body.updatedInfo.email
        }
      })
    db
    .collection('messages').update({username: req.body.username}, {
      $set: {
        username: req.body.updatedInfo.username,
      }
    })
  })
  res.send(req.body)
})

router.get('/users', (req, res) => {
  mongoConnected.then(db => {
    db
      .collection('users').find({}, { password: 0 })
      .toArray((err, users) => {
        res.send(users)
      })
  })
})

router.get('/messages', (req, res) => {
  mongoConnected.then(db => {
    let dbFindParams = {}
    if (req.query.from || req.query.to) dbFindParams.time = {}
    if (req.query.from) dbFindParams.time.$gte = +req.query.from
    if (req.query.to) dbFindParams.time.$lte = +req.query.to

    db
      .collection('users').find({}, {username: 1})
      .toArray((err, users) => {
        console.log('users');
        console.log(users);
        db
          .collection('messages').find(dbFindParams, { _id: 0 })
          .toArray((err, msgs) => {

            msgs.map(m => {
              m.username = users.find(u => u._id.toString() === m.user_id).username;
              return m;
            })
            res.send(msgs)
          })
      })
  })
})


module.exports = router