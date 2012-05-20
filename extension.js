// extension.js
// vi: et sw=2
//
// Advanced Volume Mixer
// Control programs' volume from gnome volume mixer applet.
//
// Idea from: https://extensions.gnome.org/extension/142/output-device-chooser-on-volume-menu/
//
// Author: Harry Karvonen <harry.karvonen@gmail.com>
//

const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const Gvc = imports.gi.Gvc;
const Signals = imports.signals;
const St = imports.gi.St;

const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;


let advMixer;


function AdvPopupSwitchMenuItem() {
  this._init.apply(this, arguments);
}


AdvPopupSwitchMenuItem.prototype = {
  __proto__: PopupMenu.PopupSwitchMenuItem.prototype,

  _init: function(text, active, gicon, params) {
    PopupMenu.PopupSwitchMenuItem.prototype._init.call(
      this,
      "   " + text,
      active,
      params
    );

    this._icon = new St.Icon({
      gicon:        gicon,
      style_class: "adv-volume-icon"
    });

    this.removeActor(this._statusBin);
    this.removeActor(this.label)

    this.label.add_style_class_name("adv-volume-label");

    this.addActor(this._icon, {span: 0, expand: false});
    this.addActor(this.label, {span: 2, expand: true});
    this.addActor(this._statusBin, {span: -1,
                                    expand: false,
                                    align: St.Align.END});
  }
}


function AdvMixer(mixer) {
  this._init(mixer);
}


AdvMixer.prototype = {
  _init: function(mixer) {
    this._mixer = mixer;
    this._control = mixer._control;
    this._items = {};

    this._streamAddedId = this._control.connect(
      "stream-added",
      Lang.bind(this, this._streamAdded)
    );
    this._streamRemovedId = this._control.connect(
      "stream-removed",
      Lang.bind(this, this._streamRemoved)
    );
  },


  _streamAdded: function(control, id) {
    if (id in this._items) {
      return;
    }

    let stream = control.lookup_stream_id(id);

    if (stream["is-event-stream"]) {
      // Do nothing
    } else if (stream instanceof Gvc.MixerSinkInput) {
      let slider = new PopupMenu.PopupSliderMenuItem(
        stream.volume / this._control.get_vol_max_norm()
      );
      let title = new AdvPopupSwitchMenuItem(
        stream.name,
        !stream.is_muted,
        stream.get_gicon(),
        {activate: false}
      );

      this._items[id] = {
        slider: slider,
        title: title
      };

      slider.connect(
        "value-changed",
        Lang.bind(this, this._sliderValueChanged, stream.id)
      );

      title.actor.connect(
        "button-release-event",
        Lang.bind(this, this._titleToggleState, stream.id)
      );

      title.actor.connect(
        "key-press-event",
        Lang.bind(this, this._titleToggleState, stream.id)
      );

      stream.connect(
        "notify::volume",
        Lang.bind(this, this._notifyVolume, stream.id)
      );

      stream.connect(
        "notify::is-muted",
        Lang.bind(this, this._notifyIsMuted, stream.id)
      );

      this._mixer.menu.addMenuItem(this._items[id]["slider"], 3);
      this._mixer.menu.addMenuItem(this._items[id]["title"], 3);
    }
  },

  _streamRemoved: function(control, id) {
    if (id in this._items) {
      this._items[id]["slider"].destroy();
      this._items[id]["title"].destroy();
      delete this._items[id];
    }
  },

  _sliderValueChanged: function(slider, value, id) {
    let stream = this._control.lookup_stream_id(id);
    let volume = value * this._control.get_vol_max_norm();

    stream.volume = volume;
    stream.push_volume();
  },

  _titleToggleState: function(title, event, id) {
    if (event.type() == Clutter.EventType.KEY_PRESS) {
      let symbol = event.get_key_symbol();

      if (symbol != Clutter.KEY_space && symbol != Clutter.KEY_Return) {
        return false;
      }
    }

    let stream = this._control.lookup_stream_id(id);

    stream.change_is_muted(!stream.is_muted);

    return true;
  },

  _notifyVolume: function(object, param_spec, id) {
    let stream = this._control.lookup_stream_id(id);

    this._items[id]["slider"].setValue(stream.volume / this._control.get_vol_max_norm());
  },

  _notifyIsMuted: function(object, param_spec, id) {
    let stream = this._control.lookup_stream_id(id);

    this._items[id]["title"].setToggleState(!stream.is_muted);
  },

  destroy: function() {
    this._control.disconnect(this._streamAddedId);
    this._control.disconnect(this._streamRemovedId);
    this.emit("destroy");
  }
};


Signals.addSignalMethods(AdvMixer.prototype);


function main() {
  init();
  enable();
}


function init() {
}


function enable() {
  if (Main.panel._statusArea['volume'] && !advMixer) {
    advMixer = new AdvMixer(Main.panel._statusArea["volume"]);
  }
}


function disable() {
  if (advMixer) {
    advMixer.destroy();
    advMixer = null;
  }
}

