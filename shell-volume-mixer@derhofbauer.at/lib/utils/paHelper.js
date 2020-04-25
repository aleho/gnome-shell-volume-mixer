/**
 * Shell Volume Mixer
 *
 * PulseAudio helper.
 *
 * @author Alexander Hofbauer <alex@derhofbauer.at>
 */

/* exported getCards, getCardByIndex */

const Lib = imports.misc.extensionUtils.getCurrentExtension().imports.lib;
const Log = Lib.utils.log;
const Process = Lib.utils.process;
const Utils = Lib.utils.utils;

const PYTHON_HELPER_PATH = 'pautils/cardinfo.py';

let PYTHON = undefined;

async function findPython() {
    if (PYTHON === undefined) {
        for (let python of ['python3', 'python']) {
            let ret;
            let stderr;

            try {
                [ret, , stderr] = await Process.execAsync(['/usr/bin/env', python]);

                if (ret === 0) {
                    PYTHON = python;
                    break;
                }

                Log.error('paHelper', 'findPython', `${python} not found: ${stderr} (${ret})`);

            } catch (e) {
                PYTHON = false;
                Log.error('paHelper', 'findPython', e);
            }
        }
    }

    return PYTHON;
}

/**
 * @param {?number} [index=undefined]
 * @returns {Promise<?Object.<string, paCard>>} JSON object of the output
 */
async function execHelper(index = undefined) {
    const paUtilPath = Utils.getExtensionPath(PYTHON_HELPER_PATH);

    if (!paUtilPath) {
        Log.error('paHelper', 'execHelper', `Could not find PulseAudio utility in extension path ${PYTHON_HELPER_PATH}`);
        return null;
    }

    const python = await findPython();

    if (!python) {
        return null;
    }

    const args = ['/usr/bin/env', python, paUtilPath];

    if (!isNaN(index)) {
        args.push(index);
    }


    let ret;
    let stdout;
    let stderr;
    let pythonError;

    try {
        [ret, stdout, stderr] = await Process.execAsync(args);
    } catch (e) {
        pythonError = e;
    }

    if (pythonError) {
        Log.error('paHelper', 'execHelper', pythonError);
        if (stderr) {
            Log.error('paHelper', 'execHelper', `(${ret}) ${stderr}`);
        }
    }

    if (!stdout) {
        return null;
    }

    let data = null;
    try {
        data = JSON.parse(stdout);
    } catch (e) {
        Log.error('paHelper', 'execHelper', e);
        return null;
    }

    if (!data || typeof data !== 'object') {
        Log.error('paHelper', 'execHelper', 'Invalid response');
        return null;
    }

    if ('success' in data && data.success === false) {
        Log.error('paHelper', 'execHelper', `Error: ${data.error}`);
        return null;
    }

    return data;
}

/**
 * Calls the Python helper script to get details about all available cards and their profiles.
 *
 * @returns {Promise<?Object.<string, paCard>>} JSON object of the output
 */
async function getCards() {
    return await execHelper();
}

/**
 * Calls the Python helper script to get more details about a card and its profiles.
 *
 * @param {number} index
 * @returns {Promise<?paCard>} JSON object of the output
 */
async function getCardByIndex(index) {
    const data = await execHelper(index);

    if (data && data[index]) {
        return data[index];
    }

    return null;
}
