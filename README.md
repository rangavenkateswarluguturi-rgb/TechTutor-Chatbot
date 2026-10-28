# TechTutor-Chatbot

A beginner-friendly engineering tutor powered by your own locally installed Ollama model. Your chats and preferences are stored in a local SQLite database; prompts are sent to Ollama on your computer, not to a paid AI service.

## Architecture

```text
Your browser (HTML, CSS, JavaScript)
        |  HTTP / JSON
        v
Flask app (app.py, backend/routes.py)
        |                         |
        v                         v
SQLite (local chat history)    Ollama (localhost:11434)
                                  |
                                  v
                          llama3.2:latest
```

## Folder structure

```text
Chatbot/
├── app.py                  # Flask application entry point
├── backend/
│   ├── __init__.py         # App factory and API registration
│   ├── config.py           # Environment-based settings
│   ├── database.py         # SQLite setup and preferences
│   └── routes.py           # Chat, history, settings, and Ollama API
├── instance/               # Created on first run; local SQLite database
├── static/
│   ├── app.js              # Chat interface and API client
│   └── styles.css          # Responsive light and dark themes
├── templates/
│   └── index.html          # Chat interface
├── tests/
│   └── test_app.py         # API and local-model integration tests
├── .env.example            # Example local Ollama settings
├── .gitignore
├── README.md
└── requirements.txt
```

## 1. Install Python dependencies (Windows)

Open PowerShell in the project folder:

```powershell
cd C:\Chatbot
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env
```

If PowerShell blocks activation, run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` in that terminal, then activate again.

## 2. Start Ollama and choose your model

Install Ollama for Windows from [ollama.com/download](https://ollama.com/download). Start the Ollama application from the Start menu. Its local API normally listens on `http://localhost:11434`.

Check installed models in PowerShell:

```powershell
ollama list
```

You already have both `llama3.2:latest` and `qwen2.5:latest` installed. **TechTutor AI defaults to your installed `llama3.2:latest`.** If Ollama is not running, start the Ollama desktop app or run `ollama serve` in a separate terminal.

To download another model, run `ollama pull MODEL_NAME`, for example:

```powershell
ollama pull qwen2.5:3b
```

Only installed models are offered in the model selector. Change `.env`'s `OLLAMA_MODEL` to pick a different default after restarting Flask, or select a model in the app. The app remembers your selection. The `OLLAMA_URL` setting can point to a different compatible Ollama server; keep that server on a trusted network.

## 3. Run the application

With the virtual environment active and Ollama running, start Flask:

```powershell
python app.py
```

Open **http://127.0.0.1:5000** in your browser. Keep the terminal open while using the application; press Ctrl+C there to stop it.

## 4. Try these questions

Choose a subject and ask the matching question:

- **AI/ML:** "Explain the difference between machine learning and deep learning with a simple example."
- **Web Development:** "Create a tiny Flask API and show me how to test its route."
- **UML:** "Create a PlantUML class diagram for a library with books and members, and explain the relationships."
- **Programming:** "Show me how a Python for-loop works, line by line, with its output."
- **Career Guidance:** "Give me a beginner-friendly two-week plan to prepare for a Python internship interview."
- Ask for practice: "Quiz me on SQL joins one question at a time, and explain the answer."
- Ask for a project: "Suggest a small web development project with steps and test cases."

Select a learning level before sending a prompt. Use **Enter** to send and **Shift+Enter** to add a line. Code blocks include syntax coloring and a copy button.

## What is included

- Flask JSON APIs connect the responsive browser UI directly to the locally installed model. No placeholder or fabricated model answers are shown.
- Subject buttons, beginner/intermediate/advanced levels, and an installed-model selector steer the tutor's answers.
- SQLite retains conversations, messages, and model/theme/level preferences between visits. Start a new conversation without losing earlier chats; use **Clear all conversations** to remove them.
- Light/dark appearance and mobile-friendly layout.
- Select files of any extension from your device; the picker does not filter folders by file type. Up to five text-based files (256 KB total) can be attached. PDFs, Word documents, spreadsheets, images, archives, and other binary files are not readable yet and will show an unsupported-file message. Attachment contents are sent to your local Ollama model as context and are not saved in chat history.
- User messages are limited to 8,000 characters; the request body has a 2 MB cap. SQL values are parameterized, and user-submitted code is never executed.
- Model connection, timeout, and API errors are shown in the interface. If Ollama fails while answering, the student's prompt remains in history, but no invented assistant answer is saved.

## Run tests

```powershell
python -m unittest discover -s tests -v
```

## Troubleshooting

| Problem | What to try |
| --- | --- |
| `ollama` is not recognized | Install Ollama for Windows, close and reopen PowerShell, then run `ollama list`. |
| "Cannot connect to Ollama" | Start the Ollama desktop app, or run `ollama serve` in another terminal. Confirm the URL in `.env`. |
| No models appear | Run `ollama list`; install one with `ollama pull llama3.2`, then refresh the page. |
| A model is unavailable | Select one listed in the model selector. Model names must exactly match `ollama list`, including tags such as `:latest`. |
| PowerShell won't activate `.venv` | Run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`, then activate again. |
| Python can't import Flask or requests | Activate `.venv` and run `pip install -r requirements.txt`. |
| Answers take a while | First model load can be slow. Wait for the response; the app allows up to three minutes for Ollama. Smaller models may respond faster. |
| Port 5000 is busy | Stop the other app using that port, or change the port at the bottom of `app.py` and open the matching address. |

## Architecture and safety notes

Flask serves the HTML interface and `/api` endpoints. The API discovers installed models using Ollama's `/api/tags` endpoint and generates responses using `/api/chat`. SQLite foreign keys cascade conversation deletions to their messages. Model settings are server-side configuration; don't publish your `.env` file or expose Ollama to the public internet. This starter application is intended for use on your local machine.

## Future improvements

- Add streaming responses so long explanations appear as they are generated.
- Add opt-in account access controls if the app is deployed beyond one trusted computer.
- Add searchable, exportable chat history and user-managed study plans.
- Add diagram rendering with an explicitly configured, trusted PlantUML renderer.
- Add accessibility audits and expanded browser-based end-to-end tests.
