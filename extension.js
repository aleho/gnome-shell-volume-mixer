// extension.js
// vi: et sw=2
//
// Advanced Volume Mixer
// Control programs' volume from gnome volume mixer applet.
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
      " " + text + "  ",
      active,
      params
    );

    this._icon = new St.Icon({
      gicon:        gicon,
      style_class: "adv-volume-icon"
    });

    // Rebuild switch
    this.removeActor(this._statusBin);
    this.removeActor(this.label)

    // Horizontal box
    let labelBox = new St.BoxLayout({vertical: false});

    labelBox.add(this._icon,
                {expand: false, x_fill: false, x_align: St.Align.START});
    labelBox.add(this.label,
                 {expand: false, x_fill: false, x_align: St.Align.START});
    labelBox.add(this._statusBin,
                 {expand: true, x_fill: true, x_align: St.Align.END});
            
    this.addActor(labelBox, {span: -1, expand: true });
  }
}


function AdvMixer(mixer) {
  this._init(mixer);
}


AdvMixer.prototype = {
  _init: function(mixer) {
    this._mixer = mixer;
    this._control = mixer._control;
    this._separator = new PopupMenu.PopupSeparatorMenuItem();
    this._items = {};
    this._outputs = {};
    this._outputMenu = new PopupMenu.PopupSubMenuMenuItem(_("Volume"));

    this._mixer.menu.addMenuItem(this._separator, 1);

    this._streamAddedId = this._control.connect(
      "stream-added",
      Lang.bind(this, this._streamAdded)
    );
    this._streamRemovedId = this._control.connect(
      "stream-removed",
      Lang.bind(this, this._streamRemoved)
    );
    this._defaultSinkChangedId = this._control.connect(
      "default-sink-changed",
      Lang.bind(this, this._defaultSinkChanged)
    );

    // Change Volume title
    let title = this._mixer._volumeMenu.firstMenuItem.firstMenuItem;
    title.destroy();

    this._mixer._volumeMenu.firstMenuItem.addMenuItem(this._outputMenu, 0);
    this._outputMenu.actor.show();

    // Add streams
    let streams = this._control.get_streams();
    for (let i = 0; i < streams.length; i++) {
      this._streamAdded(this._control, streams[i].id);
    }

    if (this._control.get_default_sink() != null) {
      this._defaultSinkChanged(
        this._control,
        this._control.get_default_sink().id
      );
    }
  },


  _streamAdded: function(control, id) {
    if (id in this._items) {
      return;
    }

    if (id in this._outputs) {
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
        stream.name || stream.description,
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

      this._mixer.menu.addMenuItem(this._items[id]["slider"], 2);
      this._mixer.menu.addMenuItem(this._items[id]["title"], 2);
    } else if (stream instanceof Gvc.MixerSink) {
      let output = new PopupMenu.PopupMenuItem(stream.description);

      output.connect(
        "activate",
        function (item, event) { control.set_default_sink(stream); }
      );

      this._outputMenu.menu.addMenuItem(output);

      this._outputs[id] = output;
    }
  },

  _streamRemoved: function(control, id) {
    if (id in this._items) {
      this._items[id]["slider"].destroy();
      this._items[id]["title"].destroy();
      delete this._items[id];
    }

    if (id in this._outputs) {
      this._outputs[id].destroy();
      delete this._outputs[id];
    }
  },

  _defaultSinkChanged: function(control, id) {
    for (let output in this._outputs) {
      this._outputs[output].setShowDot(output == id);
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
    this._control.disconnect(this._defaultSinkChangedId);

    this._separator.destroy();
    delete this._separator;

    // Restore Volume label
    this._outputMenu.destroy();
    delete this._outputMenu;

    let title = new PopupMenu.PopupMenuItem(_("Volume"), {reactive: false });
    this._mixer._volumeMenu.firstMenuItem.addMenuItem(title, 0);
    title.actor.show();

    // remove application streams
    for (let id in this._items) {
      this._streamRemoved(this._control, id);
    }

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
  if (Main.panel.statusArea['volume'] && !advMixer) {
    advMixer = new AdvMixer(Main.panel.statusArea["volume"]);
  }
}


function disable() {
  if (advMixer) {
    advMixer.destroy();
    advMixer = null;
  }
}

