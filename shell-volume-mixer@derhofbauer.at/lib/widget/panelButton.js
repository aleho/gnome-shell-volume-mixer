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

const { Menu } = Lib.menu.menu;
const { PercentageLabel } = Lib.widget.percentageLabel;

const VolumeType = {
    OUTPUT: 0,
    INPUT: 1,
};


/**
 * Stand-alone panel menu
 */
var PanelButton = GObject.registerClass(class PanelButton extends PanelMenu.Button
{
    /**
     * @param {Mixer} mixer
     * @param {Object} options
     * @private
     */
    _init(mixer, options = {}) {
        super._init(0.0, 'ShellVolumeMixer');

        this._volumeMenu = new Menu(mixer, {
            separator: true
        });

        this._volumeMenu.actor.add_style_class_name('svm-standalone-menu');

        this._icon = new St.Icon({ style_class: 'system-status-icon' });
        this._bin = new St.Bin({ child: this._icon });

        this._box = new St.BoxLayout();
        this.add_actor(this._box);
        this._box.add(this._bin);

        this._box.reactive = true;
        this._box.connect('scroll-event',
            (actor, event) => Volume.Indicator.prototype._handleScrollEvent.apply(this, [VolumeType.OUTPUT, event]));

        this._iconChangedId = this._volumeMenu.connect('output-icon-changed', this._onIconChanged.bind(this));

        if (options.showPercentageLabel) {
            this._percentageLabel = new PercentageLabel(mixer);
            this._box.add(this._percentageLabel);
        }

        this.menu.addMenuItem(this._volumeMenu);

        this._onIconChanged();
    }

    _onIconChanged() {
        this.setIcon(this._volumeMenu.getIcon(VolumeType.OUTPUT));
    }

    setIcon(icon_name) {
        this._icon.icon_name = icon_name;
    }

    _onDestroy() {
        super._onDestroy();

        if (this._iconChangedId) {
            this._volumeMenu.disconnect(this._iconChangedId);
            delete this._iconChangedId;
        }
    }
});
