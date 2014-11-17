var monk = require('monk'),
	Database,
	atCollection;

var connectionString = __CONFIG.dataAccess.user + ':' + __CONFIG.dataAccess.password + '@';
connectionString += __CONFIG.dataAccess.host + ':' + __CONFIG.dataAccess.port + '/' + __CONFIG.dataAccess.database;

module.exports = {
	connect: function() {
		if(atCollection) return atCollection;
		
		Database = monk(connectionString);
		atCollection = Database.get(__CONFIG.dataAccess.collection);

		return atCollection;
	},
	get: function() {
		return atCollection;
	}
}