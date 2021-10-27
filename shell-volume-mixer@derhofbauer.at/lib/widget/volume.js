/**
 * Shell Volume Mixer
 *
 * Volume widgets.
 *
 * @author Alexander Hofbauer <alex@derhofbauer.at>
 */

/* exported MasterSlider, AggregatedInput, OutputSlider, EventsSlider, InputSlider, InputStreamSlider, VolumeMenu */

const { Clutter, GLib, St } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;
const Lib = ExtensionUtils.getCurrentExtension().imports.lib;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Volume = imports.ui.status.volume;
const __ = ExtensionUtils.gettext;

const { EventBroker } = Lib.utils.eventBroker;
const { FloatingLabel } = Lib.widget.floatingLabel;
const Log = Lib.utils.log;
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
    /**
     * @param {Gvc.MixerControl} control
     * @param {sliderOptions} options
     * @private
     */
    constructor(control, options = {}) {
        super();

        this._isDestroyed = false;
        this._hasHeadphones = false;

        this.options = options;
        this._control = control;
        this._mixer = options.mixer;
        this._events = new EventBroker();

        this._init(options);

        return this;
    }

    /**
     * Init basically copied from Volume.StreamSlider (all init) and Volume.OutputStreamSlider (icons).
     *
     * @param {sliderOptions} options
     */
    _init(options) {
        if (!this.item) {
            this.item = new MenuItem.SubMenuItem();
        }

        if (this.icon) {
            // different widgets seem to use different naming
            this._icon = this.icon;
        }

        if (!this._icon) {
            this._icon = new St.Icon({ style_class: 'popup-menu-icon' });
            this.item.firstLine.add_child(this._icon);
        }

        if (!this._label) {
            this._label = new St.Label({ text: '' });
            this.item.firstLine.add_child(this._label);
        }

        this.item.label_actor = this._label;

        if (!this._slider) {
            this._slider = new Slider.VolumeSlider(0);
            this.item.secondLine.add_child(this._slider);
        }

        this._volumeInfo = new FloatingLabel();


        this.item.connect('destroy', this._onDestroy.bind(this));

        if (this._onButtonPress) {
            this.item.connect('button-press-event', this._onButtonPress.bind(this));
        }

        if (this._onKeyPress) {
            this.item.connect('key-press-event', this._onKeyPress.bind(this));
        }

        if (this._slider.scroll) {
            this.item.connect('scroll-event', (slider, event) => {
                return this._slider.emit('scroll-event', event);
            });
        }

        this.item.connect('scroll-event', () => {
            this._showVolumeInfo();
        });


        this._inDrag = false;
        this._notifyVolumeChangeId = 0;

        this._soundSettings = new Settings.Settings(Settings.SOUND_SETTINGS_SCHEMA);
        this._soundSettings.connect(`changed::${Settings.ALLOW_AMPLIFIED_VOLUME_KEY}`, this._amplifySettingsChanged.bind(this), true);
        this._amplifySettingsChanged();

        this._sliderChangedId = this._slider.connect('notify::value', this._sliderChanged.bind(this));
        this._slider.connect('drag-begin', () => (this._inDrag = true));
        this._slider.connect('drag-end', () => {
            this._inDrag = false;
            this._notifyVolumeChange();
        });

        this.stream = options.stream || null;
        this._volumeCancellable = null;

        this._icons = [
            'audio-volume-muted-symbolic',
            'audio-volume-low-symbolic',
            'audio-volume-medium-symbolic',
            'audio-volume-high-symbolic',
            'audio-volume-overamplified-symbolic',
        ];
    }

    _onKeyPress(actor, event) {
        return this._slider.emit('key-press-event', event);
    }

    _onButtonPress(actor, event) {
        if (event.get_button() === 2) {
            this.toggleMute();

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

    _showVolumeInfo(position) {
        if (!this._stream || !this._volumeInfo) {
            return;
        }

        this._volumeInfo.text = Math.round(this._slider.value * 100) + '%';

        if (this._labelTimeoutId) {
            GLib.source_remove(this._labelTimeoutId);
            this._labelTimeoutId = undefined;
        }

        if (!this._infoShowing) {
            this._infoShowing = true;

            let x, y;
            if (position) {
                [x, y] = position;
                x     += 15;
                y     += 100;
            } else {
                [x, y] = this._slider.get_transformed_position();
                x = x + Math.floor(this._slider.get_width() / 2);
            }

            this._volumeInfo.show(x, y);
        }

        this._labelTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
            this._infoShowing = false;
            this._labelTimeoutId = undefined;
            this._volumeInfo.hide();
            return GLib.SOURCE_REMOVE;
        });
    }

    hideVolumeInfo() {
        if (this._labelTimeoutId) {
            GLib.source_remove(this._labelTimeoutId);
            this._labelTimeoutId = undefined;
        }

        this._infoShowing = false;
        this._volumeInfo.hide(false);
    }

    toggleMute() {
        if (this._stream) {
            this._stream.change_is_muted(!this._stream.is_muted);
        }
    }

    _onDestroy() {
        this._isDestroyed = true;

        // make sure we clean up all bindings
        if (this._stream) {
            this._disconnectStream(this._stream);
        }
    }
};



