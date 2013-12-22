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
const St = imports.gi.St;

const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;

const Volume = imports.ui.status.volume;

const AVM = imports.misc.extensionUtils.getCurrentExtension();
const Widget = AVM.imports.widget;
const Settings = AVM.imports.settings;
const Panel = AVM.imports.panel;

const AdvancedVolumeMixer = new Lang.Class({
  Name: "AdvancedVolumeMixer",
  Extends: PopupMenu.PopupMenuSection,

  _init: function(menu) {
    this.parent();

    this.hasHeadphones = false;

    this._menu = menu;
    this._control = Volume.getMixerControl();
    this._sinks = {};
    this._outputs = {};
    this._settings = Settings.gsettings;

    log("AdvVolumeMixer init");
    log(this._control.get_vol_max_norm());
    log(this._settings.get_enum("position"));

    this._control.connect(
      "state-changed",
      Lang.bind(this, this._onControlStateChanged)
    );
    this._control.connect(
      "default-sink-changed",
      Lang.bind(this, this._readOutput));
    this._control.connect(
      "default-source-changed",
      Lang.bind(this, this._readInput)
    );
    this._control.connect(
      "stream-added",
      Lang.bind(this, this._streamAdded)
    );
    this._control.connect(
      "stream-removed",
      Lang.bind(this, this._streamRemoved)
    );

    this._output = null;

    if (this._settings.get_enum("output-type") == 0) {
      this._output = new Volume.OutputStreamSlider(this._control);
    } else {
      this._output = new Widget.AppOutputStreamSlider(this._control);
    }
    this._output.connect('stream-updated', Lang.bind(this, function() {
      this.emit('icon-changed');
    }));

    this._input = new Volume.InputStreamSlider(this._control);

    this.addMenuItem(this._output.item);
    this.addMenuItem(this._input.item);
    this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    this._onControlStateChanged();
  },

  scroll: function(event) {
    this._output.scroll(event);
  },

  _streamAdded: function(control, id) {
    if (id in this._sinks) {
      return;
    }

    if (id in this._outputs) {
      return;
    }

    let stream = control.lookup_stream_id(id);

    if (stream["is-event-stream"]) {
      // Do nothing
    } else if (stream instanceof Gvc.MixerSinkInput) {
      let s = new Widget.AppOutputStreamSlider(this._control);
      s.stream = stream;
      this._sinks[id] = s;
      this.addMenuItem(s.item);
    } else if (stream instanceof Gvc.MixerSink) {
      let s = new Volume.OutputStreamSlider(this._control);
      s.stream = stream;
      this._outputs[id] = s;
    }
  },

  _streamRemoved: function(control, id) {
    if (id in this._sinks) {
      this._sinks[id].item.destroy();
      delete this._sinks[id];
    } else if (id in this._outputs) {
      this._outputs[id].item.destroy();
      delete this._outputs[id];
    }
  },

  _onControlStateChanged: function() {
    if (this._control.get_state() == Gvc.MixerControlState.READY) {
      this._readInput();
      this._readOutput();

      let streams = this._control.get_streams();
      for (let i = 0; i < streams.length; i++) {
        this._streamAdded(this._control, streams[i].id);
      }
    }

    this.emit('icon-changed');
  },

  _readOutput: function() {
    this._output.stream = this._control.get_default_sink();
  },

  _readInput: function() {
    this._input.stream = this._control.get_default_source();
  },

  getIcon: function() {
    return this._output.getIcon();
  }
});

