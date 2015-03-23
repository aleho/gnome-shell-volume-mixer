/**
 * Shell Volume Mixer
 *
 * Convenience class to wrap Gio.Settings.
 *
 * @author Alexander Hofbauer <alex@derhofbauer.at>
 */

/* exported Settings, cleanup */
/* exported POS_MENU, POS_LEFT, POS_CENTER, POS_RIGHT */
/* exported MEDIAKEYS_SCHEMA, VOLUME_STEP_DEFAULT */

const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Lang = imports.lang;

const Utils = Extension.imports.utils;

const POS_MENU = 0;
const POS_LEFT = 1;
const POS_CENTER = 2;
const POS_RIGHT = 3;

const SETTINGS_SCHEMA = 'org.gnome.shell.extensions.shell-volume-mixer';
const MEDIAKEYS_SCHEMA = 'org.gnome.settings-daemon.plugins.media-keys';
const VOLUME_STEP_DEFAULT = 6;

const SIGNALS = {};
const GSETTINGS = {};


const Settings = new Lang.Class({
    Name: 'Settings',

    set settings(value) {
        // nothing to do here
    },

    get settings() {
        if (!GSETTINGS[this.schema]) {
            this._initSettings();
        }
        return GSETTINGS[this.schema];
    },

    _init: function(schema) {
        this.schema = schema || SETTINGS_SCHEMA;

        if (!SIGNALS[this.schema]) {
            SIGNALS[this.schema] = {};
        }

        this._signals = SIGNALS[this.schema];
    },

    /**
     * Initializes a single instance of Gio.Settings for this extension.
     */
    _initSettings: function() {
        let instance;

        // for all schemas != app schema
        if (this.schema != SETTINGS_SCHEMA) {
            instance = this._getSettings(this.schema);

        // app-schema
        } else {
            let schemaDir = Utils.getExtensionPath('schemas');

            // try to find the app-schema locally
            if (GLib.file_test(schemaDir + '/gschemas.compiled', GLib.FileTest.EXISTS)) {
                let schemaSource = Gio.SettingsSchemaSource.new_from_directory(
                        schemaDir,
                        Gio.SettingsSchemaSource.get_default(),
                        false);

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
    },

    /**
     * Returns a Gio.Settings object for a schema.
     *
     * @param schema Name of the schema to initialize.
     * @returns {Gio.Settings}
     */
    _getSettings: function(schema) {
        if (Gio.Settings.list_schemas().indexOf(schema) == -1) {
            return null;
        }

        return new Gio.Settings({
            schema: schema
        });
    },


    /**
     * Registers a listener for a signals.
     *
     * @param signal
     * @param callback
     */
    connect: function(signal, callback) {
        // already connected
        if (this._signals && this._signals[signal]) {
            Utils.error(
                    'settings',
                    'connect',
                    'Signal "' + signal + '" already bound for "' + this.schema + '"');
            return false;
        }

        let id = this.settings.connect(signal, callback);
        this._signals[signal] = id;
        return id;
    },

    /**
     * Registers a listener to changed events.
     *
     * @param callback
     */
    connectChanged: function(callback) {
        this.connect('changed::', callback);
    },

    /**
     * Disconnects all connected signals.
     */
    disconnectAll: function() {
        for (let signal in this._signals) {
            this.disconnect(this._signals[signal]);
        }
    },

    /**
     * Disconnects a signal by name.
     */
    disconnect: function(signal) {
        if (this._signals[signal]) {
            this.settings.disconnect(this._signals[signal]);
            delete this._signals[signal];
            return true;
        }

        return false;
    },

    /**
     * Disconnects a signal by id.
     */
    disconnectById: function(signalId) {
        for (let name in this._signals) {
            let id = this._signals[name];
            if (signalId == id) {
                this.settings.disconnect(id);
                delete this._signals[name];
                return true;
            }
        }

        return false;
    },


    /**
     * Retrieves the value of an 's' type key.
     */
    get_string: function(key) {
        return this.settings.get_string(key);
    },

    /**
     * Sets the value of an 's' type key.
     */
    set_string: function(key, value) {
        return this.settings.set_string(key, value);
    },

    /**
     * Retrieves the value of an 'i' type key.
     */
    get_int: function(key) {
        return this.settings.get_int(key);
    },

    /**
     * Sets the value of an 'i' type key.
     */
    set_int: function(key, value) {
        return this.settings.set_int(key, value);
    },

    /**
     * Retrieves the value of a 'b' type key.
     */
    get_boolean: function(key) {
        return this.settings.get_boolean(key);
    },

    /**
     * Sets the value of a 'b' type key.
     */
    set_boolean: function(key, value) {
        return this.settings.set_boolean(key, value);
    },

    /**
     * Retrieves the value of an enum key.
     */
    get_enum: function(key) {
        return this.settings.get_enum(key);
    },

    /**
     * Sets the value of an enum key.
     */
    set_enum: function(key, value) {
        return this.settings.set_enum(key, value);
    },

    /**
     * Retrieves the value of an array key.
     */
    get_array: function(key) {
        return this.settings.get_strv(key);
    },

    /**
     * Sets the value of an array key.
     */
    set_array: function(key, value) {
        return this.settings.set_strv(key, value);
    }
});

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
