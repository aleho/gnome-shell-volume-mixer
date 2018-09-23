/**
 * Shell Volume Mixer
 *
 * Volume widgets.
 *
 * @author Alexander Hofbauer <alex@derhofbauer.at>
 */

/* exported MasterSlider, AggregatedInput, OutputSlider, EventsSlider, InputSlider, InputStreamSlider, VolumeMenu */

const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const Lib = imports.misc.extensionUtils.getCurrentExtension().imports.lib;
const Mainloop = imports.mainloop;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Volume = imports.ui.status.volume;

const __ = Lib.utils.gettext._;
const { FloatingLabel } = Lib.widget.floatingLabel;
const MenuItem = Lib.widget.menuItem;
const Settings = Lib.settings;
const Slider = Lib.widget.slider;
const Utils = Lib.utils.utils;


/**
 * Extension of Volume.StreamSlider without its constructor().
 */
class StreamSliderExtension {}
Utils.mixin(StreamSliderExtension, Volume.StreamSlider);


/**
 * Extension of Volume.OutputStreamSlider without its constructor().
 */
class OutputStreamSliderExtension extends StreamSliderExtension {}
Utils.mixin(OutputStreamSliderExtension, Volume.OutputStreamSlider);


/**
 * Basic StreamSlider implementation for Input- and OutputStreams.
 *
 * We can extend (and monkey patch) Volume.OutputStreamSlider
 * (Volume.InputStreamSlider is meant for microphones only and Volume.StreamSlider is only basic).
 */
const StreamSlider = class extends OutputStreamSliderExtension
{
    constructor(control, options) {
        super();

        this.options = options || {};
        this._control = control;
        this._mixer = options.mixer;

        this._init(options);

        return this;
    }

    /**
     * Init basically copied from Volume.StreamSlider and Volume.StreamSlider
     */
    _init(options) {
        if (!this.item) {
            this.item = new MenuItem.SubMenuItem({ activate: false });
        }

        if (this.icon) {
            // different widgets seem to use different naming
            this._icon = this.icon;
        }

        if (!this._icon) {
            this._icon = new St.Icon({ style_class: 'popup-menu-icon' });
            this.item.firstLine.add(this._icon);
        }

        if (!this._label) {
            this._label = new St.Label({ text: '' });
            this.item.firstLine.add(this._label, { expand: true });
        }

        if (!this._slider) {
            this._slider = new Slider.VolumeSlider(0);
            this.item.secondLine.add(this._slider.actor, { expand: true });
        }

        this._volumeInfo = new FloatingLabel();


        if (this._onButtonPress) {
            this.item.actor.connect('button-press-event', this._onButtonPress.bind(this));
        }

        if (this._onKeyPress) {
            this.item.actor.connect('key-press-event', this._onKeyPress.bind(this));
        }

        if (this._slider._onScrollEvent) {
            this.item.actor.connect('scroll-event', this._slider._onScrollEvent.bind(this._slider));
        }


        let soundSettings = new Settings.Settings(Settings.SOUND_SETTINGS_SCHEMA);
        this._soundSettings = soundSettings.settings;
        this._soundSettings.connect('changed::' + Settings.ALLOW_AMPLIFIED_VOLUME_KEY, this._amplifySettingsChanged.bind(this));
        this._amplifySettingsChanged();

        this._slider.connect('value-changed', this._sliderChanged.bind(this));
        this._slider.connect('drag-end', this._notifyVolumeChange.bind(this));

        this.stream = options.stream || null;
        this._volumeCancellable = null;
    }

    _onKeyPress(actor, event) {
        return this._slider.onKeyPressEvent(actor, event);
    }

    _onButtonPress(actor, event) {
        if (event.get_button() == 2) {
            this._stream.change_is_muted(!this._stream.is_muted);
            return Clutter.EVENT_STOP;
        }
        return this._slider.startDragging(event);
    }

    refresh() {
        this._updateLabel();
        this._updateSliderIcon();
    }

    _updateSliderIcon() {
        if (this._stream && !this.options.symbolicIcons) {
            this._icon.gicon = this._stream.get_gicon();
        } else {
            super._updateSliderIcon();
        }

        this.emit('stream-updated');
    }

    _connectStream(stream) {
        super._connectStream(stream);
        this.refresh();
    }

    _updateLabel() {
        this._label.text = this._stream.name || this._stream.description || '';
    }

    _sliderChanged(slider, value, event) {
        super._sliderChanged(slider, value, event);

        if (!this._stream || !this._volumeInfo) {
            return;
        }

        // value is already a proportion of the probably boosted slider
        this._showVolumeInfo(Math.round(value * 100), event);
    }

    _showVolumeInfo(value, event) {
        this._volumeInfo.text = value + '%';

        if (this._labelTimeoutId) {
            Mainloop.source_remove(this._labelTimeoutId);
            this._labelTimeoutId = undefined;
        }

        if (!this._infoShowing) {
            this._infoShowing = true;

            let x, y;

            if (event && 'showInfoAtMouseCursor' in event && event.showInfoAtMouseCursor === true) {
                [x, y] = event.get_coords();
                let [, h] = this._volumeInfo.size;
                x += 15;
                y += h + 10;
            } else {
                [x, y] = this._slider.actor.get_transformed_position();
                x = x + Math.floor(this._slider.actor.get_width() / 2);
            }

            this._volumeInfo.show(x, y);
        }

        this._labelTimeoutId = Mainloop.timeout_add(1000, () => {
            this._infoShowing = false;
            this._labelTimeoutId = undefined;
            this._volumeInfo.hide();
            return GLib.SOURCE_REMOVE;
        });
    }

    hideVolumeInfo() {
        if (this._labelTimeoutId) {
            Mainloop.source_remove(this._labelTimeoutId);
            this._labelTimeoutId = undefined;
        }

        this._infoShowing = false;
        this._volumeInfo.hide(false);
    }
};



