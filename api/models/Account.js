var bcrypt = require('bcrypt');

var hashPassword = function(password, next) {
    bcrypt.genSalt(10, function(err, salt) {
    	if (err) {
    		return next(err);
		}
		bcrypt.hash(password, salt, next);
    });
};

/**
 * Account
 *
 * @module      :: Model
 * @description :: A short summary of how this model works and what it represents.
 * @docs		:: http://sailsjs.org/#!documentation/models
 */

module.exports = {

  attributes: {	  
  	name: {
  		type: 'string',
  		required: false
  	},
	email: {
		type: 'email',
		unique: true,
  		required: true
	},
	type: {
		type: 'integer',
  		required: true,
  		defaultsTo: 0
	},
	password: {
		type: 'string',
  		required: true
	},
	status: {
		type: 'integer',
  		required: true,
  		defaultsTo: 0
	},
	tokens: {
		collection: 'accounttoken',
		via: 'account'
	},

	toJSON: function() {
		var result = this.toObject();
		delete result.password;
		return result;
	}
  },

  constants: {
	  type: {
		  standard: 0,		// A typical user	
		  test: 1,			// A mock user used in testing
		  demonstration: 2,	// A user for demonstration purposes
		  nonhuman: 3		// A nonhuman user that acts like a real user
	  },
	  status: {
		  unverified: 0,	// The user is new and their email has not been verified yet
		  active: 1,		// The user has had their email verified and is active
		  disabled: 2,		// The user is disabled
	  }
  },
  
  beforeValidation: function(record, cb) { cb(); },

  /**
   * Hash the password before the record is created
   * @param record
   * @param next
   */
  beforeCreate: function(record, next) {
	  hashPassword(record.password, function(err, hash) {
		  if(err) {
			  return next(err);
		  }
		  record.password = hash;
		  next();
	  });
  },
  afterCreate: function(record, cb) { cb(); },

  /**
   * 
   * @param record
   * @param next
   * @returns
   */
  beforeUpdate: function(values, next) {
	  if(values.password) {
		  hashPassword(values.password, function(err, hash) {
			  if(err) {
				  return next(err);
			  }
			  values.password = hash;
			  next();
		  });
	  } else {
		  next();
	  }
  },
  afterUpdate: function(record, cb) { cb(); },

  beforeDestroy: function(record, cb) { cb(); },
  afterDestroy: function(record, cb) { cb(); }
};
