const fs = require("fs");
const readline = require("readline");
require("dotenv").config();

// --- CONFIGURATION ---
const INPUT_FILE = "datasetGeneration/withFuzzy.jsonl";
// ---------------------

async function processLineByLine() {
  const fileStream = fs.createReadStream(INPUT_FILE);

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity, // Recognizes all instances of CR LF as a single line break
  });

  let counterHallucination = 0;
  let counterCitation = 0;

  for await (const line of rl) {
    let counterHallucinationSingleEntry = 0
    let counterCitationSingleEntry = 0
    const entry = JSON.parse(line);
    for (const e of Object.entries(entry["referencesWithLLM"])){
      for (const b of e[1]){
        if (b.hallucinationCheck.partialRatio > 95){
          counterCitation++;
          counterCitationSingleEntry++;
        } else {
          counterHallucination++;
          counterHallucinationSingleEntry++
        }
      }
    }
    console.log("counterHallucinationSingleEntry: " + counterHallucinationSingleEntry)
    console.log("counterCitationSingleEntry: " + counterCitationSingleEntry)
  }

  console.log("-----------------------------------")
  console.log("counterHallucination: " + counterHallucination)
  console.log("counterCitation:" + counterCitation)
}
processLineByLine();



/**
 *                   hallu/quote
 * without fuzzy:    79 - 42
 * with fuzzy:       72 - 49
 */