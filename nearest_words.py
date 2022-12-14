# Compute top-k nearest neighbor words for each word in wordvecs model
# Current algorithm is naive with O(n^2) comparisons,
# O(log k) per comparison to maintain top-k list

import numpy as np
from heapq import *
import sys

K = 10  # top-k words

def read_model(model_path, normalize=True):
    with open(model_path) as f:
        model_lines = f.readlines()

    N = len(model_lines)  # number of words
    words = [""] * N  # word index
    DIM = len(model_lines[0].strip().split()) - 1
    assert DIM >= 50  # make sure we got rid of first line of fasttext format
    vecs = np.empty((N, DIM))  # words indexed by row

    for i in range(N):
        line = model_lines[i].strip().split()
        words[i] = line[0]
        v = np.array(line[1:], dtype=np.float)
        if normalize:
            vecs[i,] = v / np.linalg.norm(v)  # normalize vecs

    return words, vecs


def main():
    words, vecs = read_model(sys.argv[1], normalize=True)
    N = len(words)

    # too much memory to store all vector distances, so compute on-the-fly
    for i in range(N):
        # compute all dot products (cos similarities) for word i vs all other words
        sims = vecs @ vecs[i,]

        # create (sim, index) key-value pairs, excluding word i itself
        pairs = [(sims[j], j) for j in range(N) if j != i]

        # maintain top-k largest similarities using a *min* heap
        # continuously remove min element, at the end we have all the max elements
        top_pairs = []
        for pair in pairs:
            if len(top_pairs) < K:  # heap isn't full yet
                heappush(top_pairs, pair)
            elif pair > top_pairs[0]:
                heapreplace(top_pairs, pair)

        nearest_words = [words[pair[1]] for pair in nlargest(K, top_pairs)]
        print(words[i], " ".join(map(str, nearest_words)))


main()