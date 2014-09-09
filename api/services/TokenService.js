var async = require('async'),
	AccountService = require('./AccountService'),
	Bulkhead = require('bulkhead');

module.exports = new function(){
	var self = this;

	Bulkhead.service.call(this, 'AccountToken', {
		'string': function(criteria, next) {
			self.getModel().findOneByGuid(criteria, next);
		},
		'object': function(criteria, next) {
			if(criteria.id === undefined || Object.keys(criteria).length == 1) {
				// Use a standard object as a Waterline query
				self.plugin.AccountToken.find().where(criteria).exec(next);
			} else {
				// Use the Model instance directly
				next(null, criteria);
			}
		}
	});

	/**
	 * Generates a token for accounts
	 * @param	Mixed		Criteria to parse (number, string, object, array)
	 * @param	Function	Callback to fire when the mapping is finished
	 */
	this.create = function(accountCriteria, type, status, expiresAt, contents, done) {
		var self = this;
		if(expiresAt === undefined || expiresAt === null) {
			expiresAt = 86400;
		}

		this.find(accountCriteria, function(err, accounts) {
			async.concat(accounts.responses(), function(account, next) {
				self.plugin.AccountToken.create({
					type:		type || self.plugin.AccountToken.constants.type.passwordVerification,
					status:		status || self.plugin.AccountToken.constants.status.pending,
					expiresAt:	new Date(Date.now() + expiresAt * 1000),
					account:	account.id,
					contents:	contents || null
				}, function(err, token) {
					next(err, new Bulkhead.result(account, token));
				});
			}, function(err, results) {
				done(err, self.result(results));
			});
		});
	};

	/**
	 * Resets a token
	 * @param	Mixed		Criteria to parse (number, string, object, array)
	 * @param	Function	Callback to fire when the mapping is finished
	 */
	this.reset = function(criteria, done) {
		var self = this;
		this.find(criteria, function(err, results) {
			var token = results.response();
			self.plugin.AccountToken.update({
				id: token.id
			},{
				status: self.plugin.AccountToken.constants.status.pending
			}, function(err, account) {
				done(err, self.result(new Bulkhead.result(token, true)));	
			});
		});
	};
	
	/**
	 * Generates a token for the account
	 */
	this.consume = function(criteria, done) {
		var self = this;
		this.find(criteria, function(err, tokens) {
			async.concat(tokens.responses(), function(token, next) {
				if(token.status === self.plugin.AccountToken.constants.status.pending) {
					// The token can be consumed
					if(Date.now() >= token.expiresAt) {
						// The token has expired and cannot be consumed
						token.status = self.plugin.AccountToken.constants.status.expired;
						token.save(function(err, token) {
							next(null, new Bulkhead.result(token, false, 'token has expired'));	
						});
					} else {
						// The token can be consumed
						token.status = self.plugin.AccountToken.constants.status.consumed;
						token.save(function(err, token) {
							next(null, new Bulkhead.result(token, token.contents));
						});
					}
				} else {
					// Token has already been consumed
					next(null, new Bulkhead.result(token, false, 'token has been consumed'));
				}
			}, function(err, results) {
				done(err, self.result(results));
			});
		});
	};

	/**
	 * Cleans up expired tokens
	 * @param	Function	Callback to fire when the mapping is finished
	 */
	this.cleanup = function(done) {
		var self = this;
		self.plugin.AccountToken.destroy({ or: [
			{ 
				expiresAt: { '<': new Date() }
			}, { 
				status: self.plugin.AccountToken.constants.status.expired 
			}, { 
				status: self.plugin.AccountToken.constants.status.consumed 
			}
		]}, function(err) {
			done(err, self.result(true));
		});
	};
	
	/**
	 * Generates a URL to claim the token
	 * @param	string	API gateway to use
	 * @param	Token	Token Model
	 */
	this.getClaimTokenUrl = function(api, token) {
		return (sails.usingSSL ? 'https' : 'http') + '://' + sails.config.host + (sails.config.port == 80 ? '' : ':' + sails.config.port) + '/' + api + '/' + token.guid;
	};
};