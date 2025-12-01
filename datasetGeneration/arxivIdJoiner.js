const fs = require("fs");
const readline = require("readline");
require("dotenv").config();

const apiKey = process.env.SEMANTIC_SCHOLAR_API_KEY;

// --- CONFIGURATION ---
const INPUT_FILE = "datasetGeneration/final1000.jsonl";
const OUTPUT_FILE = "datasetGeneration/processedFinal1000.jsonl";
const LOG_FILE = "log.jsonl";
const STEP_SIZE = 100;
// ---------------------

async function processLineByLine() {
  const fileStream = fs.createReadStream(INPUT_FILE);
  const writeStream = fs.createWriteStream(OUTPUT_FILE, { flags: "w" });
  const errorStream = fs.createWriteStream(LOG_FILE, { flags: "w" });

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity, // Recognizes all instances of CR LF as a single line break
  });

  let counter = 0;
  batchItems = [];

  for await (const line of rl) {
    const entry = JSON.parse(line);
    if (!entry.pfusch) {
      batchItems.push(entry);
    }

    if (batchItems.length < STEP_SIZE && !entry.pfusch) {
      continue;
    }
    const ids = batchItems.map(
      ({ doi }) =>
        `DOI:${doi.replace(/^(10\.\d+)-/, "$1/").replace(/\.json$/i, "")}`
    );

    console.log(`${counter} (${((counter / 22744) * 100).toFixed(2)}%)`);

    try {
      response = await fetch(
        "https://api.semanticscholar.org/graph/v1/paper/batch?fields=externalIds,title",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": apiKey },
          body: JSON.stringify({ ids }),
        }
      );
      const result = await response.json();
      console.log("BATCH RETURN: " + result.length);
      for (let i = 0; i < batchItems.length; i++) {
        const paperWithExternalIds = {
          externalIds: result[i]?.["externalIds"] ?? null,
          ...batchItems[i],
        };
        await new Promise((resolve) => {
          writeStream.write(JSON.stringify(paperWithExternalIds) + "\n", () => {
            resolve(); // This runs when the chunk is successfully flushed
          });
        });
      }
    } catch (error) {
      errorStream.write(JSON.stringify(error));
      console.log("HERE ERROR WTF WTF WTF WTF WTF");
      console.log(error);
      batchItems = [];
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    batchItems = [];
    counter += STEP_SIZE;
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}

processLineByLine();
