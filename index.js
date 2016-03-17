var cheerio = require('cheerio');
var events = require('events');
var request = require('request');
var fs = require('fs');
var promise = require('bluebird');
var _ = require('lodash');

var routes = require(__dirname + '/routes.json');
var devConfig = require(__dirname + '/devConfig.js');

var config = {
  devhost: devConfig.devHost,
  prodhost: 'www.engadget.com'
};

// DevBox Meta Obj
var devboxMetas = {};
// Production Meta Obj
var productionMetas = {};

function syncLoop(iterations, process, exit) {  
  var index = 0;
  var done = false;
  var shouldExit = false;
  
  var loop = {
    numOfServerErrors: 0,
    uncompletedIndexes: iterations,
    next: function() {
      if (done) {
        if(shouldExit && exit){
          return exit(loop); // Exit if we're done
        }
      }
      // If we're not finished
      if (index < iterations) {
        index++; // Increment our index
        process(loop); // Run our process, pass in the loop
        // Otherwise we're done
      } else {
        done = true; // Make sure we say we're done
        if(exit) exit(loop); // Call the callback on exit (pass loop)
      }
    },
    iteration: function() {
      return index - 1; // Return the loop number we're on
    },
    break: function(end) {
      done = true; // End the loop
      shouldExit = end; // Passing end as true means we still call the exit callback
    }
  };
  loop.next();
  return loop;
};

function getAndStorePageData(loop, routesArray, routeIndex, host, hostObj) {
  var route = routesArray[routeIndex];
  request('http://' + host + route, function(err, res, body) {
    console.log('requesting: ', host + route);

    if (res.statusCode > 500 && res.statusCode < 600) {
      loop.break();
    }

    $ = cheerio.load(body);

    $('meta').each(function(i, el) {
      var metaClass = $(this).attr().class;
      var metaName = $(this).attr().name;
      var metaContent = $(this).attr().content;
      var metaProperty = $(this).attr().property;
      var metaContainsHost = false;

      if (!hostObj[route]) {
        hostObj[route] = {};
      }

      // Logic
      // If the meta element has as name property, check if if it is msapplication or twitter
      if (metaName) {
        // If yes, DO NOT PUSH TO ROUTE ARRAY
        if (metaName.indexOf('msapplication') !== -1 || metaName.indexOf('twitter') !== -1) {
          // SKIP
        } else {
        // ELSE IF !msapplication AND !twitter
          if (typeof metaContent === 'string') {
            var partialEngadget = '.engadget.com'
            metaContainsHost = metaContent.indexOf(partialEngadget) !== -1;
  
            if (metaContainsHost) {
              var indexOfSlice = $(this).attr().content.indexOf(partialEngadget) + 13;
              $(this).attr().content = $(this).attr().content.slice(indexOfSlice);
            }
          }

          var attrKeyObj = _.merge({}, $(this).attr());
          delete attrKeyObj.content;
          hostObj[route][JSON.stringify(attrKeyObj)] = $(this).attr();
        }
      } else {
        if (metaProperty && metaProperty.indexOf('og:image') !== -1) {
          // SKIP
        } else {
          if (typeof metaContent === 'string') {
            var partialEngadget = '.engadget.com'
            metaContainsHost = metaContent.indexOf(partialEngadget) !== -1;
            
            if (metaContainsHost) {
              var indexOfSlice = $(this).attr().content.indexOf(partialEngadget) + 13;
              $(this).attr().content = $(this).attr().content.slice(indexOfSlice);
            }
          }
          
          var attrKeyObj = _.merge({}, $(this).attr());
          delete attrKeyObj.content;
          hostObj[route][JSON.stringify(attrKeyObj)] = $(this).attr();
        }

      }
    });
    loop.next();
  });
};


function grabData(host, hostMetaObj, cb) {
  var err = '';
  syncLoop(routes.length, function(loop) {
    getAndStorePageData(loop, routes, loop.iteration(), host, hostMetaObj);
  }, function(loop) {
    if (loop.numOfServerErrors > 0) {
      err = '***** Sever error encountered - please re-run *****';
    } else {
      console.log('***** All requests have been made *****');
    }
    var data = hostMetaObj
    cb(err, data);
  })
};


function compareMetaTags(devMetas, prodMetas) {
  var noMatchingMetas = {};
  for (var route in devMetas) {
    if (Object.keys(devMetas[route]).length !== Object.keys(prodMetas[route]).length) {
      console.log(devMetas[route], 'this is the devMeta\'s route');
      console.log(Object.keys(devMetas[route]).length, 'devMetas[route].length');
      console.log(prodMetas[route], 'this is the prodMeta`\s route');
      console.log(Object.keys(prodMetas[route]).length, 'prodMetas[route].length');
      console.log('Number of metas are off');
      return;
    }

    for (var objKey in devMetas[route]) {
      if (devMetas[route][objKey].content !== prodMetas[route][objKey].content) {
        noMatchingMetas[route] = {
          name_prop: devMetas[route][objKey].name || devMetas[route][objKey].property,
          dev_content: devMetas[route][objKey].content,
          prod_content: prodMetas[route][objKey].content
        }
      }
    }

  };
  console.log(Object.keys(noMatchingMetas).length ? noMatchingMetas : 'All metas match');
  return;
};

var grabDataAsync = promise.promisify(grabData);

grabDataAsync(config.prodhost, productionMetas)
  .then(function(data) {
    grabDataAsync(config.devhost, devboxMetas)
      .then(function(data) {
        console.log('Both Requests Completed');
        compareMetaTags(devboxMetas, productionMetas)
      });
  });

