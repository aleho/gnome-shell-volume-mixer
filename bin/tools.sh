#!/usr/bin/env bash
set -e


WINDOW_MODE=1280x800
X11=0


function print_help() {
    echo "Shell Volume Mixer dev toolkit"
    echo ""
    echo "    test  Runs the extension in a nested session"
    echo "      --mode     Sets the nested session window size (default: 1280x800)"
    echo "      --x11      Runs a X11/xorg session (defaulting to wayland)"
    echo ""
    echo "    lg  Toggles Looking Glass via DBus"
}

###

COMMAND=$1
if [[ -z $COMMAND ]]; then
    echo "Command required"
    echo ""
    print_help
    exit 1
fi

shift

OPTIONS=$(getopt -n $0 -o h --long help,mode:,x11 -- "$@")

if [[ $? -ne 0 ]]; then
    print_help
    exit 1
fi

eval set -- "$OPTIONS"

while true; do
    case $1 in
        --mode)
            WINDOW_MODE=$2;
            shift
            ;;

        --x11)
            X11=1
            ;;


        -h|--help)
            print_help
            exit
            ;;

        --)
            shift
            break
            ;;
        *)
            print_help
            exit 1
            ;;
    esac

    shift
done


###

function toggle_looking_glass() {
    gdbus call --session --dest org.gnome.Shell --object-path /org/gnome/Shell --method org.gnome.Shell.Eval 'Main.createLookingGlass() && Main.lookingGlass.toggle();'
}

function run_nested_session() {
    local mode
    if [[ $X11 == 1 ]]; then
        mode="--x11"
    else
        mode="--wayland"
    fi

    dbus-run-session -- env MUTTER_DEBUG_NUM_DUMMY_MONITORS=1 MUTTER_DEBUG_DUMMY_MODE_SPECS=${WINDOW_MODE} gnome-shell --nested $mode
}

###

case $COMMAND in
    lg)
        toggle_looking_glass
        ;;

    test)
        run_nested_session
        ;;

    *)
        print_help
        exit 1
        ;;
esac

