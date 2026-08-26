const fs = require("fs");
const { stringify } = require("querystring");
const readline = require("readline");
require("dotenv").config();

// --- CONFIGURATION ---
const INPUT_FILE = "evaluationResultCombined.jsonl";
// ---------------------

const isMissing = (v) => v === null || v === undefined;

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
  const judgementsOnQuestionLevel = [
    "withoutGoldAnswerCorrectness",
    "withoutGoldAnswerRelevancy",
    "withGoldAnswerCorrectness",
    "withGoldAnswerRelevancy",
  ];
  const metricsOnQuestionLevel = Object.fromEntries(
    judgementsOnQuestionLevel.map((key) => [key, 0]),
  );

  const durationKeys = [
    "answerGeneration",
    "referencesNativeDuration",
    "referencesBiencoderTop1Duration",
    "referencesBM25Top1Duration",
    "referencesBiencoderTop10Bm25Top1Duration",
    "referencesBM25Top10BiencoderTop1Duration",
    "referencesBiencoderTop10CrossEncoderTop1Duration",
    "referencesBM25Top10CrossEncoderTop1Duration",
    "referencesBiencoderAndBm25Top1Duration",
    "referencesBiencoderAndBm25Top10CrossEncoderTop1Duration",
    "referencesWithLLMDuration",
  ];

  const errorsAtTheseQuestions = {};

  const duration = {
    withoutGold: Object.fromEntries(durationKeys.map((key) => [key, 0])),
    withGold: Object.fromEntries(durationKeys.map((key) => [key, 0])),
  };

  //referencesWithLLMSeeIfHallucination
  let partialRatioWithSourceTextWithoutGold = 0;
  let partialRatioWithSourceTextWithGold = 0;

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

    //evaluating on question - answer level
    metricsOnQuestionLevel["withoutGoldAnswerCorrectness"] +=
      question["quoteJudgement"]["withoutGold"]["answerCorrectness"]["result"];
    metricsOnQuestionLevel["withoutGoldAnswerRelevancy"] +=
      question["quoteJudgement"]["withoutGold"]["answerRelevancy"]["result"];
    metricsOnQuestionLevel["withGoldAnswerCorrectness"] +=
      question["quoteJudgement"]["withGold"]["answerCorrectness"]["result"];
    metricsOnQuestionLevel["withGoldAnswerRelevancy"] +=
      question["quoteJudgement"]["withGold"]["answerRelevancy"]["result"];

    const errorsAtThisQuestion = {};

    if (
      isMissing(
        question["quoteJudgement"]["withoutGold"]["answerCorrectness"][
          "result"
        ],
      )
    ) {
      errorsAtThisQuestion["answerCorrectness"] =
        (errorsAtThisQuestion["answerCorrectness"] ?? 0) + 1;
    }
    if (
      isMissing(
        question["quoteJudgement"]["withoutGold"]["answerRelevancy"]["result"],
      )
    ) {
      errorsAtThisQuestion["answerRelevancy"] =
        (errorsAtThisQuestion["answerRelevancy"] ?? 0) + 1;
    }
    if (
      isMissing(
        question["quoteJudgement"]["withGold"]["answerCorrectness"]["result"],
      )
    ) {
      errorsAtThisQuestion["answerCorrectness"] =
        (errorsAtThisQuestion["answerCorrectness"] ?? 0) + 1;
    }
    if (
      isMissing(
        question["quoteJudgement"]["withGold"]["answerRelevancy"]["result"],
      )
    ) {
      errorsAtThisQuestion["answerRelevancy"] =
        (errorsAtThisQuestion["answerRelevancy"] ?? 0) + 1;
    }

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

      // sum up partial ratios for the generative LLM extracted spans
      if (key == "referencesWithLLM") {
        partialRatioWithSourceTextWithoutGold +=
          referencesAtThisKeyWithoutGold
            .map((r) => r.hallucinationCheck.partialRatioWithSourceText)
            .reduce((total, n) => total + n, 0) /
          referencesAtThisKeyWithoutGold.length;

        partialRatioWithSourceTextWithGold +=
          referencesAtThisKeyWithGold
            .map((r) => r.hallucinationCheck.partialRatioWithSourceText)
            .reduce((total, n) => total + n, 0) /
          referencesAtThisKeyWithGold.length;
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

        if (isMissing(r["judgement"]["faithfulness"]["result"])) {
          errorsAtThisQuestion["faithfulness"] =
            (errorsAtThisQuestion["faithfulness"] ?? 0) + 1;
        }
        if (isMissing(r["judgement"]["contextRelevance"]["result"])) {
          errorsAtThisQuestion["contextRelevance"] =
            (errorsAtThisQuestion["contextRelevance"] ?? 0) + 1;
        }
        if (isMissing(r["judgement"]["entailment"]["contradiction"])) {
          errorsAtThisQuestion["contradiction"] =
            (errorsAtThisQuestion["contradiction"] ?? 0) + 1;
        }
        if (isMissing(r["judgement"]["entailment"]["neutral"])) {
          errorsAtThisQuestion["neutral"] =
            (errorsAtThisQuestion["neutral"] ?? 0) + 1;
        }
        if (isMissing(r["judgement"]["entailment"]["entailment"])) {
          errorsAtThisQuestion["entailment"] =
            (errorsAtThisQuestion["entailment"] ?? 0) + 1;
        }
        if (!entailmentLabel) {
          errorsAtThisQuestion["entailmentLabel"] =
            (errorsAtThisQuestion["entailmentLabel"] ?? 0) + 1;
        }
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

        if (isMissing(r["judgement"]["faithfulness"]["result"])) {
          errorsAtThisQuestion["faithfulness"] =
            (errorsAtThisQuestion["faithfulness"] ?? 0) + 1;
        }
        if (isMissing(r["judgement"]["contextRelevance"]["result"])) {
          errorsAtThisQuestion["contextRelevance"] =
            (errorsAtThisQuestion["contextRelevance"] ?? 0) + 1;
        }
        if (isMissing(r["judgement"]["entailment"]["contradiction"])) {
          errorsAtThisQuestion["contradiction"] =
            (errorsAtThisQuestion["contradiction"] ?? 0) + 1;
        }
        if (isMissing(r["judgement"]["entailment"]["neutral"])) {
          errorsAtThisQuestion["neutral"] =
            (errorsAtThisQuestion["neutral"] ?? 0) + 1;
        }
        if (isMissing(r["judgement"]["entailment"]["entailment"])) {
          errorsAtThisQuestion["entailment"] =
            (errorsAtThisQuestion["entailment"] ?? 0) + 1;
        }
        if (!entailmentLabel) {
          errorsAtThisQuestion["entailmentLabel"] =
            (errorsAtThisQuestion["entailmentLabel"] ?? 0) + 1;
        }
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

    durationKeys.forEach((key) => {
      duration["withoutGold"][key] +=
        question["answerMeta"]["duration"]["withoutGold"][key];
      duration["withGold"][key] +=
        question["answerMeta"]["duration"]["withGold"][key];
    });

    if (Object.keys(errorsAtThisQuestion).length > 0) {
      errorsAtTheseQuestions[question["generationMeta"]["anchorPaper"]] =
        errorsAtThisQuestion;
    }
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

  console.log("############ QUESTION LEVEL METRICS ##############");

  //metrics on question level - obtain percentage measure
  Object.keys(metricsOnQuestionLevel).forEach((key) => {
    metricsOnQuestionLevel[key] /= allQuestions.length;
  });
  console.log(JSON.stringify(metricsOnQuestionLevel, null, 2));

  //duration
  console.log("############ DURATION ############");
  Object.keys(duration["withoutGold"]).forEach((key) => {
    duration["withoutGold"][key] /= allQuestions.length;
  });
  Object.keys(duration["withGold"]).forEach((key) => {
    duration["withGold"][key] /= allQuestions.length;
  });
  console.log(JSON.stringify(duration, null, 2));

  //hallucination check
  partialRatioWithSourceTextWithoutGold =
    partialRatioWithSourceTextWithoutGold / allQuestions.length;
  partialRatioWithSourceTextWithGold =
    partialRatioWithSourceTextWithGold / allQuestions.length;

  console.log("############ HALLUCINATION CHECK ############");
  console.log(
    "partialRatioWithSourceTextWithoutGold: " +
      partialRatioWithSourceTextWithoutGold,
  );
  console.log(
    "partialRatioWithSourceTextWithGold: " + partialRatioWithSourceTextWithGold,
  );

  console.log("############ ERRORS ############");
  console.log(JSON.stringify(errorsAtTheseQuestions));
}

processLineByLine();
