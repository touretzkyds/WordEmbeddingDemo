"use strict";

// Class currently holding all controller and model functionality (God class?)
class Demo {
    constructor() {
        this.MAGNIFY_WINDOW = 0; // window size for magnified view
        this.HEATMAP_MIN = -0.2;  // min and max for heatmap colorscale
        this.HEATMAP_MAX = 0.2;
        this.VECTOR_DISPLAY_SIZE = 6;
        this.EMPTY_FEATURE_NAME = "[empty]";
        this.MODEL_DIMENSION_FALLBACK = 300;

        this.embeddingSources = {
            "wordvecs50k": {
                label: "Word2Vec 300dim",
                vectorsUrl: "wordvecs50k.vec.gz",
                nearestWordsUrl: "nearest_words.txt",
                compressed: true,
                available: true,
                expectedBytes: 35111406
            },
            "glove6b300d": {
                label: "GloVe 300dim",
                vectorsUrl: "glove.6B.300d.vec.gz",
                nearestWordsUrl: "nearest_words_glove.6B.300d.txt",
                compressed: true,
                available: true,
                expectedBytes: 38449207
            }
        };
        this.activeSourceId = "wordvecs50k";
        this.modelReady = false;
        this.isLoadingSource = false;
        this.listenersBound = false;

        // words involved in the computation of analogy (#12)
        this.analogy = {};  // default empty Object
        
        // words to show in vector display
        this.defaultVectorWords = ["queen", "king", "girl", "boy", "woman", "man"];
        this.vectorWords = this.defaultVectorWords.slice();
        
        // empty words array for checking if vector words are empty (#35)
        this.emptyVector = new Array(this.VECTOR_DISPLAY_SIZE).fill(this.EMPTY_FEATURE_NAME);

        // selected word in scatterplot (empty string represents nothing selected)
        this.selectedWord = "";

        // saved hoverX for use in magnify view
        this.hoverX = this.MAGNIFY_WINDOW;

        // main word to vector Map (may include pseudo-word vectors like "man+woman")
        this.vecs = new Map();

        // Set of actual words found in model (no pseudo-words)
        this.vocab = new Set();

        this.vecsDim = 0; // word vector dim
        this.nearestWords = new Map(); // nearest words Map

        // words plotted on scatter plot
        // changes from original demo: replace "refrigerator" with "chair" and "computer"
        this.defaultScatterWords = ['man', 'woman', 'boy', 'girl', 'king', 'queen', 'prince', 'princess', 'nephew', 'niece',
            'uncle', 'aunt', 'father', 'mother', 'son', 'daughter', 'husband', 'wife', 'chair', 'computer'];
        this.scatterWords = this.defaultScatterWords.slice();

        // vector calculations and plotting, including residual (issue #3)
        // features 0 and 1 are user defined, feature 2 is residual
        this.features = Array(3); // init Array length doesn't actually matter

        // user-supplied names of features 0 and 1
        this.defaultFeatureNames = ["[gender]", "[age]", "[royalty]", "[number]", "[part-of]", "[tense]", "[capital]", "[]", "[]"]; // leave room for two user-defined semantic dimensions (#29)
        this.featureNames = this.defaultFeatureNames.slice();

        // lists of word pairs to be used for creating features
        this.defaultFeatureWordsPairs = [
            [
                ["king", "prince",  "husband", "father", "son",     "uncle", "nephew", "boy",  "male", "his"],
                ["queen", "princess", "wife",   "mother", "daughter", "aunt", "niece", "girl", "female", "her"]
            ],
            [
                ["man", "woman", "king",  "queen",   "father", "mother",  "uncle",   "aunt"],
                ["boy", "girl", "prince", "princess", "son",   "daughter", "nephew", "niece"]
            ],
            [
                ["king", "queen", "prince", "princess"],
                ["man",  "woman", "boy",    "girl"]
            ],
            [
                ["boys","girls","cats","puppies","computers","mice"],
                ["boy", "girl", "cat", "puppy",  "computer", "mouse"]
            ],
            [
                ["sentence", "whole", "universe", "body", "country", "sentence"],
                ["word",    "piece",  "planet",   "limb", "province", "word"]
            ],
            [
                ["bought", "shone", "tried", "sold", "sought", "walked", "moved"],
                ["buy",    "shine", "try",   "sell", "seek",   "walk",   "move"]
            ],
            [
                ["texas",  "california", "egypt", "china", "italy"],
                ["austin", "sacramento", "cairo", "beijing",  "rome"]
            ],
            // leave room for two user-defined semantic dimensions (#29)
            [
                [],
                []
            ],
            [
                [],
                []
            ]
        ];
        this.featureWordsPairs = this.cloneFeatureWordsPairs(this.defaultFeatureWordsPairs);

        // default feature names (#29)
        this.idx0 = 0;
        this.idx1 = 1;
        this.selectedFeatureNames = ["[gender]", "[age]"];
        // default feature dirty status
        this.featureDirty = new Array(this.defaultFeatureNames.length).fill(false);
        // default feature button colors for saved, dirty, pending, and failed status
        this.featureButtonColors = {
            saved: {background: "#e6e6e6", text: "black"},
            dirty: {background: "#7CFC00", text: "black"},
            pending: {background: "black", text: "white"},
            failed: {background: "black", text: "white"},
        };

        // default settings for magnify plot vector display numbers (#36)
        this.formatMagnitudePlot("default")

        // create placeholder for similarity lines
        this.similarityLines = [];
    }

    cloneFeatureWordsPairs(featureWordsPairs) {
        return featureWordsPairs.map(featurePair =>
            featurePair.map(wordList => wordList.slice())
        );
    }

    getEmptyVector() {
        const dim = this.vecsDim || this.MODEL_DIMENSION_FALLBACK;
        return new Vector(new Array(dim).fill(0));
    }

    setSourceStatus(message, isError = false) {
        const sourceStatus = document.getElementById("embedding-source-status");
        if (!sourceStatus) {
            return;
        }
        sourceStatus.innerText = message;
        sourceStatus.style.color = isError ? "darkred" : "darkgreen";
    }

    markModelUnavailable(message) {
        this.modelReady = false;
        this.setSourceStatus(message, true);
    }

    guardModelReady(message = "Model is not ready yet.") {
        if (!this.modelReady) {
            this.setSourceStatus(message, true);
            return false;
        }
        return true;
    }

    // Yield once to the event loop so the browser can repaint pending DOM
    // updates the loading-bar before resume
    // setTimeout(0) is used instead of Promise.resolve() since microtasks do not allow the rendering steps to run between them
    yieldUI() {
        return new Promise(r => setTimeout(r, 0));
    }

    // Parses raw word-vector text
    // onProgress (optional) is called with a 0..1 fraction at each yield point
    async parseRawVecs(text, onProgress) {
        const vecs = new Map();
        const vocab = new Set();
        let vecsDim = 0;

        const lines = text.trim().split(/\n/);
        const total = lines.length;

        // ~2000 rows per yield gives ~25 progress updates for a 50k file
        const CHUNK_SIZE = 2000;

        for (let i = 0; i < total; i++) {
            const entries = lines[i].trim().split(/\s+/);
            if (entries.length < 2) {
                continue;
            }
            const word = entries[0];
            const rawVec = entries.slice(1).map(Number);
            if (rawVec.some(value => Number.isNaN(value))) {
                throw new Error(`Invalid vector row for "${word}"`);
            }
            vecsDim = rawVec.length;
            const vec = new Vector(rawVec).unit();
            vocab.add(word);
            vecs.set(word, vec);

            if (i % CHUNK_SIZE === CHUNK_SIZE - 1 && i < total - 1) {
                if (typeof onProgress === "function") {
                    onProgress((i + 1) / total);
                }
                await this.yieldUI();
            }
        }

        if (vecs.size === 0 || vecsDim === 0) {
            throw new Error("No vectors were parsed.");
        }

        if (typeof onProgress === "function") {
            onProgress(1);
        }

        return {vecs, vocab, vecsDim};
    }

    parseNearestWords(text) {
        const nearestWords = new Map();
        const lines = text.trim().split(/\n/);
        for (const line of lines) {
            const entries = line.trim().split(/\s+/);
            if (entries.length === 0) {
                continue;
            }
            const target = entries[0];
            const words = entries.slice(1);
            nearestWords.set(target, words);
        }
        return nearestWords;
    }

    sanitizeFeatureWordsByVocab() {
        this.featureWordsPairs = this.featureWordsPairs.map(featurePair => {
            const [wordList0, wordList1] = featurePair;
            const filtered0 = [];
            const filtered1 = [];
            const maxLen = Math.min(wordList0.length, wordList1.length);
            for (let i = 0; i < maxLen; i++) {
                const word0 = wordList0[i];
                const word1 = wordList1[i];
                if (this.vocab.has(word0) && this.vocab.has(word1)) {
                    filtered0.push(word0);
                    filtered1.push(word1);
                }
            }
            return [filtered0, filtered1];
        });
    }