/**
 * Slider replacing the master volume slider.
 */
var MasterSlider = class extends StreamSlider
{
    _init(options) {
        this.item = new MenuItem.MasterMenuItem();
        this.item.menu.actor.add_style_class_name('svm-master-slider-menu');

        this._slider = this.item._slider;
        this._icon = this.item.icon;
        this._label = this.item.label;

        this._slider.accessible_name = _('Volume');

        super._init(options);
        this._addSettingsItem();
    }

    /**
     * Add settings shortcuts to the menu.
     *
     * @private
     */
    _addSettingsItem() {
        this.item.menu.addAction(_('Settings'), () => ExtensionUtils.openPrefs());
    }

    /**
     * @param {OutputSlider} slider
     */
    addOutputSlider(slider) {
        this.item.addMenuItem(slider.item);
    }

    /**
     * Override button click to allow for mute / unmute and menu to be opened.
     */
    _onButtonPress(actor, event) {
        if (event.get_button() === 2) {
            this.toggleMute();
        }

        return Clutter.EVENT_STOP;
    }

    _updateLabel() {
        this._label.text = this._stream.description;
    }

    scroll(event) {
        const eventResult = super.scroll(event);

        if (Main.panel.statusArea.aggregateMenu.menu.isOpen) {
            this._showVolumeInfo();
        }

        return eventResult;
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
        this.item.accessible_name = __('Inputs');

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
        this.item.visible = (this.item.menu.numMenuItems > 1
            || (this.item.menu.numMenuItems > 0 && this._inputStream.isVisible())
        );
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
            this.item.addDetails(this._details);
        }

        this._cards = options.mixer.cards;
        this._updateVisibility(false);

        this._events.connect('default-sink-updated', this._onDefaultSinkUpdated.bind(this));
    }

    _onButtonPress(actor, event) {
        if (event.get_button() === 1) {
            this._setAsDefault();
            return Clutter.EVENT_PROPAGATE;
        }

        return super._onButtonPress(actor, event);
    }

    _onKeyPress(actor, event) {
        let symbol = event.get_key_symbol();
        if (symbol === Clutter.KEY_space || symbol === Clutter.KEY_Return) {
            this._setAsDefault();
            return Clutter.EVENT_STOP;
        }

        return super._onKeyPress(actor, event);
    }

    _updateLabel() {
        let text = this._stream.description;
        let description = this._stream.name;

        this._label.text = text;

        if (this.options.detailed && text !== description && description) {
            let parts = description.split('.');

            if (parts.length > 1) {
                if (parts[0] === 'alsa_output') {
                    // remove the common first (and uninteresting) part
                    parts.shift();
                }
                // the last segment of the path is the most interesting one
                description = parts.pop();
                description += ` | ${parts.join('.')}`;
            }

            this._details.text = description;
        }
    }

    _setAsDefault() {
        this._control.set_default_sink(this._stream);
    }

    _onDefaultSinkUpdated(/* stream */) {
        this._updateVisibility(false);
    }

    _updateVisibility(forceRefresh = true) {
        if (!this._shouldBeVisible()) {
            // set invisible immediately
            this.item.visible = false;

        } else {
            // check if port is available before setting visible
            (async () => {
                try {
                    const byPort = await this._shouldBeVisibleByPort(forceRefresh);

                    if (this._isDestroyed) {
                        // async race condition, we're already gone
                        return;
                    }

                    // This could be a race condition with the async code finishing after current conditions have changed.
                    // Therefore we have to check the sync path again.
                    this.item.visible = byPort && this._shouldBeVisible();

                } catch (e) {
                    Log.error('OutputSlider', '_updateVisibility', e);
                }
            })();
        }
    }

    _shouldBeVisible() {
        if (this.options.mixer.defaultSink === this._stream) {
            Log.info(`Hiding ${this._stream.id}:${this._stream.name}, it's the default sink`);

            return false;
        }

        return super._shouldBeVisible();
    }

    /**
     * @returns {Promise<boolean>}
     * @private
     */
    async _shouldBeVisibleByPort(forceRefresh = true) {
        if (!this._stream || ! this._cards) {
            return true;
        }

        if (!this._stream.card_index) {
            Log.error('OutputSlider', '_shouldBeVisibleByPort', 'Stream cannot be identified, no card index available');
            return true;
        }

        const card = await this._cards.get(this._stream.card_index, forceRefresh);

        if (!card) {
            Log.info(`Card ${this._stream.card_index} not found for stream ${this._stream.id}:${this._stream.name}`);
            return true;
        }

        const port = this._stream.port in card.ports ? card.ports[this._stream.port] : null;

        if (!port) {
            Log.error('OutputSlider', '_shouldBeVisibleByPort', `Port ${this._stream.port} not found for stream ${this._stream.id}:${this._stream.name}`);
            return true;
        }

        // null == cannot be disabled, true == available, false == not available
        if (port.available !== false) {
            return true;
        }

        Log.info(`Hiding ${this._stream.id}:${this._stream.name}, port "${this._stream.port}" not available`);

        return false;
    }
};


