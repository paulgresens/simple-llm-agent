from local_agent import LLMAgent

agent = LLMAgent("tiiuae/Falcon3-10B-Instruct")
prompt = "This is a test prompt"
answer = agent.generate(prompt)
print(answer)
