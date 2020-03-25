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

const { Cards } = Lib.utils.cards;
const { EventHandlerDelegate } = Lib.utils.eventHandlerDelegate;
const { Hotkeys } = Lib.utils.hotkeys;
const { Settings } = Lib.settings;
const Utils = Lib.utils.utils;

const STREAM_NO_MATCH = 0;
const STREAM_MATCHES = 1;
const STREAM_CARD_MATCHES = 2;

const VOL_ICONS = [
    'audio-volume-muted-symbolic',
    'audio-volume-low-symbolic',
    'audio-volume-medium-symbolic',
    'audio-volume-high-symbolic'
];


/**
 * @mixes EventHandlerDelegate
 */
var Mixer = class
{
    constructor() {
        this._control = Volume.getMixerControl();
        this.eventHandlerDelegate = this._control;

        this._settings = new Settings();
        this._hotkeys = new Hotkeys(this._settings);
        this._cards = new Cards(this._control);

        this._state = this._control.get_state();
        this._cycled = this._parsePinnedProfiles();

        this.connect('state-changed', this._onStateChanged.bind(this));
        this.connect('default-sink-changed', this._onDefaultSinkChanged.bind(this));
        this._bindProfileHotkey();

        this._onStateChanged(this._control, this._state);
    }

    /**
     * The current Gvc.MixerControl.
     */
    get control() {
        return this._control;
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
        if (!this._cycled.length) {
            return;
        }

        this._hotkeys.bind('profile-switcher-hotkey', this._switchProfile.bind(this));
    }

    /**
     * Updates the default sink, trying to mark the currently active card.
     * @private
     */
    _updateDefaultSink(stream) {
        this._defaultSink = stream;

        if (!stream || this._pauseDefaultSinkEvent) {
            delete this._pauseDefaultSinkEvent;
            // we might get a sink id without being able to lookup or setting the update ourselves
            return;
        }

        const card = this._cards.get(stream.card_index);

        if (!card || !card.card) {
            Utils.error('mixer', '_updateDefaultSink', 'Default sink updated but card not found (' + stream.name + ')');
            return;
        }

        let profile = card.card.profile;
        this._currentCycle = null;

        for (let entry of this._cycled) {
            if (entry.card == card.name && entry.profile == profile) {
                this._currentCycle = entry;
                break;
            }
        }
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
     * Reads all pinned profiles from settings.
     * @private
     */
    _parsePinnedProfiles() {
        const data = this._settings.get_array('pinned-profiles') || [];
        const cycled = [];

        let count = 0;
        for (let entry of data) {
            let item = null;
            try {
                item = JSON.parse(entry);
            } catch (e) {
                Utils.error('mixer', '_parsePinnedProfiles', e.message);
            }
            if (!item) {
                continue;
            }

            cycled.push(item);

            if (count > 0) {
                cycled[count - 1].next = item;
            }

            count++;
        }

        if (count > 0) {
            cycled[count - 1].next = cycled[0];
        }

        return cycled;
    }


    /**
     * Hotkey handler to switch between profiles.
     * @private
     */
    _switchProfile() {
        if (this._state !== Gvc.MixerControlState.READY) {
            return;
        }

        if (this._cycled.length === 0) {
            return;
        }

        if (!this._currentCycle) {
            this._currentCycle = this._cycled[0];
        }

        // lookup card indirectly via name (indexes aren't UUIDs)
        const next = this._currentCycle.next;
        const cardName = next.card;
        const profileName = next.profile;
        const paCard = this._cards.getByName(cardName);

        if (!paCard || !paCard.card) {
            // we don't know this card, we won't be able to set its profile
            return;
        }

        this._currentCycle = next;

        const cardDescription = paCard.description;
        const profileDescription = paCard.profiles[profileName];
        this._showNotification(cardDescription + '\n' + profileDescription);

        // profile's changed, now get that new sink
        const sinks = this._control.get_sinks();
        let newSink = null;

        for (let sink of sinks) {
            let result = this._streamMatchesProfile(sink.name, cardName, profileName);
            if (result === STREAM_MATCHES) {
                newSink = sink;
                break;
            }
            if (result === STREAM_CARD_MATCHES || !newSink) {
                // maybe we can use this stream later, but we'll keep searching
                newSink = sink;
            }
        }

        paCard.card.set_profile(profileName);

        if (newSink) {
            this._pauseDefaultSinkEvent = true;
            this._control.set_default_sink(newSink);
        }
    }

    /**
     * Tries to find out whether a certain stream matches profile for a card.
     * @private
     */
    _streamMatchesProfile(streamName, cardName, profileName) {
        let [, streamAddr, streamIndex, streamProfile] = streamName.split('.');
        const [, cardAddr, cardIndex] = cardName.split('.');

        // try to fix stream names without index (cardName will not have an index either)
        if (streamIndex && !streamProfile && isNaN(streamIndex)) {
            streamProfile = streamIndex;
            streamIndex = undefined;
        }

        const profileParts = profileName.split(':');
        // remove direction
        profileParts.shift();
        const profile = profileParts.join(':');

        if (streamAddr != cardAddr
                || streamIndex != cardIndex) {
            // cards don't match, certainly no hit
            return STREAM_NO_MATCH;
        }

        if (streamProfile != profile) {
            return STREAM_CARD_MATCHES;
        }

        return STREAM_MATCHES;
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

    /**
     * Shows the current volume on OSD.
     *
     * @see gsd-media-keys-manager.c
     * @private
     */
    _showVolumeOsd(level, percent) {
        const monitor = -1;
        let label = [];
        let n;

        if (level === 0) {
            n = 0;
        } else {
            n = parseInt(3 * percent / 100 + 1);
            n = Math.max(1, n);
            n = Math.min(3, n);
        }

        if (this._defaultSink) {
            let port = this._defaultSink.get_port();
            if (port
                && port.port != 'analog-output-speaker'
                && port.port != 'analog-output'
            ) {
                label.push(port.human_port);
            }
        }

        let icon = Gio.Icon.new_for_string(VOL_ICONS[n]);

        label = label.join('\n');
        if (!label) {
            label = null;
        }

        Main.osdWindowManager.show(monitor, icon, label, level);
    }
};

Utils.mixin(Mixer, EventHandlerDelegate);
