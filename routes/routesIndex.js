var path = require('path');

module.exports = {
	web: require(path.join(__dirname, 'webRoutes.js')),
	modal: require(path.join(__dirname, 'modalRoutes.js')),
	log: require(path.join(__dirname, 'logRoutes.js')),
	api: require(path.join(__dirname, 'apiRoutes.js'))
}