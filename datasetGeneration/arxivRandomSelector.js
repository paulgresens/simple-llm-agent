const fs = require("fs");
const readline = require("readline");

// --- CONFIGURATION ---
const INPUT_FILE = "datasetGeneration/processedFilteredAndJsonl.jsonl";
// OUTPUT_FILE = "datasetGeneration/random2000.jsonl";
// ---------------------

async function processLineByLine() {
  const fileStream = fs.createReadStream(INPUT_FILE);
  const writeStream = fs.createWriteStream(OUTPUT_FILE, { flags: "w" });

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity, // Recognizes all instances of CR LF as a single line break
  });
  const allEntries = [];

  for await (const line of rl) {
    const entry = JSON.parse(line);
    allEntries.push(entry);
  }
  let selectedEntries = [];
  let i = 0;
  while (i < 2000) {
    const randomIndex = Math.floor(Math.random() * allEntries.length);
    const entryToAdd = allEntries[randomIndex];
    const alreadyIn = selectedEntries.find(
      (entry) => entry.id === entryToAdd.id
    );
    if (!alreadyIn) {
      selectedEntries.push(entryToAdd);
      const line = JSON.stringify(entryToAdd) + "\n";
      writeStream.write(line);
      i++;
    }
  }
}
processLineByLine();
