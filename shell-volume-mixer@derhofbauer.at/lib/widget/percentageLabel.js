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

        mixer.connectVolumeChanges((event, volume) => {
            this.text = volume + '%';
        });
    }
});
