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

let gsettings;
let signals = [];


const Settings = new Lang.Class({
    Name: 'Settings',

    _settings: null,
    _signals: null,

    _init: function() {
        if (!gsettings) {
            gsettings = this._initSettings();
        }

        this._settings = gsettings;
        this._signals = signals;
    },

    /**
     * Initializes an instance of Gio.Settings for this extension.
     *
     * @returns {Gio.Settings}
     */
    _initSettings: function() {
        let schemaName = 'org.gnome.shell.extensions.shell-volume-mixer';
        let schemaDir = Utils.getExtensionPath('schemas');

        if (GLib.file_test(schemaDir + '/gschemas.compiled', GLib.FileTest.EXISTS)) {
            let schemaSource = Gio.SettingsSchemaSource.new_from_directory(
                    schemaDir,
                    Gio.SettingsSchemaSource.get_default(),
                    false);

            return new Gio.Settings({
                settings_schema: schemaSource.lookup(schemaName, false)
            });

        } else if (Gio.Settings.list_schemas().indexOf(schemaName) == -1) {
            throw 'Schema "%s" not found'.format(schemaName);

        } else {
            return new Gio.Settings({
                schema: schemaName
            });
        }
    },

    /**
     * Registers a listener for a signals.
     *
     * @param signal
     * @param callback
     */
    connect: function(signal, callback) {
        let id = this._settings.connect(signal, callback);
        this._signals.push(id);
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
        while (this._signals.length > 0) {
            this._settings.disconnect(this._signals.pop());
        }
    },

    get settings() {
        return this._settings;
    },


    /**
     * Retrieves the value of an 's' type key.
     */
    get_string: function(key) {
        return this._settings.get_string(key);
    },

    /**
     * Sets the value of an 's' type key.
     */
    set_string: function(key, value) {
        return this._settings.set_string(key, value);
    },

    /**
     * Retrieves the value of a 'b' type key.
     */
    get_boolean: function(key) {
        return this._settings.get_boolean(key);
    },

    /**
     * Sets the value of a 'b' type key.
     */
    set_boolean: function(key, value) {
        return this._settings.set_boolean(key, value);
    },

    /**
     * Retrieves the value of an enum key.
     */
    get_enum: function(key) {
        return this._settings.get_enum(key);
    },

    /**
     * Set the value of an enum key.
     */
    set_enum: function(key, value) {
        return this._settings.set_enum(key, value);
    },

    /**
     * Retrieves the value of an array key.
     */
    get_array: function(key) {
        return this._settings.get_strv(key);
    },

    /**
     * Set the value of an array key.
     */
    set_array: function(key, value) {
        return this._settings.set_strv(key, value);
    }
});