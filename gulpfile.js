var fs = require('fs-extra');
var gulp = require('gulp');
var gulpConnect = require('gulp-connect');
var nopt = require('nopt');
var path = require('path');

var log = console.log;

var DIST_FILES = [
  'style.css',
  'main.js',
  'node_modules/bootstrap-table/dist/bootstrap-table.css',
  'node_modules/bootstrap/dist/css/bootstrap.min.css',
  'node_modules/dateformat/lib/dateformat.js',
  'node_modules/jquery/dist/jquery.min.js',
  'node_modules/jszip/dist/jszip.min.js',
  'node_modules/bootstrap/dist/js/bootstrap.min.js',
  'node_modules/bootstrap-table/dist/bootstrap-table.min.js',
  'node_modules/lovefield/dist/lovefield.min.js'
];


function showHelp() {
  log('Usage:');
  log('  gulp server [--port=<port>]');
  log('  gulp build');
}


gulp.task('default', function() {
  showHelp();
});


gulp.task('server', ['build'], function() {
  var knownOpts = {
    'port': [Number]
  };

  var options = nopt(knownOpts);
  var port = options.port || 8000;

  // Start the server
  gulpConnect.server({
    livereload: true,
    port: port,
    root: path.join(__dirname, 'build')
  });
});

gulp.task('build', function() {
  var buildDir = path.join(__dirname, 'build');
  fs.ensureDirSync(buildDir);

  // Copy all dependencies flattened.
  DIST_FILES.forEach(function(fileName) {
    fs.copySync(fileName, path.join(buildDir, path.basename(fileName)));
  });

  // Now alter the index.html.
  var contents =
      fs.readFileSync(path.join(__dirname, 'index.html'), {encoding: 'utf8'});
  var newContents =
      contents.split('\n').map(function(line) {
        for (var i = 0; i < DIST_FILES.length; ++i) {
          var file = DIST_FILES[i];
          if (line.indexOf(file) != -1) {
            return line.replace(file, path.basename(file));
          }
        }
        return line;
      }).join('\n');
  fs.writeFileSync(path.join(buildDir, 'index.html'),
                   newContents,
                   {encoding: 'utf8'});
});
