'use strict';

var Superfeedr = require('../../index')
  , helper  = require('../helper')

describe('Superfeedr', function() {

    var superfeedr, socket, xmpp, manager

    before(function() {
        socket = new helper.SocketEventer()
        xmpp = new helper.XmppEventer()
        manager = {
            socket: socket,
            client: xmpp,
            trackId: function(id, callback) {
                this.callback = callback
            },
            makeCallback: function(error, data) {
                this.callback(error, data)
            }
        }
        superfeedr = new Superfeedr()
        superfeedr.init(manager)
    })

    beforeEach(function() {
        socket.removeAllListeners()
        xmpp.removeAllListeners()
        superfeedr.init(manager)
    })


})
