#!/bin/bash

# Requires inkscape ( brew install caskformula/caskformula/inkscape )
# Requires optipng

if [ -d "output/" ]; then
    cd output/
    for file in *.svg
    do
        inkscape -z -f "${file}" -e "${file%svg}png" -b "#fff" -d 1080
        if [ "$1" = "-c" ]; then # Run with -c flag to compress png's
            optipng "${file%svg}png" -o1
        fi
    done

else
    echo "No output directory, we're done here"
    exit 0
fi