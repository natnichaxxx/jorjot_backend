var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const mongoose = require('mongoose');
//const products = require('./routes/products');
var authRouter = require('./routes/auth');
const transactionsRoutes = require('./routes/transactions');
const challengesRoutes = require('./routes/challenges');
const cors = require('cors')

mongoose.Promise = global.Promise;

mongoose.connect('mongodb+srv://Natnicha:98765@cluster0.gkom5.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0')
        .then(() => console.log('connection successfully!'))
        .catch((err) => console.error(err))

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var app = express();

app.use(cors())

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
//app.use('/products', products);
app.use('/auth', authRouter);
app.use('/transactions', transactionsRoutes);
app.use('/challenges', challengesRoutes);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;