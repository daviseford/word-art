#!/bin/bash

python svg.py -f ./txt/bible.txt -c grey
python svg.py -f ./txt/purple_cow.txt -c "#d40adb"
python svg.py -f ./txt/romance_of_lust.txt -c "#e51919"
python svg.py -f ./txt/the_republic.txt -c black
python svg.py -f ./txt/wizard_of_oz.txt -c "#d1ca0e"

sh convert.sh -c
