#!/usr/bin/env python3
#
# Usage: query.py [cards|sinks] [index or name, omit for all data]
#
# Output is either a JSON object or an array of all data available, depending on
# whether an index / name was passed or no parameters at all.
#
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

import json
import sys

from lib import log
from lib.cards import Cards
from lib.sinks import Sinks
from lib.libpulse import NULL_ID

if len(sys.argv) < 2:
    print('Need a type to query')
    sys.exit(1)

op_type = sys.argv[1]
index = name = None

if len(sys.argv) > 2:
    filter_arg = sys.argv[2]
    if filter_arg.isdigit():
        index = int(filter_arg)
    else:
        name = filter_arg


if index == NULL_ID:
    result = {}

elif op_type == 'cards':
    with Cards() as cards:
        result = cards.get_info(index=index, name=name)

elif op_type == 'sinks':
    with Sinks() as sinks:
        result = sinks.get_info(index=index, name=name)

else:
    print('Invalid type', op_type, 'requested')
    sys.exit(1)


print(json.dumps(result, indent=4 if log.DEBUG else None))