    resetDropdownAxes() {
        for (let i = 0; i <= 8; i++) {
            const dropdown = document.getElementById(`dropdown${i}`);
            if (!dropdown) {
                continue;
            }
            if (i === 0) {
                dropdown.value = "value1";
            } else if (i === 1) {
                dropdown.value = "value2";
            } else {
                dropdown.value = "defaultValue";
            }
        }
    }

    resetStateForSource(preferredScatterWords = null) {
        this.analogy = {};
        this.selectedWord = "";
        this.dataScatter = null;
        this.plotWords = [];
        this.hoverX = 0;

        this.idx0 = 0;
        this.idx1 = 1;

        this.featureNames = this.defaultFeatureNames.slice();
        this.selectedFeatureNames = [this.featureNames[this.idx0], this.featureNames[this.idx1]];
        this.featureWordsPairs = this.cloneFeatureWordsPairs(this.defaultFeatureWordsPairs);
        this.featureDirty = new Array(this.defaultFeatureNames.length).fill(false);
        this.sanitizeFeatureWordsByVocab();

        const scatterSeed = Array.isArray(preferredScatterWords)
            ? preferredScatterWords
            : this.defaultScatterWords;
        this.scatterWords = [...new Set(scatterSeed)].filter(word => this.vocab.has(word));
        this.vectorWords = this.defaultVectorWords.map(word =>
            this.vocab.has(word) ? word : this.EMPTY_FEATURE_NAME
        );

        this.formatMagnitudePlot("default");
    }

    applyLoadedSource(sourceId, modelState, nearestWords, options = {}) {
        this.vecs = modelState.vecs;
        this.vocab = modelState.vocab;
        this.vecsDim = modelState.vecsDim;
        this.nearestWords = nearestWords;
        this.modelReady = true;

        this.resetStateForSource(options.preferredScatterWords);

        this.vecs.set(this.EMPTY_FEATURE_NAME, this.getEmptyVector());

        this.fillDimensionDefault();
        this.resetDropdownAxes();
        this.plotScatter(true);
        this.plotVector(true);
        this.processFeatureInput();
        this.resetFeatureButtonStates();

        this.removeSimilarityLines();
        this.initSimilarityLines();

        this.highlightVectorAxis(false);
        this.activeSourceId = sourceId;
    }

    bindPersistentListeners() {
        if (this.listenersBound) {
            return;
        }

        const analogyDetails = document.getElementById("analogy-details");
        analogyDetails.ontoggle = () => this.handleAnalogyToggle(analogyDetails);

        const plotly_scatter = document.getElementById("plotly-scatter");
        plotly_scatter.addEventListener("mouseup", () => {
            if (!this.modelReady) {
                return;
            }
            this.plotScatter();
        });

        plotly_scatter.addEventListener("mousedown", () => {
            if (!this.modelReady) {
                return;
            }
            this.updateSimilarityLines(true, false);
        });

        this.addOverlayListener();

        const sourceSelect = document.getElementById("embedding-source-select");
        sourceSelect.addEventListener("change", (event) => {
            this.onEmbeddingSourceChange(event);
        });

        const userFeaturesForm = document.getElementById("user-features-form");
        userFeaturesForm.addEventListener("input", (event) => {
            this.handleFeatureDraftChange(event);
        });
        userFeaturesForm.addEventListener("change", (event) => {
            this.handleFeatureDraftChange(event);
        });

        this.listenersBound = true;
    }

    setFeatureButtonState(featureIdx, state) {
        const button = document.getElementById(`feature-button${featureIdx}`);
        const colorConfig = this.featureButtonColors[state];
        if (!button || !colorConfig) {
            return;
        }
        button.style.backgroundColor = colorConfig.background;
        button.style.color = colorConfig.text;
    }

    resetFeatureButtonStates() {
        for (let i = 0; i < this.defaultFeatureNames.length; i++) {
            this.featureDirty[i] = false;
            this.setFeatureButtonState(i, "saved");
        }
    }

    markFeatureDirty(featureIdx) {
        if (featureIdx < 0 || featureIdx >= this.defaultFeatureNames.length) {
            return;
        }
        this.featureDirty[featureIdx] = true;
        this.setFeatureButtonState(featureIdx, "dirty");
        this.clearFeatureInlineMessage(featureIdx);
    }

    markFeatureSaved(featureIdx) {
        this.featureDirty[featureIdx] = false;
        this.setFeatureButtonState(featureIdx, "saved");
    }

    markFeatureFailed(featureIdx) {
        this.setFeatureButtonState(featureIdx, "failed");
    }

    isAxisAssigned(featureIdx) {
        const dropdown = document.getElementById(`dropdown${featureIdx}`);
        return dropdown && dropdown.value !== "defaultValue";
    }

    getFeatureIdxFromElement(element) {
        if (!element) {
            return null;
        }

        if (element.id) {
            const dropdownMatch = element.id.match(/^dropdown(\d+)$/);
            if (dropdownMatch) {
                return Number(dropdownMatch[1]);
            }
        }

        if (element.classList) {
            for (const className of element.classList) {
                const featureMatch = className.match(/^feature(\d+)$/);
                if (featureMatch) {
                    return Number(featureMatch[1]);
                }
            }
        }
        return null;
    }

    handleFeatureDraftChange(event) {
        const featureIdx = this.getFeatureIdxFromElement(event.target);
        if (featureIdx === null) {
            return;
        }
        this.markFeatureDirty(featureIdx);
    }

    async onEmbeddingSourceChange(event) {
        if (this.isLoadingSource) {
            return;
        }
        const sourceId = event.target.value;
        if (sourceId === this.activeSourceId) {
            return;
        }

        const hadPriorModel = this.modelReady && this.vecs.size > 0;
        const preferredScatterWords = this.scatterWords.slice();

        if (hadPriorModel) {
            this.clearPlotsForSourceSwitch();
            await this.yieldUI();
        }

        const loaded = await this.loadEmbeddingSource(sourceId, {preferredScatterWords});
        if (!loaded) {
            event.target.value = this.activeSourceId;
            if (hadPriorModel) {
                this.restorePlotsAfterFailedSourceSwitch();
            }
        }
    }

    clearPlotsForSourceSwitch() {
        this.selectedWord = "";
        this.analogy = {};
        this.dataScatter = null;
        this.plotWords = [];
        this.removeSimilarityLines();

        const emptyLayout = {
            margin: {l: 0, r: 0, t: 30, b: 0},
            showlegend: false
        };
        const emptyConfig = {responsive: true, displayModeBar: false};

        Plotly.newPlot("plotly-scatter", [], {
            ...emptyLayout,
            title: {text: "Word vector projection"}
        }, emptyConfig);
        Plotly.newPlot("plotly-vector", [], emptyLayout, emptyConfig);
        Plotly.newPlot("plotly-magnify", [], emptyLayout, emptyConfig);
    }

    restorePlotsAfterFailedSourceSwitch() {
        if (!this.guardModelReady()) {
            return;
        }
        this.plotScatter(true);
        this.plotVector(true);
        this.plotMagnify(true);
        this.initSimilarityLines();
    }

    // read raw model text and write vectors to vecs and vocab
    async processRawVecs(text) {
        const modelState = await this.parseRawVecs(text);
        this.vecs = modelState.vecs;
        this.vocab = modelState.vocab;
        this.vecsDim = modelState.vecsDim;
    }

    // read raw nearest words text (see nearest words script) and write to nearestWords
    processNearestWords(text) {
        this.nearestWords = this.parseNearestWords(text);
    }

    // create feature vectors by pairwise subtracting word vectors from lists
    // then average into one unit vector
    createFeature(vecs, wordList0, wordList1) {
        console.assert(wordList0.length === wordList1.length);
        const subVecs = [];
        for (let i = 0; i < wordList0.length; i++) {
            const word0 = wordList0[i];
            const word1 = wordList1[i];
            if (!vecs.has(word0) || !vecs.has(word1)) {
                continue;
            }
            subVecs.push(vecs.get(word0).sub(vecs.get(word1)));
        }
        if (subVecs.length === 0) {
            return this.getEmptyVector();
        }
        return subVecs.reduce((a, b) => a.add(b)).unit();
    }

    // use 1 - residual and scale residual for graphical convention (#3, #17)
    projectResidual(word) {
        if (!this.vecs.has(word)) {
            return 0;
        }
        return 2 * (1 - this.vecs.get(word).dot(this.features[2]));
    }

