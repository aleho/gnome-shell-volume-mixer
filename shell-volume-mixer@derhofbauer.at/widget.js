/**
 * Shell Volume Mixer
 *
 * Mixer widgets.
 *
 * @author Harry Karvonen <harry.karvonen@gmail.com>
 * @author Alexander Hofbauer <alex@derhofbauer.at>
 */

/* exported MasterSlider, OutputSlider, EventsSlider, InputSlider */

const Clutter = imports.gi.Clutter;
const Extension = imports.misc.extensionUtils.getCurrentExtension();
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const PopupMenu = imports.ui.popupMenu;
const Slider = imports.ui.slider;
const St = imports.gi.St;
const Tweener = imports.ui.tweener;
const Volume = imports.ui.status.volume;

const Settings = Extension.imports.settings;

/**
 * A tooltip-like label to display the current value of a slider.
 *
 * Shamelessly stolen from gnome-shell/js/ui/dash.js.
 */
const FloatingLabel = new Lang.Class({
    Name: 'FloatingLabel',

    _init: function() {
        this._label = new St.Label({ style_class: 'dash-label floating-label' });
        this._label.hide();
        Main.layoutManager.addChrome(this._label);
    },

    get text() {
        return this._label.get_text();
    },

    set text(text) {
        this._label.set_text(text);
    },

    show: function(x, y) {
        this._label.opacity = 0;
        this._label.show();
        this._label.raise_top();

        let labelHeight = this._label.get_height();
        let labelWidth = this._label.get_width();

        x = Math.floor(x - labelWidth / 2);
        y = y - labelHeight;
        this._label.set_position(x, y);

        Tweener.addTween(this._label, {
            opacity: 255,
            time: 0.15,
            transition: 'easeOutQuad'
        });
    },

    hide: function() {
        Tweener.addTween(this._label, {
            opacity: 0,
            time: 0.1,
            transition: 'easeOutQuad',
            onComplete: Lang.bind(this, function() {
                this._label.hide();
            })
        });
    }
});


/**
 * Slider with configurable steps.
 */
const VolumeSlider = new Lang.Class({
    Name: 'VolumeSlider',
    Extends: Slider.Slider,

    _init: function(value) {
        this._settings = new Settings.Settings();
        this._volumeStep = this._settings.getVolumeStep();
        this.parent(value);
    },

    scroll: function(event) {
        let direction = event.get_scroll_direction();
        let delta;

        if (event.is_pointer_emulated())
            return Clutter.EVENT_PROPAGATE;

        if (direction == Clutter.ScrollDirection.DOWN) {
            delta = -this._volumeStep;
        } else if (direction == Clutter.ScrollDirection.UP) {
            delta = +this._volumeStep;
        } else if (direction == Clutter.ScrollDirection.SMOOTH) {
            let [dx, dy] = event.get_scroll_delta();
            if (dy > 0) {
                delta = +this._volumeStep;
            } else {
                delta = -this._volumeStep;
            }
        }

        delta /= 100;
        this._value = Math.min(Math.max(0, this._value + delta), 1);

        this.actor.queue_repaint();
        this.emit('value-changed', this._value);
        return Clutter.EVENT_STOP;
    },

    onKeyPressEvent: function(actor, event) {
        let key = event.get_key_symbol();
        if (key == Clutter.KEY_Right || key == Clutter.KEY_Left) {
            let delta = key == Clutter.KEY_Right ? +this._volumeStep : -this._volumeStep;
            delta /= 100;
            this._value = Math.max(0, Math.min(this._value + delta, 1));
            this.actor.queue_repaint();
            this.emit('value-changed', this._value);
            this.emit('drag-end');
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }
});


/**
 * Submenu item for the sink selection menu.
 */
const MasterMenuItem = new Lang.Class({
    Name: 'MasterMenuItem',
    Extends: PopupMenu.PopupSubMenuMenuItem,

    _init: function() {
        this.parent('', true);

        this.slider = new VolumeSlider(0);

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
    },

    /**
     * Change volume on left / right.
     */
    _onKeyPressEvent: function(actor, event) {
        let symbol = event.get_key_symbol();

        if (symbol == Clutter.KEY_Right || symbol == Clutter.KEY_Left) {
            return this.slider.onKeyPressEvent(actor, event);
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
        this._mixer = options.mixer;

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
            this._slider = new VolumeSlider(0);
            this._vbox.add(this._slider.actor);
        }

        this._volumeInfo = new FloatingLabel();

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

    _onButtonPress: function(actor, event) {
        if (event.get_button() == 2) {
            this._stream.change_is_muted(!this._stream.is_muted);
            return false;
        }
        return this._slider.startDragging(event);
    },

    _updateSliderIcon: function() {
        if (this._stream && !this.options.symbolicIcons) {
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
    },

    _sliderChanged: function(slider, value, property) {
        this.parent(slider, value, property);

        if (!this._stream || !this._volumeInfo) {
            return;
        }

        if (this.options.boostVolume) {
            value = this._stream.get_volume() / this._mixer.getVolMaxNorm();
        }

        this._showVolumeInfo(Math.round(value * 100));
    },

    _showVolumeInfo: function(value) {
        this._volumeInfo.text = value + '%';

        if (this._labelTimeoutId) {
            Mainloop.source_remove(this._labelTimeoutId);
            this._labelTimeoutId = undefined;
        }

        if (!this._infoShowing) {
            this._infoShowing = true;
            let [x, y] = this._slider.actor.get_transformed_position();
            x = x + Math.floor(this._slider.actor.get_width() / 2);
            this._volumeInfo.show(x, y);
        }

        this._labelTimeoutId = Mainloop.timeout_add(1000, Lang.bind(this, function() {
            this._infoShowing = false;
            this._labelTimeoutId = undefined;
            this._volumeInfo.hide();
            return GLib.SOURCE_REMOVE;
        }));
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
        // override default behavior to make sure the menu can be opened
        if (event.get_button() == 2) {
            this._stream.change_is_muted(!this._stream.is_muted);
        }
        return false;
    },

    _updateLabel: function() {
        this._label.text = this._stream.description;
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
            this._setAsDefault();
            return true;
        }
        return this.parent(actor, event);
    },

    _onKeyPress: function(actor, event) {
        let symbol = event.get_key_symbol();
        if (symbol == Clutter.KEY_space || symbol == Clutter.KEY_Return) {
            this._setAsDefault();
            return false;
        }

        return this.parent(actor, event);
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
    },

    _setAsDefault: function() {
        this._control.set_default_sink(this._stream);
    }
});


/**
 * Slider for system sounds.
 */
const EventsSlider = new Lang.Class({
    Name: 'EventsSlider',
    Extends: StreamSlider,

    _updateLabel: function() {
        this._label.text = this._stream.name;
    }
});


/**
 * Slider for input sinks (e.g. recorders, media players).
 */
const InputSlider = new Lang.Class({
    Name: 'InputSlider',
    Extends: StreamSlider,

    _updateLabel: function() {
        let text = this._stream.name;
        let description = this._stream.description;

        if (description && text != description) {
            text += ' | ' + description;
        }

        this._label.text = text || '[unknown]';
    }
});