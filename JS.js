let Module;
let editor;
let compilerReady = false;

const defaultCode = `int main() {
  return 42;
}`;

const samplePrograms = {
  basic: `int main() {
  return 42;
}`,
  math: `int main() {
  return 40 + 2;
}`,
  variable: `int main() {
  int x = 7;
  return x;
}`
};

require.config({ paths: { vs: "https://unpkg.com/monaco-editor/min/vs" } });

document.addEventListener("DOMContentLoaded", () => {
  setupTabs();
  setupButtons();
  loadEditor();
  setStatus("Loading compiler...");
});

function setupTabs() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => showTab(tab.dataset.target));
  });
}

function setupButtons() {
  document.getElementById("loadSampleBtn").addEventListener("click", loadSample);
  document.getElementById("resetEditorBtn").addEventListener("click", resetEditor);
  document.getElementById("runLexerBtn").addEventListener("click", runLexerStage);
  document.getElementById("runAstBtn").addEventListener("click", runAstStage);
  document.getElementById("runIrBtn").addEventListener("click", runIrStage);
  document.getElementById("runSemanticBtn").addEventListener("click", runSemanticStage);
  document.getElementById("runAllBtn").addEventListener("click", runAllStages);
  document.getElementById("generateAiBtn").addEventListener("click", generateAiCode);
  document.getElementById("themeToggleBtn").addEventListener("click", toggleTheme);
}

function loadEditor() {
  require(["vs/editor/editor.main"], () => {
    editor = monaco.editor.create(document.getElementById("editor"), {
      value: defaultCode,
      language: "c",
      theme: "vs-light",
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 15
    });

    loadCompiler();
  });
}

function loadCompiler() {
  createClangModule().then((mod) => {
    Module = mod;
    window.runLexer = Module.cwrap("run_lexer", "string", ["string"]);
    window.runAST = Module.cwrap("run_ast", "string", ["string"]);
    window.runIR = Module.cwrap("run_ir", "string", ["string"]);
    compilerReady = true;
    setStatus("Compiler loaded. You can now run Lexer, AST, IR, or Semantic Analysis.");
  }).catch((error) => {
    console.error(error);
    setStatus(Compiler failed to load: ${error.message});
  });
}

function ensureReady() {
  if (!compilerReady || !editor) {
    setStatus("Please wait. The compiler is still loading.");
    return false;
  }
  return true;
}

function getCode() {
  return editor.getValue();
}

function setStatus(message) {
  document.getElementById("statusText").textContent = message;
}

function setOutput(id, text) {
  document.getElementById(id).textContent = text;
  showTab(id);
}

function showTab(id) {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.target === id);
  });

  document.querySelectorAll(".output").forEach((panel) => {
    panel.classList.toggle("active", panel.id === id);
  });
}

function loadSample() {
  if (!editor) {
    return;
  }

  const key = document.getElementById("sampleSelect").value;
  editor.setValue(samplePrograms[key] || defaultCode);
  setStatus("Example code loaded.");
}

function resetEditor() {
  if (!editor) {
    return;
  }

  editor.setValue(defaultCode);
  document.getElementById("aiPrompt").value = "";
  setStatus("Editor reset.");
}

function runLexerStage() {
  if (!ensureReady()) {
    return;
  }

  setOutput("lexerOutput", window.runLexer(getCode()));
  setStatus("Lexer output generated.");
}

function runAstStage() {
  if (!ensureReady()) {
    return;
  }

  setOutput("astOutput", window.runAST(getCode()));
  setStatus("AST output generated.");
}

function runIrStage() {
  if (!ensureReady()) {
    return;
  }

  setOutput("irOutput", window.runIR(getCode()));
  setStatus("IR output generated.");
}

function runSemanticStage() {
  if (!ensureReady()) {
    return;
  }

  setOutput("semanticOutput", buildSemanticAnalysis(getCode()));
  setStatus("Semantic analysis generated.");
}

function runAllStages() {
  if (!ensureReady()) {
    return;
  }

  const code = getCode();
  const ast = window.runAST(code);

  document.getElementById("lexerOutput").textContent = window.runLexer(code);
  document.getElementById("astOutput").textContent = ast;
  document.getElementById("irOutput").textContent = window.runIR(code);
  document.getElementById("semanticOutput").textContent = buildSemanticAnalysis(code, ast);
  showTab("semanticOutput");
  setStatus("All four analyses are ready.");
}

function buildSemanticAnalysis(code, astText) {
  const ast = astText || window.runAST(code);
  const errorLines = ast
    .split("\n")
    .map((line) => line.trim())
    .filter((line) =>
      line.startsWith("-") ||
      line.includes("Undeclared") ||
      line.includes("re-declared") ||
      line.includes("Function not defined") ||
      line.includes("Expected '")
    );

  const report = [];
  report.push("Semantic Analysis Report");
  report.push("------------------------");

  if (ast.includes("Semantic analysis passed.")) {
    report.push("Status: Passed");
    report.push("No semantic errors were found.");
  } else {
    report.push("Status: Errors Found");
    if (errorLines.length > 0) {
      report.push("Issues:");
      errorLines.forEach((line) => report.push(line));
    } else {
      report.push("Semantic issues were detected.");
    }
  }

  report.push("");
  report.push("Summary:");
  report.push(Lines of code: ${countCodeLines(code)});
  report.push(Has return statement: ${/\breturn\b/.test(code) ? "Yes" : "No"});
  report.push(Has variable declaration: ${/\bint\s+[a-zA-Z_]\w*/.test(code) ? "Yes" : "No"});

  return report.join("\n");
}

function countCodeLines(code) {
  return code
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0).length;
}

function generateAiCode() {
  if (!editor) {
    return;
  }

  const prompt = document.getElementById("aiPrompt").value.trim().toLowerCase();
  if (!prompt) {
    setStatus("Type something in the AI box first.");
    return;
  }

  let generated = defaultCode;

  if (prompt.includes("42")) {
    generated = samplePrograms.basic;
  } else if (prompt.includes("40") || prompt.includes("add") || prompt.includes("sum") || prompt.includes("math")) {
    generated = samplePrograms.math;
  } else if (prompt.includes("variable") || prompt.includes("x")) {
    generated = samplePrograms.variable;
  } else {
    const numberMatch = prompt.match(/(\d+)/);
    generated = int main() {\n  return ${numberMatch ? numberMatch[1] : 10};\n};
  }

  editor.setValue(generated);
  setStatus("AI generated simple C code.");
}

function toggleTheme() {
  document.body.classList.toggle("dark-theme");
  if (window.monaco) {
    monaco.editor.setTheme(document.body.classList.contains("dark-theme") ? "vs-dark" : "vs-light");
  }
}