/**
 * Slider replacing the master volume slider.
 */
var MasterSlider = class extends StreamSlider
{
    _init(options) {
        this.item = new MenuItem.MasterMenuItem();

        this._slider = this.item._slider;
        this._icon = this.item.icon;
        this._label = this.item.label;

        this._slider.actor.accessible_name = _('Volume');

        this.item.menu.addAction(_('Settings'), () => {
            Settings.openDialog();
        });

        super._init(options);
    }

    addSliderItem(item) {
        let pos = (this.item.menu._getMenuItems().length || 0) - 1;

        this.item.menu.addMenuItem(item, pos < 0 ? 0 : pos);
    }

    /**
     * Override button click to allow for mute / unmute and menu to be opened.
     */
    _onButtonPress(actor, event) {
        if (event.get_button() == 2) {
            this._stream.change_is_muted(!this._stream.is_muted);
        }
        return Clutter.EVENT_STOP;
    }

    _updateLabel() {
        this._label.text = this._stream.description;
    }
};


/**
 * Menu item for aggregated input streams.
 */
var AggregatedInput = class
{
    constructor() {
        this.item = new PopupMenu.PopupSubMenuMenuItem(__('Inputs'), true);
        this.item.icon.icon_name = 'applications-multimedia-symbolic';
        this.item.actor.accessible_name = __('Inputs');

        this._inputStream = null;
    }

    setInputStream(inputSlider) {
        this._inputStream = inputSlider;
        this.addSlider(inputSlider, 0);
    }

    addSlider(slider, pos) {
        this.item.menu.addMenuItem(slider.item, pos || undefined);

        slider.connect('stream-updated', () => {
            this.refresh();
        });
    }

    refresh() {
        let hasVisibleItems = (this.item.menu.numMenuItems > 1
            || (this.item.menu.numMenuItems > 0 && this._inputStream.isVisible())
        );

        this.item.actor.visible = hasVisibleItems;
    }
};



