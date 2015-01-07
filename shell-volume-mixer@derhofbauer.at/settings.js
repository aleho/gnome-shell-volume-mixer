/**
 * Shell Volume Mixer
 *
 * Convenience class to wrap Gio.Settings.
 *
 * @author Alexander Hofbauer <alex@derhofbauer.at>
 */

/* exported Settings */
/* exported POS_MENU, POS_LEFT, POS_CENTER, POS_RIGHT */

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
const GSD_SCHEMA = 'org.gnome.settings-daemon.plugins.sound';
const VOLUME_STEP_KEY = 'volume-step';
const VOLUME_STEP_DEFAULT = 6;

let gsettings;
let gsdsettings;
let signals = [];


const Settings = new Lang.Class({
    Name: 'Settings',

    set settings(value) {
        // nothing to do here
    },

    set gsdSettings(value) {
        // nothing to do here
    },

    get settings() {
        if (!gsettings) {
            this._initSettings();
        }
        return gsettings;
    },

    get gsdSettings() {
        if (!gsdsettings) {
            gsdsettings = this._getSettings(GSD_SCHEMA);
        }
        return gsdsettings;
    },


    /**
     * Initializes a single instance of Gio.Settings for this extension.
     */
    _initSettings: function() {
        let schemaDir = Utils.getExtensionPath('schemas');

        // first try to find the schema locally
        if (GLib.file_test(schemaDir + '/gschemas.compiled', GLib.FileTest.EXISTS)) {
            let schemaSource = Gio.SettingsSchemaSource.new_from_directory(
                    schemaDir,
                    Gio.SettingsSchemaSource.get_default(),
                    false);

            gsettings = new Gio.Settings({
                settings_schema: schemaSource.lookup(SETTINGS_SCHEMA, false)
            });

        // schema might be installed system-wide
        } else {
            gsettings = this._getSettings(SETTINGS_SCHEMA);
        }

        if (!gsettings) {
            throw 'Schema "%s" not found'.format(SETTINGS_SCHEMA);
        }
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
        signals.push(id);
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
        while (signals.length > 0) {
            this.settings.disconnect(signals.pop());
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
     * Set the value of an enum key.
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
     * Set the value of an array key.
     */
    set_array: function(key, value) {
        return this.settings.set_strv(key, value);
    },


    /**
     * Determines whether GNOME Settings Daemon has been patched for
     * configurable volume steps.
     */
    isGsdPatched: function() {
        let settings = this.gsdSettings;
        if (!settings) {
            return false;
        }

        return settings.list_keys().indexOf(VOLUME_STEP_KEY) != -1;
    },

    /**
     * Gets the system or application wide configuration value for GSD's volume
     * step, depending on availability of the corresponding patch to GSD.
     */
    getVolumeStep: function() {
        let volumeStep;

        if (this.isGsdPatched()) {
            volumeStep = this.gsdSettings.get_int(VOLUME_STEP_KEY);
        } else {
            volumeStep = this.settings.get_int(VOLUME_STEP_KEY);
        }

        return volumeStep || VOLUME_STEP_DEFAULT;
    },

    /**
     * Sets the system and application wide configuration value for GSD's volume
     * step, depending on availability of the corresponding patch to GSD.
     */
    setVolumeStep: function(value) {
        this.gsdSettings.set_int(VOLUME_STEP_KEY, value);
        return this.settings.set_int(VOLUME_STEP_KEY, value);
    }
});