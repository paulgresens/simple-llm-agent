
import json
from typing import Any

with open("config.json", "r") as config:
    config = json.load(config)


def buildJudgementPrompt(promptTemplate: str, claim:str, context: str)->str:
    return promptTemplate.format(claim=claim,context=context)

def buildContextSearchPrompt(promptTemplate: str, paperText: str, claim: str)->str:
    return promptTemplate.format(paperText=paperText, claim=claim)

def loadClaimContextPairs() -> Any:
    with open(config.get("claimsAndContextsFilePath"), "r") as claimsAndContextsFile:
      return json.load(claimsAndContextsFile)

def printAndLog(log: str) -> None:
   print(log)
   with open(config.get("outputFilePath"),"a") as outputFile:
      outputFile.write(log)