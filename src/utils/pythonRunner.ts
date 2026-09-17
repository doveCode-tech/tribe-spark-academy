/**
 * STEMtribe Advanced In-Browser Python IDE Engine
 * Powered by Skulpt Python 3 & local offline stdlib.
 * 
 * Supports:
 * - Full Python 3 syntax: Classes, inheritance, __init__, dunder methods
 * - Multi-value returns: `return a, b` returning real tuples `(a, b)`
 * - Real interactive `input()`: displays prompt in terminal, student types & presses Enter
 * - Multi-file module imports: `import helper`, `from models import User`
 * - Built-in standard library: `math`, `random`, `datetime`, `time`, `json`, `string`
 * - HTML5 Canvas Turtle Graphics: `import turtle`
 * - Precise line-numbered error tracebacks with friendly advice
 */

export interface PythonRunResult {
  outputs: string[];
  error?: string;
  errorLine?: number;
  inlinedModules: string[];
  htmlOutput: string;
}

export function executePython(
  currentCode: string,
  allFiles: { name: string; language?: string; content: string }[] = []
): PythonRunResult {
  // Collect all python files for multi-file module imports
  const moduleMap: Record<string, string> = {};
  const inlinedModules: string[] = [];

  allFiles.forEach((f) => {
    if (f.name.endsWith(".py") || f.language === "python") {
      const baseName = f.name.replace(/\.py$/i, "");
      moduleMap[f.name] = f.content;
      moduleMap[baseName] = f.content;
      if (f.content !== currentCode && !inlinedModules.includes(baseName)) {
        inlinedModules.push(baseName);
      }
    }
  });

  // Generate the full Skulpt in-browser IDE HTML
  const htmlOutput = buildSkulptIdeHtml(currentCode, moduleMap, inlinedModules);

  return {
    outputs: ["Python 3.11 Runtime Initialized"],
    inlinedModules,
    htmlOutput,
  };
}

/**
 * Builds the complete self-contained HTML document for the preview iframe
 */
