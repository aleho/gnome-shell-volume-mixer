/**
 * Shell Volume Mixer
 *
 * Sliders.
 *
 * @author Alexander Hofbauer <alex@derhofbauer.at>
 */

/* exported VolumeSlider */

const { Clutter, GObject } = imports.gi;
const Slider = imports.ui.slider;


/**
 * Custom Slider to allow for mute via middle button.
 */
var VolumeSlider = GObject.registerClass(class VolumeSlider extends Slider.Slider
{
    /**
     * Allow middle button event to bubble up for mute / unmute.
     */
    startDragging(event) {
        if (event.get_button() === 2) {
            return Clutter.EVENT_PROPAGATE;
        }
        return super.startDragging(event);
    }
});