    // plot each word on a 3D scatterplot projected onto gender, age, residual features
    // as part of the process, computes features
    // used to refresh selected word
    plotScatter(newPlot = false) {
        if (!this.modelReady) {
            return;
        }

        if (this.selectedWord && !this.vecs.has(this.selectedWord)) {
            this.selectedWord = "";
        }

        // populate feature vectors for currently selected axis dimensions
        this.features[0] = this.createFeature(
            this.vecs,
            this.featureWordsPairs[this.idx0][0],
            this.featureWordsPairs[this.idx0][1]
        );
        this.features[1] = this.createFeature(
            this.vecs,
            this.featureWordsPairs[this.idx1][0],
            this.featureWordsPairs[this.idx1][1]
        );

        const residualWords = [...new Set(this.featureWordsPairs.flat(2))]
            .filter(word => this.vecs.has(word));

        // residual dim calculation described in #3
        this.features[2] = (residualWords.length === 0)
            ? this.getEmptyVector()
            : residualWords.map(word => {
                const wordVec = this.vecs.get(word);
                const wordNoFeature0 = wordVec.sub(this.features[0].scale(wordVec.dot(this.features[0])));
                const wordResidual = wordNoFeature0.sub(this.features[1].scale(wordNoFeature0.dot(this.features[1])));
                return wordResidual;
            }
        ).reduce((a, b) => a.add(b)).unit(); // average over residual words and normalize


        // words to actually be plotted (so this.scatterWords is a little misleading)
        const analogyWords = Object.values(this.analogy).filter(word => this.vecs.has(word));
        let plotWords = this.scatterWords.concat(analogyWords);
        plotWords = [...new Set(plotWords)]; // remove duplicates
        plotWords = plotWords.filter(word => this.vecs.has(word));

        // y, z are simply projections onto features
        const x = plotWords.map(this.projectResidual, this);
        const y = plotWords.map(word => this.vecs.get(word).dot(this.features[0]));
        const z = plotWords.map(word => this.vecs.get(word).dot(this.features[1]));

        // color points by type with priority (#12)
        const color = plotWords.map(word =>
            (word === this.selectedWord) ? "red" // selected word has highest priority
            : (word === this.analogy.y) ? "pink"
            : (word === this.analogy.Wstar) ? "lime"
            : (Object.values(this.analogy).includes(word)) ? "blue"
            : (Object.values(this.vectorWords).includes(word)) ? "gray" // color default vector words gray (#34)
            : "black"
        );

        // For each point, include numbered list of nearest words in hovertext
        const hovertext = plotWords.map(target => {
            const nearest = this.nearestWords.get(target) || [];
            const nearestText = nearest.length === 0
                ? "(nearest words unavailable)"
                : nearest.map((word, i) => `${i + 1}. ${word}`).join("<br>");
            return `Reference word:<br>${target}<br>` +
                "Nearest words:<br>" +
                nearestText;
        });

        const ZOOM = 0.8;
        // save previous camera code (workaround for #9)
        let camera;
        if (newPlot) {
            camera = {eye: {x: -2.5 * ZOOM, y: -0.75 * ZOOM, z: 0.5 * ZOOM}};
        } else { // save camera
            const plotly_scatter = document.getElementById("plotly-scatter");
            camera = plotly_scatter.layout.scene.camera;
        }
        // console.log("Using camera", camera);

        // scale points in 3D space (#43)
        const sizes = x.map((val, idx) => (
            1 /
            (
                (camera.eye.x - x[idx])**2 + 
                (camera.eye.y - y[idx])**2 + 
                (camera.eye.z - z[idx])**2
            )**0.5
        ));

        // find range of sizes and set desired range
        const oldMin = Math.min(...sizes);
        const oldMax = Math.max(...sizes);
        const oldRange = oldMax - oldMin || 1;
        
        
        // scale all points between new limits of rmin and rmax
        const newMin = 10;
        const newMax = 16;
        const newRange = newMax - newMin;
        
        const scaledSizes = sizes.map(oldValue => 
            (((oldValue - oldMin) * newRange) / oldRange) + newMin);
        
        let data = [
            {
                x: x,
                y: y,
                z: z,
                mode: "markers+text",
                type: "scatter3d",
                marker: {
                    size: scaledSizes,
                    opacity: 0.8,
                    color: color
                },
                text: plotWords,
                ids: plotWords.map((word, idx) => `sc-word-${idx}`),
                textfont: {
                    size: scaledSizes,
                    color: color,
                },
                hoverinfo: "text",
                hovertext: hovertext
            }
        ];

        // draw vector arrows if analogy words are available (#18)
        if (Object.keys(this.analogy).length > 0) {
            const arrowPairs = [[this.analogy.a, this.analogy.b], [this.analogy.c, this.analogy.y]];
            for (const arrowPair of arrowPairs) {
                // xyz coordinates of endpoints
                const x = arrowPair.map(this.projectResidual, this);
                const y = arrowPair.map(word => this.vecs.get(word).dot(this.features[0]));
                const z = arrowPair.map(word => this.vecs.get(word).dot(this.features[1]));

                data.push(
                    {
                        x: x,
                        y: y,
                        z: z,
                        mode: "lines",
                        type: "scatter3d",
                        hoverinfo: "none",
                        line: {
                            color: "blue",
                            width: 3
                        }
                    },
                    {
                        type: "cone",
                        x: [x[1]],
                        y: [y[1]],
                        z: [z[1]],
                        u: [0.3 * (x[1] - x[0])],
                        v: [0.3 * (y[1] - y[0])],
                        w: [0.3 * (z[1] - z[0])],
                        anchor: "tip",
                        hoverinfo: "none",
                        colorscale: [[0, "blue"], [1, "blue"]],
                        showscale: false,
                    }
                )
            }


        }

        const layout = {
            title: {text: "Word vector projection"},
            scene: {
                xaxis: {
                    title: {text: "[residual]"},
                    dtick: 0.1
                },
                yaxis: {
                    title: {
                        text: this.featureNames[this.idx0],
                        // color based on if axis feature is selected word
                        font: {color: (this.selectedWord === this.featureNames[this.idx0]) ? "red" : "black"}
                    },
                    dtick: 0.1
                },
                zaxis: {
                    title: {
                        text: this.featureNames[this.idx1],
                        font: {color: (this.selectedWord === this.featureNames[this.idx1] ? "red" : "black")}
                    },
                    dtick: 0.1
                },
                camera: camera
            },
            margin: {l: 0, r: 0, t: 30, b: 0}, // maximize viewing area
            font: {size: 12},
            showlegend: false
        };

        // always make new plot (#9)
        // replotting scatter3d produces ugly error (#10)
        Plotly.newPlot("plotly-scatter", data, layout);

        // bind scatter click event
        let plotly_scatter = document.getElementById("plotly-scatter");
        this.plotWords = plotWords;
        plotly_scatter.on("plotly_click", (data) => {
            this.respondToScatterClick();
        });

        // expand and re-position hover overlay on hover
        plotly_scatter.on("plotly_hover", (dataScatter) => {
            this.moveAndResizeOverlay(true);
            this.dataScatter = dataScatter;
        });
        
        // shrink hover overlay back on unhover
        plotly_scatter.on("plotly_unhover", () => {
            this.moveAndResizeOverlay(false);
        });
    } 
    

    // surround a feature word in brackets
    formatFeatureName(s) {
        return `[${s}]`;
    }

    // remove feature word brackets
    unformatFeatureName(s) {
        return s.slice(1,-1);
    }

    // clear all words and set vector view to empty (#21)
    clearWords() {
        if (!this.guardModelReady("Load an embedding source first.")) {
            return;
        }
        this.scatterWords = [];
        this.analogy = {};

        this.vectorWords = new Array(this.VECTOR_DISPLAY_SIZE).fill(this.EMPTY_FEATURE_NAME);

        // stop highlight prompt for vector plot
        this.highlightVectorAxis(false);

        this.plotScatter();
        this.plotVector();
    }

    // handle feature button pressing
    selectFeature(axis) {
        if (!this.guardModelReady("Load an embedding source first.")) {
            return;
        }
        const featureIdx = (axis === 0) ? this.idx0 : this.idx1;
        const selectedWordInput = this.featureNames[featureIdx];
        console.log("button", selectedWordInput);

        // add features as pseudo-words to vecs
        const featureVec = this.createFeature(
            this.vecs,
            this.featureWordsPairs[featureIdx][0],
            this.featureWordsPairs[featureIdx][1]
        );
        this.vecs.set(selectedWordInput, featureVec);

        if (selectedWordInput === this.selectedWord) {  // deselect word
            this.selectedWord = "";
        } else { // select word
            this.selectedWord = selectedWordInput;
        }

        this.plotScatter(); // replot selected word
    }


    // after plotly plot, bind heatmap axis click event using d3
    updateHeatmapsOnWordClick() {
        if (!this.modelReady) {
            return;
        }
        // affects all heatmaps since they all have .yaxislayer-above!
        // https://stackoverflow.com/a/47400462
        // console.log("Binding heatmap click event");

        d3.selectAll(".yaxislayer-above").selectAll("text")
            .on("click", (d) => {
                const idx = d.target.__data__.x;
                // console.log("Clicked on", idx);
                // console.log("Using this", this); // should be demo `this`, not d3
                if (this.selectedWord) {
                    // modify vector view to show selected word and then deselect
                    this.vectorWords[idx] = this.selectedWord;
                    this.selectedWord = "";
                    // turn off highlight prompt for vector plot
                    this.highlightVectorAxis(false);
                    // blank out magnitude plot labels
                    this.formatMagnitudePlot("default");
                    // replot all
                    this.plotScatter();
                    this.plotVector();
                }
                // reset leader lines
                this.removeSimilarityLines();
                this.initSimilarityLines();
            });
    }