/**
 * Slider for output sinks (e.g. alsa devices, different profiles).
 */
var OutputSlider = class extends StreamSlider
{
    _init(options) {
        // make details widget available before parent triggers accessing it
        if (options.detailed) {
            this._details = new St.Label({ text: '', style_class: 'svm-slider-details' });
        }

        super._init(options);

        if (options.detailed) {
            this.item.addChildAt(this._details, 1);
        }
    }

    _onButtonPress(actor, event) {
        if (event.get_button() == 1) {
            this._setAsDefault();
            return Clutter.EVENT_PROPAGATE;
        }

        return super._onButtonPress(actor, event);
    }

    _onKeyPress(actor, event) {
        let symbol = event.get_key_symbol();
        if (symbol == Clutter.KEY_space || symbol == Clutter.KEY_Return) {
            this._setAsDefault();
            return Clutter.EVENT_STOP;
        }

        return super._onKeyPress(actor, event);
    }

    _updateLabel() {
        let text = this._stream.description;
        let description = this._stream.name;

        this._label.text = text;

        if (this.options.detailed && text != description && description) {
            let parts = description.split('.');

            if (parts.length > 1) {
                if (parts[0] == 'alsa_output') {
                    // remove the common first (and uninteresting) part
                    parts.shift();
                }
                // the last segment of the path is the most interesting one
                description = parts.pop();
                description += ' | ' + parts.join('.');
            }

            this._details.text = description;
        }
    }

    setSelected(selected) {
        if (selected !== false) {
            this.item.setSelected(true);
            this._label.add_style_class_name('selected-stream');
        } else {
            this.item.setSelected(false);
            this._label.remove_style_class_name('selected-stream');
        }
    }

    _setAsDefault() {
        this._control.set_default_sink(this._stream);
    }
};


/**
 * Slider for system sounds.
 */
var EventsSlider = class extends StreamSlider
{
    _updateLabel() {
        this._label.text = this._stream.name;
    }
};


/**
 * Slider for input sinks (e.g. media players).
 */
var InputSlider = class extends StreamSlider
{
    _updateLabel() {
        let text = this._stream.name;
        let description = this._stream.description;

        if (description && text != description) {
            if (text) {
                text = description + ' | ' + text;
            } else {
                text = description;
            }
        }

        this._label.text = text || '[' + __('unknown') + ']';
    }
};


/**
 * Input stream slider (microphones, etc ?).
 */
var InputStreamSlider = class extends StreamSlider
{
    _init(options) {
        super._init(options);

        this._showInput = false;

        this._slider.actor.accessible_name = _('Microphone');
        this._control.connect('stream-added', this._maybeShowInput.bind(this));
        this._control.connect('stream-removed', this._maybeShowInput.bind(this));
    }

    _connectStream(stream) {
        super._connectStream(stream);
        this._maybeShowInput();
    }

    _maybeShowInput() {
        if (this.options.showAlways === true) {
            this._showInput = true;
            this._updateVisibility();
        } else {
            // we extend from output stream slider impl, but this is an input stream slider
            Volume.InputStreamSlider.prototype._maybeShowInput.call(this);
        }
    }

    isVisible() {
        return this._shouldBeVisible();
    }

    _shouldBeVisible() {
        return Volume.InputStreamSlider.prototype._shouldBeVisible.call(this);
    }

    _updateLabel() {
        super._updateLabel();

        this._label.text = _('Microphone');
    }

    _updateSliderIcon() {
        if (this._stream && !this.options.symbolicIcons) {
            this._icon.gicon = this._stream.get_gicon();
        } else {
            this._icon.icon_name = 'audio-input-microphone-symbolic';
        }

        this.emit('stream-updated');
    }
};


/**
 * Just re-declarations for now.
 */
var VolumeMenu = Volume.VolumeMenu;