function buildSkulptIdeHtml(
  userCode: string,
  modulesMap: Record<string, string>,
  inlinedModules: string[]
): string {
  const encodedCode = JSON.stringify(userCode);
  const encodedModules = JSON.stringify(modulesMap);
  const origin = typeof window !== "undefined" && window.location.origin ? window.location.origin : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  ${origin ? `<base href="${origin}/" />` : ""}
  <title>STEMtribe Python IDE</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      font-family: 'Consolas', 'Fira Code', 'Monaco', 'Courier New', monospace;
      font-size: 13px;
      line-height: 1.6;
      background: #090d16;
      color: #e2e8f0;
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .terminal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #0f172a;
      border-bottom: 1px solid #1e293b;
      padding: 8px 14px;
      font-size: 11px;
      color: #94a3b8;
      user-select: none;
      flex-shrink: 0;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #22c55e;
      box-shadow: 0 0 8px #22c55e;
      transition: all 0.2s ease;
    }
    .status-dot.running {
      background: #eab308;
      box-shadow: 0 0 8px #eab308;
      animation: pulse 1s infinite;
    }
    .status-dot.error {
      background: #ef4444;
      box-shadow: 0 0 8px #ef4444;
    }
    .header-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .header-btn {
      background: #1e293b;
      border: 1px solid #334155;
      color: #cbd5e1;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
      transition: all 0.15s ease;
    }
    .header-btn:hover {
      background: #334155;
      color: #ffffff;
    }
    .terminal-content {
      flex: 1;
      padding: 14px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .imported-banner {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #0284c715;
      color: #38bdf8;
      border: 1px solid #0284c735;
      border-radius: 6px;
      padding: 3px 10px;
      font-size: 11px;
      margin-bottom: 8px;
      align-self: flex-start;
    }
    .turtle-box {
      display: none;
      margin-bottom: 12px;
      background: #ffffff;
      border-radius: 8px;
      border: 2px solid #334155;
      overflow: hidden;
      width: fit-content;
      max-width: 100%;
    }
    .output-line {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      word-break: break-word;
      white-space: pre-wrap;
    }
    .prompt-glyph {
      color: #4ade80;
      user-select: none;
      font-weight: bold;
    }
    .output-text {
      color: #f8fafc;
      flex: 1;
    }
    .input-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 6px;
      margin-bottom: 6px;
      background: #1e293b70;
      border: 1px solid #3b82f6;
      border-radius: 6px;
      padding: 6px 12px;
      box-shadow: 0 0 10px rgba(59, 130, 246, 0.2);
    }
    .input-label {
      color: #38bdf8;
      font-weight: bold;
      font-size: 12px;
    }
    .term-input-field {
      flex: 1;
      background: transparent;
      border: none;
      outline: none;
      color: #67e8f9;
      font-family: inherit;
      font-size: 13px;
      font-weight: bold;
    }
    .term-submit-btn {
      background: #2563eb;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 3px 10px;
      font-size: 11px;
      font-weight: bold;
      cursor: pointer;
    }
    .term-submit-btn:hover {
      background: #1d4ed8;
    }
    .error-box {
      margin-top: 12px;
      padding: 12px 14px;
      background: #7f1d1d25;
      border: 1px solid #ef4444;
      border-radius: 8px;
      color: #fca5a5;
    }
    .error-header {
      color: #ef4444;
      font-weight: bold;
      font-size: 12px;
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .error-message {
      font-size: 12px;
      line-height: 1.5;
      font-family: inherit;
    }
    .error-tip {
      margin-top: 6px;
      padding-top: 6px;
      border-top: 1px solid #dc262630;
      font-size: 11px;
      color: #fecaca;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }
  </style>
</head>
<body>
  <div class="terminal-header">
    <div class="header-left">
      <span id="status-dot" class="status-dot running"></span>
      <span id="status-text">Python 3.11 Kernel (STEMtribe LMS)</span>
    </div>
    <div class="header-right">
      <button class="header-btn" onclick="clearTerminal()">🗑️ Clear</button>
      <button class="header-btn" onclick="restartProgram()">🔄 Rerun</button>
      <span id="timestamp"></span>
    </div>
  </div>

  <div id="terminal-scroll" class="terminal-content">
    ${
      inlinedModules.length > 0
        ? `<div class="imported-banner">📦 Active Modules: ${inlinedModules.join(", ")}.py</div>`
        : ""
    }
    <div id="turtle-canvas" class="turtle-box"></div>
    <div id="output-container"></div>
    <div id="active-input-container"></div>
  </div>

  <!-- Skulpt Scripts (Local offline from public/skulpt, CDN fallback) -->
  <script src="${origin}/skulpt/skulpt.min.js"></script>
  <script src="${origin}/skulpt/skulpt-stdlib.js"></script>

  <script>
    var studentCode = ${encodedCode};
    var studentModules = ${encodedModules};

    var outputContainer = document.getElementById("output-container");
    var inputContainer = document.getElementById("active-input-container");
    var terminalScroll = document.getElementById("terminal-scroll");
    var statusDot = document.getElementById("status-dot");
    var statusText = document.getElementById("status-text");
    var timestampSpan = document.getElementById("timestamp");

    timestampSpan.textContent = new Date().toLocaleTimeString();

    function setStatus(type, message) {
      statusDot.className = "status-dot " + type;
      if (message) statusText.textContent = message;
    }

    function clearTerminal() {
      outputContainer.innerHTML = "";
      inputContainer.innerHTML = "";
      var turtleDiv = document.getElementById("turtle-canvas");
      if (turtleDiv) turtleDiv.innerHTML = "";
    }

    function appendOutput(text, isError) {
      if (!text) return;
      var lines = text.split("\\n");
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (i === lines.length - 1 && line === "") continue;

        var row = document.createElement("div");
        row.className = "output-line";

        var glyph = document.createElement("span");
        glyph.className = "prompt-glyph";
        glyph.textContent = isError ? "❌" : ">";

        var textSpan = document.createElement("span");
        textSpan.className = "output-text";
        textSpan.textContent = line;
        if (isError) textSpan.style.color = "#f87171";

        row.appendChild(glyph);
        row.appendChild(textSpan);
        outputContainer.appendChild(row);
      }
      terminalScroll.scrollTop = terminalScroll.scrollHeight;
    }

    // Interactive input function: pauses Skulpt and waits for student to press Enter
    function interactiveInput(promptText) {
      return new Promise(function(resolve) {
        inputContainer.innerHTML = "";

        var row = document.createElement("div");
        row.className = "input-row";

        var label = document.createElement("span");
        label.className = "input-label";
        label.textContent = (promptText || "Enter input:") + " ";

        var inputField = document.createElement("input");
        inputField.type = "text";
        inputField.className = "term-input-field";
        inputField.autocomplete = "off";
        inputField.autofocus = true;

        var submitBtn = document.createElement("button");
        submitBtn.type = "button";
        submitBtn.className = "term-submit-btn";
        submitBtn.textContent = "Submit ↵";

        function submitInput() {
          var val = inputField.value;
          // Render the submitted interaction into history
          appendOutput((promptText || "") + val);
          inputContainer.innerHTML = "";
          resolve(val);
        }

        inputField.addEventListener("keydown", function(e) {
          if (e.key === "Enter") {
            e.preventDefault();
            submitInput();
          }
        });

        submitBtn.addEventListener("click", function(e) {
          e.preventDefault();
          submitInput();
        });

        row.appendChild(label);
        row.appendChild(inputField);
        row.appendChild(submitBtn);
        inputContainer.appendChild(row);

        terminalScroll.scrollTop = terminalScroll.scrollHeight;
        setTimeout(function() { inputField.focus(); }, 50);
      });
    }

    // Custom multi-file reader: allows 'import helper' or 'from my_module import ...'
    function customModuleReader(filename) {
      if (typeof Sk === "undefined") throw new Error("Skulpt not loaded");

      // Check Skulpt's built-in standard library files
      if (Sk.builtinFiles && Sk.builtinFiles["files"] && Sk.builtinFiles["files"][filename] !== undefined) {
        return Sk.builtinFiles["files"][filename];
      }

      // If Skulpt is checking for a JS module that is not built-in, throw so it checks for .py
      if (filename.endsWith(".js")) {
        throw new Error("No JS module named '" + filename + "'");
      }

      // Check student file tabs
      var clean = filename.replace(/^(\\.\\/|\\/)/, "");
      var base = clean.replace(/\\.py$/i, "");

      if (studentModules[clean]) return studentModules[clean];
      if (studentModules[base + ".py"]) return studentModules[base + ".py"];
      if (studentModules[base]) return studentModules[base];

      throw new Error("ImportError: No module named '" + filename + "'");
    }

    function initKernel(retries) {
      retries = retries || 0;
      if (typeof Sk !== "undefined") {
        runPython();
        return;
      }
      if (retries < 25) {
        setTimeout(function() { initKernel(retries + 1); }, 40);
      } else {
        appendOutput("Connecting to Python 3 kernel...", false);
        loadCdnAndRun();
      }
    }

    function runPython() {
      clearTerminal();
      setStatus("running", "Running Python code...");

      if (typeof Sk === "undefined") {
        initKernel(0);
        return;
      }

      executeWithSkulpt();
    }

    function loadCdnAndRun() {
      var s1 = document.createElement("script");
      s1.src = "https://cdn.jsdelivr.net/npm/skulpt@1.2.0/dist/skulpt.min.js";
      s1.onload = function() {
        var s2 = document.createElement("script");
        s2.src = "https://cdn.jsdelivr.net/npm/skulpt@1.2.0/dist/skulpt-stdlib.js";
        s2.onload = function() {
          executeWithSkulpt();
        };
        s2.onerror = function() {
          setStatus("error", "Failed to load Python stdlib");
        };
        document.head.appendChild(s2);
      };
      s1.onerror = function() {
        setStatus("error", "Failed to load Python kernel");
      };
      document.head.appendChild(s1);
    }

    function executeWithSkulpt() {
      try {
        Sk.configure({
          output: function(text) { appendOutput(text, false); },
          read: customModuleReader,
          inputfun: interactiveInput,
          inputfunTakesPrompt: true,
          execLimit: 15000,
          yieldLimit: 100,
          __future__: Sk.python3
        });

        // Turtle support
        var turtleDiv = document.getElementById("turtle-canvas");
        if (studentCode.indexOf("turtle") !== -1) {
          turtleDiv.style.display = "block";
          Sk.TurtleGraphics = {
            target: "turtle-canvas",
            width: 440,
            height: 300
          };
        } else {
          turtleDiv.style.display = "none";
        }

        var runPromise = Sk.misceval.asyncToPromise(function() {
          return Sk.importMainWithBody("<stdin>", false, studentCode, true);
        });

        runPromise.then(function() {
          setStatus("ready", "Program executed successfully (0 errors)");
        }, function(err) {
          setStatus("error", "Execution Stopped with Error");
          renderFormattedError(err);
        });
      } catch (err) {
        setStatus("error", "Error Initializing Python");
        renderFormattedError(err);
      }
    }

    function renderFormattedError(err) {
      var raw = err ? err.toString() : "Unknown execution error";
      var box = document.createElement("div");
      box.className = "error-box";

      var header = document.createElement("div");
      header.className = "error-header";
      header.textContent = "❌ Python Error";

      var msg = document.createElement("div");
      msg.className = "error-message";
      msg.textContent = raw;

      var tip = document.createElement("div");
      tip.className = "error-tip";

      if (raw.indexOf("TimeLimitError") !== -1) {
        tip.textContent = "💡 Tip: Infinite loop detected! Check your while loop or for loop to ensure it has a condition to stop.";
      } else if (raw.indexOf("SyntaxError") !== -1) {
        tip.textContent = "💡 Tip: Check for missing colons (:), unclosed quotes, or unclosed brackets () [] {}.";
      } else if (raw.indexOf("NameError") !== -1) {
        tip.textContent = "💡 Tip: Check spelling of variables or functions. In Python, names are case-sensitive.";
      } else if (raw.indexOf("IndexError") !== -1) {
        tip.textContent = "💡 Tip: You tried to access an item that doesn't exist in the list. Check len() of your list.";
      } else if (raw.indexOf("TypeError") !== -1) {
        tip.textContent = "💡 Tip: Check data types. For example, you cannot add text to a number without str() or int().";
      } else if (raw.indexOf("ZeroDivisionError") !== -1) {
        tip.textContent = "💡 Tip: You cannot divide a number by zero.";
      } else if (raw.indexOf("ImportError") !== -1) {
        tip.textContent = "💡 Tip: Module not found. Make sure the imported tab name exists and is spelled correctly.";
      } else if (raw.indexOf("IndentationError") !== -1) {
        tip.textContent = "💡 Tip: Python requires consistent indentation spaces. Check spacing on this line.";
      } else {
        tip.textContent = "💡 Tip: Read the line number in the message above to find where the error occurred.";
      }

      box.appendChild(header);
      box.appendChild(msg);
      box.appendChild(tip);
      outputContainer.appendChild(box);
      terminalScroll.scrollTop = terminalScroll.scrollHeight;
    }

    function restartProgram() {
      runPython();
    }

    // Auto-run when iframe is mounted
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function() { initKernel(); });
      window.addEventListener("load", function() { initKernel(); });
    } else {
      setTimeout(function() { initKernel(); }, 20);
    }
  </script>
</body>
</html>`;
}
