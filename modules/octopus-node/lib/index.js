(function() {
	var repo = require('./repository/repo.js');

    exports.client = function(host, apiKey){
        if(!host && !apiKey){
        	return new Error('Octopus host and api key requried but not all provided.');
        }else{
        	return new repo.createRepo(host.replace('http://', ''), apiKey);
        }
    }
}());