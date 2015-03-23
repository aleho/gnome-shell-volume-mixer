/**
 * Shell Volume Mixer
 *
 * Mixer class wrapping the mixer control.
 *
 * @author Alexander Hofbauer <alex@derhofbauer.at>
 */

/* exported Mixer */

const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Gio = imports.gi.Gio;
const Gvc = imports.gi.Gvc;
const Lang = imports.lang;
const Main = imports.ui.main;
const Volume = imports.ui.status.volume;

const Hotkeys = Extension.imports.hotkeys;
const Settings = Extension.imports.settings;
const Utils = Extension.imports.utils;

const signals = [];
const STREAM_NO_MATCH = 0;
const STREAM_MATCHES = 1;
const STREAM_CARD_MATCHES = 2;

const VOL_ICONS = [
    'audio-volume-muted-symbolic',
    'audio-volume-low-symbolic',
    'audio-volume-medium-symbolic',
    'audio-volume-high-symbolic'
];


const Mixer = new Lang.Class({
    Name: 'ShellVolumeMixerMixer',

    _init: function() {
        this._settings = new Settings.Settings();
        this._hotkeys = new Hotkeys.Hotkeys(this._settings);

        this.volumeStep = this._settings.get_int('volume-step');
        this.boostVolume = this._settings.get_boolean('use-volume-boost');

        this._control = Volume.getMixerControl();
        this._state = this._control.get_state();

        this._cardNames = {};
        this._cards = this._getCardDetails();
        [this._pinned, this._cycled] = this._parsePinnedProfiles();

        this.connect('state-changed', Lang.bind(this, this._onStateChanged));
        this.connect('card-added', Lang.bind(this, this._onCardAdded));
        this.connect('card-removed', Lang.bind(this, this._onCardRemoved));
        this.connect('default-sink-changed', Lang.bind(this, this._onDefaultSinkChanged));

        this._bindProfileHotkey();

        if (this.boostVolume
                || this.volumeStep != Settings.VOLUME_STEP_DEFAULT) {
            this._bindMediaKeys();
        }

        this._onStateChanged(this._control, this._state);
    },

    get control() {
        return this._control;
    },

    connect: function(signal, callback) {
        let id = this._control.connect(signal, callback);
        signals.push(id);
    },


    /**
     * Disconnects all locally used signals.
     */
    disconnectAll: function() {
        while (signals.length > 0) {
            this._control.disconnect(signals.pop());
        }

        this._hotkeys.unbindAll();
    },


    /**
     * Binds the hotkey for profile rotation.
     */
    _bindProfileHotkey: function() {
        if (!this._pinned.length) {
            return;
        }

        this._hotkeys.bind('profile-switcher-hotkey', Lang.bind(this, this._switchProfile));
    },

    /**
     * Binds volume down / up media keys to our own handlers.
     */
    _bindMediaKeys: function() {
        let mkSettings = new Settings.Settings(Settings.MEDIAKEYS_SCHEMA);
        this._hotkeys.bindProxy(mkSettings, 'volume-down', Lang.bind(this, this.decreaseMasterVolume));
        this._hotkeys.bindProxy(mkSettings, 'volume-up', Lang.bind(this, this.increaseMasterVolume));
        this._hotkeys.bindProxy(mkSettings, 'volume-mute', Lang.bind(this, this.muteMasterVolume));
    },


    decreaseMasterVolume: function() {
        this.changeStreamVolume(this._defaultSink, 'down');
    },

    increaseMasterVolume: function() {
        this.changeStreamVolume(this._defaultSink, 'up');
    },

    muteMasterVolume: function() {
        let muted = !this._defaultSink.is_muted;
        let level = 0;
        let percent = 0;

        this._defaultSink.change_is_muted(muted);

        if (!muted) {
            let volume = this._defaultSink.volume;
            let max = this.getVolMax();
            let virtMax = this._control.get_vol_max_norm();
            level = Math.round(volume / max * 100);
            percent = Math.round(volume / virtMax * 100);
        }

        this._showVolumeOsd(level, percent);
    },


    /**
     * Changes a stream's volume by a step down / up.
     */
    changeStreamVolume: function(stream, dir) {
        let volume = stream.volume;
        let max = this.getVolMax();
        let virtMax = this._control.get_vol_max_norm();
        let step = Math.round(virtMax * (this.volumeStep / 100));

        if (dir == 'down') {
            volume -= step;
        } else {
            volume += step;
        }

        volume = this.setStreamVolume(stream, volume);

        let level = Math.round(volume / max * 100);
        let percent = Math.round(volume / virtMax * 100);

        this._showVolumeOsd(level, percent);
    },

    /**
     * Updates the volume of a stream to a certain value.
     *
     * @returns The volume level set.
     */
    setStreamVolume: function(stream, volume) {
        let max = this.getVolMax();
        volume = Math.max(0, volume);
        volume = Math.min(max, volume);

        let prevMuted = stream.is_muted;

        if (volume < 1) {
            stream.volume = 0;
            if (!prevMuted) {
                stream.change_is_muted(true);
            }
        } else {
            stream.volume = volume;
            if (prevMuted) {
                stream.change_is_muted(false);
            }
        }

        stream.push_volume();
        return volume;
    },

    /**
     * Returns the max volume, depending on boost being enabled.
     */
    getVolMax: function() {
        return this.boostVolume
                ? this._control.get_vol_max_amplified()
                : this._control.get_vol_max_norm();
    },

    /**
     * Returns the amount of a step on a (slider) scale from 0 to 1.
     */
    getNormalizedStep: function() {
        if (!this.boostVolume) {
            return this.volumeStep;
        }

        let norm = this._control.get_vol_max_norm();
        let ampl = this._control.get_vol_max_amplified();

        let step = this._step = norm / ampl * this.volumeStep;
        step = Math.round(step * 100) / 100;
        return step;
    },


    /**
     * Adds a card to our array of cards.
     *
     * @param card Card to add.
     */
    _addCard: function(card) {
        let index = card.index;

        if (!this._cards[index] || this._cards[index].fake) {
            let pacards = Utils.getCards();
            if (!pacards) {
                Utils.error('mixer', '_addCard', 'Could not retrieve PA card details');
            } else {
                this._cards[index] = pacards[index];
            }
        }

        if (!this._cards[index]) {
            Utils.error('mixer', '_addCard', 'GVC card not found through Python helper');

            // external script couldn't get card info, fake it
            this._cards[index] = {
                // card name (human name) won't be useful, we'll set it anyway
                name: card.name,
                index: index,
                profiles: [],
                fake: true
            };
        }

        let pacard = this._cards[index];
        pacard.card = card;
        this._cardNames[pacard.name] = index;
    },

    /**
     * Updates the default sink, trying to mark the currently active card.
     */
    _updateDefaultSink: function(stream) {
        this._defaultSink = stream;

        if (!stream) {
            // we might get a sink id without being able to lookup
            return;
        }

        let card = this._cards[stream.card_index];

        if (!card || !card.card) {
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
    },

    /**
     * Callback for state changes.
     */
    _onStateChanged: function(control, state) {
        this._state = state;

        if (state !== Gvc.MixerControlState.READY) {
            return;
        }

        let cards = this._control.get_cards();
        for (let card of cards) {
            this._addCard(card);
        }

        this._updateDefaultSink(this._control.get_default_sink());
    },

    /**
     * Callback for default sink changes.
     */
    _onDefaultSinkChanged: function(control, id) {
        this._updateDefaultSink(control.lookup_stream_id(id));
    },

    /**
     * Signal for added cards.
     */
    _onCardAdded: function(control, index) {
        // we're actually looking up card.index
        let card = control.lookup_card_id(index);
        this._addCard(card);
    },

    /**
     * Signal for removed cards.
     */
    _onCardRemoved: function(control, index) {
        if (index in this._cards) {
            let card = this._cards[index];
            if (card.name in this._cardNames) {
                delete this._cardNames[card.name];
            }
            delete this._cards[index];
        }
    },


    /**
     * Retrieves a list of all cards available, using our Python helper.
     */
    _getCardDetails: function() {
        let cards = Utils.getCards();
        if (!cards) {
            Utils.error('mixer', '_getCardDetails', 'Could not retrieve PA card details');
            return {};
        }

        for (let k in cards) {
            let card = cards[k];
            let profiles = {};
            // normalize profiles
            for (let profile of card.profiles) {
                profiles[profile.name] = profile.description;
            }
            card.profiles = profiles;
        }

        return cards;
    },

    /**
     * Reads all pinned profiles from settings.
     */
    _parsePinnedProfiles: function() {
        let data = this._settings.get_array('pinned-profiles') || [];
        let visible = [];
        let cycled = [];

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

            if (item.show) {
                visible.push(item);
            }
            if (item.switcher) {
                cycled.push(item);
            }
        }

        // link profiles cycle
        let len = cycled.length;
        if (len) {
            cycled[0].prev = cycled[len - 1];
            cycled[len - 1].next = cycled[0];

            let prev;
            for (let profile of cycled) {
                if (prev) {
                    profile.prev = prev;
                    prev.next = profile;
                }
                prev = profile;
            }
        }

        return [visible, cycled];
    },


    /**
     * Hotkey handler to switch between profiles.
     */
    _switchProfile: function() {
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
        let next = this._currentCycle.next;
        let cardName = next.card;
        let profileName = next.profile;
        let index = this._cardNames[cardName];
        let card = this._cards[index];

        if (!card || !card.card) {
            // we don't know this card, we won't be able to set its profile
            return;
        }

        card.card.change_profile(profileName);

        let cardDescription = card.description;
        let profileDescription = card.profiles[profileName];
        this._showNotification(cardDescription + '\n' + profileDescription);

        // default sink changes will update current cycle, profile changes won't
        this._currentCycle = next;

        // profile's changed, now get that new sink
        let sinks = this._control.get_sinks();
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

        if (!newSink) {
            // we couldn't retrieve a sink with matching profile name
            return;
        }

        this._control.set_default_sink(newSink);
    },

    /**
     * Tries to find out whether a certain stream matches profile for a card.
     */
    _streamMatchesProfile: function(streamName, cardName, profileName) {
        let [streamAlsa, streamAddr, streamIndex, streamProfile] = streamName.split('.');
        let [cardAlsa, cardAddr, cardIndex] = cardName.split('.');

        profileName = profileName.split(':');
        // remove direction
        profileName.shift();
        let profile = profileName.join(':');

        if (streamAddr != cardAddr
                || streamIndex != cardIndex) {
            // cards don't match, certainly no hit
            return STREAM_NO_MATCH;
        }

        if (streamProfile != profile) {
            return STREAM_CARD_MATCHES;
        }

        return STREAM_MATCHES;
    },

    /**
     * Shows a notification window through Shell's OSD Window Manager.
     *
     * @param text Text to display
     */
    _showNotification: function(text) {
        let monitor = -1;
        let icon = Gio.Icon.new_for_string('audio-speakers-symbolic');
        Main.osdWindowManager.show(monitor, icon, text);
    },

    /**
     * Shows the current volume on OSD.
     *
     * @see gsd-media-keys-manager.c
     */
    _showVolumeOsd: function(level, percent) {
        let monitor = -1;
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
            if (port.port != 'analog-output-speaker'
                    && port.port != 'analog-output') {
                label.push(port.human_port);
            }
        }

        if (this.boostVolume) {
            if (percent > 0) {
                label.push(percent + '%');
            } else {
                label.push(' ');
            }
        }

        let icon = Gio.Icon.new_for_string(VOL_ICONS[n]);

        label = label.join('\n');
        if (!label) {
            label = null;
        }

        Main.osdWindowManager.show(monitor, icon, label, level);
    }
});
