/**
 * Shell Volume Mixer
 *
 * Floating label.
 *
 * @author Alexander Hofbauer <alex@derhofbauer.at>
 */

/* exported FloatingLabel */

const Main = imports.ui.main;
const {Clutter, St} = imports.gi;



/**
 * A tooltip-like label to display the current value of a slider.
 *
 * Shamelessly stolen from gnome-shell/js/ui/dash.js.
 */
var FloatingLabel = class
{
    constructor() {
        this._label = new St.Label({ style_class: 'dash-label floating-label' });
        this.text = '100%';
        this._label.hide();
        Main.layoutManager.addChrome(this._label);
    }

    get text() {
        return this._label.get_text();
    }

    set text(text) {
        this._label.set_text(text);
    }

    get size() {
        return this._label.get_size();
    }

    show(x, y, animate) {
        this._label.opacity = 0;
        this._label.show();
        Main.uiGroup.set_child_above_sibling(this._label, null);

        const labelHeight = this._label.get_height();
        const labelWidth = this._label.get_width();

        const node = this._label.get_theme_node();
        const xOffset = node.get_length('-x-offset');

        let xPos;
        if (Clutter.get_default_text_direction() == Clutter.TextDirection.RTL) {
            xPos = x - labelWidth - xOffset;
        } else {
            xPos = x + labelWidth + xOffset;
        }

        const yPos = y - labelHeight;

        this._label.set_position(xPos, yPos);
        this._label.ease({
            opacity: 255,
            duration: animate !== false ? 150 : 0,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });
    }

    hide(animate) {
        this._label.ease({
            opacity: 0,
            duration: animate !== false ? 100 : 0,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => this._label.hide(),
        });
    }
};
