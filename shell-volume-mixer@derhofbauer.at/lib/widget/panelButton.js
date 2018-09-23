/**
 * Shell Volume Mixer
 *
 * Stand-alone menu panel button.
 *
 * @author Alexander Hofbauer <alex@derhofbauer.at>
 */

/* exported PanelButton */

const Lib = imports.misc.extensionUtils.getCurrentExtension().imports.lib;
const PanelMenu = imports.ui.panelMenu;
const St = imports.gi.St;

const { Menu } = Lib.menu.menu;


/**
 * Stand-alone panel menu
 */
var PanelButton = class extends PanelMenu.Button
{
    constructor(mixer) {
        super(0.0, 'ShellVolumeMixer');

        this._mixerMenu = new Menu(mixer, {
            separator: true
        });

        this._box = new St.BoxLayout();

        this._icon = new St.Icon({ style_class: 'system-status-icon' });
        this._bin = new St.Bin({ child: this._icon });

        this._stateIcon = new St.Icon({
            icon_name: 'audio-speakers-symbolic',
            style_class: 'system-status-icon'
        });

        this._box.add(this._bin);

        this.actor.add_actor(this._box);

        this._mixerMenu.connect('icon-changed', this._onIconChanged.bind(this));

        this.menu.actor.add_style_class_name('shell-volume-mixer-button');
        this.menu.addMenuItem(this._mixerMenu);

        this._onIconChanged();
    }

    _onIconChanged() {
        if (this._mixerMenu.outputHasHeadphones()) {
            this.setIcon('audio-headphones-symbolic');
        } else {
            this.setIcon(this._mixerMenu.getIcon());
        }
    }

    setIcon(icon_name) {
        this._icon.icon_name = icon_name;
    }
};
