var router = require('express').Router(),
	path = require('path'),
	fs = require('fs');

/*
	Will return the entire log file
*/
router.get('/', function(req, res) {
	res.sendFile(path.join(__ROOT, 'log.log'));
});

/*
	Will clear the log file contents if it exists
	NOTE log file will only be used when deployed in production and will be automatically created

*/
router.get('/clear', function(req, res) {
	fs.exists(path.join(__ROOT, 'log.log'), function(exists) {
		if (exists) {
			fs.writeFile(path.join(__ROOT, 'log.log'), '', function(e) {
				res.status(e ? 500 : 200).send(e || 'Cleared');
			});
		} else {
			res.status(500).send({
				ErrorMessage: 'Log file does not exist'
			});
		}
	});
});

module.exports = router;