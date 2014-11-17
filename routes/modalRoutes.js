var router = require('express').Router();

/*
	Will render the orphaned deploy modal
*/
router.get('/orphanedDeployModal', function(req, res) {
    res.render('orphanedDeployModal');
});

module.exports = router;