    // plot vector and magnify views
    plotVector(newPlot = false) {
        if (!this.modelReady) {
            return;
        }
        // heatmap plots matrix of values in z
        const emptyVec = this.vecs.get(this.EMPTY_FEATURE_NAME) || this.getEmptyVector();
        const z = this.vectorWords.map(word => this.vecs.get(word) || emptyVec);

        // improve hover output format of vector display (#41)        
        const text = z.map((row, i) => row.map((item, j) => {
            return `word: ${this.vectorWords[i]}`+
            `<br>index: ${j}` +
            `<br>value: ${item.toFixed(4)}`
            }));

        const data = [
            {
                // can't use y: this.vectorWords since the heatmap won't display duplicate words
                z: z,
                zmin: this.HEATMAP_MIN,
                zmax: this.HEATMAP_MAX,
                type: "heatmap",
                ygap: 5,
                text: text,
                hoverinfo: "text",
            }
        ];

        const layout = {
            title: {text: "Vector visualization"},
            xaxis: {
                title: "Feature index",
                dtick: 10,
                zeroline: false,
                fixedrange: true
            },
            yaxis: {
                title: "Words",
                tickvals: d3.range(this.vectorWords.length),
                ticktext: this.vectorWords,
                fixedrange: true,
                tickangle: 60,
                color: "black"
            },
            margin: {t: 30},
        };

        if (newPlot) {
            Plotly.newPlot("plotly-vector", data, layout);
            const plotly_vector = document.getElementById("plotly-vector");

            // bind axis click to replace word in vector display after plot
            // use demo instance `this`, not plotly listener `this`
            plotly_vector.on("plotly_afterplot", this.updateHeatmapsOnWordClick.bind(this));

            plotly_vector.on("plotly_hover", data => {
                this.hoverX = data.points[0].x;
                // console.log("Hover " + this.hoverX);
                this.plotMagnify();
            });

            this.plotMagnify(true);
        } else {
            Plotly.react("plotly-vector", data, layout);
            this.plotMagnify();
        }
    }

    // similar to plotVector
    plotMagnify(newPlot = false) {
        if (!this.modelReady) {
            return;
        }
        // ensure this.hoverX will produce proper plot
        // bounds are inclusive
        const lo = this.hoverX - this.MAGNIFY_WINDOW;
        const hi = this.hoverX + this.MAGNIFY_WINDOW;
        if (!(0 <= lo && hi < this.vecsDim)) {
            return;
        }

        // heatmap with subset of z
        const z = this.vectorWords.map(word =>
            this.vecs.get(word).slice(lo, hi + 1));

        // set axis labels as z if it is null
        this.similarityValues = this.similarityValues || z.map(row => 
            row.map(value => 
                ' ' + String(value.toFixed(2)))); // round off and prefix blank to distance from heatmap 
        
        // set hover output format (#48)
        const text = z.map((row, i) => row.map((item, j) => {
            return `word: ${this.vectorWords[i]}`+
            `<br>index: ${this.hoverX}` + 
            `<br>value: ${item.toFixed(4)}`
          }));
          
        // set right hand side axis tick labels
        const y2val = z.map((row, i) => row.map((item, j) => {
            return item.toFixed(2)
        }));
        
        const data = [
            // trace for left y-axis
            {
                x: d3.range(lo, hi + 1),
                z: z,
                zmin: this.HEATMAP_MIN,
                zmax: this.HEATMAP_MAX,
                type: "heatmap",
                ygap: 5,
                showscale: false,
                text: text,
                hoverinfo: "text",
            },
            // trace for right y-axis (#53)
            {
                x: d3.range(lo, hi + 1),
                z: y2val,
                zmin: this.HEATMAP_MIN,
                zmax: this.HEATMAP_MAX,
                type: "heatmap",
                yaxis: 'y2',
                ygap: 5,
                showscale: false,
                text: text,
                hoverinfo: "text",
            }
        ];

        const layout = {
            title: "",
            xaxis: {
                title: "",
                dtick: 1,
                zeroline: false,
                fixedrange: true
            },
            // shift magnitude, similarity to left (#53)
            yaxis: {
                title: {
                    text: this.plotMagnifyTitle,
                    standoff: 40},
                side: "left",
                tickvals: d3.range(this.vectorWords.length),
                ticktext: this.similarityValues,
                ticks: "", // hide ticks (#49)
                showticklabels: this.plotMagnifyShowTicks,
                fixedrange: true,
                color: this.plotMagnifyColor,
                automargin: true,
            },

            // display vector components on right side (#53)
            yaxis2: {
                title: "",
                side: "right",
                tickvals: d3.range(this.vectorWords.length),
                ticktext: y2val,
                ticks: "",
                fixedrange: true,
                automargin: true,
            },
            margin: {l: 25, r: 60, t: 30} // get close to main vector view, width increased to accomodate title
        };

        if (newPlot) {
            Plotly.newPlot("plotly-magnify", data, layout);
            // bind axis click after plot, similar to vector
            const plotly_magnify = document.getElementById("plotly-magnify");
            plotly_magnify.on("plotly_afterplot", this.updateHeatmapsOnWordClick.bind(this));
        } else {
            Plotly.react("plotly-magnify", data, layout);
        }

        // hide plotly magnify in similarity mode
        document.querySelector("#plotly-magnify > div > div > svg:nth-child(1) > g.cartesianlayer").style.visibility = this.hideMagnitudePlot ? 'hidden' : '';     
    }

    // lowercase and remove non alphanumeric characters from words (#56)
    cleanWordInput(word) {
        word = word.trim().toLowerCase().replace(/\W/g, '');
        return word;
    }

    // handle user adding/removing words in form
    // refactored to accept and handle multiple separated words at a time (#51)
    modifyWord() {
        if (!this.guardModelReady("Load an embedding source first.")) {
            return;
        }
        let addedWords = [];
        let removedWords = [];
        let absentWords = [];
        // split user input across periods, spaces, commas or semicolons
        const words = document.getElementById("modify-word-input").value
                              .split(/[ ;,.]+/); 

        // flag to detect if replotting is required
        let wordModified = false;

        words.forEach(rawWord => {
            // remove all invalid characters
            const word = this.cleanWordInput(rawWord);
            
            // ignore empty string
            if (word==="") return;
            
            if (this.scatterWords.includes(word)) {  // remove word
                this.scatterWords = this.scatterWords.filter(item => item !== word);
                removedWords.push(word);
                wordModified = true;
            } else { // add word if in vocab
                if (this.vocab.has(word)) {
                    this.scatterWords.push(word);
                    addedWords.push(word);
                    wordModified = true;
                } else { // word not found
                    absentWords.push(word);
                    // no need to replot if all words entered are invalid
                }
            }
        });

        // update selection on add/remove without entering similarity mode
        if (wordModified) {
            if (addedWords.length > 0) {
                // keep red-highlighted feedback in scatter by selecting the latest added word
                this.selectedWord = addedWords[addedWords.length - 1];
            } else if (removedWords.length > 0) {
                // remove-only, clears current active word selection
                this.selectedWord = "";
            }
            this.formatMagnitudePlot("default");
            this.highlightVectorAxis(false);
            this.updateSimilarityLines(true, false);
        } else {
            // if there is NO VALID add/remove, keep current status quo
            if (this.selectedWord) {
                this.formatMagnitudePlot("similarity");
                this.highlightVectorAxis(true);
            } else {
                this.formatMagnitudePlot("default");
                this.highlightVectorAxis(false);
            }
        }

        // generate message as per changes to words
        let message = "";
        if (addedWords.length > 0){
            message += `added: "${addedWords.join('", "')}"\n`; // add punctuation
        }
        if (removedWords.length > 0){
            message += `removed: "${removedWords.join('", "')}"\n`;
        }
        if (absentWords.length > 0){
            message += `not found: "${absentWords.join('", "')}"`;
        }
        // display the message
        document.getElementById("modify-word-message").innerText = message;

        // replot scatter plot if required
        if (wordModified) {
            this.plotScatter();  // replot to update scatter view
            document.getElementById("modify-word-input").value = ""; // clear word
        }

        // reformat magnify plot with set mode
        this.plotMagnify(false);
    }

