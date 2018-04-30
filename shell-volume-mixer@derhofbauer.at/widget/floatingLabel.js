/**
 * Shell Volume Mixer
 *
 * Floating label.
 *
 * @author Alexander Hofbauer <alex@derhofbauer.at>
 */

/* exported FloatingLabel */

const Lang = imports.lang;
const Main = imports.ui.main;
const St = imports.gi.St;
const Tweener = imports.ui.tweener;



/**
 * A tooltip-like label to display the current value of a slider.
 *
 * Shamelessly stolen from gnome-shell/js/ui/dash.js.
 */
var FloatingLabel = new Lang.Class({
    Name: 'FloatingLabel',

    _init() {
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

    show(x, y, animate) {
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

    hide(animate) {
        let duration = animate !== false ? 0.1 : 0;

        Tweener.addTween(this._label, {
            opacity: 0,
            time: duration,
            transition: 'easeOutQuad',
            onComplete: function() {
                this._label.hide();
            }.bind(this)
        });
    }
});
