var router = require('express').Router();

/*
	Will render the default dahsobard page
*/
router.get('/', function(req, res) {
    res.render('dashboard');
});

module.exports = router;