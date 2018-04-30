/**
 * Shell Volume Mixer
 *
 * Sliders.
 *
 * @author Alexander Hofbauer <alex@derhofbauer.at>
 */

/* exported VolumeSlider */

const Clutter = imports.gi.Clutter;
const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Lang = imports.lang;
const PopupMenu = imports.ui.popupMenu;
const Slider = imports.ui.slider;

const Settings = Extension.imports.settings;


/**
 * Slider with configurable steps.
 */
var VolumeSlider = new Lang.Class({
    Name: 'VolumeSlider',
    Extends: Slider.Slider,

    _init(value, step) {
        this._step = step || Settings.VOLUME_STEP_DEFAULT;
        this.parent(value);
    },

    scroll(event) {
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

    onKeyPressEvent(actor, event) {
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

    _calcNewValue(direction) {
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
    startDragging(event) {
        if (event.get_button() == 2) {
            return Clutter.EVENT_PROPAGATE;
        }
        return this.parent(event);
    }
});
