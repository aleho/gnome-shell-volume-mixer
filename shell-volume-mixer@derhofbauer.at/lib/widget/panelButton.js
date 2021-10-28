/**
 * Shell Volume Mixer
 *
 * Stand-alone menu panel button.
 *
 * @author Alexander Hofbauer <alex@derhofbauer.at>
 */

/* exported PanelButton */

const Lib = imports.misc.extensionUtils.getCurrentExtension().imports.lib;
const { GObject, St } = imports.gi;
const PanelMenu = imports.ui.panelMenu;
const Volume = imports.ui.status.volume;

const { Indicator } = Lib.menu.indicator;

/**
 * Stand-alone panel menu button.
 */
var PanelButton = GObject.registerClass(class PanelButton extends PanelMenu.Button
{
    /**
     * @param {Mixer} mixer
     * @param {Object} options
     * @private
     */
    _init(mixer, options = {}) {
        super._init(0.0, 'ShellVolumeMixer', false);

        this._indicators = new St.BoxLayout({ style_class: 'panel-status-indicators-box' });
        this.add_child(this._indicators);

        this._volume = new Indicator(mixer, {
            ...options,
            separator: true,
            menuClass: 'svm-standalone-menu',
        });

        this._indicators.add_child(this._volume);
        this.menu.addMenuItem(this._volume.menu);
    }
});
