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

    this.mixer = mixer;

    this._box = new St.BoxLayout();

    this._icon = new St.Icon({style_class: 'system-status-icon'});
    this._bin = new St.Bin({child: this._icon});

    this._stateIcon = new St.Icon({icon_name: 'audio-headphones-symbolic',
                                   style_class: 'system-status-icon'});
    this._stateIconBin = new St.Bin({child: this._stateIcon});

    this._box.add(this._bin);
    this._box.add(this._stateIconBin);

    this._stateIconBin.hide();

    this.actor.add_actor(this._box);
    this.actor.add_style_class_name('panel-status-button');
    this.actor.connect('scroll-event', Lang.bind(this, this._onScrollEvent));

    this.mixer.connect("icon-changed", Lang.bind(this, this._onIconChanged));

    this.menu.actor.add_style_class_name("AdvancedVolumeMixer");
    this.menu.addMenuItem(this.mixer);

    this._onIconChanged();
  },

  _onScrollEvent: function (actor, event) {
    this.mixer.scroll(event);
  },

  _onIconChanged: function () {
    this.setIcon(this.mixer.getIcon());

    if (this.mixer.outputHasHeadphones()) {
      this._stateIconBin.show();
    } else {
      this._stateIconBin.hide();
    }
  },

  setIcon: function (icon_name) {
    this._icon.icon_name = icon_name;
  }
});
