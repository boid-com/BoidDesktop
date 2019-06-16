#! /bin/sh

function make_boinc_user() {
    DarwinVersion=`uname -r`;
    DarwinMajorVersion=`echo $DarwinVersion | sed 's/\([0-9]*\)[.].*/\1/' `;
    if [ "$DarwinMajorVersion" -gt 8 ]; then
        baseID="501"
    else
        baseID="25"
    fi

    name=$(dscl . search /groups RecordName $1 | cut -f1 -s)
    if [ "$name" = "$1" ] ; then
        gid=$(dscl . read /groups/$1 PrimaryGroupID | cut -d" " -f2 -s)
    else
        gid="$baseID"
        while true; do
            name=$(dscl . search /groups PrimaryGroupID $gid | cut -f1 -s)
            if [ -z "$name" ] ; then
                break
            fi
            gid=$[$gid +1]
        done
        dscl . -create /groups/$1
        dscl . -create /groups/$1 gid $gid
    fi
    
    name=$(dscl . search /users RecordName $1 | cut -f1 -s)
    if [ -z "$name" ] ; then

        uid=$gid
        name=$(dscl . search /users UniqueID $uid | cut -f1 -s)
        if [ -n "$name" ] ; then
            uid="$baseID"
            while true; do
                name=$(dscl . search /users UniqueID $uid | cut -f1 -s)
                if [ -z "$name" ] ; then
                    break
                fi
                uid=$[$uid +1]
            done
        fi

        dscl . -create /users/$1
        dscl . -create /users/$1 uid $uid
        dscl . -create /users/$1 shell /usr/bin/false
        dscl . -create /users/$1 home /var/empty
        dscl . -create /users/$1 gid $gid
    fi

    dscl . -create /users/boinc_master RealName $1
    dscl . -change /users/boinc_master RealName $1 ""
}

function make_boinc_users() {
    make_boinc_user boinc_master
    make_boinc_user boinc_project
}

function check_login() {
    if [ `whoami` != 'root' ]
    then
        echo 'This script must be run as root'
        exit
    fi
}

function set_perm() {
    chown $2:$3 "$1"
    chmod $4 "$1"
}

function set_perm_recursive() {
    chown -R $2:$3 "$1"
    chmod -R $4 "$1"
}

function set_perm_dir() {
    for file in $(ls "$1")
    do
        path="$1/${file}"
        set_perm "${path}" $2 $3 $4
    done
}

function update_nested_dirs() {
   for file in $(ls "$1")
    do
	if [ -d "${1}/${file}" ] ; then
        chmod u+x,g+x,o+x "${1}/${file}"
		update_nested_dirs "${1}/${file}"
	fi
    done
}

check_login

echo "Changing directory ${1} file ownership to user and group boinc_master"

if [ ! -x "${1}/switcher/switcher" ]
then
    echo "Can't find switcher application in directory ${1}; exiting"
    exit
fi

make_boinc_users

dscl . -merge /groups/boinc_master GroupMembership "$(LOGNAME)"

dscl . -merge /groups/boinc_project GroupMembership "$(LOGNAME)"

set_perm_recursive "$1" boinc_master boinc_master u+rw,g+rw,o+r-w
if [ -f "$1/gui_rpc_auth.cfg" ] ; then
    set_perm "$1/gui_rpc_auth.cfg" boinc_master boinc_master 0660
fi
chmod 0660 "$1"/*.xml
if [ -f "$1/ss_config.xml" ] ; then
    set_perm "$1/ss_config.xml" boinc_master boinc_master 0661
fi

set_perm "$1" boinc_master boinc_master 0771

if [ -d "$1/projects" ] ; then
    set_perm_recursive "$1/projects" boinc_master boinc_project u+rw,g+rw,o+r-w
    set_perm "$1/projects" boinc_master boinc_project 0770
    update_nested_dirs "$1/projects"
fi

if [ -d "$1/slots" ] ; then
    set_perm_recursive "$1/slots" boinc_master boinc_project u+rw,g+rw,o+r-w
    set_perm "$1/slots" boinc_master boinc_project 0770
    update_nested_dirs "$1/slots"
fi

if [ -f "$1/switcher/AppStats" ] ; then 
set_perm "$1/switcher/AppStats" root boinc_master 4550
fi

set_perm "$1/switcher/switcher" root boinc_master 04050
set_perm "$1/switcher/setprojectgrp" boinc_master boinc_project 2500
set_perm "$1/switcher" boinc_master boinc_master 0550

if [ -d "$1/locale" ] ; then
    set_perm_recursive "$1/locale" boinc_master boinc_master +X
    set_perm_recursive "$1/locale" boinc_master boinc_master u+r-w,g+r-w,o+r-w
fi

if [ -f "$1/boinc" ] ; then
    set_perm "$1/boinc" boinc_master boinc_master 6555       # boinc client
fi

if [ -f "$1/boinccmd" ] ; then
    set_perm "$1/boinccmd" boinc_master boinc_master 0550
fi

if [ -f "$1/ss_config.xml" ] ; then
    set_perm "$1/ss_config.xml" boinc_master boinc_master 0664
fi

if [ -x /Applications/BOINCManager.app/Contents/MacOS/BOINCManager ] ; then 
    set_perm  /Applications/BOINCManager.app/Contents/MacOS/BOINCManager boinc_master boinc_master 0555
fi

if [ -x /Applications/BOINCManager.app/Contents/Resources/boinc ] ; then 
    set_perm /Applications/BOINCManager.app/Contents/Resources/boinc boinc_master boinc_master 6555
fi

if [ -x "/Library/Screen Savers/BOINCSaver.saver/Contents/Resources/gfx_switcher" ] ; then 
    set_perm  "/Library/Screen Savers/BOINCSaver.saver/Contents/Resources/gfx_switcher" root boinc_master 4555
fi
