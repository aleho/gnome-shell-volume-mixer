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
const Volume = imports.ui.status.volume;

const { Cards, STREAM_MATCHING } = Lib.utils.cards;
const { EventBroker } = Lib.utils.eventBroker;
const { EventHandlerDelegate } = Lib.utils.eventHandlerDelegate;
const { Hotkeys } = Lib.utils.hotkeys;
const { Profiles } = Lib.volume.profiles;
const { Settings, SETTING } = Lib.settings;
const Log = Lib.utils.log;
const Utils = Lib.utils.utils;


/**
 * @mixes EventHandlerDelegate
 */
var Mixer = class
{
    constructor() {
        this._events = new EventBroker();
        this._control = Volume.getMixerControl();
        this.eventHandlerDelegate = this._control;

        this._settings = new Settings();
        this._hotkeys = new Hotkeys(this._settings);
        this._profiles = new Profiles(this._settings);
        this._cards = new Cards(this._control);

        this._state = null;
        this._defaultSink = null;
        this._pauseDefaultSinkEvent = false;

        this.connect(this._control, 'state-changed', this._onStateChanged.bind(this), () => {
            return [this._control, this._control.get_state()];
        });

        this.connect(this._control, 'default-sink-changed', this._onDefaultSinkChanged.bind(this));

        this._bindProfileHotkey();
    }

    /**
     * The current Gvc.MixerControl.
     *
     * @returns {Gvc.MixerControl}
     */
    get control() {
        return this._control;
    }

    /**
     * @returns {Cards}
     */
    get cards() {
        return this._cards;
    }

    /**
     * @returns {?Gvc.MixerSink}
     */
    get defaultSink() {
        return this._defaultSink;
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
            this._events.emit('volume-changed', percent);
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

            if (stream) {
                Log.info(`Updating default sink ${stream.id}:${stream.name}`);

                this._connectSink();
                this._onVolumeUpdate();

            } else {
                Log.info('Default sink updated to null, cannot update');
            }
        }

        // we might get a sink id without being able to lookup
        // ...or local code causing the event triggers another update
        if (stream && !this._pauseDefaultSinkEvent) {
            try {
                const paCard = await this._cards.get(stream.card_index);

                if (!paCard || !paCard.card) {
                    Log.info(`Default sink updated but PA/GVC card not found (${stream.card_index}/${stream.name})`);
                } else {
                    this._profiles.setCurrent(paCard);
                }

            } catch (e) {
                Log.error('Mixer', '_updateDefaultSink', e);
            }
        }

        this._pauseDefaultSinkEvent = false;
        this._events.emit('default-sink-updated', stream);
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

        // noinspection JSIgnoredPromiseFromCall
        this._updateDefaultSink(this._control.get_default_sink());
    }

    /**
     * Callback for default sink changes.
     * @private
     */
    _onDefaultSinkChanged(control, id) {
        // noinspection JSIgnoredPromiseFromCall
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

        let paCard;
        try {
            // lookup card indirectly via name (indexes aren't UUIDs)
            paCard = await this._cards.getByName(next.card);
        } catch (e) {
            Log.error('Mixer', '_switchProfile', e);
        }

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

        const paProfile = paCard.profiles[next.profile];
        this._showNotification(`${paCard.description || paCard.name}\n${paProfile.description || paProfile.name}`);
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
