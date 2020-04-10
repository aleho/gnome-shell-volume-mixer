/**
 * Shell Volume Mixer
 *
 * Mixer class wrapping the mixer control.
 *
 * @author Alexander Hofbauer <alex@derhofbauer.at>
 */

/* exported Mixer */

const {Gio, Gvc} = imports.gi;
const Lib = imports.misc.extensionUtils.getCurrentExtension().imports.lib;
const Main = imports.ui.main;
const Signals = imports.signals;
const Volume = imports.ui.status.volume;

const { Cards, STREAM_MATCHING } = Lib.utils.cards;
const { EventHandlerDelegate } = Lib.utils.eventHandlerDelegate;
const { Hotkeys } = Lib.utils.hotkeys;
const { Profiles } = Lib.volume.profiles;
const { Settings, SETTING } = Lib.settings;
const Log = Lib.utils.log;
const Utils = Lib.utils.utils;


class EventSource {}
Signals.addSignalMethods(EventSource.prototype);


/**
 * @mixes EventHandlerDelegate
 */
var Mixer = class
{
    constructor() {
        this._control = Volume.getMixerControl();
        this.eventHandlerDelegate = this._control;

        this._streamEvents = new EventSource();
        this._settings = new Settings();
        this._hotkeys = new Hotkeys(this._settings);
        this._profiles = new Profiles(this._settings);
        this._cards = new Cards(this._control);

        this._state = null;
        this._defaultSink = null;

        this.connect(this._control, 'state-changed', this._onStateChanged.bind(this), () => {
            return [this._control, this._control.get_state()];
        });

        this.connect(this._control, 'default-sink-changed', this._onDefaultSinkChanged.bind(this));

        this._bindProfileHotkey();
    }

    /**
     * The current Gvc.MixerControl.
     */
    get control() {
        return this._control;
    }

    /**
     * Connects an event handler to volume changes.
     *
     * @param {function()} callback
     */
    connectVolumeChanges(callback) {
        this._streamEvents.connect('volume-changed', callback);
    }

    /**
     * Returns the current volume in percent.
     *
     * @returns {?number}
     */
    getVolume() {
        if (!this._defaultSink) {
            return null;
        }

        if (this._defaultSink.is_muted) {
            return 0;
        }

        return Math.round(this._defaultSink.volume / this._control.get_vol_max_norm() * 100);
    }

    /**
     * Cleanup.
     */
    destroy() {
        this.disconnectAll();
        this._hotkeys.unbindAll();
        this._cards.destroy();
    }

    /**
     * Binds the hotkey for profile rotation.
     * @private
     */
    _bindProfileHotkey() {
        if (!this._profiles.count()) {
            Log.info('No profiles found, not enabling profile switching hotkey');
            return;
        }

        Log.info('Profiles found, enabling profile switching hotkey');
        this._hotkeys.bind(SETTING.profile_switcher_hotkey, this._switchProfile.bind(this));
    }

    /**
     * Disconnects volume update signals from the default sink.
     * @private
     */
    _disconnectSink() {
        this.disconnect(this._defaultSink, 'notify::is-muted');
        this.disconnect(this._defaultSink, 'notify::volume');
    }

    /**
     * Connects volume update signals from the default sink for notifications.
     * @private
     */
    _connectSink() {
        this.connect(this._defaultSink, 'notify::is-muted', this._onVolumeUpdate.bind(this));
        this.connect(this._defaultSink, 'notify::volume', this._onVolumeUpdate.bind(this));
    }

    /**
     * Emits a stream update event if volume changes.
     * @private
     */
    _onVolumeUpdate() {
        const percent = this.getVolume();

        if (percent !== null) {
            this._streamEvents.emit('volume-changed', percent);
        }
    }

    /**
     * Updates the default sink, trying to mark the currently active card.
     * @private
     */
    async _updateDefaultSink(stream) {
        if (this._defaultSink !== stream) {
            if (this._defaultSink) {
                this._disconnectSink();
            }

            this._defaultSink = stream;
            this._connectSink();
            this._onVolumeUpdate();
        }

        // we might get a sink id without being able to lookup or setting the update ourselves
        if (!stream || this._pauseDefaultSinkEvent) {
            delete this._pauseDefaultSinkEvent;
            return;
        }

        const paCard = await this._cards.get(stream.card_index);

        if (!paCard || !paCard.card) {
            Log.error('Mixer', '_updateDefaultSink', `Default sink updated but PA/GVC card not found (${stream.card_index}/${stream.name})`);
            return;
        }

        this._profiles.setCurrent(paCard);
    }

    /**
     * Callback for state changes.
     * @private
     */
    _onStateChanged(control, state) {
        this._state = state;

        if (state !== Gvc.MixerControlState.READY) {
            return;
        }

        this._updateDefaultSink(this._control.get_default_sink());
    }

    /**
     * Callback for default sink changes.
     * @private
     */
    _onDefaultSinkChanged(control, id) {
        this._updateDefaultSink(control.lookup_stream_id(id));
    }


    /**
     * Hotkey handler to switch between profiles.
     * @private
     */
    async _switchProfile() {
        if (this._state !== Gvc.MixerControlState.READY) {
            return;
        }

        const next = this._profiles.next();

        if (!next) {
            return;
        }

        // lookup card indirectly via name (indexes aren't UUIDs)
        const paCard = await this._cards.getByName(next.card);

        if (!paCard || !paCard.card) {
            // we don't know this card, we won't be able to set its profile
            return;
        }

        // profile's changed, now get that new sink
        const sinks = this._control.get_sinks();
        let newSink = null;

        for (let sink of sinks) {
            let result = this._cards.streamMatchesPaCard(sink, paCard, next.profile);

            if (result === STREAM_MATCHING.stream) {
                newSink = sink;
                break;
            }

            if (result === STREAM_MATCHING.card || !newSink) {
                // maybe we can use this stream later, but we'll keep searching
                newSink = sink;
            }
        }

        paCard.card.set_profile(next.profile);

        if (newSink) {
            this._pauseDefaultSinkEvent = true;
            this._control.set_default_sink(newSink);
        }

        const cardDescription = paCard.description;
        const profileDescription = paCard.profiles[next.profile];
        this._showNotification(`${cardDescription}\n${profileDescription}`);
    }

    /**
     * Shows a notification window through Shell's OSD Window Manager.
     *
     * @param {string} text Text to display
     * @private
     */
    _showNotification(text) {
        let monitor = -1;
        let icon = Gio.Icon.new_for_string('audio-speakers-symbolic');
        Main.osdWindowManager.show(monitor, icon, text);
    }
};

Utils.mixin(Mixer, EventHandlerDelegate);
