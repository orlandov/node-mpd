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
    puts("I'm the init!", inspect(result));

    if (!result[0].match(/^OK MPD \d+\.\d+\.\d+/)) {
      self.emit("error", "Got invalid hello msg from mpd " + result);
    }
  });

  this.conn = net.createConnection(6600, 'localhost');
  this.addListeners(callback);
}

sys.inherits(MPD, events.EventEmitter);

MPD.prototype.connect = function () {}

MPD.prototype.close = function () {
  this.conn.end();    
};

MPD.prototype.addListeners = function (connCallback) {
  var self = this;

  this.conn.addListener('connect', function () {
    puts('connected');
    connCallback();
  });

  this.conn.addListener('error', function (exception) {
    puts('There was an error' + exception.toString());
  });

  this.conn.addListener('data', function (data) {
    var nl = "\n".charCodeAt(0);
    var i=0, il=data.length;

    // Because command data might not necessarily all arrive in one packet, we
    // buffer lines as we get them. Add new lines to our array as we get them
    // and then walk through the list running callbacks as we find OK
    // messages.
    while (i < il) {
      if (data[i] === nl) {
        if (self.carry) {
          puts("There was carry "+inspect(self.carry));
          puts("Next line is " + data.toString('utf8', 0, i));
        }
        self.linesBuffer.push(self.carry+data.toString('utf8', 0, i));
        self.carry = '';
        data = data.slice(i+1, il);
        il = data.length;
        i = 0;
      }
      i++;
    }

    self.carry = data.toString();
    puts("Carrying " + inspect(self.carry));

    // Likewise this is a really simple algorithm to walk accross the lines
    // array and issue a callback each time we find an `OK`.
    var result, callback;
    i = 0, il = self.linesBuffer.length;
    while (i < il) {
      if (self.linesBuffer[i].match('^OK\s?')) {
        result = self.linesBuffer.slice(0, i+1);
        self.linesBuffer = self.linesBuffer.slice(i+1);
        i=0;
        il = self.linesBuffer.length;
        var callback = self.cmdQueue.shift();
        puts("Callback was " + inspect(callback));
        callback(null, result);
        puts("leftover" + inspect(self.linesBuffer));
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

var mpd = new MPD({}, function (error, result) {
  if (error) {
    throw error;
  }

  mpd.runCommand('playlistinfo', [], function (error, result) {
    puts("Got result for playlistinfo " + inspect(result));
      mpd.runCommand('status', [], function (error, result) {
        puts("Got result for commands " + inspect(result));
        mpd.close();
      });
  });
});

mpd.addListener("error", function (error) {
  puts("Got error: " + inspect(error.toString()));    
});
