/********** Libraries **********/
var request = require('request');
var cron = require('cron').CronJob;
var cheerio = require('cheerio');
var async = require('async');
var redis = require('redis');
var fs = require('fs');
/*******************************/

/********** Redis configuration **********/
var redisClient = redis.createClient();
redisClient.setMaxListeners(0);
redisClient.select(9);
/*****************************************/

/********** Constants & Variables **********/
var imageUrlTimeout = 300;

// List of webcams to scrap
var urls =	[
							'http://lewatmana.com/cam/13/dr-satrio-casablanca',
							'http://lewatmana.com/cam/21/pancoran',
							'http://lewatmana.com/cam/87/gatot-subroto-semanggi',
							'http://lewatmana.com/cam/105/dr-satrio-Karet',
							'http://lewatmana.com/cam/112/sudirman-setiabudi',
							'http://lewatmana.com/cam/159/tugu-pancoran',
							'http://lewatmana.com/cam/160/pancoran-barat',
							'http://lewatmana.com/cam/191/mt-haryono-pancoran',
							'http://lewatmana.com/cam/248/alternatif-cibubur',
							'http://lewatmana.com/cam/249/alternatif-cibubur-transyogi',
						];
/*******************************************/

var job = new cron({
	// Change how often you want to download images. The default is 1 minute
  cronTime: '0 */1 * * * *',
  onTick: function() {
		console.log('\n######################################################################');
		console.log('Download images started at ' + new Date());
		console.log('######################################################################');

  	// Each url to scrap
		async.each(urls,
		  function (currUrl, callback) {
		  	// Get the webcam url
				request.get(currUrl, function (error, response, body) {
				  if(!error && body) {
				    var $ = cheerio.load(body);

				    var imageUrl = $('.cam-image').attr('src');
				    var dirName;

				  	if(imageUrl) {
				  		async.series([
				  			// Check for images dir, if it doesn't exist, create
				  			function (callback) {
							    fs.exists('./images', function (exists) {
								    if(exists) {
								    	callback(null);
								    }
								    else {
								      fs.mkdir('./images', function() {
								      	callback(null);
								      });
								    }
								  });
							  },

				  			// Check for images/url dir, if doesn't exist create
							  function (callback) {
							  	dirName = currUrl.split('/').pop();
							  	
							    fs.exists('./images/' + dirName, function (exists) {
								    if(exists) {
								    	callback(null);
								    }
								    else {
								      fs.mkdir('./images/' + dirName, function() {
								      	callback(null);
								      });
								    }
								  });
							  },

				  			// Check if imageUrl is already downloaded
				  			function (callback) {
									redisClient.multi()
										  .get(imageUrl, function (err, result) {})
										  .expire(imageUrl, imageUrlTimeout)
										  .exec(function (err, replies) {
									  if(replies[0]) {
									    // Image already downloaded, skip all steps and go to next url
									    callback(1);
									  }
									  else {
									  	// Next step
									  	callback(null);
									  }
									});
							  },

							  // Download the image
							  function (callback) {
							  	var fileName = './images/' + dirName + '/' + imageUrl.split('/').pop();
							  	
							  	request(imageUrl, function (error, response, body) {
									  if (!error && response.statusCode == 200) {
									  	console.log('Downloaded new image to ' + fileName);

									  	// Save url into Redis so it won't be redownloaded next time
									    redisClient.multi()
												  .set(imageUrl, 1, function (err, result) {})
												  .expire(imageUrl, imageUrlTimeout)
												  .exec(function (err, replies) {
											  callback(null);
											});
									  }
									  else {
									  	// If image fails downloading, skips all steps, delete the partially downloaded file and go to next url
									  	fs.unlink(fileName, function (err) {
											  callback(1);
											});
									  }
									}).pipe(fs.createWriteStream(fileName));
							  }
							],
							function (err, results) {
								// Next url
							  callback(null);
							});
				  	}
				  	else {
				  		// Next url
				  		callback(null);
				  	}
				  }
				  else {
				  	// Next url
				  	callback(null);
				  }
				});
		  },
		function (err) {
		  console.log('######################################################################');
			console.log('Download images ended at ' + new Date());
			console.log('######################################################################');
		});
  },
  start: true
});



		

		

