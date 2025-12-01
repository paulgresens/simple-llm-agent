const fs = require("fs");
const readline = require("readline");
require("dotenv").config();

// --- CONFIGURATION ---
const INPUT_FILE = "datasetGeneration/processedFiltered.jsonl";
const OUTPUT_FILE = "datasetGeneration/processedFilteredAndJsonl.jsonl";
// ---------------------

async function processLineByLine() {
  const fileStream = fs.createReadStream(INPUT_FILE);
  const writeStream = fs.createWriteStream(OUTPUT_FILE, { flags: "w" });

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity, // Recognizes all instances of CR LF as a single line break
  });

  let id = 0;
  for await (const line of rl) {
    const entry = JSON.parse(line);

    for (qaPair of entry["Q&A"]) {
      await new Promise((resolve) => {
        writeStream.write(
          JSON.stringify({
            id,
            question: qaPair["Q"],
            answer: qaPair["A"],
            arxiv: entry["externalIds"]["ArXiv"],
          }) + "\n",
          () => {
            id++;
            resolve();
          }
        );
      });
    }
  }
}
processLineByLine();