    // process 3COSADD word analogy input, write arithmetic vectors to vector view and add nearest neighbors to result (#14)
    // notation from original paper: "Linguistic Regularities in Continuous Space Word Representations" (Mikolov 2013)
    // Analogy notation for words: a:b as c:d, with d unknown
    // vector y = x_b - x_a + x_c, find w* = argmax_w cossim(x_w, y)
    // convert words to lowercase before processing (#39)
    processAnalogy() {
        if (!this.guardModelReady("Load an embedding source first.")) {
            return;
        }
        const wordA = this.cleanWordInput(document.getElementById("analogy-word-a").value.toLowerCase());
        const wordB = this.cleanWordInput(document.getElementById("analogy-word-b").value.toLowerCase());
        const wordC = this.cleanWordInput(document.getElementById("analogy-word-c").value.toLowerCase());

        const inputWords = [wordA, wordB, wordC];

        // Handle not found input words gracefully
        for (const word of inputWords) {
            if (!(this.vocab.has(word))) {
                document.getElementById("analogy-message").innerText = `"${word}" not found`;
                return;
            }
        }

        // all words in inputWords, clear analogy-message
        document.getElementById("analogy-message").innerText = "";

        const vecA = this.vecs.get(wordA);
        const vecB = this.vecs.get(wordB);
        const vecC = this.vecs.get(wordC);

        // vector arithmetic
        const vecBMinusA = vecB.sub(vecA);
        const wordBMinusA = `${wordB}-${wordA}`;
        const vecY = vecBMinusA.add(vecC); // dont normalize for now (#12)
        const wordY = `${wordB}-${wordA}+${wordC}`;

        // find most similar words for analogy
        let wordAnalogyPairs = [...this.vocab]
            .filter(word => !inputWords.includes(word))  //  don't match words used in arithmetic (#12)
            .map(word => [word, vecY.dot(this.vecs.get(word))]);

        wordAnalogyPairs.sort((a, b) => b[1] - a[1]);
        const nearestAnalogyWords = wordAnalogyPairs.slice(0, 10).map(pair => pair[0]);
        const wordWstar = nearestAnalogyWords[0];

        // add nearest words to Y to nearest word list (#12)
        this.nearestWords.set(wordY, nearestAnalogyWords);

        // write out most similar word to text box
        document.getElementById("analogy-word-wstar").value = wordWstar;
        // simultaneously update lower result field (#28)
        document.getElementById("analogy-word-wstar-mirror").value = wordWstar;
        

        // write arithmetic vectors to vector view
        this.vecs.set(wordBMinusA, vecBMinusA);
        this.vecs.set(wordY, vecY);

        // set analogy words to display in scatter (#12):
        this.analogy = {"b": wordB, "a": wordA, "c": wordC, "y": wordY, "Wstar": wordWstar};

        // remove similarity lines to prevent disconnected elements in leader lines
        this.removeSimilarityLines();

        this.plotScatter();

        // write arithmetic vectors to vector view (#14)
        this.vectorWords = [wordB, wordA, wordBMinusA, wordC, wordY, wordWstar].reverse();
        this.plotVector();
        
        // update the values of tick labels of magnitude plot (#36)
        this.formatMagnitudePlot("arithmetic"); 
        this.plotMagnify(false);
    }

    processOddOneOut() {
        if (!this.guardModelReady("Load an embedding source first.")) {
            return;
        }

        const words = [0, 1, 2, 3].map(i =>
            this.cleanWordInput(document.getElementById(`odd-word-${i}`).value)
        );
        const message = document.getElementById("odd-one-out-message");
        const result = document.getElementById("odd-one-out-result");

        if (words.some(word => word === "")) {
            message.innerText = "Please enter four words.";
            result.innerText = "----";
            return;
        }

        const duplicate = words.find((word, index) => words.indexOf(word) !== index);
        if (duplicate) {
            message.innerText = `"${duplicate}" is duplicated. Please enter four different words.`;
            result.innerText = "----";
            return;
        }

        for (const word of words) {
            if (!this.vocab.has(word)) {
                message.innerText = `"${word}" not found`;
                result.innerText = "----";
                return;
            }
        }

        const vectors = words.map(word => this.vecs.get(word));
        const similarityMatrix = this.buildSimilarityMatrix(vectors);
        const outlier = this.computeOutlier(words, similarityMatrix);
        const points = this.projectOddOneOutTo2D(similarityMatrix);

        result.innerText = outlier.word;
        message.innerText = `Odd one out: ${outlier.word} (avg cosine: ${outlier.score.toFixed(3)})`;
        this.renderOddOneOutPlot(points, words, outlier.index, similarityMatrix, outlier.scores);
    }

    cosine(vecA, vecB) {
        const normProduct = vecA.norm() * vecB.norm();
        return normProduct === 0 ? 0 : vecA.dot(vecB) / normProduct;
    }

    buildSimilarityMatrix(vectors) {
        const matrix = vectors.map(() => new Array(vectors.length).fill(0));
        for (let i = 0; i < vectors.length; i++) {
            for (let j = 0; j < vectors.length; j++) {
                matrix[i][j] = i === j ? 1 : this.cosine(vectors[i], vectors[j]);
            }
        }
        return matrix;
    }

    computeOutlier(words, similarityMatrix) {
        const scores = words.map((word, i) => {
            const total = similarityMatrix[i].reduce((sum, value, j) => {
                return i === j ? sum : sum + value;
            }, 0);
            return total / (words.length - 1);
        });
        const index = scores.reduce((minIndex, score, i) =>
            score < scores[minIndex] ? i : minIndex
        , 0);

        return { index, word: words[index], score: scores[index], scores };
    }

    projectOddOneOutTo2D(similarityMatrix) {
        const n = similarityMatrix.length;
        const distancesSquared = similarityMatrix.map((row, i) =>
            row.map((similarity, j) => {
                if (i === j) {
                    return 0;
                }
                const distance = Math.max(0, 1 - similarity);
                return distance * distance;
            })
        );

        // Classical MDS: convert pairwise cosine distances into centered 2D coordinates.
        const rowMeans = distancesSquared.map(row =>
            row.reduce((sum, value) => sum + value, 0) / n
        );
        const colMeans = distancesSquared[0].map((_, j) =>
            distancesSquared.reduce((sum, row) => sum + row[j], 0) / n
        );
        const totalMean = rowMeans.reduce((sum, value) => sum + value, 0) / n;
        const gramMatrix = distancesSquared.map((row, i) =>
            row.map((value, j) => -0.5 * (value - rowMeans[i] - colMeans[j] + totalMean))
        );
        const eigen = this.jacobiEigenDecomposition(gramMatrix)
            .sort((a, b) => b.value - a.value);

        const first = eigen[0];
        const second = eigen[1];
        if (!first || first.value <= 0) {
            return this.circularOddOneOutPoints(n);
        }

        const xScale = Math.sqrt(first.value);
        const yScale = second && second.value > 0 ? Math.sqrt(second.value) : 0;
        return new Array(n).fill(0).map((_, i) => ({
            x: first.vector[i] * xScale,
            y: yScale === 0 ? 0 : second.vector[i] * yScale
        }));
    }

    jacobiEigenDecomposition(matrix) {
        const n = matrix.length;
        const values = matrix.map(row => row.slice());
        const vectors = new Array(n).fill(0).map((_, i) =>
            new Array(n).fill(0).map((__, j) => i === j ? 1 : 0)
        );

        for (let iteration = 0; iteration < 100; iteration++) {
            let p = 0;
            let q = 1;
            let max = Math.abs(values[p][q]);

            for (let i = 0; i < n; i++) {
                for (let j = i + 1; j < n; j++) {
                    const candidate = Math.abs(values[i][j]);
                    if (candidate > max) {
                        max = candidate;
                        p = i;
                        q = j;
                    }
                }
            }

            if (max < 1e-10) {
                break;
            }

            const angle = 0.5 * Math.atan2(2 * values[p][q], values[q][q] - values[p][p]);
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const app = values[p][p];
            const aqq = values[q][q];
            const apq = values[p][q];

            values[p][p] = cos * cos * app - 2 * sin * cos * apq + sin * sin * aqq;
            values[q][q] = sin * sin * app + 2 * sin * cos * apq + cos * cos * aqq;
            values[p][q] = 0;
            values[q][p] = 0;

            for (let k = 0; k < n; k++) {
                if (k !== p && k !== q) {
                    const akp = values[k][p];
                    const akq = values[k][q];
                    values[k][p] = cos * akp - sin * akq;
                    values[p][k] = values[k][p];
                    values[k][q] = sin * akp + cos * akq;
                    values[q][k] = values[k][q];
                }

                const vkp = vectors[k][p];
                const vkq = vectors[k][q];
                vectors[k][p] = cos * vkp - sin * vkq;
                vectors[k][q] = sin * vkp + cos * vkq;
            }
        }

        return values.map((row, i) => ({
            value: row[i],
            vector: vectors.map(vectorRow => vectorRow[i])
        }));
    }

    circularOddOneOutPoints(count) {
        return new Array(count).fill(0).map((_, i) => {
            const angle = (2 * Math.PI * i) / count;
            return { x: Math.cos(angle), y: Math.sin(angle) };
        });
    }

