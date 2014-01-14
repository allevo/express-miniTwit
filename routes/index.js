var mongodb = require('mongodb');
var crypto = require('crypto');

mongodb.MongoClient.connect('mongodb://127.0.0.1:27017/miniTwitt', function(err, db) {
  if (err) throw err;
  mongodb.db = db;
});

function generate_hash_password(password) {
  return crypto.createHash('md5')
    .update(password)
    .digest('hex');
}
function get_user_by_username(username, callback) {
  mongodb.db.collection('user')
    .find({ username: username }, [ '_id' ])
    .limit(1)
    .toArray(callback);
}
function get_user_by_username_and_password(username, password, callback) {
  mongodb.db.collection('user')
    .find({ username: username, password: generate_hash_password(password) }, ['username', 'email', '_id', 'followings'])
    .limit(1)
    .toArray(callback);
}
function get_followings(username, callback) {
  mongodb.db.collection('user')
    .find({ username: username }, [ 'followings' ])
    .limit(1)
    .toArray(callback);
}
function get_user_messages(username, others, callback) {
  others.push(username);
  mongodb.db.collection('user')
    .aggregate(
      { $match: { username :  { $in: others } } },
      { $unwind: '$messages' },
      { $sort : { 'messages.date' : -1 } },
      { $project: { 'text': '$messages.text', 'author' : '$username', 'date': '$messages.date' } },
      callback
  );
}
function get_all_messages(callback) {
  mongodb.db.collection('user')
    .aggregate(
      { $unwind: '$messages' },
      { $sort : { 'messages.date' : -1 } },
      { $limit: 10 },
      { $project: { 'text': '$messages.text', 'author' : '$username', 'date': '$messages.date' } },
      callback
  );
}

exports.index = function(req, res) {
  if (!req.session.user) {
    return res.redirect('/public');
  }
  get_followings(req.session.user.username, function(err, data) {
    if (err) throw err; 
    get_user_messages(req.session.user.username, data[0].followings, function(err, messages) {
      if (err) throw err;
      res.render('timeline', { messages: messages });
    });
  });
};

exports.public_ = function(req, res) {
  if (req.session.user) {
    return res.redirect('/home');
  }
  get_all_messages(function(err, messages) {
    if (err) throw err;
    res.render('timeline', { messages: messages });
  });
}

exports.user = function(req, res) {
  var username = req.params.username;
  get_user_by_username(username, function(err, user) {
    if (err) throw err;
    if (user.length == 0) return res.redirect('404');

    get_followings(username, function(err, data) {
      if(err) throw err;
      console.log(data);
      get_user_messages(username, data[0].followings, function(err, messages) {
        if (err) throw err;
        var isFollowing = req.session.user && (req.session.user.followings.indexOf(username) != -1);
        res.render('timeline', { messages: messages, other: { username: username, following: isFollowing } });
      })
    });
  });
}

exports.register = function(req, res) {
  var error = {};
  if (req.method == 'POST') {
    if (!req.body.username) {
      error.username = 'You have to enter a username';
    }
    if (!req.body.email || (req.body.email.indexOf('@') == -1)) {
      error.email = 'You have to enter a valid email address';
    }
    if (!req.body.password) {
      error.password = 'You have to enter a password'; 
    }
    if (req.body.repassword != req.body.password) {
      error.repassword = 'The two passwords do not match';
    }
    if (Object.keys(error).length == 0) {
      get_user_by_username(req.body.username, function(err, data) {
        console.log(err, data);
        if (err) throw err;
        if (data.length > 0) { return res.render('register', { errors: { username: 'The username is already taken' } } ); }
        mongodb.db.collection('user').insert({
          username: req.body.username,
          password: generate_hash_password(req.body.password),
          email: req.body.email
        }, function(err, data) {
          if (err) throw err;
          res.redirect('/login');
        });
      });
    }
  }
  if (req.method == 'GET' || (Object.keys(error).length != 0)) {
    res.render('register', { errors: error });
  }
}

exports.login = function(req, res) {
  if (req.method == 'GET') {
    return res.render('login');
  }
  get_user_by_username_and_password(req.body.username, req.body.password, function(err, data) {
    if (data.length == 0) {
      return res.render('login', { error: 'Wrong credentials' });
    }
    req.session.user = data[0];
    res.redirect('/home');
  });
}

exports.logout = function(req, res) {
  req.session.user = null;
  res.redirect('/home');
}

exports.add_message = function(req, res) {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  if (req.body.message) {
    mongodb.db.collection('user')
      .update(
        { username : req.session.user.username },
        { $push: { messages: { text: req.body.message, date: (new Date()) } } },
        function(err, data) {
          if (err) throw err;
    });
  }
  res.redirect('/home');
}

exports.follow = function(req, res) {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  var username = req.params.username;
  mongodb.db.collection('user')
    .update(
      { username: req.session.user.username },
      { $addToSet: { followings: username }}, 
      function(err, data) {
        if (err) throw err;
  });
  req.session.user.followings
    .push(username);
  res.redirect('/' + username);
}

exports.unfollow = function(req, res) {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  var username = req.params.username;
  mongodb.db.collection('user')
    .update(
      { username: req.session.user.username },
      { $pull: { followings: username }}, 
      function(err, data) {
        if (err) throw err;
  });
  req.session.user.followings
    .splice(req.session.user.followings.indexOf(username), 1);
  res.redirect('/' + username);
}