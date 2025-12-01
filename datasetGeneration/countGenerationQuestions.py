import json
import time


# Load environment variables from .env file

# --- CONFIGURATION ---
INPUT_FILE = "datasetGeneration/finishedContextExtractionResult.jsonl"
INPUT_FILE_QUESTIONS = "datasetGeneration/validationQuestions.jsonl"
# ---------------------

def process_line_by_line():
    dataset_question_array = []
    
    # Read validation questions line by line
    with open(INPUT_FILE_QUESTIONS, 'r', encoding='utf-8') as file_stream_validation:
        for line in file_stream_validation:
            line = line.strip()
            if line:
                entry = json.loads(line)
                dataset_question_array.append(entry["question"])

    answered_questions = []
    
    # Read extraction results line by line
    with open(INPUT_FILE, 'r', encoding='utf-8') as file_stream_extraction:
        for line in file_stream_extraction:
            line = line.strip()
            if line:
                entry = json.loads(line)
                if entry:
                    answered_questions.append(entry)
                    print(json.dumps(entry["referencesWithLLM"]))



if __name__ == "__main__":
    process_line_by_line()