var events = require('events');

function Updater(time, event, args) {
    this.time = time;
    this.event = event;
    this.args = args
    var that;
    events.EventEmitter.call(this);
    this.init = function () {
        that = this;
        setInterval(that.run, that.time);
    };
    this.run = function () {
        that.emit(that.event, that.args);
    };

    this.setArgs = function(args) {
        that.args = args
    }
}

Updater.prototype.__proto__ = events.EventEmitter.prototype;

module.exports = Updater;



