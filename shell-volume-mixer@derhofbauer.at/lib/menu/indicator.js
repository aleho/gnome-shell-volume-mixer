/**
 * Shell Volume Mixer
 *
 * Customized indicator using Volume Menu.
 *
 * @author Alexander Hofbauer <alex@derhofbauer.at>
 */

/* exported Indicator */

const Lib = imports.misc.extensionUtils.getCurrentExtension().imports.lib;
const { Clutter, GObject, Gio } = imports.gi;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;

const { Menu } = Lib.menu.menu;
const { PercentageLabel } = Lib.widget.percentageLabel;
const { Settings, SETTING } = Lib.settings;


/**
 * Custom indicator with dropdown menu.
 * Copied from status/volume.js
 */
var Indicator = GObject.registerClass(class Indicator extends PanelMenu.SystemIndicator
{
    _init(mixer, options) {
        options = options || {};

        super._init();

        this._primaryIndicator = this._addIndicator();
        this._inputIndicator = this._addIndicator();
        this._control = mixer.control;

        this._settings = new Settings();
        this._volumeMenu = new Menu(mixer, options);
        this._volumeMenu.connect('icon-changed', this.updateIcon.bind(this));

        if (this._settings.get_boolean(SETTING.show_percentage_label)) {
            this._percentageLabel = new PercentageLabel(mixer);
            this.add(this._percentageLabel);
            this.add_style_class_name('power-status'); // fake power class for style equal to battery percentage
        }

        this._inputIndicator.set({
            icon_name: 'audio-input-microphone-symbolic',
            visible: this._volumeMenu.getInputVisible(),
        });
        this._volumeMenu.connect('input-visible-changed', () => {
            this._inputIndicator.visible = this._volumeMenu.getInputVisible();
        });

        this.menu.addMenuItem(this._volumeMenu);
    }

    /**
     * copy/pasted from volume.js:Indicator
     */
    vfunc_scroll_event() {
        let result = this._volumeMenu.scroll(Clutter.get_current_event());
        if (result == Clutter.EVENT_PROPAGATE || this.menu.actor.mapped)
            return result;

        let gicon = new Gio.ThemedIcon({ name: this._volumeMenu.getIcon() });
        let level = this._volumeMenu.getLevel();
        let maxLevel = this._volumeMenu.getMaxLevel();
        Main.osdWindowManager.show(-1, gicon, null, level, maxLevel);
        return result;
    }

    updateIcon() {
        let icon = this._volumeMenu.getIcon();

        if (icon !== null) {
            this.show();
            this._primaryIndicator.icon_name = icon;
        } else {
            this.hide();
        }
    }

    destroy() {
        if (this.menu) {
            this.menu.destroy();
            this.menu = null;
        }

        if (this._percentageLabel) {
            this._percentageLabel.destroy();
            this._percentageLabel = null;
        }
    }
});
