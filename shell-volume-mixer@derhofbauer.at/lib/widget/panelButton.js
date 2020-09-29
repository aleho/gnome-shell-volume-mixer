/**
 * Shell Volume Mixer
 *
 * Stand-alone menu panel button.
 *
 * @author Alexander Hofbauer <alex@derhofbauer.at>
 */

/* exported PanelButton */

const Lib = imports.misc.extensionUtils.getCurrentExtension().imports.lib;
const GObject = imports.gi.GObject;
const PanelMenu = imports.ui.panelMenu;
const St = imports.gi.St;

const { Menu } = Lib.menu.menu;
const { PercentageLabel } = Lib.widget.percentageLabel;


/**
 * Stand-alone panel menu
 */
var PanelButton = GObject.registerClass(class PanelButton extends PanelMenu.Button
{
    _init(mixer, options = {}) {
        super._init(0.0, 'ShellVolumeMixer');

        this._mixerMenu = new Menu(mixer, {
            separator: true
        });
        this._mixerMenu.actor.add_style_class_name('svm-standalone-menu');

        this._box = new St.BoxLayout();

        this._icon = new St.Icon({ style_class: 'system-status-icon' });
        this._bin = new St.Bin({ child: this._icon });

        this._box.add(this._bin);

        this.add_actor(this._box);

        this._iconChangedId = this._mixerMenu.connect('output-icon-changed', this._onIconChanged.bind(this));

        if (options.showPercentageLabel) {
            this._percentageLabel = new PercentageLabel(mixer);
            this._box.add(this._percentageLabel);
        }

        this.menu.addMenuItem(this._mixerMenu);

        this._onIconChanged();
    }

    _onIconChanged() {
        if (this._mixerMenu.outputHasHeadphones()) {
            this.setIcon('audio-headphones-symbolic');
        } else {
            this.setIcon(this._mixerMenu.getOutputIcon());
        }
    }

    setIcon(icon_name) {
        this._icon.icon_name = icon_name;
    }

    _onDestroy() {
        super._onDestroy();

        if (this._iconChangedId) {
            this._mixerMenu.disconnect(this._iconChangedId);
            delete this._iconChangedId;
        }
    }
});
