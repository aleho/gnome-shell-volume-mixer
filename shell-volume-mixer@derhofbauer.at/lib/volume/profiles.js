/**
 * Shell Volume Mixer
 *
 * Card / profile settings cycling.
 *
 * @author Alexander Hofbauer <alex@derhofbauer.at>
 */

/* exported Profiles */

const Lib = imports.misc.extensionUtils.getCurrentExtension().imports.lib;
const { SETTING } = Lib.settings;
const Log = Lib.utils.log;


/** @typedef {{
 *   card: string,
 *   profile: string,
 *   switcher: boolean,
 *   show: boolean,
 *   next: paCycledProfile,
 * }} paCycledProfile
 */

var Profiles = class {
    constructor(settings) {
        this._settings = settings;
        this._current = null;

        const data = this._settings.get_array(SETTING.pinned_profiles) || [];
        this._profiles = this._parseProfilesSetting(data);
    }

    /**
     * @return {number}
     */
    count() {
        return this._profiles.length;
    }

    /**
     * @param {paCard} paCard
     */
    setCurrent(paCard) {
        if (!this.count()) {
            return;
        }

        let profile = paCard.card.profile;

        for (let entry of this._profiles) {
            if (entry.card == paCard.name && entry.profile == profile) {
                this._current = entry;
                break;
            }
        }
    }

    /**
     * @returns {?paCycledProfile}
     */
    next() {
        if (!this.count()) {
            return;
        }

        if (!this._current) {
            this._current = this._profiles[0];
        }

        this._current = this._current.next;

        return this._current;
    }

    /**
     * Reads all pinned profiles from settings.
     *
     * @param {string[]} data JSON formatted data
     * @private
     */
    _parseProfilesSetting(data) {
        const profiles = [];

        let count = 0;
        for (let entry of data) {
            let item = null;
            try {
                item = JSON.parse(entry);
            } catch (e) {
                Log.error('Profiles', '_parseProfilesSetting', e);
            }
            if (!item) {
                continue;
            }

            profiles.push(item);

            if (count > 0) {
                profiles[count - 1].next = item;
            }

            count++;
        }

        if (count > 0) {
            profiles[count - 1].next = profiles[0];
        }

        return profiles;
    }
};
