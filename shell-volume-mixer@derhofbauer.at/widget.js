/**
 * Shell Volume Mixer
 *
 * Mixer widgets.
 *
 * @author Harry Karvonen <harry.karvonen@gmail.com>
 * @author Alexander Hofbauer <alex@derhofbauer.at>
 */

/* exported MasterSlider, InputSlider, OutputSlider */

const Lang = imports.lang;
const PopupMenu = imports.ui.popupMenu;
const Slider = imports.ui.slider;
const St = imports.gi.St;
const Volume = imports.ui.status.volume;


/**
 * Submenu item for the sink selection menu.
 */
const MasterMenuItem = new Lang.Class({
    Name: 'MasterMenuItem',
    Extends: PopupMenu.PopupSubMenuMenuItem,

    _init: function() {
        this.parent('', true);

        this.slider = new Slider.Slider(0);

        // remove actors except ornament (indentation of menu)
        this.actor.get_children().map(Lang.bind(this, function(child) {
            if (!child.has_style_class_name('popup-menu-ornament')) {
                this.actor.remove_actor(child);
            }
        }));

        this._vbox = new St.BoxLayout({ vertical: true });
        this._hbox = new St.BoxLayout({ vertical: false });

        this._hbox.add(this.label);
        this._hbox.add(this._triangleBin);
        this._vbox.add(this._hbox);
        this._vbox.add(this.slider.actor);

        this.actor.add_child(this.icon);
        this.actor.add_child(this._vbox);

        this.label.add_style_class_name('masterlabel');
        this.actor.add_style_class_name('masterslider');
    },

    _onButtonReleaseEvent: function(actor, event) {
        if (event.get_button() == 2) {
            return false;
        }
        return this.parent(actor, event);
    }
});


/**
 * Basic StreamSlider implementation for Input- and OutputStreams.
 *
 * We can extend (and monkey patch) Volume.OutputStreamSlider because
 * Volume.InputStreamSlider is meant for microphones only.
 */
const StreamSlider = new Lang.Class({
    Name: 'OutputStreamSlider',
    Extends: Volume.OutputStreamSlider,

    _init: function(control, options) {
        this.options = options || {};
        this._control = control;

        if (!this.item) {
            this.item = new PopupMenu.PopupBaseMenuItem({ activate: false });
        }

        if (!this._icon) {
            this._icon = new St.Icon({ style_class: 'popup-menu-icon' });
            this.item.actor.add(this._icon);
        }

        if (!this._vbox) {
            this._vbox = new St.BoxLayout({ vertical: true });
            this.item.actor.add(this._vbox, { expand: true });
        }

        if (!this._label) {
            this._label = new St.Label({ text: '' });
            this._vbox.add(this._label);
        }

        if (!this._slider) {
            this._slider = new Slider.Slider(0);
            this._vbox.add(this._slider.actor);
        }

        this._slider.connect('value-changed', Lang.bind(this, this._sliderChanged));
        this._slider.connect('drag-end', Lang.bind(this, this._notifyVolumeChange));

        this.item.actor.connect('button-press-event', Lang.bind(this, this._onButtonPress));
        this.item.actor.connect('key-press-event', Lang.bind(this, this._onKeyPress));
        this.item.actor.connect('scroll-event', Lang.bind(this._slider, this._slider._onScrollEvent));

        this._bubbleMiddleButton();

        this.stream = options.stream || null;
    },

    /**
     * Evil monkey patching to allow middle click events to bubble up.
     */
    _bubbleMiddleButton: function() {
        this._slider._orgStartDragging = this._slider.startDragging;

        this._slider.startDragging = Lang.bind(this._slider, function(event) {
            if (event.get_button() == 2) {
                return false;
            }
            return this._orgStartDragging(event);
        });
    },

    _onKeyPress: function(actor, event) {
        return this._slider.onKeyPressEvent(actor, event);
    },

    _updateSliderIcon: function() {
        if (this._stream && this.options.detailed) {
            this._icon.gicon = this._stream.get_gicon();
        } else {
            this.parent();
        }

        this.emit('stream-updated');
    },

    _connectStream: function(stream) {
        this.parent(stream);

        this._updateLabel();
        this._updateSliderIcon();
    },

    _updateLabel: function() {
        this.label.text = this._stream.name || this._stream.description || '';
    }
});


/**
 * Slider replacing the master volume slider.
 */
const MasterSlider = new Lang.Class({
    Name: 'MasterSlider',
    Extends: StreamSlider,

    _init: function(control, options) {
        this.item = new MasterMenuItem();
        this._slider = this.item.slider;
        this._icon = this.item.icon;
        this._label = this.item.label;

        this.parent(control, options);
    },

    _onButtonPress: function(actor, event) {
        if (event.get_button() == 2) {
            this._stream.change_is_muted(!this._stream.is_muted);
        }
        return false;
    },

    _updateLabel: function() {
        this._label.text = this._stream.description || '';
    }
});


/**
 * Slider for output sinks (e.g. alsa devices, different profiles).
 */
const OutputSlider = new Lang.Class({
    Name: 'OutputSlider',
    Extends: StreamSlider,

    _init: function(control, options) {
        if (options.detailed) {
            this._details = new St.Label({ text: '' });
        }

        this.parent(control, options);
    },

    _onButtonPress: function(actor, event) {
        if (event.get_button() == 1) {
            this._control.set_default_sink(this._stream);
            return true;
        } else {
            return this.parent(actor, event);
        }
    },

    _updateLabel: function() {
        let text = this._stream.description;
        let description = this._stream.name;

        this._label.text = text;

        if (this.options.detailed && text != description && description) {
            let parts = description.split('.');

            if (parts.length > 1) {
                if (parts[0] == 'alsa_output') {
                    // remove the common first (and uninteresting) part
                    parts.shift();
                }
                // the last segment of the path is the most interesting one
                description = parts.pop();
                description += ' | ' + parts.join('.');
            }

            this._details.text = description;
            this._vbox.insert_child_at_index(this._details, 1);
        }
    },

    setSelected: function(selected) {
        if (selected !== false) {
            this._label.add_style_class_name('selected-stream');
        } else {
            this._label.remove_style_class_name('selected-stream');
        }
    }
});


/**
 * Slider for input sinks (e.g. recorders, media players).
 */
const InputSlider = new Lang.Class({
    Name: 'InputSlider',
    Extends: StreamSlider,

    _onButtonPress: function(actor, event) {
        if (event.get_button() == 2) {
            this._stream.change_is_muted(!this._stream.is_muted);
            return false;
        }
        return this._slider.startDragging(event);
    },

    _updateLabel: function() {
        let text = this._stream.name;
        let description = this._stream.description;

        if (this.options.detailed && text != description) {
            text += ' | ' + description;
        }

        this._label.text = text || '';
    }
});