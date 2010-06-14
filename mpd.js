/*

MIT LICENSED

Copyright (c) 2010 Orlando Vazquez

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do
so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

*/

// This library is inspired by J. Alexander Treuman's mpd library,
// see: http://jatreuman.indefero.net/p/python-mpd/
// Obviously it's quite different due to Node.js's asynchronous nature, but I
// tried where I could to maintain consistency in naming.

sys = require('sys');
fs = require('fs');
net = require('net');
events = require('events');

puts = sys.puts;
inspect = sys.inspect;

function MPD(port, host) {
  var self = this;

  this.port = port || 6600;
  this.host = host || 'localhost';

  this.data = '';
  this.linesBuffer = [];
  this.carry = '';
  this.cmdQueue = [];

  this.cmdQueue.push(function (error, result) {
    if (!result[0].match(/^OK MPD \d+\.\d+\.\d+/)) {
      self.emit("error", "Got invalid hello msg from mpd " + result);
    }
  });
}

sys.inherits(MPD, events.EventEmitter);

MPD.prototype.connect = function (callback) {
  var self = this;
  this.conn = net.createConnection(this.port, this.host);
  this.conn.addListener('connect', function () {
    self.addListeners();
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
        if (callback)
          callback(null, result);
      }
      else {
        i++;
      }
    }
  });
}

// mpd.cmd('command', [ arg0, arg1 ], callback)
// mpd.cmd('command', callback)
MPD.prototype.cmd = function (command, args, callback) {
  if (!callback) {
    callback = args;
  }
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

  mpd.cmd('playlistinfo', [], function (error, result) {
    if (error) throw error;
    puts("Got result for playlistinfo " + inspect(result));
    mpd.close();
  });
});

