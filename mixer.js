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

  _init: function() {
    this.parent();

    this._control = Volume.getMixerControl();
    this._sinks = {};
    this._outputs = {};
    this._settings = Settings.gsettings;

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

    this._output = new Widget.AdvOutputStreamSlider(
      this._control,
      this._settings.get_enum("output-type") == 0
    );

    this._output.connect('stream-updated', Lang.bind(this, function() {
      this.emit('icon-changed');
    }));
    this._output.item.actor.connect(
      'button-press-event',
      Lang.bind(this, function(actor, event) {
        if (event.get_button() == 2) {
          actor.stream.change_is_muted(!actor.stream.is_muted);
          return true;
        }
      }
    ));

    this._input = new Volume.InputStreamSlider(this._control);
    this._separator = new PopupMenu.PopupSeparatorMenuItem();

    this.addMenuItem(this._output.item);
    this.addMenuItem(this._input.item);
    this.addMenuItem(this._separator);

    this._onControlStateChanged();
  },

  scroll: function(event) {
    this._output.scroll(event);
  },

  outputHasHeadphones: function() {
    return this._output._hasHeadphones;
  },

  separatorLastItem: function(last) {
    if (this._separator) {
      this._separator.destroy();
    }

    if (last) {
      this._separator = null;
    } else {
      this._separator = new PopupMenu.PopupSeparatorMenuItem();
      this.addMenuItem(this._separator, 2);
    }
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
      s.item.actor.connect(
        "button-press-event",
        function (actor, event) {
          if (event.get_button() == 2) {
            actor.stream.change_is_muted(!actor.stream.is_muted);
          }
        }
      );
    } else if (stream instanceof Gvc.MixerSink) {
      let s = new Widget.AppOutputStreamSlider(this._control, false, function (st) { return st.get_description(); });
      s.stream = stream;
      s.item.setOrnament(this._output.stream.id == s.stream.id);
      this._outputs[id] = s;
      this._output.item.menu.addMenuItem(s.item);
      s.item.actor.connect(
        "button-press-event",
        function (actor, event) {
          if (event.get_button() == 1) {
            control.set_default_sink(actor.stream);
          } else if (event.get_button() == 2) {
            actor.stream.change_is_muted(!actor.stream.is_muted);
          }
        }
      );
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

    for (let output in this._outputs) {
      this._outputs[output].item.setOrnament(this._output.stream.id == output);
    }
  },

  _readInput: function() {
    this._input.stream = this._control.get_default_source();
  },

  getIcon: function() {
    return this._output.getIcon();
  }
});

