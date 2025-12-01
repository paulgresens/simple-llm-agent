const fs = require("fs");
const readline = require("readline");
require("dotenv").config();

// --- CONFIGURATION ---
const INPUT_FILE = "datasetGeneration/filteredTrueMultihopAndGood.jsonl";
const OUTPUT_FILE = "datasetGeneration/increasedSizeWithCategory.jsonl";
BATCH_SIZE = 10;
// ---------------------

// Assuming SEMANTIC_SCHOLAR_API_KEY is defined in your environment
// const SEMANTIC_SCHOLAR_API_KEY = 'your_api_key';

// async function getCategoryFromArxiv(arxivId) {
//   const baseUrl = "https://export.arxiv.org/api/query";

//   // Construct URL with parameters
//   const url = new URL(baseUrl);
//   url.searchParams.append("id_list", arxivId);
//   url.searchParams.append("max_results", "1");

//   const headers = {
//     "User-Agent":
//       "ResearchScript/1.0 (mailto:tb46ixev@studserv.uni-leipzig.de)",
//   };

//   try {
//     const response = await fetch(url, { headers });

//     if (!response.ok) {
//       throw new Error(`HTTP error! status: ${response.status}`);
//     }

//     const xmlText = await response.text();

//     // Regex to find the primary category (e.g., term="cs.LG")
//     const match = xmlText.match(/<arxiv:primary_category\s+term="([^"]+)"/);

//     if (!match) {
//       throw new Error("Primary category not found in the XML response.");
//     }

//     const category = match[1];

//     // check if this is really correct, maybe take secondary category

//     // Equivalent to time.sleep(2)
//     console.log("waiting 10 seconds fuck the arxiv api");
//     await new Promise((resolve) => setTimeout(resolve, 10000));

//     return category;
//   } catch (error) {
//     console.error(`Error fetching metadata for ${arxivId}: ${error.message}`);
//     return null; // Python returns None, which translates best to null in JS
//   }
// }

async function getCategoriesFromArxiv(arxivIds) {
  const baseUrl = "https://export.arxiv.org/api/query";

  const url = new URL(baseUrl);
  url.searchParams.append("id_list", arxivIds.join(","));
  url.searchParams.append("max_results", String(arxivIds.length));

  const headers = {
    "User-Agent":
      "ResearchScript/1.0 (mailto:tb46ixev@studserv.uni-leipzig.de)",
  };

  try {
    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    console.log(response.status);
    if (response.status === 429) {
      console.log("429 - sleeping for 30 minutes");
      await new Promise((r) => setTimeout(r, 1800000));
    }

    const xmlText = await response.text();

    const result = {};
    const entries = xmlText.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];

    for (const entry of entries) {
      const idMatch = entry.match(/<id>([^<]+)<\/id>/);
      const categoryMatch = entry.match(
        /<arxiv:primary_category\s+term="([^"]+)"/,
      );

      if (!idMatch || !categoryMatch) continue;

      const paperId = arxivIds.find((e) => idMatch[1].includes(e));
      const category = categoryMatch[1];

      result[paperId] = category;
    }

    return result;
  } catch (error) {
    console.error(`Error fetching arXiv metadata: ${error.message}`);
    return {};
  }
}

async function processLineByLine() {
  const fileStreamExtractionResult = fs.createReadStream(INPUT_FILE);
  const readLineExtractionResults = readline.createInterface({
    input: fileStreamExtractionResult,
    crlfDelay: Infinity, // Recognizes all instances of CR LF as a single line break
  });

  const outputReadStream = fs.createReadStream(OUTPUT_FILE);
  const readLineOutputRes = readline.createInterface({
    input: outputReadStream,
    crlfDelay: Infinity, // Recognizes all instances of CR LF as a single line break
  });

  const writeStream = fs.createWriteStream(OUTPUT_FILE, { flags: "a" });

  const questionsWithFixedCategories = [];
  for await (const line of readLineOutputRes) {
    const entry = JSON.parse(line);
    if (entry) {
      questionsWithFixedCategories.push(entry["anchorPaper"]);
    }
  }
  outputReadStream.close();
  console.log("Alredy fixed papers: " + questionsWithFixedCategories.length);

  for await (const line of readLineExtractionResults) {
    const entry = JSON.parse(line);
    if (entry) {
      if (questionsWithFixedCategories.includes(entry["anchorPaper"])) {
        console.log(
          "question with anchor: " +
            entry["anchorPaper"] +
            "already has fixed categories",
        );
        continue;
      }

      const paperIds = entry["papersInputtedForGeneration"].map(
        (e) => e["ArXiv"],
      );
      const paperCategories = await getCategoriesFromArxiv(paperIds);
      console.log(JSON.stringify(paperCategories));

      const fixedPapersInputtedForGeneration = entry[
        "papersInputtedForGeneration"
      ].map((p) => ({
        ...p,
        category:
          p["ArXiv"] in paperCategories ? paperCategories[p["ArXiv"]] : null,
      }));

      const isValid = fixedPapersInputtedForGeneration.every(
        (p) => typeof p.category === "string" && p.category.trim() !== "",
      );
      console.log(JSON.stringify(fixedPapersInputtedForGeneration, null, 2));

      console.log("SLEEPING 60 Seconds");
      await new Promise((r) => setTimeout(r, 15000));
      console.log("45");
      await new Promise((r) => setTimeout(r, 15000));
      console.log("30");
      await new Promise((r) => setTimeout(r, 15000));
      console.log("15");
      await new Promise((r) => setTimeout(r, 15000));

      if (!isValid) {
        continue;
      }
      console.log("fixed categories for anchor: " + entry["anchorPaper"]);
      await new Promise((resolve) => {
        writeStream.write(
          JSON.stringify({
            ...entry,
            papersInputtedForGeneration: fixedPapersInputtedForGeneration,
          }) + "\n",
          () => {
            resolve();
          },
        );
      });
    }
  }
}

processLineByLine();
