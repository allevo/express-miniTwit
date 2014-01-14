
var express = require('express');
var routes = require('./routes');

// App creation and configuration
var app = module.exports = express();
app.configure(function() {
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser());
  app.use(express.session({ secret: '746gvwFWt4wGT$éçWEf' }));


  app.use(function(req, res, next) {
    res.locals.session = req.session;
    next();
  });

  app.use(app.router);
  app.use('/public', express.static(__dirname + '/public'));
});
app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});
app.configure('production', function(){
  app.use(express.errorHandler());
});


// Routes
app.get('/', routes.index);
app.get('/home', routes.index);
app.get('/public', routes.public_);
app.get('/register', routes.register);
app.post('/register', routes.register);
app.get('/login', routes.login);
app.post('/login', routes.login);
app.get('/logout', routes.logout);
app.post('/add_message', routes.add_message)

app.get('/:username/follow', routes.follow);
app.get('/:username/unfollow', routes.unfollow);

app.get('/:username', routes.user);

app.listen(3000, function() {
  console.log("Express server listening on http://localhost:3000");
});
