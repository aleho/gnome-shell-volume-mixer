/**
 * Shell Volume Mixer
 *
 * Menu items.
 *
 * @author Alexander Hofbauer <alex@derhofbauer.at>
 */

/* exported MasterMenuItem, SubMenuItem */

const { Clutter, GObject, St } = imports.gi;
const Lib = imports.misc.extensionUtils.getCurrentExtension().imports.lib;
const PopupMenu = imports.ui.popupMenu;

const Slider = Lib.widget.slider;
const Utils = Lib.utils.utils;

/**
 * @mixin
 */
class BaseMenuItem
{
    addChildFirstLine(child) {
        this.firstLine.add_child(child);
    }

    addChildSecondLine(child) {
        log('############# in add child')
        this.secondLine.add_child(child);
    }

    _buildFirstLine() {
        this.firstLine = this._makeItemLine();
        this.firstLine.add_style_class_name('line-1');

        this.container.add(this.firstLine);
    }

    _buildSecondLine() {
        console.log('### building second')
        this.secondLine = this._makeItemLine();
        this.secondLine.add_style_class_name('line-2');

        this.container.add(this.secondLine);
    }

    /**
     * @returns {St.BoxLayout}
     */
    _makeItemLine() {
        return new St.BoxLayout({
            style_class: 'popup-menu-item svm-container-line',
            reactive:    true,
        });
    }

    _prepareMenuItem() {
        this.get_children().map(child => {
            this.remove_actor(child);
        });

        this.container = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            style_class: 'svm-menu-item-container',
        });

        this.add(this.container);

        this._buildFirstLine();
        this._buildSecondLine();

        if (this.secondLine) {
            this.container.add(this.secondLine);
        }
    }
}


/**
 * Submenu item for the sink selection menu.
 *
 * @mixes BaseMenuItem
 */
var MasterMenuItem = GObject.registerClass(class MasterMenuItem extends PopupMenu.PopupSubMenuMenuItem
{
    _buildFirstLine() {
        BaseMenuItem.prototype._buildFirstLine.call(this);

        const expander = new St.Bin({
            style_class: 'popup-menu-item-expander',
            x_expand: true,
        });

        this.firstLine.add_child(this._ornamentLabel);
        this.firstLine.add_child(this.icon);
        this.firstLine.add_child(this.label);
        this.firstLine.add_child(expander);
        this.firstLine.add_child(this._triangleBin);
    }

    _buildSecondLine() {
        BaseMenuItem.prototype._buildSecondLine.call(this);

        this.secondLine.add_style_class_name('svm-master-slider-line');
        this.secondLine.add(this._slider);

        // without this label the slider will not be drawn, wtf?
        this.secondLine.add_child(new St.Label({ text: '' }));
    }

    _init() {
        super._init('', true);

        this._slider = new Slider.VolumeSlider(0);
        this._slider.accessible_name = _('Volume');

        this.menu.actor.add_style_class_name('svm-master-slider-menu');

        this.label.add_style_class_name('svm-master-label');
        this.add_style_class_name('svm-master-slider svm-menu-item');

        this._prepareMenuItem();
    }

    vfunc_button_release_event(event) {
        if (event.button === 2) {
            return Clutter.EVENT_STOP;
        }

        return super.vfunc_button_release_event(event);
    }

    /**
     * Change volume on left / right.
     */
    vfunc_key_press_event(event) {
        const symbol = event.keyval;

        if (symbol === Clutter.KEY_Right || symbol === Clutter.KEY_Left) {
            return this._slider.emit('key-press-event', event);
        }

        return super.vfunc_key_press_event(event);
    }

    addMenuItem(item) {
        const pos = (this.menu._getMenuItems().length || 0) - 1;

        this.menu.addMenuItem(item, pos < 0 ? 0 : pos);
    }
});

Utils.mixin(MasterMenuItem, BaseMenuItem, true);

/**
 * Sub menu item implementation for dropdown menus (via master slider menu or input menu).
 *
 * @mixes BaseMenuItem
 */
var SubMenuItem = GObject.registerClass(class SubMenuItem extends PopupMenu.PopupBaseMenuItem
{
    _init(params = {}) {
        super._init({
            ...params,
            activate: false,
        });

        this._prepareMenuItem();
    }

    addDetails(label) {
        const line = this._makeItemLine();

        line.add_child(label);
        this.container.insert_child_at_index(line, 1);
    }
});

Utils.mixin(SubMenuItem, BaseMenuItem, true);
