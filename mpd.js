sys = require('sys');
fs = require('fs');
net = require('net');
events = require('events');

puts = sys.puts;
inspect = sys.inspect;

function MPD(config, callback) {
  var self = this;

  config = config || {};
  config.host = config.host || 'localhost';
  config.port = config.port || 6600;

  this.config = config;

  this.data = '';
  this.linesBuffer = [];
  this.carry = '';
  this.cmdQueue = [];

  this.cmdQueue.push(function (error, result) {
    if (!result[0].match(/^OK MPD \d+\.\d+\.\d+/)) {
      self.emit("error", "Got invalid hello msg from mpd " + result);
    }
  });

  this.conn = net.createConnection(6600, 'localhost');
  this.addListeners(callback);
}

sys.inherits(MPD, events.EventEmitter);

MPD.prototype.connect = function (callback) {
  this.conn.addListener('connect', function () {
    callback();
  });
}

MPD.prototype.close = function () {
  this.conn.end();    
};

var okRE = new RegExp('^OK\s?');

MPD.prototype.addListeners = function (connCallback) {
  var self = this;

  this.conn.addListener('error', function (exception) {
    self.emit("error", exception);
  });

  this.conn.addListener('data', function (data) {
    var i, il;
    var result, callback;

    // Split the buffer on newlines and if we find the last item isn't an
    // empty string, then that means that we got a data packet that ended in
    // the middle of a line. We'll "carry" that until the next `data` event.
    var lines = (self.carry+data).split("\n");
    self.carry = '';
    var lline = lines[lines.length-1];
    if (lline !== '') {
      self.carry = lline;
      lines.pop();
    }

    // <3 splice
    self.linesBuffer.splice.apply(
      self.linesBuffer,
      [self.linesBuffer.length, lines.length].concat(lines));

    // Walk accross the lines array and run a callback each time we find an
    // `OK` or `ACK`.
    i = 0, il = self.linesBuffer.length;
    while (i < il) {
      if (self.linesBuffer[i].match(okRE)) {
        // Lean on the behaviour of Array.prototype.splice which modifies the
        // original array and returns the added/subtracted items. This gives
        // us all the lines up to the OK message to use for the callback, and
        // removes those lines from the line buffer.
        result = self.linesBuffer.splice(0, i+1);
        i = 0;
        il = self.linesBuffer.length;
        var callback = self.cmdQueue.shift();
        callback(null, result);
      }
      else {
        i++;
      }
    }
  });
}

MPD.prototype.runCommand = function (command, args, callback) {
  puts("Running command");
  this.cmdQueue.push(callback);
  this.conn.write(command + "\n");
}


var mpd = new MPD();

mpd.addListener("error", function (error) {
  puts("Got error: " + inspect(error.toString()));    
});

mpd.connect(function (error, result) {
  if (error) {
    throw error;
  }

  mpd.runCommand('playlistinfo', [], function (error, result) {
    if (error) throw error;
    puts("Got result for playlistinfo " + inspect(result));
    mpd.close();
  });
});

