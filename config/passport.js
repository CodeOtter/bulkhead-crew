// Location: /config/passport.js
var passport = require('passport'),
	LocalStrategy = require('passport-local').Strategy,
	AccountService = require('../api/services/AccountService').account;

/**
 * 
 */
passport.serializeUser(function(account, done) {
	done(null, account.id);
});

/**
 * 
 */
passport.deserializeUser(function(id, done) {
	Account.findById(id, function (err, account) {
		done(err, account);
	});
});

/**
 * 
 */
passport.use(new LocalStrategy(
	{
		usernameField: 'email'
	}, 
	function(email, password, done) {
		AccountService.getByLogin(email, password, done);	
	}
));

module.exports = {
	express: {
		customMiddleware: function(app){
			app.use(passport.initialize());
			app.use(passport.session());
		}
	}
};
