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
     * @returns {string[]}
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

    get eventHandlerDelegate() {
        return ('__delegate' in this) ? this.__delegate : null;
    }

    /**
     * Connects to a signal.
     *
     * @param {Object} target
     * @param {string} signal
     * @param {function()} [callback]
     * @param {?function()} [initial] Function returning the initial value
     */
    connect(target, signal, callback, initial) {
        if (typeof target === 'string') {
            initial = callback;
            callback = signal;
            signal = target;
            target = this.eventHandlerDelegate;
        }

        if (!target) {
            Log.error('EventHandlerDelegate', 'connect', `Connect called before setting "eventHandlerDelegate" and without passing a target (${signal})`);
            return;
        }

        let id = target.connect(signal, callback);
        this._signals.push([target, id, signal]);

        if (typeof initial === 'function') {
            callback.apply(callback, initial());
        }
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
        Log.info(`Disconnecting ${this._signals.length} signal(s)`);

        while (this._signals.length > 0) {
            const [target, id] = this._signals.pop();
            Log.info(`Disconnecting signal ${id} from ${target.constructor.name}`);

            target.disconnect(id);
        }
    }
};
