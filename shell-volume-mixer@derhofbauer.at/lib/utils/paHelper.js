/**
 * Shell Volume Mixer
 *
 * PulseAudio helper.
 *
 * @author Alexander Hofbauer <alex@derhofbauer.at>
 */

/* exported getCards */

const Lib = imports.misc.extensionUtils.getCurrentExtension().imports.lib;
const Log = Lib.utils.log;
const Process = Lib.utils.process;
const Utils = Lib.utils.utils;

const PYTHON_HELPER_PATH = 'pautils/cardinfo.py';


/**
 * Calls the Python helper script to get more details about a card and its
 * profiles.
 *
 * @return {Promise<?Object.<string, paCard>>} JSON object of the output
 */
async function getCards() {
    const paUtilPath = Utils.getExtensionPath(PYTHON_HELPER_PATH);

    if (!paUtilPath) {
        Log.error('utils', 'getCards', `Could not find PulseAudio utility in extension path ${PYTHON_HELPER_PATH}`);
        return null;
    }

    let ret;
    let stdout;
    let stderr;
    let pythonError;

    for (let python of ['python3', 'python']) {
        try {
            [ret, stdout, stderr] = await Process.execAsync(['/usr/bin/env', python, paUtilPath]);
        } catch (e) {
            pythonError = e;
        }
    }

    if (pythonError) {
        Log.error('utils', 'getCards', `(${ret}, ${stderr}) ${pythonError.message}`);
    }

    if (!stdout) {
        return null;
    }

    let data = null;
    try {
        data = JSON.parse(stdout);
    } catch (e) {
        Log.error('utils', 'getCards', e.message);
        return null;
    }

    if (!data || typeof data !== 'object') {
        Log.error('utils', 'getCards', 'Invalid response');
        return null;
    }

    if ('success' in data && data.success === false) {
        Log.error('utils', 'getCards', `Error: ${data.error}`);
        return null;
    }

    return data;
}
