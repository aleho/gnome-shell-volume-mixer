/**
 * Shell Volume Mixer
 *
 * Customized indicator using Volume Menu.
 *
 * @author Alexander Hofbauer <alex@derhofbauer.at>
 */

/* exported Indicator */

const Lib = imports.misc.extensionUtils.getCurrentExtension().imports.lib;
const { GObject } = imports.gi;
const PanelMenu = imports.ui.panelMenu;
const Volume = imports.ui.status.volume;

const { Menu } = Lib.menu.menu;
const { PercentageLabel } = Lib.widget.percentageLabel;


/**
 * Custom indicator with dropdown menu.
 * Copied from status/volume.js
 */
var Indicator = GObject.registerClass(class Indicator extends PanelMenu.SystemIndicator
{
    _init(mixer, options = {}) {
        super._init();

        this._primaryIndicator = this._addIndicator();
        this._inputIndicator = this._addIndicator();
        this._control = mixer.control;

        this._volumeMenu = new Menu(mixer, options);
        this._volumeMenu.connect('icon-changed', this.updateIcon.bind(this));

        if (options.showPercentageLabel) {
            this._percentageLabel = new PercentageLabel(mixer);
            this.add(this._percentageLabel);
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
     * We can mimic the original Indicator's handling of scroll events.
     */
    vfunc_scroll_event() {
        return Volume.Indicator.prototype.vfunc_scroll_event.apply(this, arguments);
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
