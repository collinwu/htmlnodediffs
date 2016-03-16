var cheerio = require('cheerio');
var request = require('request');
var fs = require('fs');

var routes = require(__dirname + '/routes.json');
var config = {
  devhost: 'http://{{create_staging_sb}}.sandbox.engadget.com',
  prodhost: 'http://www.engadget.com'
};

// DevBox Meta Obj
var devboxMetas = {};
// Production Meta Obj
var productionMetas = {};

request('http://www.engadget.com/2016/03/12/scott-kelly-retires/', function(err, res, body) {
  $ = cheerio.load(body);

  $('meta').each(function(index, el) {
    metaTags[index] = $(this).attr();
  });

  console.log(metaTags);
});

// Function that checks the attribute content.
  // If attribute content contains http://www.engadget.com or the devbox, then

