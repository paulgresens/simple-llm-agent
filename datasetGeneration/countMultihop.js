const fs = require("fs");
const readline = require("readline");
require("dotenv").config();

// --- CONFIGURATION ---
const INPUT_FILE = "datasetGeneration/generatedQuestions.jsonl";
// const INPUT_FILE = "datasetGeneration/filteredOnlyMultihop.jsonl";

// ---------------------

async function processLineByLine() {
  const fileStreamExtractionResult = fs.createReadStream(INPUT_FILE);
  
  const readLineExtractionResults = readline.createInterface({
    input: fileStreamExtractionResult,
    crlfDelay: Infinity, // Recognizes all instances of CR LF as a single line break
  });

  const answeredQuestions = []
  for await (const line of readLineExtractionResults) {
    const entry = JSON.parse(line);
    if (entry){
      answeredQuestions.push(entry)

    }
  }

  let generaterAnnotatedUsage = 0
  let judgeAnnotatedUsage = 0 
  let multihopGeneratorAnnotation = 0
  let multihopJudgeAnnotion = 0
  
  let generatorUsageTimes = [0,0,0,0,0,0]
  let judgeUsageTimes = [0,0,0,0,0,0]

  let questionsWhereJudgeSays3 = []
  let questionsWhereFetchFailed = []
  let categoryErrorCount = 0
  let shortedQuestions = null

  answeredQuestions.forEach((question) => {
    annotatorUsage = question["usageJudgementGeneratorLLM"].length
    generaterAnnotatedUsage += annotatorUsage
    if (annotatorUsage > 1){
      multihopGeneratorAnnotation++;
    }
    generatorUsageTimes[annotatorUsage]++

    judgeUsage = question["usageJudgeResult"].filter((e) => e.wasUsed).length
    judgeAnnotatedUsage += judgeUsage 
    if (judgeUsage > 1){
      multihopJudgeAnnotion++;
    }
    if (judgeUsage == 3){
      const countCsQuestion = question.papersInputtedForGeneration.filter((p) => p.category?.startsWith("cs.")).length
      if (countCsQuestion > 2){
        questionsWhereJudgeSays3.push(question["question"])
      }
    }

    categoryErrorCount+= question.papersInputtedForGeneration.filter((p) => !p.category).length
    judgeUsageTimes[judgeUsage]++

    if (question.paperTextLengths.filter(p => p.textLength < 500).length){
      questionsWhereFetchFailed.push(question)
    }

    if (!shortedQuestions){
      shortedQuestions = question
    } else {
      if (shortedQuestions["question"].length > question["question"].length){
        shortedQuestions = question
      }
    }
  })
  console.log("\n")
  console.log("=========================================================================")
  console.log("total questions generated:   " + answeredQuestions.length)
  console.log("\n")

  console.log("==============================GENERATOR LLM==============================")
  console.log("avg. paper usage annotated: " + generaterAnnotatedUsage / answeredQuestions.length)
  console.log(">2 papers annotated:        " + multihopGeneratorAnnotation)
  console.log("usage distribution (0-5):   " + "[" + generatorUsageTimes.join(", ")+ "]") 
  console.log("usage distribution (%):     " + "[" + generatorUsageTimes.map(e =>  (Math.round( e/answeredQuestions.length * 10000) / 100) + "%").join(", ")+ "]") 
  console.log("\n")
  console.log("==============================JUDGE LLM==================================")
  console.log("avg. paper usage annotated: " + judgeAnnotatedUsage / answeredQuestions.length)
  console.log(">2 papers annotated:        " + multihopJudgeAnnotion)
  console.log("usage distribution (0-5):   " + "[" + judgeUsageTimes.join(", ")+ "]") 
  console.log("usage distribution:         " + "[" + judgeUsageTimes.map(e =>  (Math.round( e/answeredQuestions.length * 10000) / 100) + "%").join(", ")+ "]") 
  console.log("=========================================================================")
  console.log("% true multihop:            " + Math.round((multihopJudgeAnnotion/multihopGeneratorAnnotation) * 10000) / 100 + "%") 
  console.log("PROGRESS:                   " + multihopJudgeAnnotion + " / 500 (" + Math.round((multihopJudgeAnnotion / 500) * 10000) / 100  + "%)"  )
  console.log("CS questions with 3 papers: " + questionsWhereJudgeSays3.length)
  console.log("category error:             " + categoryErrorCount)
  console.log("questionsWhereFetchFailed:  " + questionsWhereFetchFailed.length)
  console.log(JSON.stringify(questionsWhereFetchFailed.map(q => q.question),null,2))
  // console.log(JSON.stringify(questionsWhereJudgeSays3,null,2))
  // console.log(JSON.stringify(shortedQuestions,null,2))


}
processLineByLine();