//Build Repository Object
exports.createRepo = function(host, apiKey) {

	var repo = {
		client: require('./client').createClient(host, apiKey)
	}

	repo.machine = require('./machine')(repo.client);
	repo.environment = require('./environment')(repo.client);
	repo.dashboard = require('./dashboard')(repo.client);
	repo.release = require('./release')(repo.client);
	repo.deploy = require('./deploy')(repo.client);
	repo.task = require('./task')(repo.client);

	return Object.create(repo);
}