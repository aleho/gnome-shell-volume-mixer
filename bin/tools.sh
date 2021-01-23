#!/usr/bin/env bash
set -e


WINDOW_MODE=1280x800
X11=0
NAME=""
TMUX_SESSION="gsvm"


function print_help() {
    cat <<- EOT
		Shell Volume Mixer dev toolkit

		    *) test  Runs the extension in a nested session
		         --mode  Sets the nested session window size (default: 1280x800)
		         --x11   Runs a X11/xorg session (defaulting to wayland)

		    *) lg  Toggles Looking Glass via D-Bus

		    *) command  Executes a D-Bus call to debug the running extension
		                (use "help" or see D-Bus interface for methods)

		    *) add-sink  Adds a virtual sink via PulseAudio
		         --name  Virtual sink name

		    *) debug  Enables or disables debugging [true, false]
EOT
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

OPTIONS=$(getopt -n "$0" -o h --long help,mode:,name:,x11 -- "$@")

if [[ $? -ne 0 ]]; then
    print_help
    exit 1
fi

eval set -- "$OPTIONS"

while true; do
    case $1 in
        --mode)
            WINDOW_MODE=$2
            shift
            ;;

        --name)
            NAME=$2
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


function add_virtual_sink() {
    local props
    if [[ -n $NAME ]]; then
        props="sink_properties=device.description=$NAME"
    fi

    pacmd load-module module-null-sink sink_name=svm-virtual-sink "$props"
}

function toggle_looking_glass() {
    gdbus call --session --dest org.gnome.Shell --object-path /org/gnome/Shell --method org.gnome.Shell.Eval 'Main.createLookingGlass() && Main.lookingGlass.toggle();'
}


function enable_debuggin() {
    local enable="$1"

    if [[ $enable == 1 || $enable == true ]]; then
        echo "Enabling debug"
        enable="true"
    else
        echo "Disabling debug"
        enable="false"
    fi

    dconf write /org/gnome/shell/extensions/shell-volume-mixer/debug $enable
}

function has_tmux_session() {
    set +e
    if tmux has-session -t $TMUX_SESSION 2>/dev/null; then
        echo 1
    else
        echo 0
    fi
    set -e
}

function run_nested_session() {
    local manager=""
    if [[ $X11 == 1 ]]; then
        manager="--x11"
    fi

    if [[ $(has_tmux_session) == 1 ]]; then
        tmux kill-session -t $TMUX_SESSION
    fi

    dbus-run-session -- tmux -f bin/tmux.conf new-session -s $TMUX_SESSION "bin/tools.sh run-test-session --mode=${WINDOW_MODE} $manager"
}

function run_test_session() {
    local manager
    if [[ $X11 == 1 ]]; then
        manager="--x11"
    else
        manager="--wayland"
    fi

    set -x
    export MUTTER_DEBUG_NUM_DUMMY_MONITORS=1
    export MUTTER_DEBUG_DUMMY_MODE_SPECS="${WINDOW_MODE}"
    gnome-shell --nested $manager
}

function dbus_command() {
    local command="$1"
    local args="$2"

    if [[ -z $command ]]; then
        echo "Command needed"
        exit 1
    fi

    local command=(
        gdbus call
        --session
        --dest "org.gnome.Shell"
        --object-path "/at/derhofbauer/shell/VolumeMixer"
        --method "at.derhofbauer.shell.VolumeMixer.$command"
    )

    if [[ -n $args ]]; then
        command+=("$args")
    fi

    if [[ $(has_tmux_session) == 1 ]]; then
        local buffer="_cmd_output"

        if [[ -f $buffer ]]; then
            rm $buffer
        fi

        echo "Running command in test session"
        tmux new-window -n dbus-command -t $TMUX_SESSION: "${command[@]}" \; pipe-pane "cat > $buffer"

        sleep .3
        cat $buffer
        rm $buffer

    else
        "${command[@]}"
    fi
}


###


case $COMMAND in
    add-sink)
        add_virtual_sink
        ;;

    lg)
        toggle_looking_glass
        ;;

    test)
        run_nested_session
        ;;

    run-test-session)
        run_test_session
        ;;

    command)
        dbus_command "${@}"
        ;;

    debug)
        enable_debugging "$1"
        ;;

    *)
        print_help
        exit 1
        ;;
esac
