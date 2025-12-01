from typing import List, Dict
import json

questionGeneratorTemplate = """Here is a scientific paper:
{text}

Here is a two-step task for you.
Step 1: Read given scientific paper and extract
a list of 15 keywords focusing on the important
terms and concepts within the paragraph. Avoid
generic or broad words.
Step 2: Generate 10 scientific Q&A pairs as
diverse as possible based on facts and knowledge
presented in given paper, focusing on keywords
you generated. Keep the following requirements in
mind: Avoid ask simple or definitional questions.
Please assume that there is no corresponding paper
to refer to when asking questions, so ensure that
the questions and answers are self-contained (do
not refer to external sources like figures or tables,
or use demonstrative pronouns such as "this").
Incorporate specific data and insights from the
paper to create detailed and informative answers.
Ensure that the answers are concise, accurate, and
directly related to the corresponding questions.

Please present the generated keywords and
question-answer pairs in the following format:
Keywords: [keyword 1], [keyword 2], ..., [keyword15]

Q1: [Question 1]
A1: [Answer 1]
Q2: [Question 2]
A2: [Answer 2]
Q3: [Question 3]
A3: [Answer 3]
Q4: [Question 4]
A4: [Answer 4]
Q5: [Question 5]
A5: [Answer 5]
Q6: [Question 6]
A6: [Answer 6]
Q7: [Question 7]
A7: [Answer 7]
Q8: [Question 8]
A8: [Answer 8]
Q9: [Question 9]
A9: [Answer 9]
Q10: [Question 10]
A10: [Answer 10]
"""

def buildQuestionGeneratorPrompt (text:str)->str:
    return questionGeneratorTemplate.format(text=text)

#### RACAR prompts
relevancePromptTemplate = """Given a scientific paper and questions
generated from it, evaluate the relevance of the
question to the paper and return a score ranging
from 1–3 and give reasons as to why this score
was assigned. The output must be a list of dictionaries corresponding to each question, with the
fields ‘score’ and ‘reasons.’ If the question does
not pertain to the paper, assign a score of 1.
Paper: {text}
Questions: {questions}
Output:"""

def buildRelevancePrompt (text:str, questions: List[str])->str:
    return relevancePromptTemplate.format(text=text,questions=json.dumps(questions))


agnosticismPromptTemplate = """Given questions generated from a
scientific article, evaluate its context independence
and return a score ranging from 1–3. Identify
whether the question is referring to specific experimental setups, figures, or tables from the paper. For
example, questions like “What can we say about the
effect of varying pressure from Figure 1?” should
be assigned a score of 1. The output must be a
list of dictionaries corresponding to each question,
with the fields ‘score’ and ‘reasons.’
Questions: {questions}
Output:"""

def buildAgnosticismPrompt(questions: List[str])->str:
    return agnosticismPromptTemplate.format(questions=json.dumps(questions))

completenessPromptTemplate = """Given a scientific paper and question answer pairs generated from it, evaluate the
completeness of the answer for each question and
return a score ranging from 1–3 indicating the extent to which the answer fully addresses the question using the information in the paper, including
all subquestions. Also give reasons for assigning
the score. The output must be a list of dictionaries for each question answer pair, with the fields
‘score’ and ‘reasons.’
Paper: {text}
Questions: {qaPairs}
Output:"""

def buildCompletenessPrompt(text:str,qaPairs:List[Dict[str,str]])->str:
    return completenessPromptTemplate.format(text=text, qaPairs=json.dumps(qaPairs))

accuracyPromptTemplate = """Given a scientific paper and question
answer pairs generated from this scientific paper,
evaluate the accuracy of the answer for each question and return a score ranging from 1–3 indicating
whether the answer is accurately extracted from
the paper and give reasons as to why this score
was assigned. This involves checking the accuracy of any claims or statements made in the text,
and verifying that they are supported by evidence. The output must be a list of dictionaries for each
question answer pair, with the fields ‘score’ and
‘reasons.’
Paper: {text}
QA pairs: {qaPairs}
Output:"""

def buildAccuracyPrompt(text:str, qaPairs:List[Dict[str,str]])->str:
    return accuracyPromptTemplate.format(text=text, qaPairs=json.dumps(qaPairs))

reasonablenessPromptTemplate = """Given a scientific paper and statements, evaluate the reasonableness of the statements with respect to the paper and return a score
ranging from 1–3 indicating how logically consistent the content is, with no obvious contradictions
and provide reasons for assigning the score. The
output must be a list of dictionaries for each statement, with the fields ‘score’ and ‘reasons.’ Assign
a score of 1 if the statement has logical error like
contradicts.
Paper: {text}
Statements: {answers}
Output:"""

def buildReasonablenessPrompt(text: str, answers: List[str])->str:
    return reasonablenessPromptTemplate.format(text=text, answers=json.dumps(answers))
