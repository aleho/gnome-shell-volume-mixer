/**
 * Shell Volume Mixer
 *
 * Convenience class to wrap Gio.Settings.
 *
 * @author Alexander Hofbauer <alex@derhofbauer.at>
 */

/* exported Settings, cleanup */
/* exported SOUND_SETTINGS_SCHEMA, ALLOW_AMPLIFIED_VOLUME_KEY, SETTING */

const Extension = imports.misc.extensionUtils.getCurrentExtension();
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
            this._initSettings();
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
     * Initializes a single instance of Gio.Settings for this extension.
     */
    _initSettings() {
        let instance;

        // for all schemas != app schema
        if (this.schema != SETTINGS_SCHEMA) {
            instance = this._getSettings(this.schema);

        // app-schema
        } else {
            let schemaDir = Utils.getExtensionPath('schemas');

            // try to find the app-schema locally
            if (GLib.file_test(`${schemaDir}/gschemas.compiled`, GLib.FileTest.EXISTS)) {
                let schemaSource = Gio.SettingsSchemaSource.new_from_directory(
                    schemaDir,
                    Gio.SettingsSchemaSource.get_default(),
                    false
                );

                instance = new Gio.Settings({
                    settings_schema: schemaSource.lookup(this.schema, false)
                });

            // app-schema might be installed system-wide
            } else {
                instance = this._getSettings(this.schema);
            }
        }

        if (!instance) {
            throw 'Schema "%s" not found'.format(this.schema);
        }

        GSETTINGS[this.schema] = instance;
    }

    /**
     * Returns a Gio.Settings object for a schema.
     *
     * @param {string} schema Name of the schema to initialize.
     * @returns {Gio.Settings}
     */
    _getSettings(schema) {
        if (Gio.Settings.list_schemas().indexOf(schema) == -1) {
            return null;
        }

        return new Gio.Settings({
            schema: schema
        });
    }


    /**
     * Registers a listener for a signal.
     *
     * @param {string} signal
     * @param {function()} callback
     */
    connect(signal, callback) {
        // already connected
        if (this._signals && this._signals[signal]) {
            Log.error('settings', 'connect', `Signal "${signal}" already bound for "${this.schema}"`);
            return false;
        }

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
            if (signalId == id) {
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
