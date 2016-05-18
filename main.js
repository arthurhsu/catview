function convertDate(value) {
  return dateFormat(new Date(value), 'mm-dd hh:mm:ss.l');
}

(function() {

var db;
var table;
var sections = [];

function createDB() {
  var builder = lf.schema.create('log', 1);
  builder.createTable('line')
      .addColumn('section', lf.Type.STRING)
      .addColumn('no', lf.Type.INTEGER)
      .addColumn('timestamp', lf.Type.INTEGER)
      .addColumn('pid', lf.Type.INTEGER)
      .addColumn('tid', lf.Type.INTEGER)
      .addColumn('type', lf.Type.STRING)
      .addColumn('tag', lf.Type.STRING)
      .addColumn('message', lf.Type.STRING)
      .addPrimaryKey(['section', 'no'])
      .addIndex('idxPid', ['pid'])
      .addIndex('idxTag', ['tag']);
  builder.connect({storeType: lf.schema.DataStoreType.MEMORY}).then(
      function(instance) {
        db = instance;
        table = db.getSchema().table('line');
        console.log('db created');
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
  var section = $('#section').val();
  var query = db.select().from(table).orderBy(table.no);
  var searchCondition = [table.section.eq(section)];
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
    if (modules.length) {
      searchCondition.push(table.tag.in(modules));
    }
  }
  var type = $('#type').val().trim();
  if (type.length) {
    var types = type.split(',');
    if (types.length) {
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
  var rows = [];
  var section = 'unknown';
  var sectionIndicator = '--------- beginning of ';
  rawContents.forEach(function(line) {
    ++lineNumber;
    if (line.length < 18) return;
    if (line.indexOf(sectionIndicator) != -1) {
      section = line.substring(sectionIndicator.length);
      sections.push(section);
      return;
    }
    var date = Date.parse(line.substring(0, 18));
    var remaining = line.substring(18);
    var sep = remaining.indexOf(':');
    var tokens = remaining.substring(0, sep).replace(/ +(?= )/g,'').trim().split(' ');
    rows.push(table.createRow({
      'section': section,
      'no': lineNumber,
      'timestamp': date,
      'pid': parseInt(tokens[0] || '-1', 10),
      'tid': parseInt(tokens[1] || '-1', 10),
      'type': tokens[2] || '',
      'tag': tokens[3] || '',
      'message': remaining.substring(sep + 2)
    }));
  });

  // Update the selector
  sections.forEach(function(section) {
    $('#section').append('<option value="' + section + '">' + section + '</option>');
  });
  $('#section').val(sections[0]);
  db.insert().into(table).values(rows).exec().then(updateTable);
}

// main function
$(function() {
  $('#load').click(showFile);
  $('#file').change(onFileSelected);
  $('#filter').click(updateTable);
  $('#section').change(updateTable);
  createDB();
});

})();
