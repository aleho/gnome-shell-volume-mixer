# This file is part of GNOME Shell Volume Mixer
# Copyright (C) 2021 Alexander Hofbauer <alex@derhofbauer.at>
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.

import abc
from time import sleep

from . import log
from . import libpulse


class Pulseaudio:
    _pa_state = libpulse.CONTEXT_UNCONNECTED
    _op_done = False

    _iterations_max = 10000
    _iterations_intrv = 0.0001


    _data = {}
    _error = {
        'success': False,
        'error': None,
    }

    def __init__(self):
        self._pa_mainloop = libpulse.mainloop_new()
        self._pa_mainloop_api = libpulse.mainloop_get_api(self._pa_mainloop)

        self._context = libpulse.context_new(self._pa_mainloop_api, b'ShellVolumeMixer')
        self._context_notify_cb = libpulse.context_notify_cb_t(self.context_notify_cb)

        libpulse.context_set_state_callback(self._context, self._context_notify_cb, None)

    def __enter__(self):
        libpulse.context_connect(self._context, None, 0, None)
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        libpulse.context_disconnect(self._context)
        libpulse.context_unref(self._context)
        libpulse.mainloop_free(self._pa_mainloop)

    def context_notify_cb(self, context, userdata):
        try:
            self._pa_state = libpulse.context_get_state(context)
        except Exception:
            self._pa_state = libpulse.CONTEXT_FAILED
            log.debug('Context failed')

    def get_info(self, index=None, name=None):
        log.debug('Querying details...')
        operation = None
        count = 0

        while self._pa_state != libpulse.CONTEXT_TERMINATED:
            if self._op_done:
                break

            if self._pa_state == libpulse.CONTEXT_FAILED:
                self._data = self._error
                self._data['error'] = 'context failed'
                break

            if count >= self._iterations_max:
                log.debug(f'Stopping iterations after {self._iterations_intrv * self._iterations_max}s (bug?)')
                break

            if count > 0 and count % (self._iterations_max / 2) == 0:
                log.debug(f'Delaying after {self._iterations_intrv * count}s (bug?)')
                sleep(2)

            if self._pa_state == libpulse.CONTEXT_READY and operation is None:
                callback = self.build_callback()

                if name:
                    log.debug('Requesting details for', name)
                    operation = self.get_by_name(name.encode('utf8'), callback)

                elif index and index >= 0:
                    log.debug('Requesting details for', index)
                    operation = self.get_by_index(index, callback)

                else:
                    log.debug('Requesting all available data')
                    operation = self.get_all(callback)

            libpulse.mainloop_iterate(self._pa_mainloop, 0, None)
            count += 1
            sleep(self._iterations_intrv)

        if operation:
            libpulse.operation_unref(operation)

        log.debug('Query done')

        return self._data

    def pa_cb(self, context, struct, eol, user_data):
        log.debug('In callback')

        if eol:
            self._op_done = True
            log.debug('All done')
            return

        if not struct or not struct[0]:
            log.debug('No data received for callback')
            return

        item = self.cb_data(struct[0])

        if item and 'index' in item:
            self._data[item['index']] = item

        log.debug('Callback done')

    @abc.abstractmethod
    def build_callback(self):
        return

    @abc.abstractmethod
    def get_by_index(self, index, callback):
        return

    @abc.abstractmethod
    def get_by_name(self, name, callback):
        return

    @abc.abstractmethod
    def get_all(self, callback):
        return

    @abc.abstractmethod
    def cb_data(self, data):
        return None
