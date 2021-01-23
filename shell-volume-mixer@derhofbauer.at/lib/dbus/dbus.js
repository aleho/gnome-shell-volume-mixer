/**
 * Shell Volume Mixer
 *
 * D-Bus command module.
 *
 * @author Alexander Hofbauer <alex@derhofbauer.at>
 */

/* exported Dbus */

const { DBus, DBusExportedObject } = imports.gi.Gio;
const Lib = imports.misc.extensionUtils.getCurrentExtension().imports.lib;

const Log = Lib.utils.log;


const DBUS_INTERFACE =
'<!DOCTYPE node PUBLIC "-//freedesktop//DTD D-BUS Object Introspection 1.0//EN" \
  "http://www.freedesktop.org/standards/dbus/1.0/introspect.dtd"> \
<node name="/at/derhofbauer/shell/VolumeMixer"> \
    <interface name="at.derhofbauer.shell.VolumeMixer"> \
        <method name="debug"> \
            <arg name="what" type="s" direction="in" /> \
            <arg name="result" type="s" direction="out" /> \
        </method> \
        <method name="reload"/> \
        <method name="help"> \
            <arg name="result" type="s" direction="out" /> \
        </method> \
    </interface> \
</node>';


let instance;

/** @typedef {{
 *   reloadExtension: function,
 *   debugCards: {function():string},
 *   debugStreams: {function():string},
 *   debugEvents: {function():string},
 * }} CommandHandler
 */

/**
 * @property {CommandHandler} _handler
 */
var Dbus = class {
    /**
     * @param {CommandHandler} commandHandler
     * @returns {*}
     */
    constructor(commandHandler = {}) {
        if (instance) {
            return instance;
        }

        instance = this;

        this._handler = new Proxy(commandHandler, {
            get: function (target, prop) {
                if (prop in target && target[prop]) {
                    Log.info(`Got command "${prop}"`);

                    return Reflect.get(...arguments);
                }

                Log.info(`Unimplemented command "${prop}"`);
            }
        });
    }


    init() {
        this._dbus = DBusExportedObject.wrapJSObject(DBUS_INTERFACE, this);
        this._dbus.export(DBus.session, '/at/derhofbauer/shell/VolumeMixer');

        Log.info('D-Bus command interface enabled');
    }

    destroy() {
        if (this._dbus) {
            this._dbus.unexport();
            this._dbus = null;
            Log.info('D-Bus command interface disabled');
        }
    }

    //region dbus methods

    reload() {
        this._handler.reload();
    }

    /**
     * @param {string} what to debug
     * @return {string}
     */
    debug(what) {
        let result = '';

        switch (what) {
            case 'cards':
                result = this._handler.debugCards();
                break;

            case 'streams':
                result = this._handler.debugStreams();
                break;

            case 'events':
                result = this._handler.debugEvents();
                break;

            case '':
                Log.error(`D-Bus: command missing`);
                break;

            default:
                Log.error(`D-Bus: unknown command ${what}`);
        }

        return result;
    }

    help() {
        return 'Commands: debug (cards, streams, events), reload';
    }

    //endregion dbus methods
};
