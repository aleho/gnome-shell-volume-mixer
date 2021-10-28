/**
 * Shell Volume Mixer
 *
 * Customized indicator using Volume Menu.
 *
 * @author Alexander Hofbauer <alex@derhofbauer.at>
 */

/* exported Indicator */

const Lib = imports.misc.extensionUtils.getCurrentExtension().imports.lib;
const { GObject, Clutter } = imports.gi;
const PanelMenu = imports.ui.panelMenu;
const Volume = imports.ui.status.volume;

const { EventHandlerDelegate } = Lib.utils.eventHandlerDelegate;
const { Menu } = Lib.menu.menu;
const { PercentageLabel } = Lib.widget.percentageLabel;
const Utils = Lib.utils.utils;


const VolumeType = {
    OUTPUT: 0,
    INPUT: 1,
};


/**
 * Custom indicator with dropdown menu.
 * Copied from status/volume.js
 *
 * @copypaste from Volume.Indicator: Needs code to not initialize volume menu and all its events.
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

        if (options.showPercentageLabel) {
            this._percentageLabel = new PercentageLabel(mixer);
            this.add_actor(this._percentageLabel);

            this._percentageLabel.reactive = true;
            this.connect(this._percentageLabel, 'scroll-event',
                (actor, event) => this._handleScrollEvent(VolumeType.OUTPUT, event));
            this.connect(this._percentageLabel, 'button-press-event',
                (actor, event) => this._handleButtonPress(VolumeType.OUTPUT, event));
        }

        this._inputIndicator = this._addIndicator();

        this._primaryIndicator.reactive = true;
        this._inputIndicator.reactive = true;

        this.connect(this._primaryIndicator, 'scroll-event',
            (actor, event) => this._handleScrollEvent(VolumeType.OUTPUT, event));
        this.connect(this._inputIndicator, 'scroll-event',
            (actor, event) => this._handleScrollEvent(VolumeType.INPUT, event));

        this.connect(this._primaryIndicator, 'button-press-event',
            (actor, event) => this._handleButtonPress(VolumeType.OUTPUT, event));
        this.connect(this._inputIndicator, 'button-press-event',
            (actor, event) => this._handleButtonPress(VolumeType.INPUT, event));

        this._control = mixer.control;
        this._volumeMenu = new Menu(mixer, options);
        this._volumeMenu.actor.add_style_class_name(options.menuClass);

        this.connect(this._volumeMenu, 'output-icon-changed', this.updateOutputIcon.bind(this));

        this._inputIndicator.visible = this._volumeMenu.getInputVisible();
        this.connect(this._volumeMenu, 'input-visible-changed', () => {
            this._inputIndicator.visible = this._volumeMenu.getInputVisible();
        });
        this.connect(this._volumeMenu, 'input-icon-changed', this.updateInputIcon.bind(this));
        // initial call to get an icon (especially for "show-always" setups)
        this.updateInputIcon();

        this.menu.addMenuItem(this._volumeMenu);
    }

    updateOutputIcon() {
        let icon = this._volumeMenu.getIcon(VolumeType.OUTPUT);

        if (icon) {
            this._primaryIndicator.icon_name = icon;
            this._primaryIndicator.visible = true;
        } else {
            this._primaryIndicator.visible = false;
        }
    }

    updateInputIcon() {
        let icon = this._volumeMenu.getIcon(VolumeType.INPUT);

        if (icon !== null) {
            this._inputIndicator.icon_name = icon;
        }
    }

    _handleScrollEvent(type, event) {
        return Volume.Indicator.prototype._handleScrollEvent.apply(this, [type, event]);
    }

    _handleButtonPress(type, event) {
        if (event.get_button() === 2) {
            if (type === VolumeType.OUTPUT) {
                this._volumeMenu._output.toggleMute();
            } else {
                this._volumeMenu._input.toggleMute();
            }

            return Clutter.EVENT_STOP;
        }

        return Clutter.EVENT_PROPAGATE;
    }

    destroy() {
        this.disconnectAll();

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

Utils.mixin(Indicator, EventHandlerDelegate);
