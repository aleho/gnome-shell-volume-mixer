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
    Extends: PopupMenu.PopupMenuSection,

    _init: function(control, options) {
        this._control = control;
        this.options = options || {};
        this.parent();

        this._sinks = {};
        this._outputs = {};

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

        this._output.item.actor.connect('button-press-event', Lang.bind(this, function(actor, event) {
            if (event.get_button() == 2) {
                actor.stream.change_is_muted(!actor.stream.is_muted);
                return true;
            }
            return false;
        }));

        this._input = new Volume.InputStreamSlider(this._control);
        this.addMenuItem(this._input.item);

        if (this.options.separator) {
            this._addSeparator();
        }

        this._onControlStateChanged();
    },

    scroll: function(event) {
        this._output.scroll(event);
    },

    _onControlStateChanged: function() {
        if (this._control.get_state() == Gvc.MixerControlState.READY) {
            this._readInput();
            this._readOutput();

            let streams = this._control.get_streams();
            for (let i = 0; i < streams.length; i++) {
                this._streamAdded(this._control, streams[i].id);
            }
        } else {
            this.emit('icon-changed');
        }
    },

    _readOutput: function() {
        this._output.stream = this._control.get_default_sink();

        for (let output in this._outputs) {
            this._outputs[output].setSelected(this._output.stream.id == output);
        }
    },

    _readInput: function() {
        this._input.stream = this._control.get_default_source();
    },

    getIcon: function() {
        return this._output.getIcon();
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

    _streamAdded: function(control, id) {
        if (id in this._sinks || id in this._outputs) {
            return;
        }

        let stream = control.lookup_stream_id(id);

        if (stream['is-event-stream']) {
            return;
        }

        if (stream instanceof Gvc.MixerSinkInput) {
            let slider = new Widget.InputSlider(this._control, {
                detailed: this.options.detailed,
                stream: stream
            });

            this._sinks[id] = slider;
            this.addMenuItem(slider.item);

        } else if (stream instanceof Gvc.MixerSink) {
            let slider = new Widget.OutputSlider(this._control, {
                detailed: this.options.detailed,
                stream: stream
            });

            let isDefault = this._output.stream
                    && this._output.stream.id == stream.id;
            slider.setSelected(isDefault);

            this._outputs[id] = slider;
            this._output.item.menu.addMenuItem(slider.item);
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
    }
});