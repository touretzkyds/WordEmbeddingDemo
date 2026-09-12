"use strict";

// Class currently holding all controller and model functionality (God class?)
class Demo {
    constructor() {
        this.MAGNIFY_WINDOW = 0; // window size for magnified view
        this.HEATMAP_MIN = -0.2;  // min and max for heatmap colorscale
        this.HEATMAP_MAX = 0.2;
        this.VECTOR_DISPLAY_SIZE = 6;
        this.EMPTY_FEATURE_NAME = "[empty]";

        // words involved in the computation of analogy (#12)
        this.analogy = {};  // default empty Object
        
        // words to show in vector display
        this.vectorWords = ["queen", "king", "girl", "boy", "woman", "man"];
        
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
        this.scatterWords = ['man', 'woman', 'boy', 'girl', 'king', 'queen', 'prince', 'princess', 'nephew', 'niece',
            'uncle', 'aunt', 'father', 'mother', 'son', 'daughter', 'husband', 'wife', 'chair', 'computer'];

        // vector calculations and plotting, including residual (issue #3)
        // features 0 and 1 are user defined, feature 2 is residual
        this.features = Array(3); // init Array length doesn't actually matter

        // user-supplied names of features 0 and 1
        this.featureNames = ["[gender]", "[age]", "[royalty]", "[number]", "[part-of]", "[tense]", "[capital]", "[]", "[]"]; // leave room for two user-defined semantic dimensions (#29)

        // lists of word pairs to be used for creating features
        this.featureWordsPairs = [
            [
                ["prince",  "husband", "father", "son",     "uncle", "nephew", "boy",  "male", "his"],
                ["princess", "wife",   "mother", "daughter", "aunt", "niece", "girl", "female", "her"]
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

        // default feature names (#29)
        this.idx0 = 0;
        this.idx1 = 1;
        this.selectedFeatureNames = ["[gender]", "[age]"];

        // default settings for magnify plot vector display numbers (#36)
        this.formatMagnitudePlot("default")

        // create placeholder for similarity lines
        this.similarityLines = [];
    }

    // read raw model text and write vectors to vecs and vocab
    processRawVecs(text) {
        const lines = text.trim().split(/\n/);
        for (const line of lines) {
            const entries = line.trim().split(' ');
            this.vecsDim = entries.length - 1;
            const word = entries[0];
            const vec = new Vector(entries.slice(1).map(Number)).unit();  // normalize word vectors
            this.vocab.add(word);
            this.vecs.set(word, vec);
        }
    }

    // read raw nearest words text (see nearest words script) and write to nearestWords
    processNearestWords(text) {
        const lines = text.trim().split(/\n/);
        for (const line of lines) {
            const entries = line.trim().split(' ');
            const target = entries[0];
            const words = entries.slice(1);
            this.nearestWords.set(target, words);
        }
    }

    // create feature vectors by pairwise subtracting word vectors from lists
    // then average into one unit vector
    createFeature(vecs, wordList0, wordList1) {
        console.assert(wordList0.length === wordList1.length);
        const subVecs = wordList0.map((word0, i) => vecs.get(word0).sub(vecs.get(wordList1[i])));
        return subVecs.reduce((a, b) => a.add(b)).unit();
    }

    // use 1 - residual and scale residual for graphical convention (#3, #17)
    projectResidual(word) {
        return 2 * (1 - this.vecs.get(word).dot(this.features[2]));
    }

    // plot each word on a 3D scatterplot projected onto gender, age, residual features
    // as part of the process, computes features
    // used to refresh selected word
    plotScatter(newPlot = false) {
        // populate feature vectors
        this.features[0] = this.createFeature(this.vecs, this.featureWordsPairs[0][0], this.featureWordsPairs[0][1]);
        this.features[1] = this.createFeature(this.vecs, this.featureWordsPairs[1][0], this.featureWordsPairs[1][1]);

        const residualWords = [...new Set(this.featureWordsPairs.flat(2))];

        // residual dim calculation described in #3
        this.features[2] = residualWords.map(word => {
                const wordVec = this.vecs.get(word);
                const wordNoFeature0 = wordVec.sub(this.features[0].scale(wordVec.dot(this.features[0])));
                const wordResidual = wordNoFeature0.sub(this.features[1].scale(wordNoFeature0.dot(this.features[1])));
                return wordResidual;
            }
        ).reduce((a, b) => a.add(b)).unit(); // average over residual words and normalize


        // words to actually be plotted (so this.scatterWords is a little misleading)
        let plotWords = this.scatterWords.concat(Object.values(this.analogy));
        plotWords = [...new Set(plotWords)]; // remove duplicates

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
        const hovertext = plotWords.map(target =>
            `Reference word:<br>${target}<br>` +
            "Nearest words:<br>" +
            this.nearestWords.get(target)
                .map((word, i) => `${i + 1}. ${word}`)
                .join("<br>")
        );

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
        const oldRange = oldMax - oldMin;
        
        
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
                        text: this.featureNames[0],
                        // color based on if axis feature is selected word
                        font: {color: (this.selectedWord === this.featureNames[0]) ? "red" : "black"}
                    },
                    dtick: 0.1
                },
                zaxis: {
                    title: {
                        text: this.featureNames[1],
                        font: {color: (this.selectedWord === this.featureNames[1] ? "red" : "black")}
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
        const selectedWordInput = this.featureNames[axis];
        console.log("button", selectedWordInput);

        // add features as pseudo-words to vecs
        this.vecs.set(selectedWordInput, this.features[axis]);

        if (selectedWordInput === this.selectedWord) {  // deselect word
            this.selectedWord = "";
        } else { // select word
            this.selectedWord = selectedWordInput;
        }

        this.plotScatter(); // replot selected word
    }


    // after plotly plot, bind heatmap axis click event using d3
    updateHeatmapsOnWordClick() {
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
        // heatmap plots matrix of values in z
        const z = this.vectorWords.map(word => this.vecs.get(word));

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

    // remove all non alphanumeric characters from words (#56)
    cleanWordInput(word) {
        word = word.replace(/\W/g, '');
        return word;
    }

    // handle user adding/removing words in form
    // refactored to accept and handle multiple separated words at a time (#51)
    modifyWord() {
        let addedWords = [];
        let removedWords = [];
        let absentWords = [];
        let finalWordsToAdd = new Set(); // handle duplicate additions for word selection / display at the end of this function
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
                if (finalWordsToAdd.has(word)) finalWordsToAdd.delete(word);
                wordModified = true;
            } else { // add word if in vocab
                if (this.vocab.has(word)) {
                    this.scatterWords.push(word);
                    addedWords.push(word);
                    finalWordsToAdd.add(word);
                    wordModified = true;
                } else { // word not found
                    absentWords.push(word);
                    // no need to replot if all words entered are invalid
                }
            }
        });

        // make first added word active
        // if no words have been added, deactivate any currently active word
        if (finalWordsToAdd.size > 0){
            for (var word of finalWordsToAdd) // go up to last word of set
            this.selectedWord = word; // select last word
            this.formatMagnitudePlot("similarity");
            this.highlightVectorAxis(true);
        }
        else {
            this.selectedWord = "";
            this.formatMagnitudePlot("default");
            this.highlightVectorAxis(false);
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

    // handle user submitting feature words into form
    processFeatureInput() {
        // console.log(`this.idx0 = ${this.idx0}, this.idx1 = ${this.idx1}`)
        let selectedNames = [`feature${this.idx0}`, `feature${this.idx1}`]; //.user-feature-words.
        // temporary input to be validated
        let featureWordsPairsInput = [Array(2), Array(2)];
        for (let i=0; i<2; i++) {
            for (let j=0; j<2; j++) {
                // split words across new lines
                // convert to lowercase (#39)
                featureWordsPairsInput[i][j] =
                    document.querySelector(`.user-feature-words.${selectedNames[i]}.set${j}`).value.toLowerCase().split('\n');
            }
        }

        // simple user input validation
        // ensure feature sets are the same length
        for (let i=0; i<2; i++) {
            if (featureWordsPairsInput[i][0].length !== featureWordsPairsInput[i][1].length) {
                document.getElementById("user-feature-message").innerText =
                    "Ensure feature word sets are same length";
                return;
            }
        }

        // ensure all words in vocab
        for (let i=0; i<2; i++) {
            for (let j=0; j<2; j++) {
                for (const word of featureWordsPairsInput[i][j]) {
                    if (!this.vocab.has(word)) {
                        document.getElementById("user-feature-message").innerText =
                            `"${word}" not found`;
                        return;
                    }
                }
            }
        }

        // (shallow) copy feature words after validation
        this.featureWordsPairs = featureWordsPairsInput;

        // read feature names from inputs, adding bracket syntax
        this.featureNames[0] = this.formatFeatureName(document.querySelector(`.user-feature-name.${selectedNames[0]}`).value); //.user-feature-name.feature${1}
        this.featureNames[1] = this.formatFeatureName(document.querySelector(`.user-feature-name.${selectedNames[1]}`).value);

        // write names to buttons
        document.getElementById("scatter-button0").innerText = this.featureNames[0];
        document.getElementById("scatter-button1").innerText = this.featureNames[1];

        this.plotScatter();
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
        this.setFeatureAxes(selectedId);
        this.processFeatureInput();
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
        overlay.addEventListener("click", () => {
            this.respondToScatterClick();
        });
    }

    // highlight vector axis on scatter click
    respondToScatterClick(){
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
        if (mode === "similarity") {
            const selectedVector = this.vecs.get(this.selectedWord).unit();
            this.plotMagnifyTitle = "Similarity to "+`'${this.selectedWord}'`;
            this.similarityValues = this.vectorWords.map(word => this.vecs.get(word).unit().dot(selectedVector).toFixed(2));
            this.plotMagnifyShowTicks = true; 
            this.plotMagnifyColor = "red";    
            // hide magnitude plot when similarity mode active
            this.hideMagnitudePlot = true;
        }
        else if (mode === "arithmetic") {
            this.plotMagnifyTitle = "Magnitude";
            this.similarityValues = this.vectorWords.map(word => this.vecs.get(word).norm().toFixed(2));
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

    // fetch wordvecs locally (no error handling) and process
    async main() {
        // fill default feature for scatterplot
        this.fillDimensionDefault();

        // lo-tech progress indication
        const loadingText = document.getElementById("loading-text");
        const loadingIcon = document.getElementById("loading-icon");
        // this.blinkText(loadingText);
        loadingText.innerText = "Downloading model...";
        // show loading icon (#54)
        loadingIcon.style.display = "flex";

        // note python's http.server does not support response compression Content-Encoding
        // browsers and servers support content-encoding, but manually compress to fit on github (#1)
        const vecsResponse = await fetch("wordvecs50k.vec.gz");
        const vecsBlob = await vecsResponse.blob();
        const vecsBuf = await vecsBlob.arrayBuffer();

        // async unpack vectors
        loadingText.innerText = "Unpacking model...";
        const vecsText = await this.unpackVectors(vecsBuf);

        loadingText.innerText = "Processing vectors...";
        this.processRawVecs(vecsText);

        // fetch nearest words list
        const nearestWordsResponse = await fetch("nearest_words.txt");
        const nearestWordsText = await nearestWordsResponse.text();

        this.processNearestWords(nearestWordsText);
        loadingText.innerText = "Model processing done";
        // hide loading icon after processing completes
        loadingIcon.style.display = "none";

        // make empty feature available to all
        const zeroArray = new Array(this.vecsDim).fill(0);
        this.vecs.set(this.EMPTY_FEATURE_NAME, new Vector(zeroArray));

        // analogy details event listener
        const analogyDetails = document.getElementById("analogy-details");
        analogyDetails.ontoggle = () => this.handleAnalogyToggle(analogyDetails);

        // plot new plots for the first time
        this.plotScatter(true);
        this.plotVector(true);
        this.processFeatureInput(); // processes words from selected semantic dimensions when the page loads (#45)
        
        // add thin similarity lines that are later moved when user clicks (#55)
        this.initSimilarityLines();

        // add event listener to rescale points in 3D with drag (#43)
        //TODO: scale while drag is on
        const plotly_scatter = document.getElementById("plotly-scatter");
        plotly_scatter.addEventListener("mouseup", () => {
            this.plotScatter();
        });

        // hide all lines on mouse down (#53)
        // TODO: hide when zooming
        plotly_scatter.addEventListener("mousedown", () => {
            this.updateSimilarityLines(true, false);
        });

        // make overlay clickable for hovertext (#50)
        this.addOverlayListener();
    }
}

// Main function runs as promise after DOM has loaded
const demo = new Demo();
document.addEventListener("DOMContentLoaded", () => {
    demo.main().catch(e => console.error(e));
});

// resize all plots on window resize (#52)
window.addEventListener('resize', function() {
    const plotsToResize = ["plotly-scatter", "plotly-vector", "plotly-magnify"];
    plotsToResize.forEach(id => {
        const container = document.getElementById(id);
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