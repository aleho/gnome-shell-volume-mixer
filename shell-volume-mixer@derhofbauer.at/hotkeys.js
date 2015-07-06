/**
 * Shell Volume Mixer
 *
 * Hotkeys.
 *
 * @author Alexander Hofbauer <alex@derhofbauer.at>
 */

/* exported Hotkeys  */

const Lang = imports.lang;
const Main = imports.ui.main;
const Meta = imports.gi.Meta;
const Shell = imports.gi.Shell;

const BINDINGS = {};

const Hotkeys = new Lang.Class({
    Name: 'Hotkeys',

    _init: function(settings) {
        this._settings = settings;
        this._bindings = BINDINGS;
        this._proxies = {};
    },

    /**
     * Binds a hotkey using the local settings instance.
     */
    bind: function(setting, callback) {
        if (this._bindings[setting]) {
            return false;
        }

        let mode = Shell.ActionMode ? Shell.ActionMode.ALL : Shell.KeyBindingMode.ALL;
        let flags = Meta.KeyBindingFlags.NONE;

        let action = Main.wm.addKeybinding(setting, this._settings.settings, flags, mode, callback);

        if (action != Meta.KeyBindingAction.NONE) {
            this._bindings[setting] = action;
            return true;
        }

        return false;
    },

    /**
     * Unbinds a hotkey.
     */
    unbind: function(setting) {
        if (!this._bindings[setting]) {
            return false;
        }

        Main.wm.removeKeybinding(setting);
        delete this._bindings[setting];

        if (this._proxies[setting]) {
            this._proxies[setting].disconnect('changed::' + setting);
            delete this._proxies[setting];
        }

        return true;
    },

    /**
     * Binds a hotkey, proxying string changes from another settings object.
     */
    bindProxy: function(fromSettings, setting, callback) {
        if (this._bindings[setting]) {
            return false;
        }

        let success = this.bind(setting, callback);

        if (!success) {
            return false;
        }

        this._proxyStringSettingChange(fromSettings, setting);
        fromSettings.connect('changed::' + setting, Lang.bind(this, this._proxyStringSettingChange));

        this._proxies[setting] = fromSettings;

        return true;
    },

    /**
     * Unbinds all hotkeys.
     */
    unbindAll: function() {
        for (let setting in this._bindings) {
            this.unbind(setting);
        }
    },


    /**
     * Helper to use Shell's keybindings (which expects an array) with string
     * keybindings.
     */
    _proxyStringSettingChange: function(gsettings, key) {
        let value = gsettings.get_string(key) || '';
        let proxy = this._settings.get_array(key);

        // don't trigger a change event
        if (proxy.length == 1 && proxy[0] == value) {
            return;
        }

        this._settings.set_array(key, [value]);
    }
});
