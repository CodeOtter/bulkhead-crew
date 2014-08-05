module.exports = {
	service: {
		account: require('./api/services/AccountService'),
		token: require('./api/services/TokenService'),
		policy: require('./api/services/PolicyService')
	},
	bootstrap: function(sails, done) {
		//require('./api/services/Bootstrap').load()
		console.log('licks')
		/*var mailer = require('bulkhead-mailer');
		sails.config.express.customMiddleware = require('./lib/config/passport');
		sails.service.accountservice = this.service.account;
		sails.service.tokenservice = this.service.token;
		sails.service.policyservice = this.service.policy;
		sails.models.account = require('./lib/models/Account');
		sails.models.accounttoken = require('./lib/models/AccountToken');
		sails.config.mailer = mailer.config;*/
		done();
	}
};
