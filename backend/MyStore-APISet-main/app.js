var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

const myStoreRouter = require('./src/myStore')
var app = express();

var cors = require('cors');
const { BADQUERY } = require('dns');
var bodyParser = require('body-parser');

app.use(cors())

var port = process.env.PORT || 4000;

app.listen(port, () => {
  console.log(new Date(),' Server Deployed on port ', port)
})

var options = {  
  inflate: true,
  limit: '50mb',
  type: 'application/octet-stream'
};
app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({limit: '50mb'}));
app.use(bodyParser.json({
  verify: (req, res, buf) => {
    req.rawBody = buf
  }
}))

const midware = (req, res, next) => {
  console.log(new Date(),` New Request ` + req.path)
  console.log(new Date(),' Body for ' + req.path + ' : ')
  console.log(req.body)
  next()
}

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/mystore',midware, myStoreRouter);

var localDB = {}
app.post('/handle', (req, res) => {
  console.log(req.body)
  try {
    var body = req.body;
    if(body['operator']=='set') {
        localDB[body.key] = body.value
        res.send(201)
    }
    if(body['operator']=='get') {
      if(body.key && body.key in localDB) {
        return res.send(localDB[body.key])
      }
      res.send('invalid value')
    }
    if(body['operator']=='del') {
      delete localDB[body.key]
      res.send('deleted')
    }
    if(body['operator']=='keys') {
      var keyArray = Object.keys(localDB)
      res.send(keyArray)
    }
    if(body['operator']=='flushall') {
      localDB = {}
      res.send('flushed')
    }
  } catch(e) {
      res.status(400).send('Bad Request')
  }
 
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  console.log(err)
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error')
});

module.exports = app;