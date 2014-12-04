#!/usr/bin/python
#
# Usage: cardinfo.py [card_index] [card_name]
#
# Output is either a card object or an array of all cards available, depending
# on whether a card index / name was passed or no parameters at all.
#
# This file is part of GNOME Shell Volume Mixer
# Copyright (C) 2014 Alexander Hofbauer <alex@derhofbauer.at>
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

import json
import sys

import pa


class PulseAudio():
    _name = 'ShellVolumeMixer'
    _cards = None
    _error = {
        'success': False,
        'error': None,
    }
    _card_op_done = None
    _pa_state = pa.CONTEXT_UNCONNECTED


    def __init__(self):
        self.pa_mainloop = pa.mainloop_new()
        self.pa_mainloop_api = pa.mainloop_get_api(self.pa_mainloop)

        self._context = pa.context_new(self.pa_mainloop_api, b'self._name')
        self._context_notify_cb = pa.context_notify_cb_t(self.context_notify_cb)

        pa.context_set_state_callback(self._context, self._context_notify_cb, None)


    def __enter__(self):
        pa.context_connect(self._context, None, 0, None)
        return self


    def __exit__(self, eType, eValue, eTrace):
        pa.context_disconnect(self._context)
        pa.context_unref(self._context)
        pa.mainloop_free(self.pa_mainloop)


    def get_card_info(self, index = None, name = None):
        self._cards = {}
        self._card_op_done = False
        operation = None

        loops = 1000
        while loops > 0:
            loops -= 1

            if self._pa_state == pa.CONTEXT_FAILED:
                self._cards = self._error
                self._cards['error'] = 'context failed'
                break

            if self._pa_state == pa.CONTEXT_TERMINATED:
                self._cards = self._error
                self._cards['error'] = 'context terminated'
                break

            if self._card_op_done == True:
                break

            if self._pa_state == pa.CONTEXT_READY and not operation:
                self._pa_card_info_cb = pa.card_info_cb_t(self.pa_card_info_cb)

                if name:
                    operation = pa.context_get_card_info_by_name(self._context,
                            name, self._pa_card_info_cb, None)

                elif index and index >= 0:
                    operation = pa.context_get_card_info_by_index(self._context,
                            index, self._pa_card_info_cb, None)

                else:
                    operation = pa.context_get_card_info_list(self._context,
                            self._pa_card_info_cb, None)


            pa.mainloop_iterate(self.pa_mainloop, 0, None)


        if operation:
            pa.operation_unref(operation)


        return self._cards


    def pa_card_info_cb(self, context, struct, cindex, user_data):
        if not struct or not struct[0]:
            return

        pacard = struct[0]
        description = None

        cardName = pacard.name.decode('utf8')

        try:
            description = pa.proplist_gets(pacard.proplist, b'device.description')
        except:
            pass

        if not description:
            try:
                description = pa.proplist_gets(pacard.proplist, b'alsa.card_name')
            except:
                pass

        if description:
            description = description.decode('utf8')
        else:
            description = cardName


        card = {
            'index': pacard.index,
            'name': cardName,
            'description': description,
            'active_profile': None,
            'profiles': [
            ],
        }

        if pacard.active_profile and pacard.active_profile[0]:
            ap = pacard.active_profile[0]
            card['active_profile'] = ap.name.decode('utf8')

        for index in range(0, pacard.n_profiles):
            if not pacard.profiles2[index] or not pacard.profiles2[index][0]:
                continue
            profile = pacard.profiles2[index][0]
            card['profiles'].append({
                'name': profile.name.decode('utf8'),
                'description': profile.description.decode('utf8'),
                'available': bool(profile.available),
            })

        self._cards[card['index']] = card
        self._card_op_done = True


    def context_notify_cb(self, context, userdata):
        try:
            self._pa_state = pa.context_get_state(context)

        except Exception:
            self._pa_state = pa.CONTEXT_FAILED



index = name = None

if len(sys.argv) > 1:
    if sys.argv[1].isdigit():
        index = int(sys.argv[1])
    else:
        name = sys.argv[1]


with PulseAudio() as pulse:
    info = pulse.get_card_info(index = index, name = name)
#    print(json.dumps(info, indent = 4, separators = (',', ': ')))
    print(json.dumps(info))
