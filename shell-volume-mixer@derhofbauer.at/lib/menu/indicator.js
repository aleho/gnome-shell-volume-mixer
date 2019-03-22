/**
 * Shell Volume Mixer
 *
 * Customized indicator using Volume Menu.
 *
 * @author Alexander Hofbauer <alex@derhofbauer.at>
 */

/* exported Indicator */

const Lib = imports.misc.extensionUtils.getCurrentExtension().imports.lib;
const PanelMenu = imports.ui.panelMenu;
const Volume = imports.ui.status.volume;

const { Menu } = Lib.menu.menu;


const Utils = Lib.utils.utils;


class IndicatorExtension extends PanelMenu.SystemIndicator {}
Utils.mixin(IndicatorExtension, Volume.Indicator);


/**
 * Custom indicator, extension from Volume.Indicator without its constructor.
 */
var Indicator = class extends IndicatorExtension
{
    constructor(mixer, options) {
        options = options || {};

        super();

        this._primaryIndicator = this._addIndicator();
        this._control = mixer.control;

        this._volumeMenu = new Menu(mixer, options);
        this._volumeMenu.connect('icon-changed', this.updateIcon.bind(this));

        this.menu.addMenuItem(this._volumeMenu);

        this.indicators.connect('scroll-event', this._onScrollEvent.bind(this));
    }

    updateIcon() {
        let icon = this._volumeMenu.getIcon();

        if (icon != null) {
            this.indicators.show();
            this._primaryIndicator.icon_name = icon;
        } else {
            this.indicators.hide();
        }
    }

    destroy() {
        if (this.menu) {
            this.menu.destroy();
            this.menu = null;
        }
    }
};
