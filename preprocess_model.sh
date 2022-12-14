#!/bin/sh
# example of creating smaller model from NLPL model release

# from issue #1: words to be used defined as only alpha characters
# since words are sorted by frequency, only keep most common casing of a word
# from #2: make all words lowercase
# take first n many words, skipping first line of fasttext format
tail -n +2 wiki-news-300d-1M.vec |
grep -P "^[a-zA-Z]+ " |
awk '!a[tolower($1)]++' |
tr '[:upper:]' '[:lower:]' | # could do lowercasing earlier
head -n50000 > wordvecs50k.vec

# compress for github
gzip -c wordvecs50k.vec > wordvecs50k.vec.gz

# for manual analysis, get list of included words
cut -d' ' -f1 wordvecs50k.vec > words50k.txt

# run nearest neighbors precomputation (#4) (and time for fun)
time python3 nearest_words.py wordvecs50k.vec > nearest_words.txt