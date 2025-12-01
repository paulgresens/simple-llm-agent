import os
import re
import time
import json
import random
import requests
import io
from PyPDF2 import PdfReader
from dotenv import load_dotenv

load_dotenv()

# --- CONFIGURATION ---
SCADS_API_KEY = os.getenv("SCADS_API_KEY")
ARXIV_API_KEY = os.getenv("ARXIV_API_KEY")
INPUT_FILE = "datasetGeneration/all_paper_ids.txt"

PROMPT_TEMPLATE = """
You will be be provided 5 scientific paper text, which share same topic that they are talking about. They will be provided in the following format:
[
  {
    "ArXiv": string,
    "text": string,
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
"""

def build_prompt(texts):
    return PROMPT_TEMPLATE + json.dumps(texts)

def get_all_squai_arxiv_ids():
    if not os.path.exists(INPUT_FILE):
        return []
    with open(INPUT_FILE, "r") as f:
        # Removes quotes and whitespace
        return [line.strip().replace('"', '') for line in f]

# def get_pdf_link_from_arxiv_api(arxiv_id):
#     base_url = "http://export.arxiv.org/api/query"
#     params = {
#         "id_list": arxiv_id,
#         "start": 0,
#         "max_results": 1
#     }
#     try:
#         response = requests.get(base_url, params=params)
#         response.raise_for_status()
#         xml_text = response.text

#         # Regex to find the PDF link
#         link_match = re.search(r'<link\s+href="([^"]+)"[^>]*title="pdf"', xml_text)
#         if link_match:
#             return link_match.group(1)
        
#         # Fallback to ID conversion
#         id_match = re.search(r'<id>(http://arxiv\.org/abs/[^<]+)</id>', xml_text)
#         if id_match:
#             return id_match.group(1).replace("/abs/", "/pdf/") + ".pdf"
#     except Exception as e:
#         print(f"ArXiv API Error: {e}")
#     return None

# def process_paper(pdf_url):
#     try:
#         print(f"[DOWNLOADING] {pdf_url}")
#         headers = {"User-Agent": "ResearchScript/1.0"}
#         response = requests.get(pdf_url, headers=headers, timeout=30)
#         response.raise_for_status()

#         # Load PDF from memory buffer
#         with io.BytesIO(response.content) as open_pdf_file:
#             reader = PdfReader(open_pdf_file)
#             text = ""
#             for page in reader.pages:
#                 text += page.extract_text() + "\n"

#         # --- CLEANUP ---
#         # 1. Multiple empty lines
#         clean_text = re.sub(r'\n\s*\n', '\n', text).strip()
#         # 2. Page numbers (lines that are just digits)
#         clean_text = re.sub(r'^\s*\d+\s*$', ' ', clean_text, flags=re.MULTILINE)
#         # 3. Hyphenation at line breaks
#         clean_text = re.sub(r'(\w)-\n(\w)', r'\1\2', clean_text)
#         # 4. Excessive newlines
#         clean_text = re.sub(r'\n\s*\n\s*\n', '\n\n', clean_text)
#         # 5. Spaces after commas
#         clean_text = re.sub(r',([A-Z])', r', \1', clean_text)

#         return clean_text.strip()
#     except Exception as e:
#         print(f"Error processing PDF: {e}")
#         return None

def get_raw_paper_data(arxiv_id):
    fields = "title,references.title,references.externalIds,references.year,references.url"
    url = f"https://api.semanticscholar.org/graph/v1/paper/ARXIV:{arxiv_id}"
    headers = {
        "User-Agent": "ResearchScript/1.0",
        "x-api-key": ""
    }
    try:
        response = requests.get(url, params={"fields": fields, "limit": 1000}, headers=headers)
        return response.json()
    except Exception as e:
        print(f"Semantic Scholar Fetch failed: {e}")
        return {"error": str(e)}

def ask_llm(prompt_text):
    url = "https://llm.scads.ai/v1/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {SCADS_API_KEY}"
    }
    payload = {
        "model": "Qwen/Qwen3-VL-8B-Instruct",
        "messages": [{"role": "user", "content": prompt_text}],
        "temperature": 0.7
    }
    try:
        # 30-minute timeout (1800 seconds)
        response = requests.post(url, headers=headers, json=payload, timeout=1800)
        response.raise_for_status()
        data = response.json()
        return data['choices'][0]['message']['content']
    except Exception as e:
        print(f"LLM Failed: {e}")
        return None

def main():
    print(json.dumps(get_all_squai_arxiv_ids()))
    return 
    all_squai_ids = get_all_squai_arxiv_ids()
    starting_id = "1501.07614"

    # Start with the main paper
    start_pdf_link = get_pdf_link_from_arxiv_api(starting_id)
    starting_text = process_paper(start_pdf_link)

    # Get references
    paper_data = get_raw_paper_data(starting_id)
    if "references" not in paper_data:
        print("No references found.")
        return

    # Filter references that exist in your SQuAI ID list
    valid_refs = [
        p for p in paper_data["references"]
        if p.get("externalIds") and p["externalIds"].get("ArXiv") in all_squai_ids
    ]

    print("-" * 60)
    print(f"References in squai dataset: {len(valid_refs)}")
    print("-" * 60)

    if len(valid_refs) < 4:
        return

    # Select 4 random references
    selected_refs = random.sample(valid_refs, 4)

    final_papers = []
    for ref in selected_refs:
        time.sleep(3) # Respect ArXiv's rate limit
        arxiv_id = ref["externalIds"]["ArXiv"]
        pdf_link = get_pdf_link_from_arxiv_api(arxiv_id)
        text = process_paper(pdf_link)
        if text:
            final_papers.append({"ArXiv": arxiv_id, "text": text})

    final_papers.append({"ArXiv": starting_id, "text": starting_text})

    # Adjust context window
    adjusted_papers = []
    for entry in final_papers:
        if not entry["text"] or len(entry["text"]) < 60000:
            adjusted_papers.append(entry)
        else:
            txt = entry["text"]
            entry["text"] = f"First 30000: {txt[:30000]} Last 30000: {txt[-30000:]}"
            adjusted_papers.append(entry)

    prompt = build_prompt(adjusted_papers)
    
    with open("prompt.txt", "w") as f:
        f.write(prompt)

    print("-" * 60)
    print("Answering with LLM...")
    answer = ask_llm(prompt)
    
    if answer:
        print(answer)
        with open("answer.txt", "w") as f:
            f.write(answer)
        with open("test.txt", "w") as f:
            json.dump(adjusted_papers, f, indent=2)

if __name__ == "__main__":
    main()