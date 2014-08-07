var suite = require('bulkhead-test'),
	assert = require('assert'),
	crew = require('../../index');
	bulkhead = require('bulkhead'),
	mailer = require('bulkhead-mailer');

describe('crew.account', function() {
	suite.lift(bulkhead.bootstrap.load);
	describe('Base Class', function() {
		it('should be able to find accounts based on multiple types of criteria', function(done) {
			// Add mailer configuration for testing
			crew.account.find(['bob@bob.com', { email: 'tim@tim.com' }, null], function(err, result) {
				assert.deepEqual(result.response(0), null);
				assert.deepEqual(result.response(1).email, 'bob@bob.com');
				assert.deepEqual(result.response(2).email, 'tim@tim.com');
				assert.deepEqual(result.response(3), undefined);
				done();
			});
		});
		
		it('should register new accounts and delete them', function(done) {
			crew.account.register('test@test.com', 'Test', 'Test', 0, 0, function(err, result) {
				// Create the account
				if(err) {
					assert.fail(err);
				}
				var account = result.response();
				assert.deepEqual(account.email, 'test@test.com');
				assert.deepEqual(account.name, 'Test');
				assert.deepEqual(account.type, 0);
				assert.deepEqual(account.status, 0);
				assert.ok(account.password.length > 0);
				
				crew.account.find('test@test.com', function(err, account) {
					// Confirm its in the database
					if(err) {
						assert.fail(err);
					}
					var account = result.response();
					assert.deepEqual(account.email, 'test@test.com');
					assert.deepEqual(account.name, 'Test');
					assert.deepEqual(account.type, 0);
					assert.deepEqual(account.status, 0);
					assert.ok(account.password.length > 0);
					
					crew.account.remove(account, function(err, result) {
						// Remove the new account
						if(err) {
							assert.fail(err);
						}
						assert.ok(result.response() == true);
						
						crew.account.find('test@test.com', function(err, result) {
							// Confirm the account has been removed
							if(err) {
								assert.fail(err);
							}
							assert.deepEqual(result.response(), undefined);
						});
						done();
					});				
				});

			});
		});

		it('should disable then renable an account', function(done) {
			crew.account.find('bob@bob.com', function(err, result) {
				// Find the fixture
				var account = result.response();
				assert.deepEqual(account.status, Account.constants.status.unverified);
				crew.account.disable(account, function(err, result) {
					// Disable the account
					crew.account.find(account.id, function(err, result) {
						// Find the account again to make sure the database change committed
						var account = result.response();
						assert.deepEqual(account.status, Account.constants.status.disabled);
						crew.account.enable(account, function(err, result) {
							// Enable the account
							crew.account.find(account.id, function(err, result) {
								// Find the account again to make sure the database change committed
								var account = result.response();
								assert.deepEqual(account.status, Account.constants.status.active);
								done();
							});
						});
					});
				});
			});
			
		});

		it('should get accounts by login credentials', function(done) {
			crew.account.getByLogin('bob@bob.com', 'Bob', function(err, result) {
				// Check if the account can correctly login
				if(err) {
					assert.fail(err);
				}
				var account = result.response();
				assert.deepEqual(account.email, 'bob@bob.com');
				assert.deepEqual(account.name, 'Bob');
				assert.deepEqual(account.type, 0);
				assert.deepEqual(account.status, Account.constants.status.active);
				assert.ok(account.password.length > 0);
				
				crew.account.getByLogin('ralph@ralph.com', 'Ralph', function(err, result) {
					// Attempt to login with an account that isn't there
					assert.deepEqual(result.message(), 'account not found');
					assert.deepEqual(result.response(), false);
					
					crew.account.getByLogin('bob@bob.com', 'berb', function(err, result) {
						// Login with an account that is there, but with a bad password
						assert.deepEqual(result.message(), 'invalid password');
						assert.deepEqual(result.response(), false);
						
						crew.account.disable('bob@bob.com', function(err, result) {
							// Disable an account...

							crew.account.getByLogin('bob@bob.com', 'Bob', function(err, result) {
								// ... to make sure it fails when you try to login again.
								assert.deepEqual(result.message(), 'account is disabled');
								assert.deepEqual(result.response(), false);
								done();
							});
						});
					});
				});
			});
		});

		it('should create and consume a general token', function(done) {
			crew.account.find('bob@bob.com', function(err, result) {
				var account = result.response();
				crew.token.create(result.response(), null, null, null, null, function(err, result) {
					// Create a token
					if(err) {
						assert.fail(err);
					}

					var token = result.response();
					assert.ok(token.id > 0);
					assert.ok(token.expiresAt.getTime() > Date.now());
					assert.deepEqual(token.contents, null);
					assert.deepEqual(token.type, AccountToken.constants.type.passwordVerification);
					assert.deepEqual(token.status, AccountToken.constants.status.pending);

					crew.token.find(token.id, function(err, result) {
						// Confirm the token exists
						if(err) assert.fail(err);
						var token2 = result.response();
						assert.deepEqual(token.id, token2.id);
						assert.deepEqual(token.contents, token2.contents);
						assert.deepEqual(token.expiresAt, token2.expiresAt);
						assert.deepEqual(token.type, token2.type);
						assert.deepEqual(token.status, token2.status);

						Account.findOne(account.id).populate('tokens').exec(function(err, account) {
							// Confirm the token binds to the account correctly
							if(err) assert.fail(err);
							var token = account.tokens[0];
							
							assert.deepEqual(account.tokens.length, 1);
							assert.deepEqual(token.id, token2.id);
							assert.deepEqual(token.contents, token2.contents);
							assert.deepEqual(token.expiresAt, token2.expiresAt);
							assert.deepEqual(token.type, token2.type);
							assert.deepEqual(token.status, token2.status);
							
							crew.token.consume(token.guid, function(err, result) {
								// Consume the token
								if(err) assert.fail(err);
								assert.deepEqual(result.response(), null);
								crew.token.consume(token.guid, function(err, result) {
									// Ensure the token cannot be consumed again
									if(err) assert.fail(err);
									assert.deepEqual(result.response(), false);
									
									crew.token.find(token.id, function(err, result) {
										// Confirm the token is correctly consumed
										if(err) assert.fail(err);
										var token2 = result.response();
										assert.deepEqual(token.id, token2.id);
										assert.deepEqual(token.contents, token2.contents);
										assert.deepEqual(token.expiresAt, token2.expiresAt);
										assert.deepEqual(token.type, token2.type);
										assert.deepEqual(token2.status, AccountToken.constants.status.consumed);
										
										Account.findOne(account.id).populate('tokens').exec(function(err, account) {
											// Confirm the token binds to the account correctly
											if(err) assert.fail(err);
											var token2 = account.tokens[0];

											assert.deepEqual(account.tokens.length, 1);
											assert.deepEqual(token.id, token2.id);
											assert.deepEqual(token.contents, token2.contents);
											assert.deepEqual(token.expiresAt, token2.expiresAt);
											assert.deepEqual(token.type, token2.type);
											assert.deepEqual(token2.status, AccountToken.constants.status.consumed);
											
											crew.token.cleanup(function(err, result) {
												// Remove all expired tokens
												if(err) assert.fail(err);
												assert.ok(result.response());
												
												crew.token.find(token.id, function(err, result) {
													// Make sure the token no longer exists
													if(err) assert.fail(err);
													assert.deepEqual(result.response(), undefined);

													Account.findOne(account.id).populate('tokens').exec(function(err, account) {
														// Confirm the token no longer populates
														if(err) assert.fail(err);
														var token = account.tokens[0];

														assert.deepEqual(result.response(), undefined);
														done();
													});
												});
											});
										});
									});
								});
							});
						});
					});
				});
			});
		});
		
		it('should verify an email address', function(done) {
			crew.account.find('ed@ed.com', function(err, result) {
				// Get an account
				if(err) assert.fail(err);
				var account = result.response();

				crew.token.create(account, AccountToken.constants.type.emailVerification, null, null, 'ted@ted2.com', function(err, result) {
					// Create a token for the account
					if(err) {
						assert.fail(err);
					}
					var token = result.response();

					crew.account.verifyEmail(account, token, function(err, result) {
						// Consume the token to verify the email
						if(err) assert.fail(err);
						assert.ok(result.response() !== false);
						
						crew.account.find(account, function(err, result) {
							// Confirm the account changed status
							if(err) assert.fail(err);
							var account = result.response();
							assert.ok(account.status === Account.constants.status.active);
							assert.ok(account.email === token.contents);

							crew.token.find(token, function(err, result) {
								// Confirm the token changed
								if(err) assert.fail(err);
								var token = result.response();
								assert.ok(token.status === AccountToken.constants.status.consumed);

								crew.account.verifyEmail(account, token, function(err, result) {
									// Confirm the email cannot be verified twice
									assert.ok(!result.response());

									crew.account.find(account, function(err, result) {
										// Confirm the account remained the same
										if(err) assert.fail(err);
										assert.ok(result.response().status === Account.constants.status.active);
										crew.token.find(token, function(err, result) {
											// Confirm the token remained the same
											if(err) assert.fail(err);
											var token = result.response();
											assert.ok(token.status === AccountToken.constants.status.consumed);
											crew.token.cleanup(function(err, result) {
												if(err) assert.fail(err);
												assert.ok(result.response());
												done();
											});
										});
									});
								});
							});
						});
					});
				});
			});
		});
		
		it('should expire a token', function(done) {
			crew.account.find('bob@bob.com', function(err, result) {
				var account = result.response();
				crew.token.create(result.response(), null, null, -360000, null, function(err, result) {
					// Create a token
					if(err) {
						assert.fail(err);
					}

					var token = result.response();
					assert.ok(token.id > 0);
					assert.ok(token.expiresAt.getTime() < Date.now());
					assert.deepEqual(token.contents, null);
					assert.deepEqual(token.type, AccountToken.constants.type.passwordVerification);
					assert.deepEqual(token.status, AccountToken.constants.status.pending);
							
					crew.token.consume(token.guid, function(err, result) {
						// Consume the token
						if(err) assert.fail(err);
						assert.deepEqual(result.response(), false);

						crew.token.cleanup(function(err, result) {
							// Remove all expired tokens
							if(err) assert.fail(err);
							assert.ok(result.response());
							
							crew.token.find(token.id, function(err, result) {
								// Make sure the token no longer exists
								if(err) assert.fail(err);
								assert.deepEqual(result.response(), undefined);

								Account.findOne(account.id).populate('tokens').exec(function(err, account) {
									// Confirm the token no longer populates
									if(err) assert.fail(err);
									var token = account.tokens[0];

									assert.deepEqual(result.response(), undefined);

									crew.account.enable(account, function(err, account) {
										if(err) assert.fail(err);
										done();	
									});
								});
							});
						});
					});
				});
			});
		});

		it('should reset an accounts password', function(done) {
			crew.account.find('tim@tim.com', function(err, result) {
				var account = result.response();
				crew.account.requestPasswordReset(result.response(), function(err, result) {
					// Create a token
					if(err) {
						assert.fail(err);
					}

					var token = result.response();
					assert.ok(token.id > 0);
					assert.ok(token.expiresAt.getTime() > Date.now());
					assert.deepEqual(token.contents, null);
					assert.deepEqual(token.type, AccountToken.constants.type.passwordVerification);
					assert.deepEqual(token.status, AccountToken.constants.status.pending);

					crew.account.resetPassword(account, token.guid, 'tested', function(err, result) {
						// Consume the token
						if(err) assert.fail(err);
						assert.deepEqual(result.response(), true);

						crew.token.cleanup(function(err, result) {
							// Remove all expired tokens
							if(err) assert.fail(err);
							assert.ok(result.response());
							
							crew.token.find(token.id, function(err, result) {
								// Make sure the token no longer exists
								if(err) assert.fail(err);
								assert.deepEqual(result.response(), undefined);

								Account.findOne(account.id).populate('tokens').exec(function(err, account) {
									// Confirm the token no longer populates
									if(err) assert.fail(err);
									var token = account.tokens[0];

									assert.deepEqual(result.response(), undefined);
									assert.ok(account.password[0] === '$');
									
									crew.account.getByLogin('tim@tim.com', 'tested', function(err, result) {
										// Check if the account can correctly login
										if(err) {
											assert.fail(err);
										}

										var account = result.response();
										assert.deepEqual(account.email, 'tim@tim.com');
										assert.deepEqual(account.name, 'Tim');
										assert.deepEqual(account.type, 0);
										assert.deepEqual(account.status, Account.constants.status.unverified);
										done();
									});
								});
							});
						});
					});
				});
			});
		});

		it('should verify an email address', function(done) {
			crew.account.find('tim@tim.com', function(err, result) {
				var account = result.response();
				crew.account.requestEmailChange(result.response(), 'john@john.com', function(err, result) {
					// Create a token
					if(err) {
						assert.fail(err);
					}

					var token = result.response();
					assert.ok(token.id > 0);
					assert.ok(token.expiresAt.getTime() > Date.now());
					assert.deepEqual(token.contents, 'john@john.com');
					assert.deepEqual(token.type, AccountToken.constants.type.emailVerification);
					assert.deepEqual(token.status, AccountToken.constants.status.pending);

					crew.account.verifyEmail(account, token.guid, function(err, result) {
						// Consume the token
						if(err) assert.fail(err);
						assert.deepEqual(result.response(), 'john@john.com');

						crew.token.cleanup(function(err, result) {
							// Remove all expired tokens
							if(err) assert.fail(err);
							assert.ok(result.response());
							
							crew.token.find(token.id, function(err, result) {
								// Make sure the token no longer exists
								if(err) assert.fail(err);
								assert.deepEqual(result.response(), undefined);

								Account.findOne(account.id).populate('tokens').exec(function(err, account) {
									// Confirm the token no longer populates
									if(err) assert.fail(err);
									var token = account.tokens[0];

									assert.deepEqual(result.response(), undefined);
									assert.ok(account.password[0] === '$');
									
									crew.account.getByLogin('john@john.com', 'tested', function(err, result) {
										// Check if the account can correctly login
										if(err) {
											assert.fail(err);
										}
										var account = result.response();
										assert.deepEqual(account.email, 'john@john.com');
										assert.deepEqual(account.name, 'Tim');
										assert.deepEqual(account.type, 0);
										assert.deepEqual(account.status, Account.constants.status.active);
										account.destroy(function(err) {
											if(err) assert.fail(err);
											done();
										})
									});
								});
							});
						});
					});
				});
			});
		});
		
		it('should update the account', function(done) {
			crew.account.update('bob@bob.com', 'kyle@kyle.com', 'password', 'Kyle', function(err, results){
				if(err) assert.fail(err);
				var account = results.response();

				assert.deepEqual(account.name, 'Kyle');
				assert.deepEqual(account.type, 0);
				assert.deepEqual(account.status, Account.constants.status.active);
				assert.ok(account.password.length > 0);

				// Gather tokens
				AccountToken.find().where({account : account.id}).exec(function(err, tokens) {
					assert.ok(tokens.length == 2);
					if(err) assert.fail(err);
					if(tokens[0].type === AccountToken.constants.type.passwordVerification) {
						var passwordToken = tokens[0],
							emailToken = tokens[1];
					} else {
						var passwordToken = tokens[1],
							emailToken = tokens[0];
					}

					crew.account.resetPassword(account, passwordToken.guid, 'password', function(err, result) {
						if(err) assert.fail(err);
						assert.ok(result.response() !== false);

						crew.account.verifyEmail(account, emailToken.guid, function(err, result) {
							if(err) assert.fail(err);
							assert.ok(result.response() !== false);

							crew.account.getByLogin('kyle@kyle.com', 'password', function(err, result) {
								// Check if the account can correctly login
								if(err) {
									assert.fail(err);
								}
								var account = result.response();
								assert.deepEqual(account.email, 'kyle@kyle.com');
								assert.deepEqual(account.name, 'Kyle');
								assert.deepEqual(account.type, 0);
								assert.deepEqual(account.status, Account.constants.status.active);
								crew.token.cleanup(function(err, result) {
									if(err) assert.fail(err);
									done();
								});
							});
						});
					});
				});
			});			
		});
	});
});