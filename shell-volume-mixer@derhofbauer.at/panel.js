/**
 * Shell Volume Mixer
 *
 * Advanced mixer extension.
 *
 * @author Harry Karvonen <harry.karvonen@gmail.com>
 * @author Alexander Hofbauer <alex@derhofbauer.at>
 */

/* exported Button */

const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Lang = imports.lang;
const PanelMenu = imports.ui.panelMenu;
const St = imports.gi.St;

const Menu = Extension.imports.menu;

/**
 * Stand-alone panel menu
 */
const Button = new Lang.Class({
    Name: 'ShellVolumeMixerButton',
    Extends: PanelMenu.Button,

    _init: function(mixer, options) {
        this.parent(0.0, 'ShellVolumeMixer');

        this._mixerMenu = new Menu.Menu(mixer, {
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
        this.actor.connect('scroll-event', Lang.bind(this, this._onScrollEvent));

        this._mixerMenu.connect('icon-changed', Lang.bind(this, this._onIconChanged));

        this.menu.actor.add_style_class_name('shellvolumemixer');
        this.menu.addMenuItem(this._mixerMenu);

        this._onIconChanged();
    },

    _onScrollEvent: function(actor, event) {
        this._mixerMenu.scroll(event);
    },

    _onIconChanged: function() {
        if (this._mixerMenu.outputHasHeadphones()) {
            this.setIcon('audio-headphones-symbolic');
        } else {
            this.setIcon(this._mixerMenu.getIcon());
        }
    },

    setIcon: function(icon_name) {
        this._icon.icon_name = icon_name;
    }
});
