/**
 * Shell Volume Mixer
 *
 * Advanced mixer extension.
 *
 * @author Harry Karvonen <harry.karvonen@gmail.com>
 * @author Alexander Hofbauer <alex@derhofbauer.at>
 */

/* exported Menu */

const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Gvc = imports.gi.Gvc;
const Lang = imports.lang;
const PopupMenu = imports.ui.popupMenu;
const Volume = imports.ui.status.volume;

const Widget = Extension.imports.widget;

const Menu = new Lang.Class({
    Name: 'ShellVolumeMixerMenu',
    Extends: Volume.VolumeMenu,

    _init: function(control, options) {

        // no this.parent(); shouldn't go through VolumeMenu's setup
        PopupMenu.PopupMenuSection.prototype._init.call(this);

        this.options = options || {};
        this._outputs = {};
        this._inputs = {};

        this._control = control;
        this._control.connect('state-changed', Lang.bind(this, this._onControlStateChanged));
        this._control.connect('default-sink-changed', Lang.bind(this, this._readOutput));
        this._control.connect('default-source-changed', Lang.bind(this, this._readInput));
        this._control.connect('stream-added', Lang.bind(this, this._streamAdded));
        this._control.connect('stream-removed', Lang.bind(this, this._streamRemoved));

        this._output = new Widget.MasterSlider(this._control, {
            detailed: this.options.detailed
        });
        this._output.connect('stream-updated', Lang.bind(this, function() {
            this.emit('icon-changed');
        }));
        this.addMenuItem(this._output.item);

        this._input = new Volume.InputStreamSlider(this._control);
        this.addMenuItem(this._input.item);

        if (this.options.separator) {
            this._addSeparator();
        }

        this._onControlStateChanged();
    },

    outputHasHeadphones: function() {
        return this._output._hasHeadphones;
    },

    _addSeparator: function() {
        if (this._separator) {
            this._separator.destroy();
        }

        this._separator = new PopupMenu.PopupSeparatorMenuItem();
        this.addMenuItem(this._separator, 2);
    },

    _onControlStateChanged: function() {
        this.parent();

        if (this._control.get_state() != Gvc.MixerControlState.READY) {
            return;
        }

        let streams = this._control.get_streams();
        for (let k in streams) {
            this._addStream(this._control, streams[k]);
        }
    },

    _readOutput: function() {
        this.parent();

        for (let id in this._outputs) {
            this._outputs[id].setSelected(this._output.stream.id == id);
        }
    },

    _addStream: function(control, stream) {
        if (stream.id in this._inputs || stream.id in this._outputs
                || stream.is_event_stream
                || stream instanceof Gvc.MixerEventRole) {
            return;
        }

        // input stream
        if (stream instanceof Gvc.MixerSinkInput) {
            let slider = new Widget.InputSlider(control, {
                detailed: this.options.detailed,
                stream: stream
            });

            this._inputs[stream.id] = slider;
            this.addMenuItem(slider.item);

        // output stream
        } else if (stream instanceof Gvc.MixerSink) {
            let slider = new Widget.OutputSlider(control, {
                detailed: this.options.detailed,
                stream: stream
            });

            let isSelected = this._output.stream
                    && this._output.stream.id == stream.id;
            slider.setSelected(isSelected);

            this._outputs[stream.id] = slider;
            this._output.item.menu.addMenuItem(slider.item);
        }
    },

    _streamAdded: function(control, id) {
        let stream = control.lookup_stream_id(id);
        this._addStream(control, stream);
    },

    _streamRemoved: function(control, id) {
        if (id in this._inputs) {
            this._inputs[id].item.destroy();
            delete this._inputs[id];
        } else if (id in this._outputs) {
            this._outputs[id].item.destroy();
            delete this._outputs[id];
        }
    }
});