/**
 * Shell Volume Mixer
 *
 * PulseAudio card retrieval utilities.
 *
 * @author Alexander Hofbauer <alex@derhofbauer.at>
 */

/* exported Cards, STREAM_MATCHING */

const ExtensionUtils = imports.misc.extensionUtils;
const Lib = ExtensionUtils.getCurrentExtension().imports.lib;
const Main = imports.ui.main;
const { Gvc, GLib } = imports.gi;
const __ = ExtensionUtils.gettext;

const { EventBroker } = Lib.utils.eventBroker;
const { EventHandlerDelegate } = Lib.utils.eventHandlerDelegate;
const Log = Lib.utils.log;
const Utils = Lib.utils.utils;
const PaHelper = Lib.utils.paHelper;


var STREAM_MATCHING = Object.freeze({
    stream: 1,
    card:   2,
});

const NULL_CARD = 4294967295;

/** @typedef {{
 *   name: String,
 *   description: String,
 *   available: Boolean,
 * }} paProfile
 */

/** @typedef {{
 *   name: String,
 *   description: String,
 *   available: Boolean,
 *   direction: String,
 * }} paPort
 */

/** @typedef {{
 *   index: Number,
 *   alsaCard: Number,
 *   name: String,
 *   description: String,
 *   active_profile: String,
 *   profiles: Object.<string, paProfile>,
 *   ports: Object.<string, paPort>,
 *   fake: Boolean,
 *   card: Object<Gvc.MixerCard>,
 * }} paCard
 */

/**
 * @property {Object.<string, paCard>} _paCards
 * @mixes EventHandlerDelegate
 */
var Cards = class {
    /**
     * @param {Gvc.MixerControl} control
     */
    constructor(control) {
        this._events = new EventBroker();
        this._control = control;
        this.eventHandlerDelegate = control;

        this._initDone = new Promise(resolve => {
            this._initialized = resolve;
        });

        this.connect('state-changed', this._onStateChanged.bind(this), () => {
            return [this._control, this._control.get_state()];
        });

        this._events.connect('debug-cards', (event, callback) => {
            callback(Log.dump(this._paCards));
        });
    }

    /**
     * @returns {boolean}
     * @private
     */
    _controlIsReady() {
        return (this._control && this._control.get_state() === Gvc.MixerControlState.READY);
    }

    /**
     * Callback for state changes.
     */
    _onStateChanged(/* control, state */) {
        if (!this._controlIsReady()) {
            return;
        }

        // noinspection JSIgnoredPromiseFromCall
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
            this._events.emit('extension-disable');

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
     * @param {paCard} paCard
     * @param {Gvc.MixerCard} card
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

        Log.info('Card added', card.index, paCard.name);

        paCard.card = card;
        this._cardNames[paCard.name] = card.index;
    }

    /**
     * Signal for added cards.
     */
    async _onCardAdded(control, index) {
        // we're actually looking up card.index
        let card = control.lookup_card_id(index);
        let paCard = await this.get(index);

        if (!paCard || paCard.fake) {
            try {
                paCard = await PaHelper.getCardByIndex(index);
            } catch (e) {
                Log.error('Cards', '_onCardAdded', 'Calling Python helper failed');
            }

            if (!paCard) {
                Log.error('Cards', '_onCardAdded', 'GVC card not found through Python helper');

                // external script couldn't get card info, fake it
                paCard = {
                    // card name (human name) won't be useful, we'll set it anyway
                    name:     card.name,
                    index:    index,
                    profiles: [],
                    fake:     true
                };
            }

            this._paCards[index] = paCard;
        }

        this._addGvcCard(paCard, card);
    }

    /**
     * Signal for removed cards.
     */
    _onCardRemoved(control, index) {
        if (index in this._paCards) {
            const name = this._paCards[index].name;
            delete this._cardNames[name];
            delete this._paCards[index];
            Log.info('Card removed', index, name);

        } else {
            Log.info('Untracked card not removed', index);
        }
    }


    /**
     * Finds a card by card index.
     *
     * @param {number} index
     * @param {Boolean} forceRefresh
     * @returns {Promise<?paCard>}
     */
    async get(index, forceRefresh = false) {
        if (index === NULL_CARD) {
            return null;
        }

        await this._initDone;

        if (!forceRefresh) {
            if (index in this._paCards) {
                return this._paCards[index];
            }

            Log.info(`Card ${index} not found, querying...`);
        }

        const paCard = await PaHelper.getCardByIndex(index);

        if (!paCard) {
            return null;
        }

        if (this._controlIsReady()) {
            let card = this._control.lookup_card_id(paCard.index);
            this._addGvcCard(paCard, card);
        }

        return paCard;
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
     * @param {Gvc.MixerStream} stream
     * @param {paCard} paCard
     * @param {string} profileName
     * @returns {STREAM_MATCHING}
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

        if (streamAddr !== cardAddr
            || streamIndex !== cardIndex
        ) {
            // cards don't match, certainly no hit
            return false;
        }

        if (streamProfile !== profile) {
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