    renderOddOneOutPlot(points, words, outlierIndex, similarityMatrix, scores) {
        const pairSimilarities = [];
        for (let i = 0; i < words.length; i++) {
            for (let j = i + 1; j < words.length; j++) {
                pairSimilarities.push(similarityMatrix[i][j]);
            }
        }

        const minSimilarity = Math.min(...pairSimilarities);
        const maxSimilarity = Math.max(...pairSimilarities);
        const similarityRange = maxSimilarity - minSimilarity;
        const lineTraces = [];
        const similarityLabels = [];

        for (let i = 0; i < words.length; i++) {
            for (let j = i + 1; j < words.length; j++) {
                const similarity = similarityMatrix[i][j];
                const strength = similarityRange === 0 ? 0.7 : (similarity - minSimilarity) / similarityRange;
                const midpoint = {
                    x: (points[i].x + points[j].x) / 2,
                    y: (points[i].y + points[j].y) / 2
                };
                lineTraces.push({
                    x: [points[i].x, points[j].x],
                    y: [points[i].y, points[j].y],
                    mode: "lines",
                    type: "scatter",
                    line: {
                        color: `rgba(80, 80, 80, ${0.25 + 0.55 * strength})`,
                        width: 1.5 + 4 * strength
                    },
                    hoverinfo: "none",
                    showlegend: false
                });
                similarityLabels.push({
                    x: midpoint.x,
                    y: midpoint.y,
                    text: similarity.toFixed(2),
                    showarrow: false,
                    font: { size: 11, color: "#333" },
                    bgcolor: "rgba(255, 255, 255, 0.8)",
                    borderpad: 2
                });
            }
        }

        const wordLabels = words.map((word, i) => ({
            x: points[i].x,
            y: points[i].y,
            text: word,
            showarrow: false,
            yshift: 14,
            font: {
                size: 12,
                color: i === outlierIndex ? "#d62728" : "#1f77b4"
            },
            bgcolor: "rgba(255, 255, 255, 0.85)",
            borderpad: 1
        }));

        const pointTrace = {
            x: points.map(point => point.x),
            y: points.map(point => point.y),
            mode: "markers",
            type: "scatter",
            marker: {
                size: 14,
                color: "#000",
                line: {
                    width: 1,
                    color: "#333"
                }
            },
            hoverinfo: "none",
            showlegend: false
        };

        const layout = {
            title: "Odd One Out Similarity Map",
            margin: { l: 30, r: 30, t: 45, b: 30 },
            xaxis: { visible: false, zeroline: false },
            yaxis: { visible: false, zeroline: false, scaleanchor: "x" },
            hovermode: false,
            annotations: [...similarityLabels, ...wordLabels]
        };

        Plotly.newPlot("odd-one-out-plot", [...lineTraces, pointTrace], layout, {
            responsive: true,
            displayModeBar: false,
            staticPlot: true
        });
    }


    // inflate option to:"string" freezes browser, see https://github.com/nodeca/pako/issues/228
    // TextDecoder may hang browser but seems much faster
    unpackVectors(vecsBuf) {
        return new Promise((resolve) => {
            const vecsUint8 = pako.inflate(vecsBuf);
            const vecsText = new TextDecoder().decode(vecsUint8);
            return resolve(vecsText);
        });
    }

    // fill in HTML default words used to define semantic dimensions and feature names for scatterplot
    fillDimensionDefault() {
        for (let i=0; i<this.featureNames.length; i++) {
            // write button names and feature names
            if (i<2) //for two scatter buttons
                document.getElementById(`scatter-button${i}`).innerText = this.selectedFeatureNames[i];
            document.querySelector(`.user-feature-name.feature${i}`).value = this.unformatFeatureName(this.featureNames[i]);

            for (let j=0; j<2; j++) {
                document.querySelector(`.user-feature-words.feature${i}.set${j}`).textContent =
                    this.featureWordsPairs[i][j].join("\n");
            }
        }
    }

    // read one feature row(dimension)'s two word lists from textareas
    getFeatureWordsInput(featureIdx) {
        const selectedName = `feature${featureIdx}`;
        let featureWordsPairInput = Array(2);
        for (let j=0; j<2; j++) {
            // split words across new lines and normalize case/whitespace
            // strip only trailing blank lines so interior blanks can still be validated
            const lines = document.querySelector(`.user-feature-words.${selectedName}.set${j}`).value
                .toLowerCase()
                .split('\n')
                .map(word => word.trim());

            while (lines.length > 0 && lines[lines.length - 1] === "") {
                lines.pop();
            }
            featureWordsPairInput[j] = lines;
        }
        return featureWordsPairInput;
    }

    // validate one feature row and write message on failure
    validateFeatureInput(featureIdx, featureWordsPairInput) {
        // detect totally blank row before other validation messages
        if (featureWordsPairInput[0].length === 0 && featureWordsPairInput[1].length === 0) {
            this.setFeatureInlineMessage(featureIdx, "Text boxes are empty");
            return false;
        }

        // ensure feature sets are the same length
        if (featureWordsPairInput[0].length !== featureWordsPairInput[1].length) {
            this.setFeatureInlineMessage(featureIdx, "Ensure feature word sets are same length");
            return false;
        }

        // ensure all words in vocab
        for (let j=0; j<2; j++) {
            for (const word of featureWordsPairInput[j]) {
                if (!this.vocab.has(word)) {
                    this.setFeatureInlineMessage(featureIdx, `"${word}" not found`);
                    return false;
                }
            }
        }
        return true;
    }

    // save one validated feature row to model
    saveFeatureInput(featureIdx, featureWordsPairInput) {
        this.featureWordsPairs[featureIdx] = featureWordsPairInput;
        const selectedName = `feature${featureIdx}`;
        this.featureNames[featureIdx] =
            this.formatFeatureName(document.querySelector(`.user-feature-name.${selectedName}`).value.trim());
    }

    validateFeatureNameInput(featureIdx) {
        const selectedName = `feature${featureIdx}`;
        const axisName = document.querySelector(`.user-feature-name.${selectedName}`).value.trim();
        if (axisName.length === 0) {
            this.setFeatureInlineMessage(featureIdx, "Specify a name for this axis");
            return false;
        }
        return true;
    }

    // sync scatter axis button labels with selected feature names
    updateScatterButtonLabels() {
        document.getElementById("scatter-button0").innerText = this.featureNames[this.idx0];
        document.getElementById("scatter-button1").innerText = this.featureNames[this.idx1];
    }

    // handle one row submit: validate current row, then paired axis row if needed
    submitFeature(featureIdx) {
        if (!this.guardModelReady("Load an embedding source first.")) {
            return;
        }
        document.getElementById("user-feature-message").innerText = "";
        this.clearFeatureInlineMessages();
        this.setFeatureButtonState(featureIdx, "pending");

        const featureWordsPairInput = this.getFeatureWordsInput(featureIdx);
        if (!this.validateFeatureInput(featureIdx, featureWordsPairInput)) {
            this.markFeatureFailed(featureIdx);
            return;
        }

        const isAxisFeature = this.isAxisAssigned(featureIdx);
        const validatedInputs = new Map([[featureIdx, featureWordsPairInput]]);

        if (isAxisFeature) {
            if (!this.validateFeatureNameInput(featureIdx)) {
                this.markFeatureFailed(featureIdx);
                return;
            }

            // lightweight rule: if one axis row is submitted, validate the other axis row too (between X-axis and Z-axis)
            const otherAxisIdx = (featureIdx === this.idx0) ? this.idx1 : this.idx0;
            const otherFeatureWordsPairInput = this.getFeatureWordsInput(otherAxisIdx);
            if (!this.validateFeatureInput(otherAxisIdx, otherFeatureWordsPairInput)) {
                this.markFeatureFailed(featureIdx);
                this.markFeatureFailed(otherAxisIdx);
                return;
            }
            if (!this.validateFeatureNameInput(otherAxisIdx)) {
                this.markFeatureFailed(featureIdx);
                this.markFeatureFailed(otherAxisIdx);
                return;
            }
            validatedInputs.set(otherAxisIdx, otherFeatureWordsPairInput);
        }

        validatedInputs.forEach((wordsPair, idx) => {
            this.saveFeatureInput(idx, wordsPair);
            this.markFeatureSaved(idx);
        });

        if (isAxisFeature) {
            this.updateScatterButtonLabels();
            this.plotScatter();
        }
    }

    // validate and apply currently selected X/Z-axis dimensions
    // used by axis dropdown changes and initial page loading
    processFeatureInput() {
        if (!this.guardModelReady("Load an embedding source first.")) {
            return;
        }
        document.getElementById("user-feature-message").innerText = "";
        this.clearFeatureInlineMessages();

        const axisIdxs = [this.idx0, this.idx1];
        const featureInputs = new Map();
        let hasError = false;

        for (const featureIdx of axisIdxs) {
            const featureWordsPairInput = this.getFeatureWordsInput(featureIdx);
            featureInputs.set(featureIdx, featureWordsPairInput);
            if (!this.validateFeatureInput(featureIdx, featureWordsPairInput)) {
                hasError = true;
            }
        }
        if (hasError) {
            return;
        }

        for (const featureIdx of axisIdxs) {
            this.saveFeatureInput(featureIdx, featureInputs.get(featureIdx));
        }
        this.updateScatterButtonLabels();
        this.plotScatter();
    }

    // clear all semantic dimension row messages before revalidation
    clearFeatureInlineMessages() {
        document.querySelectorAll(".user-feature-inline-message")
            .forEach(elem => elem.remove());
    }

    clearFeatureInlineMessage(featureIdx) {
        const summary = document.querySelector(`#feature-details${featureIdx} summary`);
        if (!summary) {
            return;
        }
        summary.querySelectorAll(".user-feature-inline-message")
            .forEach(elem => elem.remove());
    }

