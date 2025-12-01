const fs = require("fs");
const readline = require("readline");
require("dotenv").config();

// --- CONFIGURATION ---
const INPUT_FILE = "datasetGeneration/all_paper_ids.txt";
const INPUT_FILTERED_QUESTIONS = "datasetGeneration/processedFiltered.jsonl";
// const OUTPUT_FILE = "datasetGeneration";
// ---------------------

async function processLineByLine() {
  const fileStream = fs.createReadStream(INPUT_FILE);
  const inputFilteredStream = fs.createReadStream(INPUT_FILTERED_QUESTIONS);

  // const writeStream = fs.createWriteStream(OUTPUT_FILE, { flags: "w" });

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity, // Recognizes all instances of CR LF as a single line break
  });

  const arrayWithAllIds = [];
  for await (const line of rl) {
    const cleanId = line.replace(/"/g, "");
    arrayWithAllIds.push(cleanId);
  }
  console.log(arrayWithAllIds.length);
}
processLineByLine();
