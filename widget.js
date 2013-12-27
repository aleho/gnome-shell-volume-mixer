// vi: et sw=2 fileencoding=utf8
//

const Mainloop = imports.mainloop;
const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const Slider = imports.ui.slider;
const Pango = imports.gi.Pango;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Atk = imports.gi.Atk;
const Clutter = imports.gi.Clutter;
const Lang = imports.lang;

const BoxPointer = imports.ui.boxpointer;

const Volume = imports.ui.status.volume;


const AppOutputStreamSlider = new Lang.Class({
  Name: "AppOutputStreamSlider",
  Extends: Volume.OutputStreamSlider,

  _init: function(control, oldStyle, stream_name_func) {
    this.parent(control);
    log("AppOutputStreamSlider");

    this.item.destroy();

    this.stream_name = stream_name_func || function (stream) { return stream.get_name() || stream.get_description(); };

    this.oldStyle = oldStyle || false;
    this.item = new PopupMenu.PopupBaseMenuItem({ activate: false });

    this._vbox = new St.BoxLayout({vertical: true});

    this._slider = new Slider.Slider(0);
    this._slider.connect('value-changed', Lang.bind(this, this._sliderChanged));
    this._slider.connect('drag-end', Lang.bind(this, this._notifyVolumeChange));

    this._icon = new St.Icon({ style_class: 'adv-volume-icon' });
    this._label = new St.Label({text: ""});
    this.item.actor.add(this._icon);
    this._vbox.add(this._label);
    this._vbox.add(this._slider.actor);
    this.item.actor.add(this._vbox, {expand: true});

    this.item.actor.connect('scroll-event', Lang.bind(this._slider, this._slider._onScrollEvent));
  },

  setButtonPressEvent: function() {
    this.item.actor.connect('button-press-event', Lang.bind(this, function(actor, event) {
      // FIXME Middle click mute
      this._slider.startDragging(event);
    }));
  },

  setOnlyMiddleButtonPressEvent: function() {
    this.item.actor.connect('button-press-event', Lang.bind(this, function(actor, event) {
      // FIXME Middle click mute
    }));
  },

  setKeyPressEvent: function() {
    this.item.actor.connect('key-press-event', Lang.bind(this, function(actor, event) {
      return this._slider.onKeyPressEvent(actor, event);
    }));
  },

  _updateSliderIcon: function() {
    if (this._stream && !this.oldStyle) {
      this._icon.gicon = this._stream.get_gicon();
    } else {
      this.parent();
    }

    this.emit("stream-updated");
  },

  _connectStream: function(stream) {
    this.parent(stream);

    this._label.text = this.stream_name(stream);
    this._updateSliderIcon();
    this.item.actor.stream = stream;
  }
});

const AdvSubMenuItem = new Lang.Class({
  Name: "AdvSubMenuItem",
  Extends: PopupMenu.PopupSubMenuMenuItem,

  _init: function(oldStyle) {
    this.parent("", true);

    //this.icon.remove_style_class_name("popup-menu-icon");
    this.icon.set_style_class_name("adv-volume-icon");
    this.slider = new Slider.Slider(0);

    // Remove actors except ornament
    this.actor.get_children().map(Lang.bind(this, function(child) {
      log(child);
      if (!child.has_style_class_name("popup-menu-ornament")) {
        this.actor.remove_actor(child);
      }
    }));

    if (oldStyle) {
      this.actor.add_child(this.icon);
      this.actor.add(this.slider.actor, {expand: true});
      this.actor.add_child(this._triangleBin);
    } else {
      this._vbox = new St.BoxLayout({vertical: true});
      this._hbox = new St.BoxLayout({vertical: false});

      this._hbox.add(this.label);
      this._hbox.add(this._triangleBin);
      this._vbox.add(this._hbox);
      this._vbox.add(this.slider.actor);

      this.actor.add_child(this.icon);
      this.actor.add_child(this._vbox);
    }
  },

  _onButtonReleaseEvent: function (actor, event) {
    if (event.get_button() != 2) {
      this._setOpenState(!this._getOpenState());
    }
  }
});


const AdvOutputStreamSlider = new Lang.Class({
  Name: "AdvOutputStreamSlider",
  Extends: AppOutputStreamSlider,

  _init: function(control, oldStyle) {
    this.parent(control, oldStyle);
    log("AdvOutputStreamSlider");

    this.item.destroy();
    this.item = new AdvSubMenuItem(this.oldStyle);

    this._slider.actor.destroy();
    this._slider = this.item.slider;
    this._slider.connect('value-changed', Lang.bind(this, this._sliderChanged));
    this._slider.connect('drag-end', Lang.bind(this, this._notifyVolumeChange));

    this._icon.destroy();
    this._icon = this.item.icon;
    this._label.destroy();
    this._label = this.item.label;

    this.item.actor.connect('scroll-event', Lang.bind(this._slider, this._slider._onScrollEvent));

  }
});
