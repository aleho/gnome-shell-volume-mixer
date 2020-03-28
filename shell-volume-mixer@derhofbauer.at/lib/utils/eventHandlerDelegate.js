/**
 * Shell Volume Mixer
 *
 * Event handler mixin.
 *
 * @author Alexander Hofbauer <alex@derhofbauer.at>
 */

/* exported EventHandlerDelegate */

const Lib = imports.misc.extensionUtils.getCurrentExtension().imports.lib;
const Log = Lib.utils.log;


/**
 * @mixin
 */
var EventHandlerDelegate = class {
    /**
     * @return {String[]}
     * @private
     */
    get _signals() {
        if (!this.__signals) {
            this.__signals = [];
        }

        return this.__signals;
    }

    /**
     * @param {Object} delegate
     */
    set eventHandlerDelegate(delegate) {
        this.__delegate = delegate;
    }

    /**
     * Connects to a signal.
     *
     * @param {Object} target
     * @param {string} signal
     * @param {function} callback
     */
    connect(target, signal, callback) {
        if (typeof target === 'string') {
            callback = signal;
            signal = target;
            target = ('__delegate' in this) ? this.__delegate : null;
        }

        if (!target) {
            Log.error('EventHandlerDelegate', 'connect', `Connect called before setting "eventHandlerDelegate" and without passing a target (${signal})`);
            return;
        }

        let id = target.connect(signal, callback);
        this._signals.push([target, id, signal]);
    }

    /**
     * Connects to a signal.
     *
     * @param {Object} target
     * @param {string} signal
     */
    disconnect(target, signal) {
        if (typeof target === 'string') {
            signal = target;
            target = this.__delegate;
        }

        for (let index in this._signals) {
            const [target, id, name] = this._signals[index];
            if (target === target && signal === name) {
                target.disconnect(id);
                this._signals.splice(index, 1);
                return;
            }
        }

        Log.error('EventHandlerDelegate', 'disconnect', `Signal ${signal} not found on target`);
    }

    /**
     * Disconnects all locally used signals.
     */
    disconnectAll() {
        if (!this.__delegate) {
            return;
        }

        while (this._signals.length > 0) {
            const [target, id] = this._signals.pop();
            target.disconnect(id);
        }
    }
};
