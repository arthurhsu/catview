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

function readTextFile(f) {
  var reader = new FileReader();
  reader.onloadend = function(evt) {
    preParseLog(evt.target.result);
  };
  reader.readAsText(f);
}

function readZipFile(f) {
  var zip = new JSZip();
  zip.loadAsync(f).then(function(zip) {
    console.log('zip loaded', zip);
    var fileName = Object.keys(zip.files)[0];
    console.log(fileName, zip.files[fileName]);
    return zip.files[fileName].async('string');
  }).then(function(rawContents) {
    console.log(rawContents);
    preParseLog(rawContents);
  });
}

function notSupported() {
  console.log('File type is not supported');
}

function onFileSelected(evt) {
  var files = evt.target.files;
  var f = files[0];
  sections = [];

  if (!f) {
    return;
  }

  $('#log_name').text(f.name);
  var callback = (!f.type.length || f.type.match('text.*')) ? readTextFile :
      f.type.match('zip') ? readZipFile : notSupported;

  db.delete().from(table).exec().then(function() {
    callback(f);
  });
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

function preParseLog(buffer) {
  var rawContents = buffer.replace('\r\n', '\n').split('\n');

  // Let's check if this is feedback report or not
  if (rawContents[0].indexOf('--------- ') == -1) {
    // Alright this is a multi-section feedback report
    var start = 0;
    var end = 0;
    for (var i = 0; i < rawContents.length && !end; ++i) {
      if (!start && rawContents[i].indexOf('------ SYSTEM LOG (') != -1) {
        start = i;
      } else if (start && rawContents[i].startsWith('[logcat: ')) {
        end = i;
      }
    }
    rawContents.splice(0, start + 1);
    rawContents.splice(end - start - 1, rawContents.length - end + start + 1);
    parseLog(rawContents);
  } else {
    // Plain logcat -d logs.
    parseLog(rawContents);
  }
}

function parseLog(rawContents) {
  var isCrash = false;
  var lineNumber = 0;
  var rows = [];
  var section = 'unknown';
  var sections = [];
  var sectionIndicator = '--------- beginning of ';
  rawContents.forEach(function(line) {
    ++lineNumber;
    if (line.length < 18) return;
    if (line.indexOf(sectionIndicator) != -1) {
      section = line.substring(sectionIndicator.length).trim();
      sections.push(section);
      return;
    }
    if (sections.length == 0) {
      sections = [section];
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