    // attach an inline message next to a feature row's submit button
    setFeatureInlineMessage(featureIdx, message) {
        const summary = document.querySelector(`#feature-details${featureIdx} summary`);
        if (!summary) {
            return;
        }
        this.clearFeatureInlineMessage(featureIdx);
        const msg = document.createElement("span");
        msg.className = "user-feature-inline-message";
        msg.innerText = message;
        summary.appendChild(msg);
    }

    // populate other box if one box is filled (#28)
    populateOther(event, wordId, mirrorId) {
        var word = document.getElementById(wordId);
        var mirror = document.getElementById(mirrorId);
        mirror.value = word.value;
        this.resetAnalogyWord(event.key);
    }

    // clear analogy result as soon as user starts typing (#46)
    resetAnalogyWord(key){
        if (key != "Enter") { // do not reset if enter is pressed
            var result = document.getElementById("analogy-word-wstar");
            result.value = "----";
            var resultMirror = document.getElementById("analogy-word-wstar-mirror");
            resultMirror.value = "----";
        }
    }

    // (#29) user dropdown selection actions for custom features 
    dropDownActions(selectedId) {
        if (!this.guardModelReady("Load an embedding source first.")) {
            return;
        }
        this.setFeatureAxes(selectedId);
        const selectedFeatureIdx = parseInt(selectedId[selectedId.length - 1]);
        this.markFeatureDirty(selectedFeatureIdx);
    }

    // set X, Z axes as features selected by user (#29)
    setFeatureAxes(selectedId) {
        var selectedValue = document.getElementById(selectedId).value;
        var allIds = ["dropdown0", "dropdown1", "dropdown2", "dropdown3", "dropdown4", "dropdown5", "dropdown6", "dropdown7", "dropdown8"];

        if (selectedValue == "value1"){
            this.idx0 = parseInt(selectedId[(selectedId).length-1]);
        }
        if (selectedValue == "value2"){
            this.idx1 = parseInt(selectedId[(selectedId).length-1]);
        }
        this.selectedFeatureNames = [this.featureNames[this.idx0], this.featureNames[this.idx1]];

        for (var id of allIds) {
            if (id != selectedId && selectedValue != "defaultValue") {
                if (document.getElementById(id).value == selectedValue){
                    document.getElementById(id).value = "defaultValue";
                }
            }
        }
    }

    // switch "vector arithmetic mode" (#22)
    handleAnalogyToggle(element) {
        if (!this.modelReady) {
            return;
        }
        // deselect word if user enters vector arithmetic mode (#37)
        this.selectedWord = ""; 
        // also turn off highlight prompt for vector plot if user enters vector arithmetic mode (#37)
        this.highlightVectorAxis(false);
        this.formatMagnitudePlot("arithmetic")
        if (!element.open) {
            // on details close, erase analogy object and modify vector plot words as follows -
            this.analogy = {};
            this.formatMagnitudePlot("default")
            // check 3rd and 5th entry of vectorplot words, if they are hold arithmetic results, erase (#35)
            for (const i of [1,3]) { // indices corresponding to 5th and 3rd entry
                if (this.getEraseRequirement(this.vectorWords[i])){
                    this.vectorWords[i] = this.EMPTY_FEATURE_NAME;
                }
            }
        }
            // replot so as to reset any active animations (#37)
            this.plotScatter();
            this.plotVector();
            this.plotMagnify();
            // also turn off similarity lines (#55)
            this.removeSimilarityLines();
            this.initSimilarityLines();
    }

    // move element to a target position using left and top coordinates
    moveElem(elem, targetLeft, targetTop){ 
        elem.style.left = targetLeft  + "px"
        elem.style.top = targetTop + "px"
    }

    // resize element to given width, height
    resizeElem(elem, targetWidth, targetHeight) {
        elem.style.width = targetWidth + "px"
        elem.style.height = targetHeight + "px"
    }

    // manipulate clickable overlay to bring above hover text (#50)
    moveAndResizeOverlay(hovering){
        const overlay = document.getElementById("scatter-overlay");
        if (hovering) {
            // move overlay to hovertext
            // get bounding region to overlay on
            const topElem = document.querySelector("#scene > svg > g > text > tspan:nth-child(5)");
            const parentElem = document.getElementById("plotly-scatter");
            if (topElem !== null) {
                const rectTop = topElem.getBoundingClientRect();
                const rectParent = parentElem.getBoundingClientRect();
                this.moveElem(overlay, 
                    rectTop.left - rectParent.left - 5, // 5px margin on left
                    rectTop.top - rectParent.top,
                    );
                // increase size of overlay
                this.resizeElem(overlay,
                    1.15*(rectTop.width), // 15% margin on right
                    3.5*(rectTop.height) // empirical height based on limits of hovertext popping up
                    );
            }
            // enable clicks
            overlay.style.pointerEvents = "auto";
        } else {
            // shrink size back
            this.resizeElem(overlay, 0, 0);
            // disable clicks
            overlay.style.pointerEvents = "none";
        }
    }

    // bind click on scatter hover overlay (#50)
    addOverlayListener(){
        const overlay = document.getElementById("scatter-overlay");
        if (overlay.dataset.boundClick === "true") {
            return;
        }
        overlay.addEventListener("click", () => {
            this.respondToScatterClick();
        });
        overlay.dataset.boundClick = "true";
    }

    // highlight vector axis on scatter click
    respondToScatterClick(){
        if (!this.modelReady || !this.dataScatter || !this.dataScatter.points || this.dataScatter.points.length === 0) {
            return;
        }
        const ptNum = this.dataScatter.points[0].pointNumber;
        const clickedWord = this.plotWords[ptNum];
        
        // actions if user clicks on (ie selects or deselects) a word in scatter plot
        if (clickedWord === this.selectedWord) { // deselect
            this.highlightVectorAxis(false); // turn off highlight prompt for vector plot
            this.selectedWord = "";
            this.formatMagnitudePlot("default");
            this.updateSimilarityLines(true, false); // move and hide lines
        } else { // select
            this.highlightVectorAxis(true); // turn on highlight prompt for vector plot
            this.selectedWord = clickedWord;
            this.formatMagnitudePlot("similarity");
            this.updateSimilarityLines(true, true); // move and show lines
        }

        // replot with new point color
        this.plotScatter();
        // replot with similarity values
        this.plotMagnify();
    }

    // draw lines between selected word in scatter plot and highlighted similarity words in vector plot (#55)
    initSimilarityLines() {
        this.similarityLines = [];
        // select vectorwords 
        const yTicks = document.querySelectorAll("#plotly-vector > div > div > svg:nth-child(1) > g.cartesianlayer > g > g.yaxislayer-above > g");
        const pointAnchor = document.getElementById("scatter-overlay");
        yTicks.forEach((yTick, idx) => {
            this.similarityLines.push(
                new LeaderLine(
                    LeaderLine.pointAnchor(pointAnchor, {x: '0%', y: '80%'}), // height % based on fact that scatter overlay is asymmetric
                    yTick,
                    {
                        path: 'magnet',
                        color: 'red',
                        dash: true,
                        size: 0.5,
                        hide: true,
                    }
                )
            );
        });
    }

    // toggle visibility of similarity lines on click (#55)
    updateSimilarityLines(reposition, visible) {
        // update line captions
        this.similarityLines.forEach((line, idx) => {
            const options = {
                middleLabel: LeaderLine.pathLabel(`${this.similarityValues[idx]}`),
            };
            line.setOptions(options);
        });
        if (reposition) {
            // move lines to updated position
            this.similarityLines.forEach((line) => {
                line.position();
            });
        }
        // show or hide lines
        if (visible) {
            this.similarityLines.forEach((line, idx) => {
                // TODO: add if clause for [empty] slots
                if (this.vectorWords[idx] !== "[empty]") {
                    line.show();
                }
            });
        } else {
            this.similarityLines.forEach((line) => {
                line.hide();
            });
        }
    }

    // remove all lines to prevent disconnected element error 
    removeSimilarityLines() {
        this.similarityLines.forEach((line) => {
            line.remove();
        });
        this.similarityLines = [];
    }

    // detect if erase is required, ie. we have arithmetic results instead of pure words in vector plot (#35)
    getEraseRequirement(word) {
        const numWords = word.split('-').length; // since '-' is always part of our analogy eg. king-man+woman
        return numWords > 1;
    }

    // prompt user for copying word into vector plot (#31)
    highlightVectorAxis(active) { 
        // select y ticks of vector plot to highlight
        this.fun = [];
        const yTicks = document.querySelectorAll("#plotly-vector > div > div > svg:nth-child(1) > g.cartesianlayer > g > g.yaxislayer-above > g");
        if (active) {
            // draw red rectangles around text as prompt
            yTicks.forEach((elem) => {
                if (elem.__data__.text !== "[empty]") {
                    elem.style.setProperty("outline", "2px solid red");
                }
            });
        }
        else {
            // turn off prompt
            yTicks.forEach((elem) => {
                elem.style.setProperty("outline", "none");
            });
        }
    }

