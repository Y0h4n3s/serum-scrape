var events = require('events');

function Updater(time) {
    this.time = time;
    this.array = [
        {number: 1},
        {number: 2}
    ];
    var that;
    events.EventEmitter.call(this);

    this.init = function()
    {
        that = this;
        setInterval(that.run,that.time);
    };

    this.run = function()
    {
        that.array.forEach(function (item) {
            if(item.number === 2)
            {
                that.emit('Event');
            }
        });
    };
}

Updater.prototype.__proto__ = events.EventEmitter.prototype;

module.exports = Updater;



