(function() {

var dbCrash;
var dbMain;
var tableCrash;
var tableMain;

function createDB() {
  var builderMain = lf.schema.create('main', 1);
  builderMain.createTable('line')
      .addColumn('no', lf.Type.INTEGER)
      .addColumn('timestamp', lf.Type.INTEGER)
      .addColumn('pid', lf.Type.INTEGER)
      .addColumn('tid', lf.Type.INTEGER)
      .addColumn('type', lf.Type.STRING)
      .addColumn('tag', lf.Type.STRING)
      .addColumn('message', lf.Type.STRING)
      .addIndex('idxTimestamp', ['timestamp'])
      .addIndex('idxPid', ['pid'])
      .addIndex('idxTag', ['tag']);
  builderMain.connect({storeType: lf.schema.DataStoreType.MEMORY}).then(
      function(db) {
        dbMain = db;
        tableMain = db.getSchema().table('line');
        console.log('main db created');
      });

  var builderCrash = lf.schema.create('crash', 1);
  builderCrash.createTable('line')
      .addColumn('no', lf.Type.INTEGER)
      .addColumn('timestamp', lf.Type.INTEGER)
      .addColumn('pid', lf.Type.INTEGER)
      .addColumn('tid', lf.Type.INTEGER)
      .addColumn('type', lf.Type.STRING)
      .addColumn('tag', lf.Type.STRING)
      .addColumn('message', lf.Type.STRING)
      .addIndex('idxTimestamp', ['timestamp'])
      .addIndex('idxPid', ['pid'])
      .addIndex('idxTag', ['tag']);
  builderCrash.connect({storeType: lf.schema.DataStoreType.MEMORY}).then(
      function(db) {
        dbCrash = db;
        tableCrash = db.getSchema().table('line');
        console.log('crash db created');
      });

  // TODO(arthurhsu): make this more robust by waiting for DB to be actually
  // ready.
}

function showFile() {
  var file = $('#file');
  file.click();
}

function onFileSelected(evt) {
  var files = evt.target.files;
  var f = files[0];

  if (!f || !f.type.match('text.*')) {
    return;
  }

  $('#log_name').text(f.name);
  $('#contents').empty();
  var reader = new FileReader();
  reader.onloadend = function(evt) {
    parseLog(evt.target.result);
  };
  reader.readAsText(f);
}

function updateTable() {
  dbMain.select().from(tableMain).limit(25).exec().then(function(rows) {
    var contents = rows.map(function(row) {
      return '<tr><td>' +
          row.no + '</td><td>' +
          dateFormat(new Date(row.timestamp), 'mm-dd hh:mm:ss.l') + '</td><td>' +
          row.pid + '</td><td>' +
          row.tid + '</td><td>' +
          row.type + '</td><td>' +
          row.tag + '</td><td>' +
          row.message + '</td></tr>';
    }).join();
    $('#contents').empty();
    $('#contents').append(contents);
  });
}

function parseLog(buffer) {
  var rawContents = buffer.split('\n');
  var isCrash = false;
  var lineNumber = 0;
  var rowsCrash = [];
  var rowsMain = [];
  rawContents.forEach(function(line) {
    ++lineNumber;
    if (line.length < 18) return;
    if (line.trim() == '--------- beginning of crash') {
      isCrash = true;
      return;
    } else if (line.trim() == '--------- beginning of main') {
      isCrash = false;
      return;
    }
    var date = Date.parse(line.substring(0, 18));
    var remaining = line.substring(18);
    var sep = remaining.indexOf(':');
    var tokens = remaining.substring(0, sep).replace(/ +(?= )/g,'').trim().split(' ');
    var table = isCrash ? tableCrash : tableMain;
    var toPush = isCrash ? rowsCrash : rowsMain;
    toPush.push(table.createRow({
      'no': lineNumber,
      'timestamp': date,
      'pid': tokens[0] || -1,
      'tid': tokens[1] || -1,
      'type': tokens[2] || '',
      'tag': tokens[3] || '',
      'message': remaining.substring(sep + 2)
    }));
  });
  Promise.all([
    dbCrash.insert().into(tableCrash).values(rowsCrash).exec(),
    dbMain.insert().into(tableMain).values(rowsMain).exec()
  ]).then(updateTable);
}

// main function
$(function() {
  $('#load').click(showFile);
  $('#file').change(onFileSelected);
  createDB();
});

})();
