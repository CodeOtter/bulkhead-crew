var TokenService = require('./TokenService'),
	mailer = require('bulkhead-mailer'),
	bcrypt = require('bcrypt');
	async = require('async'),
	PolicyService = require('./PolicyService');
	Bulkhead = require('bulkhead');

module.exports = new function(){
	var self = this;
	
	Bulkhead.service.call(this, 'Account', {
		'string': function(criteria, next) {
			self.getModel().findOneByEmail(criteria, next);
		}
	});

	/**
	 * Creates a new user
	 * @param	String		Email address
	 * @param	String		Password
	 * @param	String		Name of the user
	 * @param	Number		Type
	 * @param	Number		Status
	 * @param	Function	Callback to call when the user is created
	 */
	this.register = function(email, password, name, type, status, done) {
		var self = this;

		this.create({
			email: email,
			password: password,
			name: name
		}, function(data, next) {
			// Validation
			var errors = [];
			data.email = (data.email).toString();
			data.password = (data.password).toString();
			data.name = (data.name).toString();
			data.type = Account.constants.type.standard;		// @TODO: Only let admins set type
			data.status = Account.constants.status.unverified;	// @TODO: Only let admins set status

			if(!PolicyService.account.isEmailValid(data.email)) {
				errors.push('email is invalid');
			}

			if(!PolicyService.account.isPasswordValid(data.email)) {
				errors.push('password is invalid');
			}

			next(errors.length > 0 ? errors : null, data);
		}, function(err, result) {
			// Package the result
			if(err)
				return self.result(false, done, email, result, err);
			if(!result)
				return self.result(result, done, email, 'account not created');

			return self.result(result, done, email);
		});
	};

	/**
	 * Updates user
	 * @param	String		Email address
	 * @param	String		Password
	 * @param	String		Name of the user
	 * @param	Number		Type
	 * @param	Number		Status
	 * @param	Function	Callback to call when the user is created
	 */
	this._update = this.update;
	this.update = function(id, email, password, name, done) {
		var self = this,
			tasks = [];

		this._update(id, {
			name: name
		}, function(changes, record, next) {
			// Validation

			if(PolicyService.account.isInactive(record)) {
				return next('cannot update disabled account', changes);
			}

			var errors = [];

			changes.name = (changes.name).toString();
			
			if(email !== null || email !== undefined) { 
				// An email change has been detected
				email = String(email);
				if(!PolicyService.account.isEmailValid(email)) {
					// The email is invalid
					errors.push('email is invalid');
				} else {
					// Prepare a post-update task
					tasks.push(function(next) {
						self.requestEmailChange(id, email, next);
					});
				}
			}

			if(password !== null || password !== undefined) {
				// A password change has been detected
				password = String(password);
				if(!PolicyService.account.isPasswordValid(password)) {
					// The password is invalid
					errors.push('password is invalid');
				} else {
					// Prepare a post-update task
					tasks.push(function(next) {
						self.requestPasswordReset(id, next);
					});
				}
			}

			next(errors.length > 0 ? errors : null, changes);
		}, function(err, result) {
			var account = result[0];
			// Package the result
			if(err)
				return self.result(false, done, id, account, err);
			if(!account)
				return self.result(false, done, id, 'account not updated');

			async.parallel(tasks, function(err, tokens) {
				if(err) {
					TokenService.remove(tokens, function(err, results) {
						if(err)
							return self.result(false, done, id, 'database failure', err);
						if(!results)
							return self.result(false, done, id, 'could not rollback the account update');

						return self.result(false, done, id, 'account not updated');
					});
				} else {
					return self.result(account, done, id);
				}
			});
		});
	};
	
	/**
	 * Disables an account
	 * @param	Mixed		Criteria to parse (number, string, object, array)
	 * @param	Function	Callback to fire when the mapping is finished
	 */
	this.disable = function(criteria, done) {
		var self = this;
		this.findAndDo(criteria, function(account, next) {
			Account.update({
				id: account.id
			},{
				status: Account.constants.status.disabled
			}, function(err, account) {
				// @TODO: Destroy all tokens for a disabled account?
				next(err, new Bulkhead.result(account.id, account));	
			});
		}, function(err, results) {
			// Package the result
			return done(err, self.result(results));
		});
	};

	/**
	 * Enable an account
	 * @param	Mixed		Criteria to parse (number, string, object, array)
	 * @param	Function	Callback to fire when the mapping is finished
	 */
	this.enable = function(criteria, done) {
		var self = this;
		this.findAndDo(criteria, function(account, next) {
			// Enable the account
			Account.update({
				id: account.id
			},{
				status: Account.constants.status.active
			}, function(err, account) {
				next(err, new Bulkhead.result(account.id, account));	
			});
		}, function(err, results) {
			// Package the result
			return done(err, self.result(results));
		});
	};

	/**
	 * Gets an account by login credentials
	 * @param	String		Email address
	 * @param	String		Plain-text password
	 * @param	Function	Callback
	 */
	this.getByLogin = function(email, password, done) {
		var self = this;
		Account.findOneByEmail(email, function (err, account) {
	      if (err) {
	    	  // The database has failed
	    	  return self.result(false, done, email, 'database failure', err);
	      }

	      if (account) {
	    	// An account with a matching email was found, now compare the passwords
	        bcrypt.compare(password, account.password, function (err, match) {
	          if (err) {
	        	  // The password comparison failed for internal reasons
	        	  return self.result(false, done, email, 'hash comparison failure', err);
	          }

	          if (match) {
	            // The password comparison worked

	        	if(account.status == Account.constants.status.disabled) {
	        		return self.result(false, done, email, 'account is disabled');
	        	}
	        	
	        	return self.result(account, done, email);
	          } else {
	            // The password comparison failed
	        	return self.result(false, done, email, 'invalid password');
	          }
	        });
	      } else {
	    	// No account was found that matched the email
	    	 return self.result(false, done, email, 'account not found');
	      }
	    });
	};

	/**
	 * Change the email address of a single account
	 * @param	Mixed		Account Criteria
	 * @param	String		Email address
	 * @param	Function	Callback to fire when the mapping is finished
	 */
	this.requestEmailChange = function(criteria, email, done) {
		var self = this,
			email = (email).toString();
		
		if(!PolicyService.account.isEmailValid(email)) {
			return self.result(false, done, email, 'email is invalid');
		}
		
		this.find(criteria, function(err, results) {
			if(err)
				return self.result(false, done, criteria, 'database failure', err);
			if(results.isEmpty())
				return self.result(false, done, criteria, 'account not found');

			var account = results.response();
			TokenService.create(account, AccountToken.constants.type.emailVerification, AccountToken.constants.status.pending, null, email,
				function(err, results) {
					if(err) {
						// Database error
						return self.result(false, done, account, 'database failure', err);
					}
					
					var token = results.response();
					if(results.message() !== undefined) {
						// Token generation failed
						return self.result(false, done, account, results.message());
					}

					// The token was generated
					mailer.dispatch(
						account.name + ' <' + account.email + '>',
						null,
						'Your new email needs to be confirmed',
						'Please click on this link to verify your email address: ' + TokenService.getClaimTokenUrl('accounts/verifyEmail/' + account.id, token),
						null,
						null,
						function(err, message) {
							if(err) {
								// The mail could not be dispatched, delete the token
								token.destroy(function(err) {
									return self.result(false, done, account, 'database failure', err);
								});
							} else {
								// Mail was a success
								return self.result(token, done, account);
							}
						}
					);
				});
		});
	};
	
	/**
	 * Reset the password for multiple accounts
	 * @param	Mixed		Account Criteria
	 * @param	Function	Callback to fire when the mapping is finished
	 */
	this.requestPasswordReset = function(criteria, done) {
		var self = this;
		this.findAndDo(criteria, function(account, next) {
			// Get an account
			TokenService.create(account, AccountToken.constants.type.passwordReset, AccountToken.constants.status.pending, null, null,
				function(err, results) {
					if(err) {
						// Database error
						return next(err, new Bulkhead.result(account, false, 'database error'));
					}
					var token = results.response();
					
					if(results.message() !== undefined) {
						// Token generation failed
						return next(null, new Bulkhead.result(account, false, results.message()));
					}

					// The token was generated
					mailer.dispatch(
						account.name + ' <' + account.email + '>',
						null,
						'Your password reset request',
						'Please click on this link to change your password: ' + TokenService.getClaimTokenUrl('accounts/changePassword/' + account.id, token),
						null,
						null,
						function(err, message) {
							if(err) {
								// The mail could not be dispatched, delete the token
								token.destroy(function(err) {
									return next(err, new Bulkhead.result(account, false, message));
								});
							} else {
								// Mail was a success
								return next(null, new Bulkhead.result(account, token));
							}
						}
					);
				});
		}, function(err, results) {
			// Package the result
			return done(err, self.result(results));
		});
	};
	
	/**
	 * Verify the email address of an account
	 * @param	Mixed		Criteria for account
	 * @param	Mixed		Criteria for GUID
	 * @param	Function	Callback to fire when the mapping is finished
	 */
	this.verifyEmail = function(account, guid, done) {
		var self = this;

		TokenService.find(guid, function(err, results) {
			if(err)
				return self.result(false, done, guid, 'database failure', err);
			if(results.isEmpty())
				return self.result(false, done, guid, 'token not found');

			// Get the token
			var token = results.response();

			if(token.type !== undefined && token.type === AccountToken.constants.type.emailVerification) {
				// Token found and is an email verification token
				self.find(account, function(err, results) {
					if(err)
						return self.result(false, done, account, 'database error', err);
					if(results.isEmpty())
						return self.result(false, done, account, 'account not found');

					var account = results.response();

					if(token.account !== account.id) {
						// The token belongs to the wrong account
						return self.result(false, done, account, 'incorrect token/account pairing');
					}


					// The account is properly unverified
					TokenService.consume(token, function(err, results) {
						// Consume the token
						if(results.message() === undefined) {
							// The token was successfully consumed
							Account.update({
								id: account.id
							}, {
								status: Account.constants.status.active,
								email: token.contents
							}, function(err, account) {
								if(err) {
									// An error occurred, reset the token
									TokenService.reset(token, function(err, results) {
										return self.result(false, done, guid, 'database failure', err);
									});
								} else {
									// The account was successfully updated
									return self.result(token.contents, done, guid);
								}
							});	
						} else {
							// The token was not correctly consumed
							return self.result(false, done, guid, results.message());
						}
					});
				});
			} else {
				// No token found
				return self.result(false, done, guid, 'token incorrectly formed');
			}
		});
	};
	
	/**
	 * Resets an accounts password
	 * @param	Mixed		Criteria to parse (number, string, object, array)
	 * @param	Function	Callback to fire when the mapping is finished
	 */
	this.resetPassword = function(account, guid, password, done) {
		var self = this,
			password = (password).toString();

		if(!PolicyService.account.isPasswordValid(password)) {
			return self.result(false, done, password, 'password is invalid');
		}

		TokenService.find(guid, function(err, results) {
			if(err) 
				return self.result(false, done, guid, 'database failure', err);
			if(results.isEmpty())
				return self.result(false, done, guid, 'token not found');

			// Get the token
			var token = results.response();

			if(token.type !== undefined && token.type === AccountToken.constants.type.passwordVerification) {
				// Token found and is an email verification token
				self.find(account, function(err, results) {

					if(err)
						return self.result(false, done, account, 'database failure', err);
					if(results.isEmpty())
						return self.result(false, done, account, 'account not found');

					var account = results.response();

					if(token.account !== account.id) {
						// The token belongs to the wrong account
						return self.result(false, done, account, 'incorrect token/account pairing');
					}

					// The account is properly unverified
					TokenService.consume(token, function(err, results) {
						// Consume the token
						if(results.message() === undefined) {
							// The token was successfully consumed
							Account.update({
								id: account.id
							}, {
								password: password
							}, function(err, account) {
								if(err) {
									// An error occurred, reset the token
									TokenService.reset(token, function(err, results) {
										return self.result(false, done, guid, 'database failure', err);
									});
								} else {
									// The account was successfully updated
									return self.result(true, done, guid);
								}
							});	
						} else {
							// The token was not correctly consumed
							return self.result(false, done, guid, results.message());
						}
					});
				});
			} else {
				// No token found
				return self.result(false, done, guid, 'token incorrectly formed');
			}
		});
	};
};