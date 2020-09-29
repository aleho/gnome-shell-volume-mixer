/**
 * Shell Volume Mixer
 *
 * Customized indicator using Volume Menu.
 *
 * @author Alexander Hofbauer <alex@derhofbauer.at>
 */

/* exported Indicator */

const Lib = imports.misc.extensionUtils.getCurrentExtension().imports.lib;
const { Clutter, GObject } = imports.gi;
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
        this._volumeMenu.actor.add_style_class_name('svm-integrated-menu');
        this._volumeMenu.connect('output-icon-changed', this.updateOutputIcon.bind(this));

        if (options.showPercentageLabel) {
            this._percentageLabel = new PercentageLabel(mixer);
            this.add(this._percentageLabel);
        }

        // copy paste code here
        this._inputIndicator.visible = this._volumeMenu.getInputVisible();
        this._volumeMenu.connect('input-visible-changed', () => {
            this._inputIndicator.visible = this._volumeMenu.getInputVisible();
        });
        this._volumeMenu.connect('input-icon-changed', () => {
            let icon = this._volumeMenu.getInputIcon();

            if (icon !== null)
                this._inputIndicator.icon_name = icon;
        });

        this.menu.addMenuItem(this._volumeMenu);
    }

    /**
     * We can mimic the original Indicator's handling of scroll events.
     */
    vfunc_scroll_event() {
        Volume.Indicator.prototype.vfunc_scroll_event.apply(this, arguments);

        // tell all upstream consumers we handled this event
        return Clutter.EVENT_STOP;
    }

    updateOutputIcon() {
        let icon = this._volumeMenu.getOutputIcon();

        if (icon) {
            this.show();
            this._primaryIndicator.icon_name = icon;
            this._primaryIndicator.visible = true;
        } else {
            this.hide();
            this._primaryIndicator.visible = false;
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
