app.filter('statusLabel', function() {
	return function(deploy) {
		var activeStates = ['Provisioning', 'Executing', 'Queued', 'Cancelling'],
			label = {
				label: true
			};
		if (deploy.isProvisioning || deploy.isExecuting || !deploy.isCompleted) {
			label['label-info'] = true;
		} else if (deploy.isSuccessful && deploy.isCompleted) {
			label['label-success'] = true;
		} else {
			label['label-danger'] = true;
		}
		return label;
	}
});

app.filter('disableUnlock', function() {
	return function(deploy) {
		if (deploy.deployment.isProvisioning || deploy.deployment.isExecuting || !deploy.deployment.isCompleted || deploy.orphanedDeployments.length > 0) return true;

		return false;
	}
});

app.filter('formatNextDeploy', function($filter){
	return function(deploy){
		if(!deploy || !Object.keys(deploy).length) return 'Non Queued';

		return deploy.buildId + ' on branch ' + deploy.branch + ', queued: ' + $filter('formatDate')(deploy.queued);
	}
});

app.filter('formatDate', function(){
	return function(date, format){
		if(!date) return date;

		if(!format) return moment(date).fromNow();

		return moment(date).format(format);
	}
});

app.filter('formatNull', function(){
	return function(data, message){
		if(!data) return message;

		return data;
	}
});