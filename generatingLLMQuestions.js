const fs = require("fs");
const readline = require("readline");
require("dotenv").config();
const https = require("https");
const pdf = require("pdf-parse");
const SCADS_API_KEY = "sk-AnHIy5NzsbmejCuuIlAvUQ";
const ARXIV_API_KEY = "9SVrGeKtlt3aUG3Qz573y80cXEGGdma93BLipzJI";
const { Agent, fetch } = require("undici");

promptTemplate = `
You will be be provided 5 scientific paper text, which share same topic that they are talking about. They will be provided in the following format:

[
  {
    ArXiv: string,
    text: string,
  }
]

You should do the following:
Step 1: Read the given scientific paper texts and extract a list of 15 important keywords for each of them. Focus on important concepts or entities within the paper. Avoid using generic or broad words.
Step 2: Generate 5 scientific question-answer pairs, with the following requirements.
Requirements:
-questions should be as diverse as possible, asking the same thing twice with different wording is not acceptable
-try to cover a whole range of topics, that are discussed in the different papers
-questions should be based on the information provided in multiple of the papers
-try generating questions, that require multiple papers to answer
-questions must be context independently answerable, so no reference to a specific paper or entities that you can only understand with the specific paper. Questions should have the same character, as if you would ask an expert in their field something, without having a specific paper in mind. Do not refer to external sources like figures or tables.
-questions cannot contain explicit references to the papers or its content such as "in this paper", "the proposed methods" or similar
-questions should be complex, avoid simple or definitional questions
-try answering the question as specific as possible
-add the arxiv ids of the papers, that contain the relevant information for answering the question
-only add the arxiv id of the paper if it really did contribute significantly to the answer of the question

provide your answer, stricly following this json format:
[
{
"question": "<YOUR_QUESTION>"
"answer": "<YOUR ANSWER>",
"papers":[<ARXIV_ID_1>, <ARXIV_ID_2>, ...]
}
]
Do not deviate from this schema. Dont add the keywords you generated. Do not add any preciding information like json:
Paper Texts:

`;

const buildPrompt = (texts) => promptTemplate.concat(JSON.stringify(texts));

const delay = (ms) => new Promise((res) => setTimeout(res, ms));
// --- CONFIGURATION ---
const INPUT_FILE = "datasetGeneration/all_paper_ids.txt";
// const OUTPUT_FILE = "datasetGeneration";
// ---------------------

async function getAllSquaiArxivIds() {
  const fileStream = fs.createReadStream(INPUT_FILE);
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
  return arrayWithAllIds;
}

async function getPdfLinkFromArxivApi(arxivId) {
  // 1. Construct the API Query
  const baseUrl = "http://export.arxiv.org/api/query";
  const params = new URLSearchParams({
    id_list: arxivId, // You can pass multiple IDs separated by commas
    start: 0,
    max_results: 1,
  });

  const url = `${baseUrl}?${params.toString()}`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

    const xmlText = await response.text();

    const linkMatch = xmlText.match(/<link\s+href="([^"]+)"[^>]*title="pdf"/);

    if (linkMatch && linkMatch[1]) {
      return linkMatch[1]; // Returns: https://arxiv.org/pdf/2102.01420v1
    }
    const idMatch = xmlText.match(
      /<id>(http:\/\/arxiv\.org\/abs\/[^<]+)<\/id>/
    );
    if (idMatch && idMatch[1]) {
      return idMatch[1].replace("/abs/", "/pdf/") + ".pdf";
    }
  } catch (error) {
    console.log(error);
  }
}

function downloadPdfToBuffer(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: { "User-Agent": "ResearchScript/1.0" },
      },
      (res) => {
        // 1. Handle Redirects (ArXiv does this often)
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          console.log(`[REDIRECT] -> ${res.headers.location}`);
          downloadPdfToBuffer(res.headers.location).then(resolve).catch(reject);
          return;
        }

        // 2. Check for Errors
        if (res.statusCode !== 200) {
          reject(new Error(`Failed to download. Status: ${res.statusCode}`));
          return;
        }

        // 3. Collect Data Chunks
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));

        res.on("end", () => {
          // Combine chunks into a single Buffer
          const buffer = Buffer.concat(chunks);
          resolve(buffer);
        });
      }
    );

    request.on("error", (err) => reject(err));
  });
}
async function processPaper(pdfUrl) {
  try {
    // console.log(`[DOWNLOADING] ${pdfUrl}...`);
    console.log(pdfUrl);
    const pdfBuffer = await downloadPdfToBuffer(pdfUrl);

    // console.log(`[PARSING] ${pdfBuffer.length} bytes...`);
    const data = await pdf(pdfBuffer);

    // --- CLEANUP ---
    // PDF text is often messy. This regex removes excessive newlines and page numbers.
    let cleanText = data.text
      .replace(/\n\s*\n/g, "\n") // Remove multiple empty lines
      .trim();

    // 2. Remove Page Numbers (standalone digits on a new line)
    // Matches a line that is just a number, like "1" or " 2 "
    cleanText = cleanText.replace(/^\s*\d+\s*$/gm, " ");

    // 3. Fix Hyphenation (word- break -> wordbreak)
    // Matches: "word-" + newline + "rest"
    cleanText = cleanText.replace(/(\w)-\n(\w)/g, "$1$2");

    // 4. Remove excessive newlines (3+ lines -> 2 lines)
    cleanText = cleanText.replace(/\n\s*\n\s*\n/g, "\n\n");

    // 5. Fix missing spaces after commas (common pdf-parse bug)
    // "Jiang,Senior" -> "Jiang, Senior"
    cleanText = cleanText.replace(/,([A-Z])/g, ", $1");

    return cleanText.trim();
  } catch (error) {
    console.error("Error processing PDF:", error.message);
    return null;
  }
}

