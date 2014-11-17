/*
	Repeated Tasks Index
	Tasks have to be manually started, after which they will run on a timer if their associated flag is true.
	See each task file for more info.
*/

module.exports = {
	start: function() {
		require(__dirname + '/checkPoolMachineShutdownTask.js')();
		require(__dirname + '/checkQueuedDeploymentTask.js')();
		require(__dirname + '/checkRunningDeploymentTask.js')();
		require(__dirname + '/checkTestingCompleteTask.js')();
	}
}