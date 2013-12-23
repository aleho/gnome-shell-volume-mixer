// vi: et sw=2 fileencoding=utf8
//


const Lang = imports.lang;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const PanelMenu = imports.ui.panelMenu;
const GLib = imports.gi.GLib;

const AVM = imports.misc.extensionUtils.getCurrentExtension();
const Settings = AVM.imports.settings;

const AdvancedVolumeMixerStatusButton = new Lang.Class({
  Name: 'AdvancedVolumeMixerStatusButton',
  Extends: PanelMenu.Button,

  _init: function(mixer) {
    this.parent(0.0, "AdvancedVolumeMixer");

    this._mixer = mixer;

    this._delegate = this._mixer;

    this._coverPath = "";
    this._coverSize = 22;
    this._state = "";

    this._box = new St.BoxLayout();

    this._icon = new St.Icon({icon_name: this._mixer.getIcon(), // 'audio-x-generic-symbolic',
                              style_class: 'system-status-icon'});
    this._bin = new St.Bin({child: this._icon});

    this._stateIcon = new St.Icon({icon_name: 'system-run-symbolic',
                                   style_class: 'status-icon'});
    this._stateIconBin = new St.Bin({child: this._stateIcon,
                                     y_align: St.Align.END});

    this._box.add(this._bin);
    this._box.add(this._stateIconBin);
    this.actor.add_actor(this._box);
    this.actor.add_style_class_name('panel-status-button');
    this.actor.connect('scroll-event', Lang.bind(this, this._onScrollEvent));

    this._mixer.connect("icon-changed", Lang.bind(this, this._onIconChanged));
    this.menu.actor.add_style_class_name("AdvancedVolumeMixer");
    this.menu.addMenuItem(this._mixer);
  },

  _onScrollEvent: function (actor, event) {
    this._mixer.scroll(event);
  },

  _onIconChanged: function (mixer) {
    this.setIcon(mixer.getIcon());
  },

  setIcon: function (icon_name) {
    this._icon.icon_name = icon_name;
  }

});
