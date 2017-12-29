#!/bin/bash

python svg.py -f ./txt/bible.txt -c grey
python svg.py -f ./txt/purple_cow.txt -c purple
python svg.py -f ./txt/romance_of_lust.txt -c red
python svg.py -f ./txt/the_republic.txt -c black
python svg.py -f ./txt/wizard_of_oz.txt -c yellow

sh convert.sh
