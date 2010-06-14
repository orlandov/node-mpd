NAME
----

node-mpd - Node client interface to MPD (Music Player Dæmon)

SYNOPSYS
--------

    MPD = require('mpd').MPD;

    // create mpd handle with optional config
    var mpd = new MPD({ host: 'localhost' , port: 6600 }
                      , function (error) {
      mpd.runCommand('status', function (result) {
        mpd.close();
      });
    });

DESCRIPTION
-----------

MPD is a networked music server. This library aims to provide an asynchronous
client interface to facilitate communication between Node.js programs and MPD
servers.


Gratuitous Metalocalypse Quote:

    Toki: It sounds like microchips.
    Nathan: Yeah, Pickles is right you know. Who was clearly the one who said that.
    Toki: I just said that, not Pickle!
    Nathan: Uh, that's a good Pickles impression that's for sure. Right Pickles?
    Pickles: ...
    Nathan: I SAID "RIGHT PICKLLLLLLES!!!"
    Pickles: It sounds like microchips. In ones and zeros-

    -- Dethvengeance (S2E03), Metalocalypse

SEE ALSO
--------

- http://www.musicpd.org/doc/protocol/

AUTHOR
------

Orlando Vazquez (ovazquez@gmail.com)
