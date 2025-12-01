const fs = require("fs");
const { stringify } = require("querystring");
const readline = require("readline");
require("dotenv").config();

// --- CONFIGURATION ---
const INPUT_FILE = "evaluationResultCombined.jsonl";
// ---------------------

async function processLineByLine() {
  const allQuestions = [];
  const questionsReadStream = fs.createReadStream(INPUT_FILE);
  const questionsReadStreamInterface = readline.createInterface({
    input: questionsReadStream,
    crlfDelay: Infinity,
  });
  for await (const q of questionsReadStreamInterface) {
    const entry = JSON.parse(q);
    allQuestions.push(entry);
  }
  questionsReadStreamInterface.close();

  console.log("--------------------");
  console.log("PARSED " + allQuestions.length + " QUESTIONS");
  console.log("--------------------");

  const referencesKeys = [
    "referencesNative",
    "referencesBiencoderTop1",
    "referencesBM25Top1",
    "referencesBiencoderTop10Bm25Top1",
    "referencesBM25Top10BiencoderTop1",
    "referencesBiencoderTop10CrossEncoderTop1",
    "referencesBM25Top10CrossEncoderTop1",
    "referencesBiencoderAndBm25Top1",
    "referencesBiencoderAndBm25Top10CrossEncoderTop1",
    "referencesWithLLM",
  ];

  const judgementsOnSentenceLevel = [
    "faithfulness",
    "contextRelevance",
    // this sums the absolute values of the judgements on each sentence and is later divided by the count of sentences to achieve the average
    "contradiction",
    "neutral",
    "entailment",
    //-----------
    // this sums up the occurance of the actual label
    "contradictionPercentage",
    "neutralPercentage",
    "entailmentPercentage",
    //-----------
  ];

  //this collects for the whole question and is later calculating percentage score
  const spansWithoutGoldSummedUp = Object.fromEntries(
    referencesKeys.map((key) => [
      key,
      Object.fromEntries(judgementsOnSentenceLevel.map((key) => [key, 0])),
    ]),
  );
  const spansWithGoldSummedUp = Object.fromEntries(
    referencesKeys.map((key) => [
      key,
      Object.fromEntries(judgementsOnSentenceLevel.map((key) => [key, 0])),
    ]),
  );

  for (const question of allQuestions) {
    const referencesWithoutGold = question["withoutGold"];
    const referencesWithGold = question["withGold"];

    referencesKeys.forEach((key) => {
      let referencesAtThisKeyWithoutGold = Object.values(
        referencesWithoutGold[key],
      ).flat();
      let referencesAtThisKeyWithGold = Object.values(
        referencesWithGold[key],
      ).flat();

      // for native references the judgement key holds an array with multiple judgements so flatten this out
      if (key === "referencesNative") {
        referencesAtThisKeyWithoutGold = referencesAtThisKeyWithoutGold.flatMap(
          (entry) =>
            entry.judgement.map((judgement) => ({
              ...entry,
              judgement,
            })),
        );

        referencesAtThisKeyWithGold = referencesAtThisKeyWithGold.flatMap(
          (entry) =>
            entry.judgement.map((judgement) => ({
              ...entry,
              judgement,
            })),
        );
      }
      // end of flattening

      //collecting the judgement sentence level  - without gold
      const referencesAtThisKeyWithoutGoldSummedUp = Object.fromEntries(
        judgementsOnSentenceLevel.map((key) => [key, 0]),
      );

      referencesAtThisKeyWithoutGold.forEach((r) => {
        referencesAtThisKeyWithoutGoldSummedUp["faithfulness"] +=
          r["judgement"]["faithfulness"]["result"];

        referencesAtThisKeyWithoutGoldSummedUp["contextRelevance"] +=
          r["judgement"]["contextRelevance"]["result"];

        referencesAtThisKeyWithoutGoldSummedUp["contradiction"] +=
          r["judgement"]["entailment"]["contradiction"];
        referencesAtThisKeyWithoutGoldSummedUp["neutral"] +=
          r["judgement"]["entailment"]["neutral"];
        referencesAtThisKeyWithoutGoldSummedUp["entailment"] +=
          r["judgement"]["entailment"]["entailment"];

        const entailmentLabel = r["judgement"]["entailment"]["label"];
        referencesAtThisKeyWithoutGoldSummedUp[
          entailmentLabel + "Percentage"
        ] += 1;
      });

      Object.keys(referencesAtThisKeyWithoutGoldSummedUp).forEach(
        (judgementKey) => {
          //obtain actual percentage measure for the whole question and sum up to top level
          spansWithoutGoldSummedUp[key][judgementKey] +=
            referencesAtThisKeyWithoutGoldSummedUp[judgementKey] /
            referencesAtThisKeyWithoutGold.length;
        },
      );

      //collecting the judgement for the spans under this method  - with gold

      const referencesAtThisKeyWithGoldSummedUp = Object.fromEntries(
        judgementsOnSentenceLevel.map((key) => [key, 0]),
      );

      referencesAtThisKeyWithGold.forEach((r) => {
        referencesAtThisKeyWithGoldSummedUp["faithfulness"] +=
          r["judgement"]["faithfulness"]["result"];

        referencesAtThisKeyWithGoldSummedUp["contextRelevance"] +=
          r["judgement"]["contextRelevance"]["result"];

        referencesAtThisKeyWithGoldSummedUp["contradiction"] +=
          r["judgement"]["entailment"]["contradiction"];
        referencesAtThisKeyWithGoldSummedUp["neutral"] +=
          r["judgement"]["entailment"]["neutral"];
        referencesAtThisKeyWithGoldSummedUp["entailment"] +=
          r["judgement"]["entailment"]["entailment"];

        const entailmentLabel = r["judgement"]["entailment"]["label"];
        referencesAtThisKeyWithGoldSummedUp[entailmentLabel + "Percentage"] +=
          1;
      });

      Object.keys(referencesAtThisKeyWithGoldSummedUp).forEach(
        (judgementKey) => {
          //obtain actual percentage measure for the whole question and sum up to top level
          spansWithGoldSummedUp[key][judgementKey] +=
            referencesAtThisKeyWithGoldSummedUp[judgementKey] /
            referencesAtThisKeyWithGold.length;
        },
      );
    });
  }

  console.log("############ WITHOUT GOLD ##############");
  Object.keys(spansWithoutGoldSummedUp).forEach((key) => {
    Object.keys(spansWithoutGoldSummedUp[key]).forEach((judgementKey) => {
      // this has the summed up percentages of all questions, so divide to get the actual percentage measure
      spansWithoutGoldSummedUp[key][judgementKey] /= allQuestions.length;
    });
  });
  console.log(JSON.stringify(spansWithoutGoldSummedUp, null, 2));

  console.log("############ WITH GOLD ##############");

  Object.keys(spansWithGoldSummedUp).forEach((key) => {
    Object.keys(spansWithGoldSummedUp[key]).forEach((judgementKey) => {
      // this has the summed up percentages of all questions, so divide to get the actual percentage measure
      spansWithGoldSummedUp[key][judgementKey] /= allQuestions.length;
    });
  });
  console.log(JSON.stringify(spansWithGoldSummedUp, null, 2));
}

processLineByLine();
