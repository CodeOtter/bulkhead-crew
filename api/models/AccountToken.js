var Guid = require('guid');

/**
 * AccountToken
 *
 * @module      :: Model
 * @description :: A Token is a request for uniqueness.
 * @docs		:: http://sailsjs.org/#!documentation/models
 */

module.exports = {

  attributes: {	  
  	guid: {
  		type: 'string',
  		required: false
  	},
	type: {
		type: 'integer',
  		required: true,
  		defaultsTo: 0
	},
	status: {
		type: 'integer',
  		required: true,
  		defaultsTo: 0
	},
	expiresAt: {
		type: 'datetime',
		required: true
	},
	contents: {
		type: 'string',
		required: false
	},
	account: {
		model: 'account',
		required: true
	},

	toJson: function() {
		var result = this.toObject();
		return result;
	}
  },

  constants: {
	  type: {
		  passwordVerification: 0,		// A password reset token
		  emailVerification: 1	// A password reset token
	  },
	  status: {
		  pending: 0,		// The token has not been consumed
		  consumed: 1,		// The token was consumed
		  expired: 2,		// The token expired
	  }
  },
  
  beforeValidation: function(record, cb) { cb(); },
  
  /**
   * Generate a guid before the record is created
   * @param record
   * @param next
   */
  beforeCreate: function(record, next) {
	record.guid = Guid.create().value;
    next(null, record);
  },

  afterCreate: function(newlyInsertedRecord, cb) { cb(); },

  beforeUpdate: function(valuesToUpdate, cb) { cb(); },
  afterUpdate: function(updatedRecord, cb) { cb(); },

  beforeDestroy: function(criteria, cb) { cb(); },
  afterDestroy: function(criteria, cb) { cb(); }
};
