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

const Lang = imports.lang;
const Gvc = imports.gi.Gvc;
const Signals = imports.signals;

const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;

const PA_INVALID_INDEX = 0xffffffff;

let advMixer;


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
      let item = new PopupMenu.PopupSliderMenuItem(
        stream.volume / this._control.get_vol_max_norm()
      );
      let title = new PopupMenu.PopupMenuItem(
        stream.name,
        {reactive: false}
      );

      this._items[id] = [item, title];

      item.connect(
        "value-changed",
        Lang.bind(this, this._sliderValueChanged, stream.id)
      );

      stream.connect(
        "notify::volume",
        Lang.bind(this, this._notifyVolume, stream.id)
      );

      this._mixer.menu.addMenuItem(item, 3);
      this._mixer.menu.addMenuItem(title, 3);

      title.actor.show();
      item.actor.show();
    }
  },

  _streamRemoved: function(control, id) {
    if (id in this._items) {
      this._items[id][0].destroy();
      this._items[id][1].destroy();
      delete this._items[id];
    }
  },

  _sliderValueChanged: function(slider, value, id) {
    let stream = this._control.lookup_stream_id(id);
    let volume = value * this._control.get_vol_max_norm();

    stream.volume = volume;
    stream.push_volume();
  },

  _notifyVolume: function(object, param_spec, id) {
    let stream = this._control.lookup_stream_id(id);

    this._items[id][0].setValue(stream.volume / this._control.get_vol_max_norm());
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

