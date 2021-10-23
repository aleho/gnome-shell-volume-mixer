/**
 * Shell Volume Mixer
 *
 * Convenience class to wrap Gio.Settings.
 *
 * @author Alexander Hofbauer <alex@derhofbauer.at>
 */

/* exported Settings, cleanup */
/* exported SOUND_SETTINGS_SCHEMA, ALLOW_AMPLIFIED_VOLUME_KEY, SETTING */

const ExtensionUtils = imports.misc.extensionUtils;
const Extension = ExtensionUtils.getCurrentExtension();
const { Gio, GLib } = imports.gi;
const Lib = Extension.imports.lib;

const Log = Lib.utils.log;
const Utils = Lib.utils.utils;


const SETTINGS_SCHEMA = 'org.gnome.shell.extensions.shell-volume-mixer';
var SOUND_SETTINGS_SCHEMA = 'org.gnome.desktop.sound';
var ALLOW_AMPLIFIED_VOLUME_KEY = 'allow-volume-above-100-percent';

var SETTING = Object.freeze({
    position:                  'position',
    remove_original:           'remove-original',
    show_percentage_label:     'show-percentage-label',
    show_detailed_sliders:     'show-detailed-sliders',
    show_system_sounds:        'show-system-sounds',
    show_virtual_streams:      'show-virtual-streams',
    always_show_input_streams: 'always-show-input-streams',
    use_symbolic_icons:        'use-symbolic-icons',
    profile_switcher_hotkey:   'profile-switcher-hotkey',
    pinned_profiles:           'pinned-profiles',
    debug:                     'debug',

    position_at: {
        menu:   0,
        left:   1,
        center: 2,
        right:  3,
    },
});


const SIGNALS = {};
const GSETTINGS = {};



var Settings = class
{
    get settings() {
        if (!GSETTINGS[this.schema]) {
            GSETTINGS[this.schema] = ExtensionUtils.getSettings(this.schema);
        }

        return GSETTINGS[this.schema];
    }

    constructor(schema) {
        this.schema = schema || SETTINGS_SCHEMA;

        if (!SIGNALS[this.schema]) {
            SIGNALS[this.schema] = {};
        }

        this._signals = SIGNALS[this.schema];
    }

    /**
     * Registers a listener for a signal.
     *
     * @param {string} signal
     * @param {function()} callback
     * @param {boolean} allowMultiple Whether to error out if the setting has already been connected
     */
    connect(signal, callback, allowMultiple = false) {
        if (!allowMultiple && this._signals[signal]) {
            Log.error('Settings', 'connect', `Signal "${signal}" already bound for "${this.schema}"`);
            return false;
        }

        Log.info(`Connecting to settings change signal "${signal}"`);
        let id = this.settings.connect(signal, callback);
        this._signals[signal] = id;

        return id;
    }

    /**
     * Registers a listener to changed events.
     *
     * @param {function()} callback
     */
    connectChanged(callback) {
        this.connect('changed', callback);
    }

    /**
     * Disconnects all connected signals.
     */
    disconnectAll() {
        for (let signal in this._signals) {
            this.disconnect(this._signals[signal]);
        }
    }

    /**
     * Disconnects a signal by name.
     */
    disconnect(signal) {
        if (this._signals[signal]) {
            this.settings.disconnect(this._signals[signal]);
            delete this._signals[signal];
            return true;
        }

        return false;
    }

    /**
     * Disconnects a signal by id.
     */
    disconnectById(signalId) {
        for (let name in this._signals) {
            let id = this._signals[name];
            if (signalId === id) {
                this.settings.disconnect(id);
                delete this._signals[name];
                return true;
            }
        }

        return false;
    }


    /**
     * Retrieves the value of an 's' type key.
     */
    get_string(key) {
        return this.settings.get_string(key);
    }

    /**
     * Sets the value of an 's' type key.
     */
    set_string(key, value) {
        return this.settings.set_string(key, value);
    }

    /**
     * Retrieves the value of an 'i' type key.
     */
    get_int(key) {
        return this.settings.get_int(key);
    }

    /**
     * Sets the value of an 'i' type key.
     */
    set_int(key, value) {
        return this.settings.set_int(key, value);
    }

    /**
     * Retrieves the value of a 'b' type key.
     */
    get_boolean(key) {
        return this.settings.get_boolean(key);
    }

    /**
     * Sets the value of a 'b' type key.
     */
    set_boolean(key, value) {
        return this.settings.set_boolean(key, value);
    }

    /**
     * Retrieves the value of an enum key.
     */
    get_enum(key) {
        return this.settings.get_enum(key);
    }

    /**
     * Sets the value of an enum key.
     */
    set_enum(key, value) {
        return this.settings.set_enum(key, value);
    }

    /**
     * Retrieves the value of an array key.
     */
    get_array(key) {
        return this.settings.get_strv(key);
    }

    /**
     * Sets the value of an array key.
     */
    set_array(key, value) {
        return this.settings.set_strv(key, value);
    }
};

/**
 * Disconnects all signals of all schemas.
 * Used to make sure all there are no connected signals left.
 */
function cleanup() {
    for (let schema in SIGNALS) {
        if (!GSETTINGS[schema]) {
            continue;
        }

        for (let signal in SIGNALS[schema]) {
            GSETTINGS[schema].disconnect(SIGNALS[schema][signal]);
            delete SIGNALS[schema][signal];
        }
    }
}
