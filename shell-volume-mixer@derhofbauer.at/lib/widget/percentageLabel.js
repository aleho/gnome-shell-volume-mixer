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
            this.clutter_text.set_markup(`<span size="smaller">${volume}%</span>`);
        });
    }
});
