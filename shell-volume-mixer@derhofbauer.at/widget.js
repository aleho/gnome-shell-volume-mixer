/**
 * Shell Volume Mixer
 *
 * Advanced mixer extension.
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
 * Advanced OutputStreamSlider, extending and monkey patching the default
 * implementation.
 */
let OutputStreamSlider = new Lang.Class({
    Name: 'OutputStreamSlider',
    Extends: Volume.OutputStreamSlider,

    _init: function(control, options) {
        this.parent(control);
        this.options = options || {};

        this.item.destroy();
        this.item = new PopupMenu.PopupBaseMenuItem({ activate: false });

        this._vbox = new St.BoxLayout({ vertical: true });

        this._slider = new Slider.Slider(0);
        this._slider.connect('value-changed', Lang.bind(this, this._sliderChanged));
        this._slider.connect('drag-end', Lang.bind(this, this._notifyVolumeChange));

        this._icon = new St.Icon({ style_class: 'popup-menu-icon' });
        this._label = new St.Label({ text: '' });
        this.item.actor.add(this._icon);
        this._vbox.add(this._label);
        this._vbox.add(this._slider.actor);
        this.item.actor.add(this._vbox, { expand: true });

        this.item.actor.connect('scroll-event', Lang.bind(this._slider, this._slider._onScrollEvent));

        this._bubbleMiddleButton();

        if (options.stream) {
            this.stream = options.stream;
        }
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

        this._updateLabel(stream);
        this._updateSliderIcon();
        this.item.actor.stream = stream;
    },

    _updateLabel: function(stream) {
        this._label.text = stream.get_name() || stream.get_description();
    }
});

const AdvSubMenuItem = new Lang.Class({
    Name: 'AdvSubMenuItem',
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

        this.label.add_style_class_name('masterlabel');

        this._vbox = new St.BoxLayout({ vertical: true });
        this._hbox = new St.BoxLayout({ vertical: false });

        this._hbox.add(this.label);
        this._hbox.add(this._triangleBin);
        this._vbox.add(this._hbox);
        this._vbox.add(this.slider.actor);

        this.actor.add_child(this.icon);
        this.actor.add_child(this._vbox);
    },

    _onButtonReleaseEvent: function(actor, event) {
        if (event.get_button() != 2) {
            this._setOpenState(!this._getOpenState());
        }
    }
});


/**
 * Slider replacing the master volume slider.
 */
const MasterSlider = new Lang.Class({
    Name: 'MasterSlider',
    Extends: OutputStreamSlider,

    _init: function(control, options) {
        this.parent(control, options);

        this.item.destroy();
        this.item = new AdvSubMenuItem();

        this._slider.actor.destroy();
        this._slider = this.item.slider;
        this._slider.connect('value-changed', Lang.bind(this, this._sliderChanged));
        this._slider.connect('drag-end', Lang.bind(this, this._notifyVolumeChange));

        this._icon.destroy();
        this._icon = this.item.icon;
        this._label.destroy();
        this._label = this.item.label;

        this.item.actor.add_style_class_name('masterslider');

        this.item.actor.connect('scroll-event', Lang.bind(this._slider, this._slider._onScrollEvent));

        this._bubbleMiddleButton();
    },

    _updateLabel: function(stream) {
        this._label.text = stream.get_description();
    }
});


/**
 * Slider for input sinks (e.g. applications).
 */
const InputSlider = new Lang.Class({
    Name: 'InputSlider',
    Extends: OutputStreamSlider,

    _init: function(control, options) {
        this.parent(control, options);

        this.item.actor.connect('button-press-event', function(actor, event) {
            if (event.get_button() == 2) {
                actor.stream.change_is_muted(!actor.stream.is_muted);
            }
        });
    },

    _updateLabel: function(stream) {
        let label = stream.get_name();
        let description = stream.get_description();
        if (this.options.detailed && label != description) {
            label += ' | ' + description;
        }

        this._label.text = label;
    }
});


/**
 * Slider for output sinks (e.g. alsa devices, different ports).
 */
const OutputSlider = new Lang.Class({
    Name: 'OutputSlider',
    Extends: OutputStreamSlider,

    _init: function(control, options) {
        if (options.detailed) {
            this._details = new St.Label({ text: '' });
        }

        this.parent(control, options);

        this.item.actor.connect('button-press-event', function(actor, event) {
            if (event.get_button() == 1) {
                control.set_default_sink(actor.stream);
            } else if (event.get_button() == 2) {
                actor.stream.change_is_muted(!actor.stream.is_muted);
            }
        });
    },

    _updateLabel: function(stream) {
        let text = stream.get_description();
        let description = stream.get_name();

        this._label.text = text;

        if (this.options.detailed && text != description) {
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