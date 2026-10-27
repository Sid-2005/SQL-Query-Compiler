# SQL Query Compiler & Phase Visualizer 🚀

An interactive web-based visualizer and compiler pipeline for SQL queries, designed for **Compiler Design / Compiler Construction** courses and demonstrations.

This project demonstrates each fundamental phase of a compiler in real time:
1. **Lexical Analysis (Tokenization)** — Scanner output with token types, values, and line/column positions.
2. **Syntax Analysis (Parsing & AST)** — Recursive descent parser producing an Abstract Syntax Tree (AST).
3. **Semantic Analysis** — Symbol table lookup, schema validation, and type/column checking against mock relational tables.
4. **Intermediate Code Generation (ICG / TAC)** — Three-Address Code generation using quadruples/temporaries (`t0`, `t1`, etc.).
5. **Code Optimization** — Constant folding, algebraic simplification, and dead code elimination.
6. **Execution Plan & Code Generation** — Relational algebra query plan tree and simulated execution engine.

---

## ⚡ How to Run on Any Computer (Windows, Mac, Linux)

Running this project on any system requires **no package installations** (no `npm install` needed).

### Method 1: Using Node.js (Recommended)

#### 1. Requirements
- Ensure **[Node.js](https://nodejs.org/)** is installed on the system (version 14 or higher).
  - To verify, open terminal/command prompt and run:
    ```bash
    node -v
    ```

#### 2. Open Terminal in the Project Folder
- **Windows**:
  - Open the project folder in File Explorer.
  - Click on the address bar at the top, type `cmd` or `powershell`, and press **Enter**.
  - *(Or open Command Prompt/PowerShell and `cd` to the folder path).*
- **macOS / Linux**:
  - Open Terminal and navigate to the project directory:
    ```bash
    cd path/to/project-folder
    ```

#### 3. Start the Server
Run the following command:
```bash
node server.js
```
You will see:
```text
Server running on http://localhost:3000
```

#### 4. Open in Your Browser
Open any web browser (Chrome, Edge, Firefox, Safari) and go to:
👉 **[http://localhost:3000](http://localhost:3000)**

*(To stop the server at any time, press `Ctrl + C` in the terminal).*

---

### Method 2: Quick Run Without Node.js (Zero Installation)

If the computer does not have Node.js installed:

1. Navigate into the project folder.
2. **Double-click `index.html`** to open it directly in any modern browser (Chrome, Firefox, Edge, Safari).
3. The entire compiler, parser, AST renderer, and execution plan run client-side in the browser!

---

### Method 3: Using Python (Alternative)

If Python is already installed on the machine:

```bash
# In the project directory:
python -m http.server 3000

# On some Linux/Mac systems:
python3 -m http.server 3000
```
Then visit **http://localhost:3000** in your browser.

---

### Method 4: Using VS Code Live Server

1. Open the project folder in **Visual Studio Code**.
2. Install the **Live Server** extension (by Ritwick Dey).
3. Right-click `index.html` in the file explorer and click **"Open with Live Server"**.

---

## 📁 Project Structure

```text
CC/
├── index.html                   # Main web application UI layout
├── server.js                    # Lightweight HTTP server (uses standard Node.js libraries only)
├── README.md                    # Setup & execution instructions
├── PROJECT_BRIEF_AND_FLOWCHART.md # Full project report, flowcharts & compiler design brief
├── css/
│   └── styles.css               # Modern responsive styling & animations
└── js/
    ├── compiler.js              # Core compiler logic (Lexer, Parser, AST, Semantic, TAC, Optimizer)
    └── app.js                   # UI interactions, event handling, schema viewer, AST visualizer
```

📖 **Detailed Documentation & Flowcharts**: See [PROJECT_BRIEF_AND_FLOWCHART.md](PROJECT_BRIEF_AND_FLOWCHART.md) for full architectural flowcharts, EBNF grammar specifications, phase-by-phase trace, and viva presentation notes.

---

## 🛠️ How to Use the Visualizer

1. **Load Pre-made Test Queries**:
   - Use the **"Load Example Query…"** dropdown at the top to test common SQL patterns:
     - Basic `SELECT` queries
     - `WHERE` filtering
     - `ORDER BY` sorting
     - `GROUP BY` and aggregate functions (`COUNT`, `SUM`, `AVG`, `MIN`, `MAX`)
     - `INNER JOIN` across multiple tables
     - Constant folding (e.g., `2 + 3 * 4`)
     - Syntax error & Semantic error demonstrations
2. **Compile**:
   - Type or modify any query, then click **"▶ Compile Query"** (or press `Ctrl + Enter`).
3. **Explore the Compiler Phases**:
   - Click across the tabs (`Tokens / Lexer`, `Syntax / AST`, `Semantic Analysis`, `Three-Address Code`, `Optimization`, `Execution Plan`) to inspect each phase's output and symbol tables.
4. **View Available Tables & Schema**:
   - Click the **"📋 Database Schema"** button in the header to view sample tables (`students`, `departments`, `courses`, `enrollments`).

---

## ❓ Frequently Asked Questions & Troubleshooting

- **Error: `EADDRINUSE: address already in use :::3000`?**
  Another process is already using port 3000.
  Open `server.js` in any text editor and change line 5:
  ```javascript
  const PORT = 3001; // Change 3000 to 3001 or any unused port
  ```
  Then run `node server.js` again and visit `http://localhost:3001`.

- **Command `node` is not recognized?**
  Install Node.js from [nodejs.org](https://nodejs.org/) (LTS version recommended), or simply use **Method 2** (double-click `index.html`).

- **Does this require internet access?**
  No, all styles, scripts, fonts, and compiler logic run 100% offline.
