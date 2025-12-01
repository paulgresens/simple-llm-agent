const fs = require("fs");
const readline = require("readline");
require("dotenv").config();

// --- CONFIGURATION ---
const INPUT_FILE = "datasetGeneration/processedFinal1000.jsonl";
const INPUT_SQUAI_ARXIV = "datasetGeneration/all_paper_ids.txt";
const OUTPUT_FILE = "datasetGeneration/processedFiltered.jsonl";
// ---------------------

async function processLineByLine() {
  const fileStream = fs.createReadStream(INPUT_FILE);
  const writeStream = fs.createWriteStream(OUTPUT_FILE, { flags: "w" });
  const squaiArxivIdsStream = fs.createReadStream(INPUT_SQUAI_ARXIV);

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity, // Recognizes all instances of CR LF as a single line break
  });

  const squaiRl = readline.createInterface({
    input: squaiArxivIdsStream,
    crlfDelay: Infinity, // Recognizes all instances of CR LF as a single line break
  });

  const arrayWithAllSquaiArxivIds = [];
  for await (const line of squaiRl) {
    const cleanId = line.replace(/"/g, "");
    arrayWithAllSquaiArxivIds.push(cleanId);
  }

  let countWithArxiv = 0;
  let countWithArxivAndInSquai = 0;
  let countWithoutArxiv = 0;

  for await (const line of rl) {
    const entry = JSON.parse(line);
    if (entry.externalIds && entry.externalIds.ArXiv) {
      if (arrayWithAllSquaiArxivIds.includes(entry.externalIds.ArXiv)) {
        await new Promise((resolve) => {
          writeStream.write(JSON.stringify(entry) + "\n", () => {
            countWithArxiv++;
            countWithArxivAndInSquai++;
            resolve();
          });
        });
      } else {
        countWithArxiv++;
      }
    } else {
      countWithoutArxiv++;
    }
  }
  console.log("countWithArxiv: " + countWithArxiv);
  console.log("countWithArxivAndInSquai: " + countWithArxivAndInSquai);
  console.log("countWithoutArxiv: " + countWithoutArxiv);
}
processLineByLine();
