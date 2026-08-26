const fs = require("fs");
const readline = require("readline");
require("dotenv").config();

// --- CONFIGURATION ---
const INPUT_FILE = "contextWithAndWithoutGold.jsonl";
const INPUT_FILE_CATEGORIES =
  "datasetGeneration/generatedJudgedV5AllWithCategories.jsonl";
// ---------------------

const counter = {
  math: { NO_PAPER: 0, ONE_PAPER: 0, BOTH_PAPERS: 0 },
  physics: { NO_PAPER: 0, ONE_PAPER: 0, BOTH_PAPERS: 0 },
  cs: { NO_PAPER: 0, ONE_PAPER: 0, BOTH_PAPERS: 0 },
  other: { NO_PAPER: 0, ONE_PAPER: 0, BOTH_PAPERS: 0 },
  interdisciplinary: { NO_PAPER: 0, ONE_PAPER: 0, BOTH_PAPERS: 0 },
};
const counterPreFiltering = {
  math: { NO_PAPER: 0, ONE_PAPER: 0, BOTH_PAPERS: 0 },
  physics: { NO_PAPER: 0, ONE_PAPER: 0, BOTH_PAPERS: 0 },
  cs: { NO_PAPER: 0, ONE_PAPER: 0, BOTH_PAPERS: 0 },
  other: { NO_PAPER: 0, ONE_PAPER: 0, BOTH_PAPERS: 0 },
  interdisciplinary: { NO_PAPER: 0, ONE_PAPER: 0, BOTH_PAPERS: 0 },
};
const counterRetention = {
  math: {},
  physics: {},
  cs: {},
  other: {},
  interdisciplinary: {},
};

async function processLineByLine() {
  const allPapersWithCategories = {};
  const categoriesReadStream = fs.createReadStream(INPUT_FILE_CATEGORIES);
  const categoriesReadLineInterface = readline.createInterface({
    input: categoriesReadStream,
    crlfDelay: Infinity,
  });
  for await (const l of categoriesReadLineInterface) {
    const entry = JSON.parse(l);
    entry["papersInputtedForGeneration"].map((p) => {
      allPapersWithCategories[[p.ArXiv]] = p.category;
    });
  }
  categoriesReadLineInterface.close();
  // end reading all categories

  const fileStreamExtractionResult = fs.createReadStream(INPUT_FILE);

  const readLineExtractionResults = readline.createInterface({
    input: fileStreamExtractionResult,
    crlfDelay: Infinity, // Recognizes all instances of CR LF as a single line break
  });

  const physicsTags = [
    "astro-ph",
    "cond-mat",
    "gr-qc",
    "hep-ex",
    "hep-lat",
    "hep-ph",
    "hep-th",
    "math-ph",
    "nlin.",
    "nucl-ex",
    "nucl-th",
    "physics",
    "quant-ph",
  ];

  const arxivCategoriePrefixes = [
    { tag: "cs", category: "Computer Science" },
    { tag: "econ", category: "Economics" },
    { tag: "eess", category: "Electrical Engineering and Systems Science" },
    { tag: "math", category: "Mathematics" },
    // --physics
    { tag: "astro-ph", category: "Astrophysics" },
    { tag: "cond-mat", category: "Condensed Matter" },
    { tag: "gr-qc", category: "General Relativity and Quantum Cosmology" },
    { tag: "hep-ex", category: "High Energy Physics - Experiment" },
    { tag: "hep-lat", category: "High Energy Physics - Lattice" },
    { tag: "hep-ph", category: "High Energy Physics - Phenomenology" },
    { tag: "hep-th", category: "High Energy Physics - Theory" },
    { tag: "math-ph", category: "Mathematical Physics" },
    { tag: "nlin.", category: "Nonlinear Sciences" },
    { tag: "nucl-ex", category: "Nuclear Experiment" },
    { tag: "nucl-th", category: "Nuclear Theory" },
    { tag: "physics", category: "Physics" },
    { tag: "quant-ph", category: "Quantum Physics" },
    // --physics
    { tag: "q-bio", category: "Quantitative Biology" },
    { tag: "q-fin", category: "Quantitative Finance" },
    { tag: "stat", category: "Statistics" },
  ];

  for await (const line of readLineExtractionResults) {
    const lineContent = JSON.parse(line);
    const paper1Arxiv = lineContent["generationMeta"]["usedPapers"][0]["arXiv"];
    const paper2Arxiv = lineContent["generationMeta"]["usedPapers"][1]["arXiv"];

    let paper1Category = allPapersWithCategories[paper1Arxiv];
    let paper2Category = allPapersWithCategories[paper2Arxiv];

    if (!paper1Category || !paper2Category) {
      throw new Error("THIS SHOULD NOT HAPPEN");
    }
    // let paper1Category = lineContent["generationMeta"][
    //   "papersInputtedForGeneration"
    // ].find((e) => e.ArXiv === paper1Arxiv).category;

    // let paper2Category = lineContent["generationMeta"][
    //   "papersInputtedForGeneration"
    // ].find((e) => e.ArXiv === paper2Arxiv).category;

    if (physicsTags.find((tag) => paper1Category.startsWith(tag))) {
      paper1Category = "physics";
    } else {
      const categoryIndex = arxivCategoriePrefixes.findIndex((pref) =>
        paper1Category.startsWith(pref.tag),
      );
      paper1Category = arxivCategoriePrefixes[categoryIndex]["tag"];
    }

    if (physicsTags.find((tag) => paper2Category.startsWith(tag))) {
      paper2Category = "physics";
    } else {
      const categoryIndex = arxivCategoriePrefixes.findIndex((pref) =>
        paper2Category.startsWith(pref.tag),
      );
      paper2Category = arxivCategoriePrefixes[categoryIndex]["tag"];
    }

    let joinedCategory;
    if (paper1Category === paper2Category) {
      if (["math", "physics", "cs"].includes(paper1Category)) {
        joinedCategory = paper1Category;
      } else {
        joinedCategory = "other";
      }
    } else {
      joinedCategory = "interdisciplinary";
    }

    const papersRetriedBySquai = lineContent["answerMeta"][
      "papersRetrievedBySQuAI"
    ].filter((p) => [paper1Arxiv, paper2Arxiv].includes(p));

    let increaseWhere;
    if (papersRetriedBySquai.length === 0) {
      increaseWhere = "NO_PAPER";
    } else {
      if (papersRetriedBySquai.length === 1) {
        increaseWhere = "ONE_PAPER";
      } else {
        increaseWhere = "BOTH_PAPERS";
      }
    }
    counter[joinedCategory][increaseWhere]++;

    const papersRetrievedPreFiltering = lineContent["answerMeta"][
      "docs_retrieved_pre_filtering"
    ].filter((p) => [paper1Arxiv, paper2Arxiv].includes(p));

    let increaseWherePreFiltering;
    if (papersRetrievedPreFiltering.length === 0) {
      increaseWherePreFiltering = "NO_PAPER";
    } else {
      if (papersRetrievedPreFiltering.length === 1) {
        increaseWherePreFiltering = "ONE_PAPER";
      } else {
        increaseWherePreFiltering = "BOTH_PAPERS";
      }
    }
    counterPreFiltering[joinedCategory][increaseWherePreFiltering]++;
  }
  console.log(JSON.stringify(counter, null, 2));
  console.log(JSON.stringify(counterPreFiltering, null, 2));
}

processLineByLine();
