/**
 * Shell Volume Mixer
 *
 * Advanced mixer extension.
 *
 * @author Harry Karvonen <harry.karvonen@gmail.com>
 * @author Alexander Hofbauer <alex@derhofbauer.at>
 */

/* exported OutputStreamSlider */

const Lang = imports.lang;
const PopupMenu = imports.ui.popupMenu;
const Slider = imports.ui.slider;
const St = imports.gi.St;
const Volume = imports.ui.status.volume;


const AppOutputStreamSlider = new Lang.Class({
    Name: 'AppOutputStreamSlider',
    Extends: Volume.OutputStreamSlider,

    _init: function(control, oldStyle, stream_name_func) {
        this.parent(control);

        this.item.destroy();

        this.stream_name = stream_name_func
                || function (stream) {
                    return stream.get_name() || stream.get_description();
                };

        this.oldStyle = oldStyle || false;
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
    },

    _bubbleMiddleButton: function() {
        // evil monkey patching
        this._slider._orgStartDragging = this._slider.startDragging;
        this._slider.startDragging = function() {};
        this._slider._startDragging = Lang.bind(this._slider, function(actor, event) {
            return this._orgStartDragging(event);
        });

        this.item.actor.connect('button-press-event', Lang.bind(this, function(actor, event) {
            if (event.get_button() != 2) {
                return this._slider._orgStartDragging(event);
            } else {
                return false;
            }
        }));
    },

    _updateSliderIcon: function() {
        if (this._stream && !this.oldStyle) {
            this._icon.gicon = this._stream.get_gicon();
        } else {
            this.parent();
        }

        this.emit('stream-updated');
    },

    _connectStream: function(stream) {
        this.parent(stream);

        this._label.text = this.stream_name(stream);
        this._updateSliderIcon();
        this.item.actor.stream = stream;
    }
});

const AdvSubMenuItem = new Lang.Class({
    Name: 'AdvSubMenuItem',
    Extends: PopupMenu.PopupSubMenuMenuItem,

    _init: function(oldStyle) {
        this.parent('', true);

        this.slider = new Slider.Slider(0);

        // Remove actors except ornament
        this.actor.get_children().map(Lang.bind(this, function(child) {
            if (!child.has_style_class_name('popup-menu-ornament')) {
                this.actor.remove_actor(child);
            }
        }));

        if (oldStyle) {
            this.actor.add_child(this.icon);
            this.actor.add(this.slider.actor, {expand: true});
            this.actor.add_child(this._triangleBin);
        } else {
            this._vbox = new St.BoxLayout({ vertical: true });
            this._hbox = new St.BoxLayout({ vertical: false });

            this._hbox.add(this.label);
            this._hbox.add(this._triangleBin);
            this._vbox.add(this._hbox);
            this._vbox.add(this.slider.actor);

            this.actor.add_child(this.icon);
            this.actor.add_child(this._vbox);
        }
    },

    _onButtonReleaseEvent: function (actor, event) {
        if (event.get_button() != 2) {
            this._setOpenState(!this._getOpenState());
        }
    }
});


const OutputStreamSlider = new Lang.Class({
    Name: 'VolumeMixerOutputStreamSlider',
    Extends: AppOutputStreamSlider,

    _init: function(control, oldStyle) {
        this.parent(control, oldStyle);

        this.item.destroy();
        this.item = new AdvSubMenuItem(this.oldStyle);

        this._slider.actor.destroy();
        this._slider = this.item.slider;
        this._slider.connect('value-changed', Lang.bind(this, this._sliderChanged));
        this._slider.connect('drag-end', Lang.bind(this, this._notifyVolumeChange));

        this._icon.destroy();
        this._icon = this.item.icon;
        this._label.destroy();
        this._label = this.item.label;

        this.item.actor.connect('scroll-event', Lang.bind(this._slider, this._slider._onScrollEvent));

        this._bubbleMiddleButton();
    }
});