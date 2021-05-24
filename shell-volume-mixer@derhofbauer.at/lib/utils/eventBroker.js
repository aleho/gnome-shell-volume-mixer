/**
 * Shell Volume Mixer
 *
 * Global event broker singleton.
 *
 * @author Alexander Hofbauer <alex@derhofbauer.at>
 */

/* exported EventBroker */

const Lib = imports.misc.extensionUtils.getCurrentExtension().imports.lib;
const Signals = imports.signals;

const Log = Lib.utils.log;

let instance;

var EventBroker = class {
    constructor() {
        if (instance) {
            return instance;
        }

        instance = this;

        this.connect('debug-events', (event, callback) => {
            callback(Log.dump(this._signalConnections));
        });
    }
};

Signals.addSignalMethods(EventBroker.prototype);
