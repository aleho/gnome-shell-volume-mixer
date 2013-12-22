// vi: et sw=2 fileencoding=utf8
//

const Mainloop = imports.mainloop;
const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const Slider = imports.ui.slider;
const Pango = imports.gi.Pango;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Lang = imports.lang;

const Volume = imports.ui.status.volume;


const AppOutputStreamSlider = new Lang.Class({
  Name: "AppOutputStreamSlider",
  Extends: Volume.StreamSlider,

  _init: function(control) {
    log("AppOutputStreamSlider");

    this._control = control;
    this.item = new PopupMenu.PopupBaseMenuItem({ activate: false });

    this._vbox = new St.BoxLayout({vertical: true});
    //this._hbox = new St.BoxLayout({vertical: false});

    this._slider = new Slider.Slider(0);
    this._slider.connect('value-changed', Lang.bind(this, this._sliderChanged));
    this._slider.connect('drag-end', Lang.bind(this, this._notifyVolumeChange));

    this._icon = new St.Icon({ style_class: 'adv-volume-icon' });
    this._label = new St.Label({text: ""});
    this.item.actor.add(this._icon);
    this._vbox.add(this._label);
    this._vbox.add(this._slider.actor /*,{ expand: true }*/);
    this.item.actor.add(this._vbox, {expand: true});

    this.item.actor.connect('scroll-event', Lang.bind(this._slider, this._slider._onScrollEvent));
    this.item.actor.connect('button-press-event', Lang.bind(this, function(actor, event) {
      this._slider.startDragging(event);
    }));
    this.item.actor.connect('key-press-event', Lang.bind(this, function(actor, event) {
      return this._slider.onKeyPressEvent(actor, event);
    }));
  },

  _updateSliderIcon: function() {
    if (this._stream) {
      log("_updateSliderIcon:");
      log(this._stream.get_gicon());
      this._icon.gicon = this._stream.get_gicon();
    } else {
      this._icon.icon_name = (this._hasHeadphones ?
                              'audio-headphones-symbolic' :
                              'audio-speakers-symbolic');
    }
  },

  _connectStream: function(stream) {
    this._mutedChangedId = stream.connect('notify::is-muted', Lang.bind(this, this._updateVolume));
    this._volumeChangedId = stream.connect('notify::volume', Lang.bind(this, this._updateVolume));
    this._label.text = stream.get_name() || stream.get_description();
    this._icon.gicon = stream.get_gicon();
  },

});