/**
 * Slider for system sounds.
 */
var EventsSlider = class extends StreamSlider
{
    /**
     * @param {sliderOptions} options
     * @private
     */
    _init(options) {
        super._init(options);

        this.item.add_style_class_name('events-stream-slider');
        this.item.secondLine.add_style_class_name('svm-events-slider-line');
    }

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

        if (description && text !== description) {
            if (text) {
                text = `${description} | ${text}`;
            } else {
                text = description;
            }
        }

        this._label.text = text || '[%s]'.format(__('unknown'));
    }
};


/**
 * Input stream slider (microphones, etc ?).
 */
var InputStreamSlider = class extends StreamSlider
{
    /**
     * @param {sliderOptions} options
     */
    _init(options) {
        super._init(options);

        this._showInput = false;

        this._slider.accessible_name = _('Microphone');
        this._streamAddedId = this._control.connect('stream-added', this._maybeShowInput.bind(this));
        this._streamRemovedId = this._control.connect('stream-removed', this._maybeShowInput.bind(this));

        this._icon.icon_name = 'audio-input-microphone-symbolic';
        this._icons = [
            'microphone-sensitivity-muted-symbolic',
            'microphone-sensitivity-low-symbolic',
            'microphone-sensitivity-medium-symbolic',
            'microphone-sensitivity-high-symbolic',
        ];
    }

    _connectStream(stream) {
        Volume.InputStreamSlider.prototype._connectStream.apply(this, [stream]);
        this.refresh();
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

    _shouldBeVisible() {
        return Volume.InputStreamSlider.prototype._shouldBeVisible.call(this);
    }

    isVisible() {
        return this._shouldBeVisible();
    }

    _updateLabel() {
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

    _onDestroy() {
        if (this._streamAddedId) {
            this._control.disconnect(this._streamAddedId);
        }

        if (this._streamRemovedId) {
            this._control.disconnect(this._streamRemovedId);
        }

        super._onDestroy();
    }
};
