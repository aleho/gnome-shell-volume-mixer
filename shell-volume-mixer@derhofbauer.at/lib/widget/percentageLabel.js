/**
 * Shell Volume Mixer
 *
 * Percentage label.
 *
 * @author Alexander Hofbauer <alex@derhofbauer.at>
 */

/* exported PercentageLabel */

const { Clutter, GObject, St } = imports.gi;
const Lib = imports.misc.extensionUtils.getCurrentExtension().imports.lib;

const { EventBroker } = Lib.utils.eventBroker;


var PercentageLabel = GObject.registerClass(class Indicator extends St.Label {
    _init(mixer) {
        this._events = new EventBroker();

        super._init({
            y_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
        });

        this.add_style_class_name('percentage-label');

        this._events.connect('volume-changed', (event, volume) => {
            this._setText(volume);
        });

        // set initial value, if available
        this._setText(mixer.getVolume());
    }

    /**
     * @param {?number} percent
     * @private
     */
    _setText(percent) {
        if (percent === null) {
            this.text = '';
        } else {
            this.text = _('%d\u2009%%').format(percent);
        }
    }
});
