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
const Meta = imports.gi.Meta;
const Shell = imports.gi.Shell;
const Volume = imports.ui.status.volume;

const Utils = Extension.imports.utils;

const signals = [];
const STREAM_NO_MATCH = 0;
const STREAM_MATCHES = 1;
const STREAM_CARD_MATCHES = 2;
var get_vol_max_norm;


const Mixer = new Lang.Class({
    Name: 'ShellVolumeMixerMixer',

    _init: function(options) {
        this._settings = options.settings;

        this._control = Volume.getMixerControl();
        this._state = this._control.get_state();

        this._cardNames = {};
        this._cards = this._getCardDetails();
        [this._pinned, this._cycled] = this._parsePinnedProfiles();

        this.connect('state-changed', Lang.bind(this, this._onStateChanged));
        this.connect('card-added', Lang.bind(this, this._onCardAdded));
        this.connect('card-removed', Lang.bind(this, this._onCardRemoved));
        this.connect('default-sink-changed', Lang.bind(this, this._onDefaultSinkChanged));

        this._bindHotkey();

        this._onStateChanged(this._control, this._state);
    },

    get control() {
        return this._control;
    },

    connect: function(signal, callback) {
        let id = this._control.connect(signal, callback);
        signals.push(id);
    },

    disconnectAll: function() {
        while (signals.length > 0) {
            this._control.disconnect(signals.pop());
        }

        this._unbindHotkey();
    },

    _bindHotkey: function() {
        if (!this._pinned.length) {
            return;
        }
        Main.wm.addKeybinding('profile-switcher-hotkey',
                this._settings._settings,
                Meta.KeyBindingFlags.NONE,
                Shell.KeyBindingMode.ALL,
                Lang.bind(this, this._switchProfile));
    },

    _unbindHotkey: function() {
        if (!this._pinned.length) {
            return;
        }
        Main.wm.removeKeybinding('profile-switcher-hotkey');
    },

    /**
     * Monkey patch for maximum volume calculations (needed for other parts
     * of the UI, like volume overlay).
     */
    enableVolumeBoost: function() {
        if (get_vol_max_norm) {
            // we've already patched the control
            return;
        }

        get_vol_max_norm = this._control.get_vol_max_norm;
        this._control.get_vol_max_norm = this._control.get_vol_max_amplified;
    },

    /**
     * Undoes the monkey patching of get vol max norm.
     */
    disableVolumeBoost: function() {
        if (!get_vol_max_norm) {
            // apparently we never patched get_vol_max_norm
            return;
        }

        this._control.get_vol_max_norm = get_vol_max_norm;
        get_vol_max_norm = undefined;
    },

    /**
     * Returns the "real" normalized max volume.
     */
    getVolMaxNorm: function() {
        if (get_vol_max_norm) {
            return get_vol_max_norm.call(this._control);
        }
        return this._control.get_vol_max_norm();
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
    },

    /**
     * Callback for default source changes.
     */
    _onDefaultSinkChanged: function(control, id) {
        let stream = control.lookup_stream_id(id);
        if (!stream) {
            // we might get a sink id without being able to lookup
            return;
        }

        let card = this._cards[stream.card_index];
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
    }
});