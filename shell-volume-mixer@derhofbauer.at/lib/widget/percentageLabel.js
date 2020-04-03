/**
 * Shell Volume Mixer
 *
 * Percentage label.
 *
 * @author Alexander Hofbauer <alex@derhofbauer.at>
 */

/* exported PercentageLabel */

const { Clutter, GObject, St } = imports.gi;


/**
 * @mixes EventHandlerDelegate
 */
var PercentageLabel = GObject.registerClass(class Indicator extends St.Label {
    _init(mixer) {
        super._init({
            y_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
        });

        this.add_style_class_name('percentage-label');

        mixer.connectVolumeChanges((event, volume) => {
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
            const formatted = _('%d\u2009%%').format(percent);
            this.clutter_text.set_markup(`<span size="smaller">${formatted}</span>`);
        }
    }
});
