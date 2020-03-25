/**
 * Shell Volume Mixer
 *
 * PulseAudio card retrieval utilities.
 *
 * @author Alexander Hofbauer <alex@derhofbauer.at>
 */

/* exported Cards */

const Lib = imports.misc.extensionUtils.getCurrentExtension().imports.lib;
const Main = imports.ui.main;
const { Gvc, GLib } = imports.gi;

const __ = Lib.utils.gettext._;
const { EventHandlerDelegate } = Lib.utils.eventHandlerDelegate;
const Utils = Lib.utils.utils;


/** @typedef {
 *   name: String,
 *   index: Number,
 *   profiles: String[],
 *   fake: Boolean,
 *   card: Object<Gvc.MixerCard>
 * } paCard
 */

/**
 * @property {Object.<string, paCard>} _cards
 */
var Cards = class {
    constructor(control) {
        this._control = control;
        this.eventHandlerDelegate = control;
        this._initCards();

        this.connect('state-changed', this._onStateChanged.bind(this));
        this.connect('card-added', this._onCardAdded.bind(this));
        this.connect('card-removed', this._onCardRemoved.bind(this));
    }

    /**
     * Returns a card by name.
     *
     * @param {Number} index
     * @return {?paCard}
     */
    get(index) {
        return (index in this._cards) ? this._cards[index] : null;
    }

    /**
     * Returns a card by name
     * @param {String} name
     * @return {?paCard}
     */
    getByName(name) {
        const index = this._cardNames[name];

        if (!isNaN(index) && index >= 0) {
            return this.get(index);
        }

        return null;
    }

    /**
     * Retrieves a list of all cards available, using our Python helper.
     * Tries to be error-resistant in case the helper cannot deliver.
     */
    _initCards() {
        this._cards = {};
        this._cardNames = {};

        const cards = this._getCardDetails();

        if (cards && Object.keys(cards).length) {
            this._cards = cards;
            return;
        }

        this._cardsRetries = (this._cardsRetries || 4) - 1;

        if (this._cardsRetries <= 0) {
            Utils.error('cards', '_initCards', 'Could not retrieve PA card details with Python helper script');
            Main.notifyError('Volume Mixer', __('Querying PulseAudio sound cards failed, disabling extension'));
            Lib.main.Extension.disable();

            return;
        }

        this._cardsRetryId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, () => {
            this._cardsRetryId = 0;
            this._initCards();

            return GLib.SOURCE_REMOVE;
        });
    }

    /**
     * @return {?Object.<string, paCard>}
     * @private
     */
    _getCardDetails() {
        let cards = Utils.getCards();

        if (!cards) {
            return null;
        }

        for (let k in cards) {
            let card = cards[k];

            if (!card) {
                continue;
            }

            if (!card.profiles || !card.profiles.length) {
                card.profiles = {};
                continue;
            }

            let profiles = {};

            for (let profile of card.profiles) {
                profiles[profile.name] = profile.description;
            }
            card.profiles = profiles;
        }

        return cards;
    }

    /**
     * Adds a card to our array of cards.
     *
     * @param {Object} card Card to add.
     */
    _addCard(card) {
        let index = card.index;

        if (!this._cards[index] || this._cards[index].fake) {
            let paCards = Utils.getCards();

            if (!paCards) {
                Utils.error('cards', '_addCard', 'Could not retrieve PA card details');
            } else {
                this._cards[index] = paCards[index];
            }
        }

        if (!this._cards[index]) {
            Utils.error('cards', '_addCard', 'GVC card not found through Python helper');

            // external script couldn't get card info, fake it
            this._cards[index] = {
                // card name (human name) won't be useful, we'll set it anyway
                name: card.name,
                index: index,
                profiles: [],
                fake: true
            };
        }

        let paCard = this._cards[index];
        paCard.card = card;

        this._cardNames[paCard.name] = index;
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
        if (index in this._cards) {
            delete this._cardNames[this._cards[index].name];
            delete this._cards[index];
        }
    }

    /**
     * Callback for state changes.
     */
    _onStateChanged(control, state) {
        if (state !== Gvc.MixerControlState.READY) {
            return;
        }

        let cards = this._control.get_cards();
        for (let card of cards) {
            this._addCard(card);
        }
    }

    /**
     * Cleanup.
     */
    destroy() {
        if (this._cardsRetryId) {
            GLib.source_remove(this._cardsRetryId);
            this._cardsRetryId = 0;
        }

        this.disconnectAll();
    }
};

Utils.mixin(Cards, EventHandlerDelegate);