async function getRawPaperData(arxivId) {
  // 1. Define the fields you want the API to return in the object
  const fields =
    "title,references.title,references.externalIds,references.year,references.url";

  // 2. Construct the URL with a high limit (max 1000) to get all refs
  const url = `https://api.semanticscholar.org/graph/v1/paper/ARXIV:${arxivId}?fields=${fields}&limit=1000`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "ResearchScript/1.0",
        "x-api-key": ARXIV_API_KEY,
      },
    });

    // 3. Return the whole JSON object directly
    return await response.json();
  } catch (error) {
    console.error("Fetch failed:", error.message);
    return { error: error.message };
  }
}

async function askLLM(promptText) {
  const url = "https://llm.scads.ai/v1/chat/completions";

  const customDispatcher = new Agent({
    headersTimeout: 1800000, // 30 minutes in milliseconds
    bodyTimeout: 1800000, // 30 minutes
    connectTimeout: 1800000, // 30 minutes
  });
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SCADS_API_KEY}`,
      },
      dispatcher: customDispatcher,
      body: JSON.stringify({
        model: "Qwen/Qwen3-VL-8B-Instruct",
        // model: "meta-llama/Llama-3.3-70B-Instruct",
        messages: [{ role: "user", content: promptText }],
        temperature: 0.7,
      }),
    });
    console.log(response);

    if (!response.ok) throw new Error(`API Error: ${response.status}`);

    const data = await response.json();

    // Return JUST the text answer
    return data.choices[0].message.content;
  } catch (error) {
    console.error("Failed:", error);
    return null;
  }
}

const main = async () => {
  const allSquaiArxivIds = await getAllSquaiArxivIds();
  //   console.log(a);
  //   await getReferencesWithLinks("2102.01420");
  const startingPaperId = "1501.07614";

  const b = await getPdfLinkFromArxivApi(startingPaperId);
  const startingPaperText = await processPaper(b);

  const c = await getRawPaperData(startingPaperId);

  const referencesInUnarxiveCorpus = c.references.filter(
    (paper) =>
      paper.externalIds?.ArXiv &&
      allSquaiArxivIds.includes(paper.externalIds?.ArXiv)
  );
  console.log("-------------------------------------------------------------");
  console.log(
    "References in squai dataset: " + referencesInUnarxiveCorpus.length
  );
  console.log("-------------------------------------------------------------");

  if (referencesInUnarxiveCorpus.length < 4) {
    return;
  }
  const randomReferences = referencesInUnarxiveCorpus
    .sort(() => 0.5 - Math.random())
    .slice(0, 4); // 2. Take the first 4 items

  references = [];
  for (reference of randomReferences) {
    await delay(3000);
    const pdfLink = await getPdfLinkFromArxivApi(reference.externalIds.ArXiv);
    const paperText = await processPaper(pdfLink);
    references.push({
      ArXiv: reference.externalIds.ArXiv,
      text: paperText,
    });
  }

  references.push({
    ArXiv: startingPaperId,
    text: startingPaperText,
  });
  //todo this should be adjustet no?
  validReferencesAdjustedToFitContext = references.map((entry) => {
    if (entry.text?.length < 60000) {
      return entry;
    }
    return {
      text:
        "First 30000 characters: " +
        entry.text.substring(0, 30000) +
        "Last 30000 characters: " +
        entry.text.substring(entry.text.length - 30000),
      ArXiv: entry.ArXiv,
    };
  });

  const prompt = buildPrompt(validReferencesAdjustedToFitContext);
  console.log("-------------------------------------------------------------");

  console.log("Answering with LLM:");
  const answer = await askLLM(prompt);
  console.log(answer);
  fs.writeFileSync(
    `test.txt`,
    JSON.stringify(validReferencesAdjustedToFitContext, null, 2)
  );
  fs.writeFileSync(`answer.txt`, answer);
};

main();
