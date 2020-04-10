/**
 * Shell Volume Mixer
 *
 * PulseAudio card retrieval utilities.
 *
 * @author Alexander Hofbauer <alex@derhofbauer.at>
 */

/* exported Cards, STREAM_MATCHING */

const Lib = imports.misc.extensionUtils.getCurrentExtension().imports.lib;
const Main = imports.ui.main;
const { Gvc, GLib } = imports.gi;

const __ = Lib.utils.gettext._;
const { EventHandlerDelegate } = Lib.utils.eventHandlerDelegate;
const Log = Lib.utils.log;
const Utils = Lib.utils.utils;
const PaHelper = Lib.utils.paHelper;


var STREAM_MATCHING = Object.freeze({
    stream: 1,
    card:   2,
});


/** @typedef {{
 *   name: string,
 *   index: number,
 *   profiles: string[],
 *   fake: boolean,
 *   card: Object<Gvc.MixerCard>
 * }} paCard
 */

/**
 * @property {Object.<string, paCard>} _cards
 */
var Cards = class {
    constructor(control) {
        this._control = control;
        this.eventHandlerDelegate = control;

        this._initDone = new Promise(resolve => {
            this._initialized = resolve;
        });

        this.connect('state-changed', this._onStateChanged.bind(this));
    }

    /**
     * @returns {boolean}
     * @private
     */
    _controlIsReady() {
        return (this._control.get_state() === Gvc.MixerControlState.READY);
    }

    /**
     * Callback for state changes.
     */
    _onStateChanged(/* control, state */) {
        if (!this._controlIsReady()) {
            return;
        }

        this._init();
    }

    /**
     * @returns {Promise<void>}
     * @private
     */
    async _init() {
        try {
            await this._initCards();
            this._initialized();

        } catch (e) {
            Log.error('Cards', '_init', e);
            Main.notifyError('Volume Mixer', __('Querying PulseAudio sound cards failed, disabling extension'));
            Lib.main.Extension.disable();
            return;
        }

        this.connect('card-added', this._onCardAdded.bind(this));
        this.connect('card-removed', this._onCardRemoved.bind(this));
    }

    /**
     * Retrieves a list of all cards available, using our Python helper.
     * Tries to be error-resistant in case the helper cannot deliver.
     *
     * @returns {Promise<void>}
     */
    async _initCards() {
        this._paCards = {};
        this._cardNames = {};

        let cards;

        let retries = 3;
        do {
            cards = await this._getCardDetails();
        } while (!cards
            && (--retries) > 0
            && await new Promise(resolve => GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, () => resolve(true)))
        );

        if (!cards) {
            throw Error('Could not retrieve PA card details with Python helper script');
        }

        this._paCards = cards;
    }

    /**
     * @returns {?Object.<string, paCard>}
     * @private
     */
    async _getCardDetails() {
        const paCards = await PaHelper.getCards();

        if (!paCards) {
            return null;
        }

        for (let k in paCards) {
            let paCard = paCards[k];

            if (!paCard) {
                continue;
            }

            if (!paCard.profiles || !paCard.profiles.length) {
                paCard.profiles = {};
                continue;
            }

            let profiles = {};

            for (let profile of paCard.profiles) {
                profiles[profile.name] = profile.description;
            }

            paCard.profiles = profiles;
        }

        if (!paCards || !Object.keys(paCards).length) {
            return null;
        }

        if (this._controlIsReady()) {
            for (let card of this._control.get_cards()) {
                if (card.index in paCards) {
                    this._addGvcCard(paCards[card.index], card);
                }
            }
        }

        return paCards;
    }

    /**
     * Adds a card to our array of cards.
     *
     * @param {Object<Gvc.MixerCard>} card Card to add.
     */
    _addCard(card) {
        let index = card.index;

        const paCard = this.get(index);

        if (!paCard || paCard.fake) {
            Log.error('Cards', '_addCard', 'GVC card not found through Python helper');

            // external script couldn't get card info, fake it
            this._paCards[index] = {
                // card name (human name) won't be useful, we'll set it anyway
                name: card.name,
                index: index,
                profiles: [],
                fake: true
            };
        }

        this._addGvcCard(paCard, card);
    }

    /**
     * @param {paCard} paCard
     * @param {Object<Gvc.MixerCard>} card
     * @private
     */
    _addGvcCard(paCard, card) {
        if (!paCard) {
            Log.error('Cards', '_addGvcCard', 'No paCard passed');
            return;
        }

        if (!paCard.name) {
            Log.error('Cards', '_addGvcCard', 'Invalid paCard data, name missing');
            return;
        }

        paCard.card = card;
        this._cardNames[paCard.name] = card.index;
    }

    /**
     * Signal for added cards.
     */
    _onCardAdded(control, index) {
        // we're actually looking up card.index
        let card = control.lookup_card_id(index);
        this._addCard(card);
    }

    /**
     * Signal for removed cards.
     */
    _onCardRemoved(control, index) {
        if (index in this._paCards) {
            delete this._cardNames[this._paCards[index].name];
            delete this._paCards[index];
        }
    }


    /**
     * Finds a card by card index.
     *
     * @param {number} index
     * @returns {Promise<?paCard>}
     */
    async get(index) {
        await this._initDone;

        return (index in this._paCards) ? this._paCards[index] : null;
    }

    /**
     * Finds a card by name.
     *
     * @param {string} name
     * @returns {Promise<?paCard>}
     */
    async getByName(name) {
        await this._initDone;

        const index = this._cardNames[name];
        if (!isNaN(index) && index >= 0) {
            return this.get(index);
        }

        return null;
    }

    /**
     * Tries to find out whether a certain stream matches profile for a card.
     *
     * @param {Object<Gvc.MixerStream>} stream
     * @param {paCard} paCard
     * @param {string} profileName
     * @private
     */
    streamMatchesPaCard(stream, paCard, profileName) {
        const streamName = stream.name;
        const cardName = paCard.name;

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
            || streamIndex != cardIndex
        ) {
            // cards don't match, certainly no hit
            return false;
        }

        if (streamProfile != profile) {
            return STREAM_MATCHING.card;
        }

        return STREAM_MATCHING.stream;
    }

    /**
     * Cleanup.
     */
    destroy() {
        this.disconnectAll();
    }
};

Utils.mixin(Cards, EventHandlerDelegate);
