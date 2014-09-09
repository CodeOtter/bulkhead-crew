var async = require('async'),
	validator = require('validator'),
	TokenService = require('./TokenService'),
	Bulkhead = require('bulkhead');

/**
 * 
 */
module.exports = new function(){

	

	Bulkhead.service.call(this);

	var self = this,
		pkg = this.bulkhead;
	
	self.account = {

		/**
		 * 
		 * @param account
		 * @returns {Boolean}
		 */
		isActive: function(account) { 
			return account.status === self.plugin.Account.constants.status.active;
		},

		/**
		 * 
		 * @param account
		 * @returns {Boolean}
		 */
		isInactive: function(account) {
			return account.status !== self.plugin.Account.constants.status.active;
		},

		/**
		 * 
		 * @param account
		 * @returns {Boolean}
		 */
		isDisabled: function(account) {
			return account.status === self.plugin.Account.constants.status.disabled;
		},

		/**
		 * 
		 * @param account
		 * @returns {Boolean}
		 */
		isUnverified: function(account) {
			return account.status === self.plugin.Account.constants.status.unverified;
		},

		/**
		 * 
		 * @param account
		 */
		isPendingEmailChange: function(account, done) {
			self.plugin.TokenService.find({ 
				account: account.id,
				type: self.plugin.AccountToken.constants.type.emailVerification,
				status: self.plugin.AccountToken.constants.status.pending
			}, function(err, tokens) {
				if(err)
					return self.result(false, done, account, 'database failure', err);
				return self.result(tokens.isEmpty(), done, account);
			});
		},

		/**
		 * 
		 * @param account
		 */
		isPendingPasswordChange: function(account, done) {
			self.plugin.TokenService.find({ 
				account: account.id,
				type: self.plugin.AccountToken.constants.type.passwordVerification,
				status: self.plugin.AccountToken.constants.status.pending
			}, function(err, tokens) {
				if(err)
					return self.result(false, done, account, 'database failure', err);
				return self.result(tokens.isEmpty(), done, account);
			});
		},

		/**
		 * 
		 * @param password
		 */
		isPasswordValid: function(password) {
			return password.length >= 6;
		},

		/**
		 * 
		 * @param email
		 * @returns
		 */
		isEmailValid: function(email) {
			return validator.isEmail(email);
		}
	};
	
	self.purchase = {
		
	};
};
