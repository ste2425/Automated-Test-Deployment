//Environment Methods
module.exports = function(client) {
	return {
		getDashboard: function(callback) {
			client.performRequest('/api/dashboard', callback);
		},
		getDashboardDynamic: function(callback) {
			client.performRequest('/api/dashboard/dynamic', callback);
		}
	}
}