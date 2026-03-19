from agent.nyaya_agent import NyayaAgent
from optimizations import is_valid_query


if __name__ == "__main__":
    agent = NyayaAgent()

    while True:
        user_input = input("\nAsk Nyaya: ")
        
        # Validate query first
        if not is_valid_query(user_input):
            print("[ERROR] Invalid query detected. Please enter a legal question (not a command or file path).")
            continue
        
        # Pass ONLY the user question for retrieval (no system prompt!)
        answer = agent.ask(user_input)
        print("\nAnswer:")
        print(answer)

