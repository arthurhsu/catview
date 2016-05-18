function convertDate(value) {
  return dateFormat(new Date(value), 'mm-dd hh:mm:ss.l');
}

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
      .addPrimaryKey(['no'])
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
      .addPrimaryKey(['no'])
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
  var reader = new FileReader();
  reader.onloadend = function(evt) {
    parseLog(evt.target.result);
  };
  reader.readAsText(f);
}

function updateTable() {
  var db = dbMain;
  var table = tableMain;
  var query = db.select().from(table).orderBy(table.no);
  var searchCondition = [];
  var pid = $('#pid').val().trim();
  if (pid.length) {
    var pids = pid.split(',').map(function(v) {
      return parseInt(v);
    });
    if (pids.length) {
      searchCondition.push(table.pid.in(pids));
    }
  }
  var module = $('#tag').val().trim();
  if (module.length) {
    var modules = module.split(',');
    if (modules.length == 1) {
      searchCondition.push(table.tag.eq(module));
    } else {
      searchCondition.push(table.tag.in(modules));
    }
  }
  var type = $('#type').val().trim();
  if (type.length) {
    var types = type.split(',');
    if (types.length == 1) {
      searchCondition.push(table.type.eq(type));
    } else {
      searchCondition.push(table.type.in(types));
    }
  }

  if (searchCondition.length) {
    query.where(lf.op.and.apply(undefined, searchCondition));
  }

  console.log(query.toSql());
  query.exec().then(function(rows) {
    $('#contents').bootstrapTable('load', rows);
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
      'pid': parseInt(tokens[0] || '-1', 10),
      'tid': parseInt(tokens[1] || '-1', 10),
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
  $('#filter').click(updateTable);
  createDB();
});

})();
