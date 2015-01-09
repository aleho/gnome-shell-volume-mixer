/**
 * Shell Volume Mixer
 *
 * Convenience class to wrap Gio.Settings.
 *
 * @author Alexander Hofbauer <alex@derhofbauer.at>
 */

/* exported Settings */
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
        if (!GSETTINGS[this._schema]) {
            this._initSettings();
        }
        return GSETTINGS[this._schema];
    },

    _init: function(schema) {
        this._schema = schema || SETTINGS_SCHEMA;
    },

    /**
     * Initializes a single instance of Gio.Settings for this extension.
     */
    _initSettings: function() {
        let instance;

        // for all schemas != app schema
        if (this._schema != SETTINGS_SCHEMA) {
            instance = this._getSettings(this._schema);

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
                    settings_schema: schemaSource.lookup(this._schema, false)
                });

            // app-schema might be installed system-wide
            } else {
                instance = this._getSettings(this._schema);
            }
        }

        if (!instance) {
            throw 'Schema "%s" not found'.format(this._schema);
        }

        GSETTINGS[this._schema] = instance;
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
        let id = this.settings.connect(signal, callback);
        if (!SIGNALS[this._schema]) {
            SIGNALS[this._schema] = [];
        }
        SIGNALS[this._schema].push(id);
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
        while (SIGNALS[this._schema] && SIGNALS[this._schema].length > 0) {
            this.settings.disconnect(SIGNALS[this._schema].pop());
        }
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