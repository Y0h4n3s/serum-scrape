var events = require('events');

function Updater(time) {
    this.time = time;
    var that;
    events.EventEmitter.call(this);
    this.init = function() {
        that = this;
        setInterval(that.run,that.time);
    };
    this.run = function() {
        that.emit('Event');
    };
}

Updater.prototype.__proto__ = events.EventEmitter.prototype;

module.exports = Updater;



