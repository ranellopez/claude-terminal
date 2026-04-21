import anthropic

client = anthropic.Anthropic()  # uses ANTHROPIC_API_KEY env var
messages = []

print("Claude Terminal (type 'exit' to quit)\n")

while True:
    user_input = input("You: ").strip()
    if user_input.lower() == "exit":
        break

    messages.append({"role": "user", "content": user_input})

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=8096,
        messages=messages
    )

    reply = response.content[0].text
    messages.append({"role": "assistant", "content": reply})
    print(f"\nClaude: {reply}\n")
claude
