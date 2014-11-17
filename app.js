global.__CONFIG = require('./config.json');
global.__ROOT = __dirname;

//TODO: put these flags in a database or json file, not global in-memory variables
//Flags
global.deployProcessing = false;
global.checkForDeployments = false;
global.checkActiveDeploymentState = false;
global.checkMachinesToShutdown = false;
global.checkForDeploymentsUnlock = false;


//App modules
var express = require('express'),
    path = require('path'),
    cookieParser = require('cookie-parser'),
    bodyParser = require('body-parser'),
    https = require('https');

//Create database connection
require(path.join(__ROOT, 'modules', 'data-access')).connect();

var routes = require('./routes/routesIndex.js');

//express setup
var app = express();
app.set('port', 3001);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use(cookieParser());
app.set('views', path.join(__ROOT, 'views'));
app.set('view engine', 'jade');
app.use(express.static(path.join(__ROOT, 'public')));

//Strap express routes
app.use('/', routes.web);
app.use('/modals', routes.modal);
app.use('/log', routes.log);
app.use('/api', routes.api);

//Start express server
app.listen(app.get('port'), function() {
    console.log('listening on *:', app.get('port'));
});

//start running tasks
require(path.join(__ROOT, 'tasks', 'tasksIndex.js')).start();