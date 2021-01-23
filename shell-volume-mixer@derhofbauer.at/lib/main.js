/**
 * Shell Volume Mixer
 *
 * Main extension setup.
 *
 * @author Alexander Hofbauer <alex@derhofbauer.at>
 */

/* exported Extension */

const Lib = imports.misc.extensionUtils.getCurrentExtension().imports.lib;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;

const { Dbus } = Lib.dbus.dbus;
const { EventBroker } = Lib.utils.eventBroker;
const { Mixer } = Lib.volume.mixer;
const { Indicator } = Lib.menu.indicator;
const { PanelButton } = Lib.widget.panelButton;
const { Settings, SETTING, cleanup: settingsCleanup } = Lib.settings;

const Log = Lib.utils.log;

const DEFAULT_INDICATOR_POS = 4;


let instance;

var Extension = class {
    constructor() {
        if (instance) {
            return instance;
        }

        instance = this;

        // save the original volume reference in aggregate menu.
        this._orgVolume = this._menu._volume;
    }

    /**
     * Settings instance.
     * @private
     */
    get _settings() {
        if (!this._settingsInstance) {
            this._settingsInstance = new Settings();
        }

        return this._settingsInstance;
    }

    /**
     * The shell aggregate menu instance.
     * @private
     */
    get _menu() {
        return Main.panel.statusArea.aggregateMenu;
    }

    enable() {
        this._events = new EventBroker();
        this._events.connect('extension-disable', () => {
            this.disable();
        });
        this._events.connect('extension-enable', () => {
            this.enable();
        });
        this._events.connect('extension-reload', () => {
            this._reloadExtension();
        });

        this._settings.connectChanged(() => {
            this._reloadExtension();
        });

        this._mixer = new Mixer();

        let position = this._settings.get_enum(SETTING.position);

        if (position === SETTING.position_at.menu) {
            this._replaceOriginal();
        } else {
            this._addPanelButton(position);
        }

        if (this._settings.get_boolean(SETTING.debug) === true) {
            this._enableDebugging();
        }
    }

    disable() {
        instance = null;

        this._menu._volume = this._orgVolume;
        this._showOriginal();

        if (this._events) {
            this._events.disconnectAll();
            this._events = null;
        }

        if (this._mixer) {
            this._mixer.destroy();
            this._mixer = null;
        }

        if (this._indicator) {
            this._menu._indicators.remove_actor(this._indicator);
            this._indicator.destroy();
            this._indicator = null;
        }

        if (this._panelButton) {
            this._panelButton.destroy();
            this._panelButton = null;
        }

        if (this._dbus) {
            this._dbus.destroy();
            this._dbus = null;
        }

        this._settingsInstance = null;
        settingsCleanup();
    }

    /**
     * Hides the original menu item and icon.
     * @private
     */
    _hideOriginal() {
        this._orgVolume._volumeMenu.actor.hide();
        this._orgVolume._primaryIndicator.hide();
        this._menu._indicators.remove_child(this._orgVolume);
    }

    /**
     * Restores the original menu item and icon.
     * @private
     */
    _showOriginal() {
        this._menu._indicators.insert_child_at_index(this._orgVolume, this._indicatorPos || DEFAULT_INDICATOR_POS);
        this._orgVolume._volumeMenu.actor.show();
        this._orgVolume._primaryIndicator.show();
    }

    /**
     * Replaces the current indicator and menu.
     * @private
     */
    _replaceOriginal() {
        this._indicator = new Indicator(this._mixer, {
            separator: false,
            showPercentageLabel: this._settings.get_boolean(SETTING.show_percentage_label),
        });

        // get current indicator position
        this._indicatorPos = this._getCurrentIndicatorPosition();
        this._hideOriginal();

        // add our own indicator and menu
        this._menu._volume = this._indicator;
        this._menu._indicators.insert_child_at_index(this._indicator, this._indicatorPos);
        this._menu.menu.addMenuItem(this._indicator.menu, 0);

        this._menu.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem(), 1);

        // on disable/enable we won't get a stream-changed event, so trigger it here to be safe
        this._indicator.updateOutputIcon();
    }

    /**
     * Find the current volume icon's position.
     * @private
     */
    _getCurrentIndicatorPosition() {
        let indicators = this._menu._indicators.get_children();
        let indicatorPos = DEFAULT_INDICATOR_POS;

        for (let i = 0; i < indicators.length; i++) {
            if (this._orgVolume === indicators[i]) {
                indicatorPos = i;
                break;
            }
        }

        return indicatorPos;
    }

    /**
     * Inits this extension as stand-alone button.
     * @private
     */
    _addPanelButton(position) {
        if (this._settings.get_boolean(SETTING.remove_original)) {
            this._hideOriginal();
        }

        this._panelButton = new PanelButton(this._mixer, {
            showPercentageLabel: this._settings.get_boolean(SETTING.show_percentage_label),
        });

        if (position === SETTING.position_at.left) {
            Main.panel.addToStatusArea('ShellVolumeMenu', this._panelButton, 999, 'left');
        } else if (position === SETTING.position_at.center) {
            Main.panel.addToStatusArea('ShellVolumeMenu', this._panelButton, 999, 'center');
        } else {
            Main.panel.addToStatusArea('ShellVolumeMenu', this._panelButton);
        }
    }

    /**
     * Reloads the extension be disabling / enabling it.
     * @private
     */
    _reloadExtension() {
        this.disable();
        this.enable();
    }

    /**
     * Enables the debugging and messages.
     *
     * @private
     */
    _enableDebugging() {
        Log.verbose = true;

        this._dbus = new Dbus({
            debugCards: () => {
                return this._emitDebugEvent('debug-cards');
            },

            debugStreams: () => {
                return this._emitDebugEvent('debug-streams');
            },

            debugEvents: () => {
                return this._emitDebugEvent('debug-events');
            },

            reload: () => {
                this._reloadExtension();
            },
        });

        this._dbus.init();
    }

    _emitDebugEvent(eventName) {
        this._events.emit(eventName, result => {
            Log.info(result);
        });

        return 'OK';
    }
};
