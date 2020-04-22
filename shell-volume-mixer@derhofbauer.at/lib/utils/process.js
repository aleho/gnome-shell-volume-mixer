/**
 * Shell Volume Mixer
 *
 * Process utility.
 *
 * @author Alexander Hofbauer <alex@derhofbauer.at>
 */

/* exported execAsync */

const { Gio } = imports.gi;

/**
 * Executes an async command.
 *
 * @param {Array} command
 * @returns {Promise<[int, string, string]>|Promise<Error>}
 */
async function execAsync(command) {
    const process = new Gio.Subprocess({
        argv:  command.map(arg => arg.toString()),
        flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
    });

    process.init(null);

    return new Promise((resolve, reject) => {
        process.communicate_utf8_async(null, null, (process, result) => {
            try {
                const [success, stdout, stderr] = process.communicate_utf8_finish(result);
                const ret = process.get_exit_status();

                if (!success) {
                    reject(Error('Error spawning subprocess'));
                } else {
                    resolve([ret, stdout, stderr]);
                }

            } catch (e) {
                reject(e);
            }
        });
    });
}
