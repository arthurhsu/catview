var gulp = require('gulp');
var gulpConnect = require('gulp-connect');
var nopt = require('nopt');

var log = console.log;


function showHelp() {
  log('Usage:');
  log('  gulp server [--port=<port>]');
}


gulp.task('default', function() {
  showHelp();
});


gulp.task('server', function() {
  var knownOpts = {
    'port': [Number]
  };

  var options = nopt(knownOpts);
  var port = options.port || 8000;

  // Start the server
  gulpConnect.server({
    livereload: false,
    port: port,
    root: __dirname
  });
});
