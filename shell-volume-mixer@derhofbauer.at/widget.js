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
const Utils = Extension.imports.utils;

/**
 * A tooltip-like label to display the current value of a slider.
 *
 * Shamelessly stolen from gnome-shell/js/ui/dash.js.
 */
const FloatingLabel = new Lang.Class({
    Name: 'FloatingLabel',

    _init: function() {
        this._label = new St.Label({ style_class: 'dash-label floating-label' });
        this.text = '100%';
        this._label.hide();
        Main.layoutManager.addChrome(this._label);
    },

    get text() {
        return this._label.get_text();
    },

    set text(text) {
        this._label.set_text(text);
    },

    get size() {
        return this._label.get_size();
    },

    show: function(x, y, animate) {
        this._label.opacity = 0;
        this._label.show();
        this._label.raise_top();

        let labelHeight = this._label.get_height();
        let labelWidth = this._label.get_width();

        x = Math.floor(x - labelWidth / 2);
        y = y - labelHeight;
        this._label.set_position(x, y);

        let duration = animate !== false ? 0.15 : 0;

        Tweener.addTween(this._label, {
            opacity: 255,
            time: duration,
            transition: 'easeOutQuad'
        });
    },

    hide: function(animate) {
        let duration = animate !== false ? 0.1 : 0;

        Tweener.addTween(this._label, {
            opacity: 0,
            time: duration,
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

    _init: function(value, step) {
        this._step = step || Settings.VOLUME_STEP_DEFAULT;
        this.parent(value);
    },

    scroll: function(event) {
        if (event.is_pointer_emulated()) {
            return Clutter.EVENT_PROPAGATE;
        }

        let direction = 'up';
        let scrollDir = event.get_scroll_direction();

        if (scrollDir == Clutter.ScrollDirection.SMOOTH) {
            let [dx, dy] = event.get_scroll_delta();
            if (dy > 0) {
                direction = 'down';
            } else if (dy == 0) {
                // bugfix first dy event being zero
                direction = false;
            }
        } else if (scrollDir == Clutter.ScrollDirection.DOWN) {
            direction = 'down';
        }

        if (direction) {
            this._value = this._calcNewValue(direction);
        }

        this.actor.queue_repaint();
        this.emit('value-changed', this._value, event);
        return Clutter.EVENT_STOP;
    },

    onKeyPressEvent: function(actor, event) {
        let key = event.get_key_symbol();

        if (key == Clutter.KEY_Right || key == Clutter.KEY_Left) {
            let dir = (key == Clutter.KEY_Right) ? 'up' : 'down';
            this._value = this._calcNewValue(dir);

            this.actor.queue_repaint();
            this.emit('value-changed', this._value);
            this.emit('drag-end');

            return Clutter.EVENT_STOP;
        }

        return Clutter.EVENT_PROPAGATE;
    },

    _calcNewValue: function(direction) {
        let value = this._value;
        let step = this._step / 100;

        if (direction == 'down') {
            value -= step;
        } else {
            value += step;
        }

        return Math.min(Math.max(0, value), 1);
    },

    /**
     * Allow middle button event to bubble up for mute / unmute.
     */
    startDragging: function(event) {
        if (event.get_button() == 2) {
            return Clutter.EVENT_PROPAGATE;
        }
        return this.parent(event);
    }
});


let makeItemLine = function(ornament) {
    let line = new St.BoxLayout({ style_class: 'popup-menu-item svm-container-line' });

    if (ornament === undefined) {
        ornament = new St.Label({ style_class: 'popup-menu-ornament' });
    }

    if (ornament) {
        line.add(ornament);
    }

    return line;
};

let prepareMenuItem = function(instance) {
    instance.actor.get_children().map(Lang.bind(instance, function (child) {
        instance.actor.remove_actor(child);
    }));

    instance.container = new St.BoxLayout({ vertical: true });
    instance.actor.add(instance.container, { expand: true });

    if (!instance.firstLine) {
        instance.firstLine = makeItemLine(instance._ornamentLabel);
    }

    if (!instance.secondLine) {
        instance.secondLine = makeItemLine();
    }

    instance.container.add(instance.firstLine, { expand: true });
    instance.container.add(instance.secondLine, { expand: true });
};

/**
 * Submenu item for the sink selection menu.
 */
const MasterMenuItem = new Lang.Class({
    Name: 'MasterMenuItem',
    Extends: PopupMenu.PopupSubMenuMenuItem,

    _init: function(sliderVolumeStep) {
        this.parent('', true);
        prepareMenuItem(this);

        this._slider = new VolumeSlider(0, sliderVolumeStep);

        this.firstLine.add_child(this.icon);
        this.firstLine.add(this.label, { expand: true });
        this.firstLine.add_child(this._triangleBin);

        this.secondLine.add(this._slider.actor, { expand: true });

        this.label.add_style_class_name('svm-master-label');
        this.actor.add_style_class_name('svm-master-slider svm-menu-item');
    },

    _onButtonReleaseEvent: function(actor, event) {
        if (event.get_button() == 2) {
            return Clutter.EVENT_STOP;
        }
        return this.parent(actor, event);
    },

    /**
     * Change volume on left / right.
     */
    _onKeyPressEvent: function(actor, event) {
        let symbol = event.get_key_symbol();

        if (symbol == Clutter.KEY_Right || symbol == Clutter.KEY_Left) {
            return this._slider.onKeyPressEvent(actor, event);
        }

        return this.parent(actor, event);
    }
});


/**
 * Sub menu item implementation for dropdown menus (via master slider).
 */
const SubMenuItem = new Lang.Class({
    Name: 'OutputStreamSlider',
    Extends: PopupMenu.PopupBaseMenuItem,

    _init: function(params) {
        this.parent(params);
        prepareMenuItem(this);
    },

    addChildAt: function(child, pos) {
        let line = makeItemLine();

        line.add_child(child);
        this.container.insert_child_at_index(line, pos);

        return line;
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
            this.item = new SubMenuItem({ activate: false });
        }

        if (this.icon) {
            // different widgets seem to use different naming
            this._icon = this.icon;
        }

        if (!this._icon) {
            this._icon = new St.Icon({ style_class: 'popup-menu-icon' });
            this.item.firstLine.add(this._icon);
        }

        if (!this._label) {
            this._label = new St.Label({ text: '' });
            this.item.firstLine.add(this._label, { expand: true });
        }

        if (!this._slider) {
            this._slider = new VolumeSlider(0, this._mixer.getNormalizedStep());
            this.item.secondLine.add(this._slider.actor, { expand: true });
        }

        this._volumeInfo = new FloatingLabel();

        this._slider.connect('value-changed', Lang.bind(this, this._sliderChanged));
        this._slider.connect('drag-end', Lang.bind(this, this._notifyVolumeChange));

        this.item.actor.connect('button-press-event', Lang.bind(this, this._onButtonPress));
        this.item.actor.connect('key-press-event', Lang.bind(this, this._onKeyPress));
        this.item.actor.connect('scroll-event', Lang.bind(this._slider, this._slider._onScrollEvent));

        this.stream = options.stream || null;
    },

    _onKeyPress: function(actor, event) {
        return this._slider.onKeyPressEvent(actor, event);
    },

    _onButtonPress: function(actor, event) {
        if (event.get_button() == 2) {
            this._stream.change_is_muted(!this._stream.is_muted);
            return Clutter.EVENT_STOP;
        }
        return this._slider.startDragging(event);
    },

    refresh: function() {
        this._updateLabel();
        this._updateSliderIcon();
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
        this.refresh();
    },

    _updateLabel: function() {
        this.label.text = this._stream.name || this._stream.description || '';
    },

    _sliderChanged: function(slider, value, event) {
        if (!this._stream) {
            return;
        }

        let max = this._mixer.getVolMax();
        let newVol = max * value;
        this._mixer.setStreamVolume(this._stream, newVol);

        if (!this._volumeInfo) {
            return;
        }

        let percent = Math.round(newVol / this._control.get_vol_max_norm() * 100);
        this._showVolumeInfo(percent, event);
    },

    _updateVolume: function() {
        let muted = this._stream.is_muted;
        let max = this._mixer.getVolMax();

        this._slider.setValue(muted ? 0 : (this._stream.volume / max));
        this.emit('stream-updated');
    },

    _showVolumeInfo: function(value, event) {
        this._volumeInfo.text = value + '%';

        if (this._labelTimeoutId) {
            Mainloop.source_remove(this._labelTimeoutId);
            this._labelTimeoutId = undefined;
        }

        if (!this._infoShowing) {
            this._infoShowing = true;

            let x, y;

            if (event && 'showInfoAtMouseCursor' in event && event.showInfoAtMouseCursor === true) {
                [x, y] = event.get_coords();
                let [w, h] = this._volumeInfo.size;
                x += 15;
                y += h + 10;
            } else {
                [x, y] = this._slider.actor.get_transformed_position();
                x = x + Math.floor(this._slider.actor.get_width() / 2);
            }

            this._volumeInfo.show(x, y);
        }

        this._labelTimeoutId = Mainloop.timeout_add(1000, Lang.bind(this, function() {
            this._infoShowing = false;
            this._labelTimeoutId = undefined;
            this._volumeInfo.hide();
            return GLib.SOURCE_REMOVE;
        }));
    },

    hideVolumeInfo: function() {
        if (this._labelTimeoutId) {
            Mainloop.source_remove(this._labelTimeoutId);
            this._labelTimeoutId = undefined;
        }

        this._infoShowing = false;
        this._volumeInfo.hide(false);
    }
});



/**
 * Slider replacing the master volume slider.
 */
var MasterSlider = new Lang.Class({
    Name: 'MasterSlider',
    Extends: StreamSlider,

    _init: function(control, options) {
        this.item = new MasterMenuItem(options.mixer.getNormalizedStep());

        this._slider = this.item._slider;
        this._icon = this.item.icon;
        this._label = this.item.label;

        this.parent(control, options);
        this._slider.actor.accessible_name = _('Volume');
    },

    /**
     * Override button click to allow for mute / unmute and menu to be opened.
     */
    _onButtonPress: function(actor, event) {
        if (event.get_button() == 2) {
            this._stream.change_is_muted(!this._stream.is_muted);
        }
        return Clutter.EVENT_STOP;
    },

    _updateLabel: function() {
        this._label.text = this._stream.description;
    },

    /**
     * Mouse scroll event triggered by scrolling over panel icon.
     */
    scroll: function(event) {
        event.showInfoAtMouseCursor = !Main.panel.statusArea.aggregateMenu.menu.isOpen;
        return this._slider.scroll(event);
    }
});


/**
 * Slider for output sinks (e.g. alsa devices, different profiles).
 */
var OutputSlider = new Lang.Class({
    Name: 'OutputSlider',
    Extends: StreamSlider,

    _init: function(control, options) {
        if (options.detailed) {
            this._details = new St.Label({ text: '' });
        }

        this.parent(control, options);

        if (options.detailed) {
            this.item.addChildAt(this._details, 1);
        }
    },

    _onButtonPress: function(actor, event) {
        if (event.get_button() == 1) {
            this._setAsDefault();
            return Clutter.EVENT_PROPAGATE;
        }
        return this.parent(actor, event);
    },

    _onKeyPress: function(actor, event) {
        let symbol = event.get_key_symbol();
        if (symbol == Clutter.KEY_space || symbol == Clutter.KEY_Return) {
            this._setAsDefault();
            return Clutter.EVENT_STOP;
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
        }
    },

    setSelected: function(selected) {
        if (selected !== false) {
            this.item.setOrnament(PopupMenu.Ornament.DOT);
            this._label.add_style_class_name('selected-stream');
        } else {
            this.item.setOrnament(PopupMenu.Ornament.NONE);
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
var EventsSlider = new Lang.Class({
    Name: 'EventsSlider',
    Extends: StreamSlider,

    _updateLabel: function() {
        this._label.text = this._stream.name;
    }
});


/**
 * Slider for input sinks (e.g. recorders, media players).
 */
var InputSlider = new Lang.Class({
    Name: 'InputSlider',
    Extends: StreamSlider,

    _updateLabel: function() {
        let text = this._stream.name;
        let description = this._stream.description;

        if (description && text != description) {
            if (text) {
                text += ' | ' + description;
            } else {
                text = description;
            }
        }

        this._label.text = text || '[unknown]';
    }
});
