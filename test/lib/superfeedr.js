var should  = require('should')
  , Superfeedr = require('../../index')
  , ltx     = require('ltx')
  , helper  = require('../helper')
  , xhtmlIm = require('xmpp-ftw').utils['xep-0071']

describe('Superfeedr', function() {

    var superfeedr, socket, xmpp, manager

    before(function() {
        socket = new helper.Eventer()
        xmpp = new helper.Eventer()
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

})
