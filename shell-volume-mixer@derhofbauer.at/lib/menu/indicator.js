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

const VolumeType = {
    OUTPUT: 0,
    INPUT: 1,
};


/**
 * Custom indicator with dropdown menu.
 * Copied from status/volume.js
 *
 * @copypaste: Needs code to not initialize volume menu and all its events.
 */
var Indicator = GObject.registerClass(class Indicator extends PanelMenu.SystemIndicator
{
    /**
     * @param {Mixer} mixer
     * @param {Object} options
     * @private
     */
    _init(mixer, options = {}) {
        super._init();

        this._primaryIndicator = this._addIndicator();
        this._inputIndicator = this._addIndicator();

        this._primaryIndicator.reactive = true;
        this._inputIndicator.reactive = true;

        this._primaryIndicator.connect('scroll-event',
            (actor, event) => Volume.Indicator.prototype._handleScrollEvent.apply(this, [VolumeType.OUTPUT, event]));
        this._inputIndicator.connect('scroll-event',
            (actor, event) => Volume.Indicator.prototype._handleScrollEvent.apply(this, [VolumeType.INPUT, event]));

        this._control = mixer.control;
        this._volumeMenu = new Menu(mixer, options);
        this._volumeMenu.connect('output-icon-changed', this.updateOutputIcon.bind(this));

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

        this._volumeMenu.actor.add_style_class_name('svm-integrated-menu');

        if (options.showPercentageLabel) {
            this._percentageLabel = new PercentageLabel(mixer);
            this.add(this._percentageLabel);
        }
    }

    updateOutputIcon() {
        let icon = this._volumeMenu.getOutputIcon();

        if (icon) {
            this._primaryIndicator.icon_name = icon;
            this._primaryIndicator.visible = true;
        } else {
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
