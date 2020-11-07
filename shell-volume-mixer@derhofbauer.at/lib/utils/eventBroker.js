/**
 * Shell Volume Mixer
 *
 * Global event broker singleton.
 *
 * @author Alexander Hofbauer <alex@derhofbauer.at>
 */

/* exported EventBroker */

const Signals = imports.signals;

let instance;

var EventBroker = class {
    constructor() {
        if (instance) {
            return instance;
        }

        instance = this;
    }
};

Signals.addSignalMethods(EventBroker.prototype);
