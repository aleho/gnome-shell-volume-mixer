/**
 * Shell Volume Mixer
 *
 * Hotkeys.
 *
 * @author Alexander Hofbauer <alex@derhofbauer.at>
 */

/* exported Hotkeys  */

const { Meta, Shell } = imports.gi;
const Lib = imports.misc.extensionUtils.getCurrentExtension().imports.lib;
const Main = imports.ui.main;

const Log = Lib.utils.log;

const BINDINGS = {};

var Hotkeys = class
{
    constructor(settings) {
        this._settings = settings;
        this._bindings = BINDINGS;
    }

    /**
     * Binds a hotkey using the local settings instance.
     *
     * @param {string} setting Settings key
     * @param {function()} callback
     */
    bind(setting, callback) {
        if (this._bindings[setting]) {
            Log.info(`Not binding hotkey for ${setting}, already bound`);
            return false;
        }

        const mode = Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW;
        const flags = Meta.KeyBindingFlags.IGNORE_AUTOREPEAT;
        const action = Main.wm.addKeybinding(setting, this._settings.settings, flags, mode, callback);

        if (action === Meta.KeyBindingAction.NONE) {
            Log.info(`Could not bind hotkey for ${setting}`);
        } else {
            Log.info(`Bound hotkey for ${setting}`);
            this._bindings[setting] = action;
        }
    }

    /**
     * Unbinds a hotkey.
     *
     * @param {string} setting Settings key
     */
    unbind(setting) {
        if (this._bindings[setting]) {
            Main.wm.removeKeybinding(setting);
            delete this._bindings[setting];
            Log.info(`Unbound hotkey for ${setting}`);
        }
    }

    /**
     * Unbinds all hotkeys.
     */
    unbindAll() {
        Log.info('Unbinding all hotkeys');
        for (let setting in this._bindings) {
            this.unbind(setting);
        }
    }
};