    computeSimilarityValues() {
        return;
    }

    // hide or show magnitude numbers for vector magnitude plot depending on mode (#36) 
    formatMagnitudePlot(mode="default") {
        if (mode === "similarity" && this.vecs.has(this.selectedWord)) {
            const selectedVector = this.vecs.get(this.selectedWord).unit();
            this.plotMagnifyTitle = "Similarity to "+`'${this.selectedWord}'`;
            this.similarityValues = this.vectorWords.map(word => {
                const vec = this.vecs.get(word) || this.vecs.get(this.EMPTY_FEATURE_NAME) || this.getEmptyVector();
                return vec.unit().dot(selectedVector).toFixed(2);
            });
            this.plotMagnifyShowTicks = true; 
            this.plotMagnifyColor = "red";    
            // hide magnitude plot when similarity mode active
            this.hideMagnitudePlot = true;
        }
        else if (mode === "arithmetic") {
            this.plotMagnifyTitle = "Magnitude";
            this.similarityValues = this.vectorWords.map(word => {
                const vec = this.vecs.get(word) || this.vecs.get(this.EMPTY_FEATURE_NAME) || this.getEmptyVector();
                return vec.norm().toFixed(2);
            });
            this.plotMagnifyShowTicks = true;        
            this.plotMagnifyColor = "blue";  
            // show magnitude plot
            this.hideMagnitudePlot = false;
        }
        else {
            this.plotMagnifyTitle = "";
            this.similarityValues = "";
            this.plotMagnifyShowTicks = false;        
            this.plotMagnifyColor = "black";       
            // show magnitude plot
            this.hideMagnitudePlot = false;
        }
    }

    setLoadingProgress(percent, label) {
        const fill = document.getElementById("loading-progress-fill");
        const pct = document.getElementById("loading-progress-percent");
        const text = document.getElementById("loading-text");
        const progress = document.getElementById("loading-progress");
        const clamped = Math.max(0, Math.min(100, percent));

        // Auto-detect stage jumps: 
        // small frequent updates get an instant width change so the bar tracks the percentage text exactly
        // large jumps get a brief CSS transition for polish
        const previous = typeof this.lastLoadingProgress === "number"
            ? this.lastLoadingProgress
            : 0;
        const SMOOTH_DELTA = 3;
        const smooth = Math.abs(clamped - previous) >= SMOOTH_DELTA;

        if (fill) {
            fill.classList.toggle("smooth", smooth);
            fill.style.width = `${clamped}%`;
        }
        if (pct) {
            pct.innerText = `${Math.round(clamped)}%`;
        }
        if (progress) {
            progress.setAttribute("aria-valuenow", `${Math.round(clamped)}`);
        }
        if (text && typeof label === "string") {
            text.innerText = label;
        }
        this.lastLoadingProgress = clamped;
    }

    // Stream a fetch response while reporting progress between [startPct, endPct].
    // Returns a Uint8Array of all received bytes.
    async downloadWithProgress(url, startPct, endPct, label, expectedBytes) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Could not load file: ${url}`);
        }

        const contentLength = parseInt(response.headers.get("Content-Length") || "0", 10);
        const total = contentLength > 0 ? contentLength : (expectedBytes || 0);
        const range = endPct - startPct;
        const reader = response.body && typeof response.body.getReader === "function"
            ? response.body.getReader()
            : null;

        // Fallback: streaming not supported, just read whole body.
        if (!reader) {
            this.setLoadingProgress(startPct, label);
            const buf = new Uint8Array(await response.arrayBuffer());
            this.setLoadingProgress(endPct, label);
            return buf;
        }

        const chunks = [];
        let loaded = 0;
        this.setLoadingProgress(startPct, label);

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            chunks.push(value);
            loaded += value.length;

            if (total > 0) {
                const pct = startPct + Math.min(1, loaded / total) * range;
                const mb = (loaded / (1024 * 1024)).toFixed(1);
                const totalMb = (total / (1024 * 1024)).toFixed(1);
                this.setLoadingProgress(pct, `${label} (${mb} / ${totalMb} MB)`);
            } else {
                // Unknown total: asymptotically approach endPct so the bar still moves.
                const fakeRatio = 1 - Math.exp(-loaded / 20000000);
                const pct = startPct + fakeRatio * range;
                const mb = (loaded / (1024 * 1024)).toFixed(1);
                this.setLoadingProgress(pct, `${label} (${mb} MB)`);
            }
        }

        const merged = new Uint8Array(loaded);
        let offset = 0;
        for (const chunk of chunks) {
            merged.set(chunk, offset);
            offset += chunk.length;
        }
        this.setLoadingProgress(endPct, label);
        return merged;
    }

    async loadEmbeddingSource(sourceId, options = {}) {
        const source = this.embeddingSources[sourceId];
        const loadingIcon = document.getElementById("loading-icon");

        if (!source) {
            this.markModelUnavailable(`Unknown embedding source: ${sourceId}`);
            return false;
        }

        this.isLoadingSource = true;
        this.modelReady = false;
        this.setLoadingProgress(0, "");
        loadingIcon.style.display = "flex";
        this.setSourceStatus(`Loading ${source.label}...`, false);

        // Guarantee the progress bar stays visible for at least some time even whenthe load finishes almost instantly
        const MIN_VISIBLE_MS = 350;
        const minVisible = new Promise(r => setTimeout(r, MIN_VISIBLE_MS));
        let succeeded = false;

        try {
            const vecsBytes = await this.downloadWithProgress(
                source.vectorsUrl,
                0,
                70,
                `Downloading ${source.label} vectors...`,
                source.expectedBytes
            );

            this.setLoadingProgress(70, source.compressed ? "Unpacking vectors..." : "Reading vectors...");
            // Yield to let the browser paint the updated progress bar before the synchronous decompression/decode blocks the main thread
            await this.yieldUI();
            const vecsText = source.compressed
                ? await this.unpackVectors(vecsBytes.buffer)
                : new TextDecoder().decode(vecsBytes);

            this.setLoadingProgress(80, "Processing vectors...");
            await this.yieldUI();
            const modelState = await this.parseRawVecs(vecsText, (ratio) => {
                // Map parsing progress (0..1) to the 80..95 portion of the bar.
                this.setLoadingProgress(80 + ratio * 15);
            });

            this.setLoadingProgress(95, "Loading nearest words...");
            let nearestWords = new Map();
            if (source.nearestWordsUrl) {
                const nearestWordsResponse = await fetch(source.nearestWordsUrl);
                if (!nearestWordsResponse.ok) {
                    throw new Error(`Could not load nearest words file: ${source.nearestWordsUrl}`);
                }
                const nearestWordsText = await nearestWordsResponse.text();
                nearestWords = this.parseNearestWords(nearestWordsText);
            }

            this.applyLoadedSource(sourceId, modelState, nearestWords, options);
            this.setLoadingProgress(100, `${source.label} ready`);
            this.setSourceStatus(`${source.label} loaded successfully`, false);
            succeeded = true;
            return true;
        } catch (e) {
            console.error(e);
            this.setLoadingProgress(0, "");
            const hasPriorModel = this.vecs.size > 0;
            this.modelReady = hasPriorModel;
            this.setSourceStatus(
                hasPriorModel
                    ? `Failed to load ${source.label}; still using ${this.embeddingSources[this.activeSourceId].label}`
                    : `Failed to load ${source.label}: ${e.message}`,
                true
            );
            return false;
        } finally {
            // Only honor the minimum-visible delay on success.
            if (succeeded) {
                await minVisible;
            }
            loadingIcon.style.display = "none";
            const fill = document.getElementById("loading-progress-fill");
            if (fill) {
                fill.classList.remove("smooth");
                fill.style.width = "0%";
            }
            this.lastLoadingProgress = 0;
            this.isLoadingSource = false;
        }
    }

    // fetch wordvecs locally and process
    async main() {
        // fill default feature for scatterplot before model load
        this.fillDimensionDefault();
        this.resetDropdownAxes();
        this.bindPersistentListeners();

        const sourceSelect = document.getElementById("embedding-source-select");
        sourceSelect.value = this.activeSourceId;

        const loaded = await this.loadEmbeddingSource(this.activeSourceId);
        if (!loaded) {
            sourceSelect.value = this.activeSourceId;
        }
    }
}

// Main function runs as promise after DOM has loaded
const demo = new Demo();
document.addEventListener("DOMContentLoaded", () => {
    demo.main().catch(e => console.error(e));
});

// resize all plots on window resize (#52)
window.addEventListener('resize', function() {
    if (!demo.modelReady) {
        return;
    }
    const plotsToResize = ["plotly-scatter", "plotly-vector", "plotly-magnify"];
    plotsToResize.forEach(id => {
        const container = document.getElementById(id);
        if (!container) {
            return;
        }
        const updatedDims = {
            width: parseInt(0.99 * container.offsetWidth),
            height: parseInt(0.99 * container.offsetHeight)
        };
        Plotly.relayout(id, updatedDims);
    });
    // reset leader lines
    demo.removeSimilarityLines(); 
    demo.initSimilarityLines();
});
