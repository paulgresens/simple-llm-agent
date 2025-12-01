const fs = require("fs");
const readline = require("readline");
require("dotenv").config();

// --- CONFIGURATION ---
const INPUT_FILE = "datasetGeneration/finishedContextExtractionResult.jsonl";
const INPUT_FILE_QUESTIONS = "datasetGeneration/validationQuestions.jsonl"
// ---------------------

async function processLineByLine() {
  const fileStreamExtractionResult = fs.createReadStream(INPUT_FILE);
  
  const readLineExtractionResults = readline.createInterface({
    input: fileStreamExtractionResult,
    crlfDelay: Infinity, // Recognizes all instances of CR LF as a single line break
  });
  
  const fileStreamValidationQuestions = fs.createReadStream(INPUT_FILE_QUESTIONS);
  
  const rlValiation = readline.createInterface({
    input: fileStreamValidationQuestions,
    crlfDelay: Infinity, // Recognizes all instances of CR LF as a single line break
  });
  const datasetQuestionArray  = []
  for await (const line of rlValiation){
    const entry = JSON.parse(line)
    datasetQuestionArray.push(entry.question)
  }

  let time = 0;

  const answeredQuestions = []
  for await (const line of readLineExtractionResults) {
    const entry = JSON.parse(line);
    if (entry){
      answeredQuestions.push(entry.meta.question)

    }
  }

console.log("answeredQuestions " + answeredQuestions.length)
console.log("datasetQuestionArray: " + datasetQuestionArray.length)

  const unansweredQuestions = datasetQuestionArray.filter((entry) => !answeredQuestions.includes(entry))

  const mystery = answeredQuestions.filter((entry) => !datasetQuestionArray.includes(entry))
  console.log("loaded answered questions:  " + answeredQuestions.length)
  console.log("answered count:             " + answeredQuestions.length)
  console.log("questions count:            " + datasetQuestionArray.length) 
  console.log("however the fuck missmatch: " + mystery.length)
  for (const u of unansweredQuestions){
    const index = datasetQuestionArray.findIndex((entry) => entry === u)
    console.log("---------------------------")
    console.log(u)
    console.log(u.length)
    console.log(datasetQuestionArray[index])
    console.log(datasetQuestionArray[index].length)
    console.log(u === datasetQuestionArray[index])
    console.log("---------------------------")
        
  }
  console.log("-----------------------------------")



}
processLineByLine();
