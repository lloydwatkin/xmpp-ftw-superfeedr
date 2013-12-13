'use strict';

var builder    = require('ltx')
  , Base       = require('xmpp-ftw/lib/base')

var SuperFeedr = function() {
    this.itemParser = null
}

SuperFeedr.prototype = new Base()

SuperFeedr.prototype.NS_PUBSUB     = 'http://jabber.org/protocol/pubsub'
SuperFeedr.prototype.NS_EVENT      = 'http://jabber.org/protocol/superfeedr#event'
SuperFeedr.prototype.NS_SUPERFEEDR = 'http://superfeedr.com/xmpp-pubsub-ext'

SuperFeedr.prototype.HOST          = 'firehoser.superfeedr.com'

SuperFeedr.prototype._events = {
    'xmpp.superfeedr.subscribe': 'subscribe',
    'xmpp.superfeedr.unsubscribe': 'unsubscribe',
    'xmpp.superfeedr.retrieve': 'getItems',
    'xmpp.superfeedr.subscriptions': 'getSubscriptions'
}

SuperFeedr.prototype.handles = function(stanza) {
    return ((this.HOST === stanza.attrs.from) && stanza.is('message'))
}

SuperFeedr.prototype.handle = function(stanza) {
    var self = this
    var message = { meta: this._parseFeedDetails(stanza.getChild('event')) }
    message.items = []
    stanza.getChild('event').getChild('items').getChildren('item').forEach(function(item) {
        message.items.push(self._getItemParser().parse(item))
    })
    this.socket.emit('xmpp.superfeedr.push', message)
    return true
}

SuperFeedr.prototype.subscribe = function(data, callback) {
    if (!data.feed)
        return this._clientError('Missing \'feed\' key', data, callback)
    if (!data.jid) data.jid = this.manager.jid

    var self   = this
    var stanza = this._getStanza(data, 'set', 'subscribe')

    this.manager.trackId(stanza.root().attr('id'), function(stanza) {
        if (stanza.attrs.type === 'error') callback(self._parseError(stanza), null)
        callback(
            null,
            self._parseFeedDetails(stanza.getChild('pubsub').getChild('subscription'))
        )
    })
    this.client.send(stanza)
}

SuperFeedr.prototype.unsubscribe = function(data, callback) {
    if (!data.feed)
        return this._clientError('Missing \'feed\' key', data, callback)
    if (!data.jid) data.jid = this.manager.jid

    var self   = this
    var stanza = this._getStanza(data, 'set', 'unsubscribe')

    this.manager.trackId(stanza.root().attr('id'), function(stanza) {
        if (stanza.attrs.type === 'error') callback(self._parseError(stanza), null)
        callback(null, true)
    })
    this.client.send(stanza)
}

SuperFeedr.prototype.getItems = function(data, callback) {
    if (!data.feed)
        return this._clientError('Missing \'feed\' key', data, callback)

    var self = this
    var stanza = this._getStanza(data, 'get', 'items', this.NS_PUBSUB)
    this.manager.trackId(stanza.root().attr('id'), function(stanza) {
        if (stanza.attrs.type === 'error')
            return callback(self._parseError(stanza), null)
        var items = { meta: self._parseFeedDetails(stanza), items: [] }
        stanza.getChild('pubsub')
            .getChild('items')
            .getChildren('item')
            .forEach(function(element) {

            try {
                items.items.push(self._getItemParser().parse(element))
            } catch(e) {
                // Can not parse the item
                self.manager._getLogger().error(e)
            }
        })
        callback(null, items)
    })
    this.client.send(stanza)
}

SuperFeedr.prototype.getSubscriptions = function(data, callback) {
    var self = this
    var page = parseInt(data.page || '1')
    var stanza = new builder.Element('iq', {to: this.HOST, type: 'get', id: this._getId()})
        .c('pubsub', {xmlns: this.NS_PUBSUB, 'xmlns:superfeedr': this.NS_SUPERFEEDR })
        .c('subscriptions', {jid: this.manager.jid, 'superfeedr:page': page})
    this.manager.trackId(stanza.root().attr('id'), function(stanza) {
        if (stanza.attrs.type === 'error') return callback(self._parseError(stanza), null)
        var subscriptions = []
        stanza.getChild('pubsub').getChild('subscriptions').getChildren('subscription').forEach(function(entry) {
            subscriptions.push(self._parseFeedDetails(entry))
        })
        callback(null, subscriptions)
    })
    this.client.send(stanza)
}

SuperFeedr.prototype._getStanza = function(data, type, element, namespace) {
    var attributes = { node: data.feed }
    if (data.jid) attributes.jid = data.jid
    return new builder.Element(
        'iq',
        { to: this.HOST, type: type, id: this._getId() }
    ).c('pubsub', {xmlns: namespace || this.NS_PUBSUB})
     .c(element, attributes)
}

SuperFeedr.prototype._parseFeedDetails = function(entry) {
    var status = entry.getChild('status')
    if (null == status) return
    var feedDetails = {
        feed: entry.attrs.node,
        jid: entry.attrs.jid,
        status: {
            response: status.getChild('http').attrs.code,
            fetch: {
                next: status.getChild('next_fetch').getText(),
                last: status.getChild('last_fetch').getText(),
                period: status.getChild('period').getText()
            },
            parsed: status.getChild('last_parse').getText(),
            maintenance: status.getChild('last_maintenance_at').getText(),
            message: status.getChild('http').getText()
        }
    }
    var optionals = ['title', 'entries_count_since_last_maintenance', 'id']
    optionals.forEach(function(optional) {
        var value
        if (null !== (value = status.getChild(optional))) feedDetails[optional] = value.getText()
    })
    var links
    if ((links = status.getChildren('link')).length > 0) {
        feedDetails.links = []
        var attributes = ['title', 'rel', 'href', 'type']
        links.forEach(function(link) {
            var l = {}
            attributes.forEach(function(attribute) {
                var value
                if (null !== (value = link.attrs[attribute])) l[attribute] = link.attrs[attribute]
            })
            feedDetails.links.push(l)
        })
    }
    return feedDetails
}

SuperFeedr.prototype._getItemParser = function() {
    if (!this.itemParser)
        this.itemParser = require('xmpp-ftw-item-parser')
    return this.itemParser
}

SuperFeedr.prototype.setItemParser = function(parser) {
    this.itemParser = parser
    return this
}

module.exports = SuperFeedr