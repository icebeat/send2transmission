(function() {

	var Transmission = {

		// config transmission
		server: "http://admin:admin@flex:9091/transmission/rpc", // http://user:pass@host:port/path2transmission/rpc
		downloadDir: "/share/HDA_DATA/Multimedia/Movies", // where?
		paused: false, // start downloading or not

		// private var
		sessionId: null,

		getSession: function (callback) {
			var xhr = new XMLHttpRequest;
			xhr.onreadystatechange = function(){
				if(xhr.readyState!=4) return;
				var _sessionId = xhr.getResponseHeader('X-Transmission-Session-Id');
				if(xhr.status!=409 && xhr.status!=200 || !_sessionId) {
					callback("error");
					return;
				};
				Transmission.sessionId = _sessionId;
				callback("success");
				return;
			};
			xhr.open("POST", Transmission.server, true);
			xhr.send();
		},

		addMagnet: function (magnetLink, callback) {
			if (!Transmission.sessionId) {
				Transmission.getSession(function (status) {
					if (status!="success") {
						callback("error");
					} else {
						Transmission.addMagnet(magnetLink, callback);
					}
				});
			} else {

				var data = {
					method: "torrent-add",
					arguments: {
						"filename": magnetLink,
						"paused": Transmission.paused, 
						"download-dir": Transmission.downloadDir
					}
				};

				var xhr = new XMLHttpRequest;
				xhr.onreadystatechange = function(){
					if(xhr.readyState!=4) return;
					var response = JSON.parse(xhr.responseText);
					// handle 409s (for CSRF token timeout) by asking for a new token
					if(xhr.status==409) {
						return Transmission.getSession(function (status) {
							if (status!="success") {
								callback("error");
							} else {
								Transmission.addMagnet(magnetLink, callback);
							}
						});
					}	
					if(xhr.status!=200) {
						callback("error");
						return;
					}
					
					if(response.result != "success") {
						callback("error");
						return;
					}
					callback("success", response);
				};
				xhr.open("POST", Transmission.server, true);
				xhr.setRequestHeader('X-Transmission-Session-Id', Transmission.sessionId);
				xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
				xhr.send(JSON.stringify(data));
			}
		}

	};

	chrome.contextMenus.create({
		title: "Send to Transmission",
		contexts: ["link"],
		targetUrlPatterns: ["magnet:\?*"],
		onclick: function(info, tab) {
			Transmission.addMagnet(info.linkUrl, function (status, response) {
				if (status == "success") {
					var notification = webkitNotifications.createNotification(
						"images/icon48.png",
						response.arguments["torrent-added"].name,
						"Torrent was successfully added to Transmission."
					);
				} else {
					var notification = webkitNotifications.createNotification(
						"images/icon48.png",
						"Torrent addition failed",
						"Torrent couldn't be added to Transmission."
					);
				}
				notification.show();
				setTimeout(function () {
					notification.cancel();
				}, 1500);
			});
		}
	});

}());
