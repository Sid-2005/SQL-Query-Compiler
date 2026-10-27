// ═══════════════════════════════════════════════════════════════
//  SQL Compiler Visualizer — Client Application
//  Compiler Design Laboratory Project
// ═══════════════════════════════════════════════════════════════

(function () {
  'use strict';

  const {
    TokenType, SCHEMA, EXAMPLES,
    Lexer, Parser, generateParseTree, formatParseTreeAscii, getASTNodeDetails,
    SemanticAnalyzer, IRGenerator, Optimizer, ExecutionPlanner,
  } = window.SQLCompiler;

  /* ──────────────── State ──────────────── */
  const PHASES = [
    { id: 'lexer',      name: 'Lexical Analysis',        short: '01 Lexer' },
    { id: 'parser',     name: 'Parse Tree',              short: '02 Parser' },
    { id: 'ast',        name: 'Abstract Syntax Tree',    short: '03 AST' },
    { id: 'semantic',   name: 'Semantic Analysis',       short: '04 Semantic' },
    { id: 'ir',         name: 'Intermediate Code (TAC)', short: '05 IR Code' },
    { id: 'optimizer',  name: 'Query Optimization',      short: '06 Optimizer' },
    { id: 'execution',  name: 'Execution Plan',          short: '07 Execution' },
  ];

  let currentPhaseIndex = 0;
  let compilation = null;
  let selectedASTNode = null;
  let selectedPlanNode = null;

  /* ──────────────── DOM References ──────────────── */
  const editor          = document.getElementById('sqlEditor');
  const lineNumbers     = document.getElementById('lineNumbers');
  const examplesSelect  = document.getElementById('examplesSelect');
  const clearBtn        = document.getElementById('clearBtn');
  const resetBtn        = document.getElementById('resetBtn');
  const compileBtn      = document.getElementById('compileBtn');
  const statusDot       = document.getElementById('statusDot');
  const statusText      = document.getElementById('statusText');
  const phaseView       = document.getElementById('phaseViewSection');
  const prevPhaseBtn    = document.getElementById('prevPhaseBtn');
  const nextPhaseBtn    = document.getElementById('nextPhaseBtn');
  const phaseCounter    = document.getElementById('phaseCounter');
  const schemaToggle    = document.getElementById('schemaToggle');
  const schemaPanel     = document.getElementById('schemaPanel');
  const schemaGrid      = document.getElementById('schemaGrid');

  /* ──────────────── Initialization ──────────────── */
  function init() {
    // Default starting query
    editor.value = EXAMPLES['where-query'] || `SELECT name, salary\nFROM employees\nWHERE salary > 50000\nORDER BY salary DESC;`;
    updateLineNumbers();
    renderSchema();

    // Event listeners
    editor.addEventListener('input', () => {
      updateLineNumbers();
      setStatus('ready', 'Query modified — ready to compile');
    });
    editor.addEventListener('scroll', syncScroll);
    editor.addEventListener('keydown', handleEditorKeydown);

    examplesSelect.addEventListener('change', handleExampleChange);
    clearBtn.addEventListener('click', handleClear);
    resetBtn.addEventListener('click', handleReset);
    compileBtn.addEventListener('click', compile);

    prevPhaseBtn.addEventListener('click', () => goToPhase(currentPhaseIndex - 1));
    nextPhaseBtn.addEventListener('click', () => goToPhase(currentPhaseIndex + 1));

    schemaToggle.addEventListener('click', toggleSchema);

    // Phase tab navigation buttons
    document.querySelectorAll('.phase-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.phaseIndex, 10);
        goToPhase(idx);
      });
    });

    // Initial compile
    compile();
  }

  /* ──────────────── Editor Controls ──────────────── */
  function updateLineNumbers() {
    const lines = editor.value.split('\n');
    lineNumbers.innerHTML = lines.map((_, i) => `<span>${i + 1}</span>`).join('');
  }

  function syncScroll() {
    lineNumbers.scrollTop = editor.scrollTop;
  }

  function handleEditorKeydown(e) {
    if (e.key === 'Tab') {
      e.preventDefault();
      const s = editor.selectionStart, end = editor.selectionEnd;
      editor.value = editor.value.substring(0, s) + '    ' + editor.value.substring(end);
      editor.selectionStart = editor.selectionEnd = s + 4;
      updateLineNumbers();
    }
  }

  function handleExampleChange() {
    const key = examplesSelect.value;
    if (key && EXAMPLES[key]) {
      editor.value = EXAMPLES[key];
      updateLineNumbers();
      compile();
    }
    examplesSelect.value = '';
  }

  function handleClear() {
    editor.value = '';
    updateLineNumbers();
    compilation = null;
    setStatus('ready', 'Editor cleared');
    renderPhase();
  }

  function handleReset() {
    editor.value = EXAMPLES['where-query'];
    updateLineNumbers();
    compile();
  }

  function setStatus(type, msg) {
    statusDot.className = 'status-dot';
    if (type === 'ready')   statusDot.classList.add('status-ready');
    if (type === 'success') statusDot.classList.add('status-success');
    if (type === 'error')   statusDot.classList.add('status-error');
    statusText.textContent = msg;
  }

  /* ──────────────── Schema Panel ──────────────── */
  function renderSchema() {
    let html = '';
    for (const [tbl, cols] of Object.entries(SCHEMA)) {
      html += `
        <div class="schema-card">
          <div class="schema-table-title">Relation: <strong>${tbl}</strong></div>
          <table class="schema-attr-table">
            <thead><tr><th>Attribute</th><th>Type</th><th>Constraint</th></tr></thead>
            <tbody>
              ${Object.entries(cols).map(([c, m]) => `
                <tr>
                  <td><code>${m.pk ? '🔑 ' : ''}${c}</code></td>
                  <td><span class="type-badge">${m.type}</span></td>
                  <td>${m.pk ? 'PRIMARY KEY' : (m.nullable ? 'NULL' : 'NOT NULL')}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
    }
    schemaGrid.innerHTML = html;
  }

  function toggleSchema() {
    const isCollapsed = schemaPanel.classList.toggle('collapsed');
    schemaToggle.setAttribute('aria-expanded', !isCollapsed);
  }

  /* ════════════════════════════════════════════════════════════
     MAIN COMPILATION PIPELINE
     ════════════════════════════════════════════════════════════ */
  function compile() {
    const sql = editor.value.trim();
    if (!sql) {
      setStatus('ready', 'Ready to compile');
      compilation = null;
      renderPhase();
      return;
    }

    compilation = {
      sql,
      lexer: null,
      parser: null,
      parseTree: null,
      parseTreeAscii: '',
      semantic: null,
      ir: null,
      optimizer: null,
      execution: null,
      totalErrors: 0
    };

    // Phase 1 — Lexical Analysis
    const lexer = new Lexer(sql);
    const lexResult = lexer.tokenize();
    compilation.lexer = lexResult;

    // Phase 2 — Parser (Concrete Parse Tree)
    const nonComment = lexResult.tokens.filter(t => t.type !== TokenType.COMMENT);
    const parser = new Parser(nonComment);
    const parseResult = parser.parse();
    compilation.parser = parseResult;

    if (parseResult.ast) {
      compilation.parseTree = generateParseTree(parseResult.ast);
      compilation.parseTreeAscii = formatParseTreeAscii(compilation.parseTree);
    }

    // Phase 3 — Semantic Analysis (Symbol Table & Type Checker)
    const semanticAnalyzer = new SemanticAnalyzer(SCHEMA);
    compilation.semantic = semanticAnalyzer.analyze(parseResult.ast);

    // Phase 4 — Intermediate Code Generation (Three-Address Code)
    if (parseResult.ast && parseResult.errors.length === 0) {
      const irGen = new IRGenerator();
      compilation.ir = irGen.generate(parseResult.ast);
    } else {
      compilation.ir = { tacLines: [], instructions: [] };
    }

    // Phase 5 — Optimization Passes
    if (compilation.ir && compilation.ir.tacLines.length > 0) {
      const optimizer = new Optimizer();
      compilation.optimizer = optimizer.optimize(compilation.ir, parseResult.ast);
    } else {
      compilation.optimizer = { beforeLines: [], afterLines: [], beforeCode: '', afterCode: '', passes: [], optimized: [] };
    }

    // Phase 6 — Execution Plan
    if (compilation.optimizer && compilation.optimizer.optimized.length > 0) {
      const planner = new ExecutionPlanner();
      compilation.execution = planner.plan(compilation.optimizer.optimized, parseResult.ast);
    } else {
      compilation.execution = { nodes: [], tree: null, totalCost: 0 };
    }

    // Count errors across front-end phases
    const errorCount = (lexResult.errors ? lexResult.errors.length : 0) +
                       (parseResult.errors ? parseResult.errors.length : 0) +
                       (compilation.semantic.errors ? compilation.semantic.errors.length : 0);
    compilation.totalErrors = errorCount;

    // Update status bar
    if (errorCount === 0) {
      setStatus('success', 'Compilation successful (7 phases generated)');
    } else {
      setStatus('error', `Compilation failed — ${errorCount} error${errorCount > 1 ? 's' : ''}`);
    }

    // Update tab indicators
    updatePhaseTabBadges();

    // Render current active phase
    renderPhase();
  }

  function updatePhaseTabBadges() {
    document.querySelectorAll('.phase-tab-btn').forEach((btn, idx) => {
      btn.classList.remove('has-error', 'is-success');
      if (!compilation) return;

      if (idx === 0) {
        if (compilation.lexer.errors.length > 0) btn.classList.add('has-error');
        else btn.classList.add('is-success');
      } else if (idx === 1) {
        if (compilation.parser.errors.length > 0) btn.classList.add('has-error');
        else if (compilation.parser.ast) btn.classList.add('is-success');
      } else if (idx === 2) {
        if (compilation.parser.ast) btn.classList.add('is-success');
      } else if (idx === 3) {
        if (compilation.semantic.errors.length > 0) btn.classList.add('has-error');
        else if (compilation.semantic.symbolTable.length > 0) btn.classList.add('is-success');
      } else if (idx === 4) {
        if (compilation.ir.tacLines.length > 0) btn.classList.add('is-success');
      } else if (idx === 5) {
        if (compilation.optimizer.afterLines.length > 0) btn.classList.add('is-success');
      } else if (idx === 6) {
        if (compilation.execution.nodes.length > 0) btn.classList.add('is-success');
      }
    });
  }

  /* ──────────────── Phase Navigation ──────────────── */
  function goToPhase(index) {
    if (index < 0 || index >= PHASES.length) return;
    currentPhaseIndex = index;

    // Update buttons
    document.querySelectorAll('.phase-tab-btn').forEach((btn, i) => {
      btn.classList.toggle('active', i === currentPhaseIndex);
    });

    prevPhaseBtn.disabled = currentPhaseIndex === 0;
    nextPhaseBtn.disabled = currentPhaseIndex === PHASES.length - 1;

    phaseCounter.textContent = `Phase ${currentPhaseIndex + 1} of ${PHASES.length} — ${PHASES[currentPhaseIndex].name}`;

    renderPhase();
  }

  /* ════════════════════════════════════════════════════════════
     PHASE RENDERERS
     ════════════════════════════════════════════════════════════ */
  function renderPhase() {
    if (!compilation) {
      phaseView.innerHTML = `
        <div class="phase-empty-state">
          <p>Enter an SQL query and click <strong>Compile Query</strong> to inspect compiler phases.</p>
        </div>`;
      return;
    }

    switch (currentPhaseIndex) {
      case 0: renderLexerPhase(); break;
      case 1: renderParserPhase(); break;
      case 2: renderASTPhase(); break;
      case 3: renderSemanticPhase(); break;
      case 4: renderIRPhase(); break;
      case 5: renderOptimizerPhase(); break;
      case 6: renderExecutionPhase(); break;
    }
  }

  /* ── 01: Lexer ── */
  function renderLexerPhase() {
    const { tokens, errors } = compilation.lexer;
    const nonEOF = tokens.filter(t => t.type !== TokenType.EOF);

    let errorHTML = '';
    if (errors && errors.length > 0) {
      errorHTML = `
        <div class="compiler-error-box">
          <div class="error-box-header">Lexical Error</div>
          ${errors.map(e => `
            <div class="error-msg-line">
              <span class="error-pos">Line ${e.line}, Column ${e.col}</span>
              <span class="error-text">${escapeHTML(e.message)}</span>
            </div>`).join('')}
        </div>`;
    }

    phaseView.innerHTML = `
      <div class="phase-container">
        <div class="phase-title-bar">
          <h3>Phase 01: Lexical Analysis (Tokenization)</h3>
          <span class="phase-meta-badge">${nonEOF.length} tokens generated</span>
        </div>
        <p class="phase-summary-text">
          The lexer performs character-stream scanning, stripping whitespace and comments, and maps raw lexemes to classified tokens with source line and column coordinates.
        </p>

        ${errorHTML}

        <div class="view-panel">
          <div class="panel-subhead">Token Stream Table</div>
          <div class="table-container">
            <table class="compiler-table token-table">
              <thead>
                <tr>
                  <th style="width: 60px;">#</th>
                  <th>Lexeme</th>
                  <th>Token Type</th>
                  <th>Source Position</th>
                </tr>
              </thead>
              <tbody>
                ${nonEOF.map((t, idx) => `
                  <tr>
                    <td><code>${String(idx + 1).padStart(2, '0')}</code></td>
                    <td><code class="tok-lexeme">${escapeHTML(t.value)}</code></td>
                    <td><span class="tok-badge tok-${t.type.toLowerCase()}">${t.type}</span></td>
                    <td><code>Line ${t.line}, Col ${t.col}</code></td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>`;
  }

  /* ── 02: Parser (Parse Tree) ── */
  function renderParserPhase() {
    const { ast, errors } = compilation.parser;
    const { parseTree, parseTreeAscii } = compilation;

    let errorHTML = '';
    if (errors && errors.length > 0) {
      errorHTML = `
        <div class="compiler-error-box">
          <div class="error-box-header">Syntax Error</div>
          ${errors.map(e => `
            <div class="error-msg-line">
              <span class="error-pos">Line ${e.line}, Column ${e.col}</span>
              <span class="error-text">${escapeHTML(e.message)}</span>
            </div>`).join('')}
        </div>`;
    }

    phaseView.innerHTML = `
      <div class="phase-container">
        <div class="phase-title-bar">
          <h3>Phase 02: Parser (Parse Tree / Concrete Syntax Tree)</h3>
          <span class="phase-meta-badge">${ast ? 'Grammar Accepted' : 'Syntax Rejected'}</span>
        </div>
        <p class="phase-summary-text">
          The recursive-descent parser validates token order against the SQL context-free grammar and derives the structural parse tree representing concrete grammatical productions.
        </p>

        ${errorHTML}

        ${parseTree ? `
          <div class="view-panel">
            <div class="panel-subhead">Concrete Syntax Derivation Tree</div>
            <pre class="ascii-tree-block">${escapeHTML(parseTreeAscii)}</pre>
          </div>
        ` : `
          <div class="compiler-notice-box">
            Parsing aborted due to syntax errors. Fix query syntax to generate parse tree.
          </div>`}
      </div>`;
  }

  /* ── 03: AST (Abstract Syntax Tree) ── */
  function renderASTPhase() {
    const { ast, errors } = compilation.parser;

    if (!ast) {
      phaseView.innerHTML = `
        <div class="phase-container">
          <div class="phase-title-bar">
            <h3>Phase 03: Abstract Syntax Tree (AST)</h3>
            <span class="phase-meta-badge badge-err">No AST Available</span>
          </div>
          <div class="compiler-notice-box">AST construction requires a valid query syntax.</div>
        </div>`;
      return;
    }

    // Default select root node if not selected
    if (!selectedASTNode) {
      selectedASTNode = ast;
    }

    const nodeDetails = getASTNodeDetails(selectedASTNode);

    phaseView.innerHTML = `
      <div class="phase-container">
        <div class="phase-title-bar">
          <h3>Phase 03: Abstract Syntax Tree (AST)</h3>
          <span class="phase-meta-badge">AST Nodes Generated</span>
        </div>
        <p class="phase-summary-text">
          The Abstract Syntax Tree retains essential semantic nodes (statements, operators, attributes, literals) while omitting concrete grammar punctuation. Click any tree node to inspect its attributes in the compiler inspector.
        </p>

        <div class="ast-split-layout">
          <div class="ast-tree-pane">
            <div class="panel-subhead">Interactive AST Tree (Click node to inspect)</div>
            <div class="ast-render-root" id="astTreeRoot">
              ${renderASTTreeNode(ast, '0')}
            </div>
          </div>
          <div class="ast-inspector-pane">
            <div class="panel-subhead">Node Inspector</div>
            <div class="inspector-card" id="astInspectorCard">
              ${renderNodeDetailsTable(nodeDetails)}
            </div>
            <details class="ast-json-details">
              <summary>View Complete AST (JSON)</summary>
              <pre class="json-code-block">${escapeHTML(JSON.stringify(ast, null, 2))}</pre>
            </details>
          </div>
        </div>
      </div>`;

    // Attach click events on AST tree nodes
    document.querySelectorAll('.ast-tree-node').forEach(elem => {
      elem.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.ast-tree-node').forEach(n => n.classList.remove('selected'));
        elem.classList.add('selected');
        const nodePath = elem.dataset.astPath;
        const targetNode = findNodeByPath(compilation.parser.ast, nodePath);
        if (targetNode) {
          selectedASTNode = targetNode;
          const details = getASTNodeDetails(targetNode);
          document.getElementById('astInspectorCard').innerHTML = renderNodeDetailsTable(details);
        }
      });
    });
  }

  function renderASTTreeNode(node, path) {
    if (!node || typeof node !== 'object') {
      return `<div class="ast-tree-leaf"><code>${escapeHTML(String(node))}</code></div>`;
    }
    const type = node.type || (Array.isArray(node) ? 'List' : 'Object');
    const isSelected = selectedASTNode === node ? 'selected' : '';

    let childHTML = '';
    const entries = Object.entries(node).filter(([k]) => k !== 'type');

    for (const [k, v] of entries) {
      if (v === null || v === undefined) continue;
      if (typeof v === 'object') {
        if (Array.isArray(v)) {
          if (v.length > 0) {
            childHTML += `
              <div class="ast-tree-prop">
                <span class="prop-key">${k}:</span>
                <div class="ast-tree-children">
                  ${v.map((item, idx) => renderASTTreeNode(item, `${path}.${k}[${idx}]`)).join('')}
                </div>
              </div>`;
          }
        } else {
          childHTML += `
            <div class="ast-tree-prop">
              <span class="prop-key">${k}:</span>
              <div class="ast-tree-children">
                ${renderASTTreeNode(v, `${path}.${k}`)}
              </div>
            </div>`;
        }
      } else {
        childHTML += `<div class="ast-tree-simple"><span class="prop-key">${k}:</span> <span class="prop-val">${escapeHTML(String(v))}</span></div>`;
      }
    }

    return `
      <div class="ast-tree-node ${isSelected}" data-ast-path="${path}">
        <span class="node-type-label">${type}</span>
        ${childHTML ? `<div class="node-contents">${childHTML}</div>` : ''}
      </div>`;
  }

  function findNodeByPath(root, path) {
    if (path === '0') return root;
    // Simple path resolver
    const parts = path.split('.').slice(1);
    let cur = root;
    for (const p of parts) {
      if (!cur) return null;
      if (p.includes('[')) {
        const [prop, rest] = p.split('[');
        const idx = parseInt(rest.replace(']', ''), 10);
        cur = cur[prop] ? cur[prop][idx] : null;
      } else {
        cur = cur[p];
      }
    }
    return cur;
  }

  function renderNodeDetailsTable(details) {
    if (!details) return '<p class="text-muted">Select an AST node to inspect properties.</p>';
    return `
      <table class="inspector-table">
        <tbody>
          ${Object.entries(details).map(([k, v]) => `
            <tr>
              <td class="insp-key">${k}</td>
              <td class="insp-val"><code>${escapeHTML(String(v))}</code></td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  }

  /* ── 04: Semantic Analysis ── */
  function renderSemanticPhase() {
    const { errors, warnings, symbolTable } = compilation.semantic;

    let errorHTML = '';
    if (errors && errors.length > 0) {
      errorHTML = `
        <div class="compiler-error-box">
          <div class="error-box-header">Semantic Error</div>
          ${errors.map(e => `
            <div class="error-msg-line">
              <span class="error-text">${escapeHTML(e.message)}</span>
            </div>`).join('')}
        </div>`;
    }

    phaseView.innerHTML = `
      <div class="phase-container">
        <div class="phase-title-bar">
          <h3>Phase 04: Semantic Analysis & Symbol Table</h3>
          <span class="phase-meta-badge ${errors.length > 0 ? 'badge-err' : 'badge-ok'}">
            ${errors.length > 0 ? `${errors.length} Semantic Error(s)` : 'Schema Validated'}
          </span>
        </div>
        <p class="phase-summary-text">
          Semantic analysis checks identifier existence against the system catalog/schema, resolves attribute ambiguity, validates scoping, and verifies type compatibility.
        </p>

        ${errorHTML}

        <div class="view-panel">
          <div class="panel-subhead">Compiler Symbol Table</div>
          <div class="table-container">
            <table class="compiler-table symbol-table">
              <thead>
                <tr>
                  <th>Identifier</th>
                  <th>Symbol Type</th>
                  <th>Source Context</th>
                  <th>Resolution Status</th>
                  <th>Schema Details</th>
                </tr>
              </thead>
              <tbody>
                ${symbolTable.length > 0 ? symbolTable.map(s => `
                  <tr>
                    <td><code>${escapeHTML(s.identifier)}</code></td>
                    <td><span class="sym-badge sym-${s.type.toLowerCase()}">${s.type}</span></td>
                    <td><code>${s.source}</code></td>
                    <td><span class="status-badge status-${s.status.toLowerCase()}">${s.status}</span></td>
                    <td class="text-muted">${escapeHTML(s.details || '')}</td>
                  </tr>`).join('') : '<tr><td colspan="5" class="text-muted">No identifiers mapped.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      </div>`;
  }

  /* ── 05: Intermediate Code (Three-Address Code) ── */
  function renderIRPhase() {
    const { tacLines } = compilation.ir;

    if (!tacLines || tacLines.length === 0) {
      phaseView.innerHTML = `
        <div class="phase-container">
          <div class="phase-title-bar">
            <h3>Phase 05: Intermediate Representation (Three-Address Code)</h3>
            <span class="phase-meta-badge badge-err">No TAC Available</span>
          </div>
          <div class="compiler-notice-box">Intermediate code generation requires valid AST syntax.</div>
        </div>`;
      return;
    }

    const tacText = tacLines.map(t => `${t.line}  ${t.code}`).join('\n');

    phaseView.innerHTML = `
      <div class="phase-container">
        <div class="phase-title-bar">
          <h3>Phase 05: Intermediate Representation (Three-Address Code)</h3>
          <span class="phase-meta-badge">${tacLines.length} Instructions</span>
        </div>
        <p class="phase-summary-text">
          The AST is lowered into linearized Three-Address Code (TAC). Each instruction utilizes at most three memory references (target and up to two operands) representing atomic query engine operations.
        </p>

        <div class="view-panel">
          <div class="panel-subhead">Generated Three-Address Code Listing</div>
          <pre class="tac-code-block">${escapeHTML(tacText)}</pre>
        </div>

        <div class="view-panel">
          <div class="panel-subhead">Instruction Instruction-Set Breakdown</div>
          <div class="table-container">
            <table class="compiler-table tac-table">
              <thead>
                <tr>
                  <th style="width: 60px;">Line</th>
                  <th>Instruction (TAC)</th>
                  <th>Operation</th>
                  <th>Target / Operands</th>
                  <th>Compiler Explanation</th>
                </tr>
              </thead>
              <tbody>
                ${tacLines.map(t => `
                  <tr>
                    <td><code>${t.line}</code></td>
                    <td><code class="tac-hl">${escapeHTML(t.code)}</code></td>
                    <td><span class="op-badge">${t.op}</span></td>
                    <td><code>${escapeHTML(t.operands.join(', ') || '-')}</code></td>
                    <td class="text-muted">${escapeHTML(t.explanation)}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>`;
  }

  /* ── 06: Optimization ── */
  function renderOptimizerPhase() {
    const { beforeCode, afterCode, passes } = compilation.optimizer;

    const hasOptimizations = passes && passes.length > 0;

    phaseView.innerHTML = `
      <div class="phase-container">
        <div class="phase-title-bar">
          <h3>Phase 06: Query Optimization (Algebraic Transformations)</h3>
          <span class="phase-meta-badge">${hasOptimizations ? `${passes.length} Pass(es) Applied` : 'Canonical'}</span>
        </div>
        <p class="phase-summary-text">
          The optimizer rewrites intermediate code using algebraic equivalence rules — pushing predicates down before joins, pruning unused projections, and folding constant expressions at compile-time.
        </p>

        <div class="view-panel">
          <div class="panel-subhead">Active Optimization Passes</div>
          ${hasOptimizations ? `
            <div class="opt-passes-list">
              ${passes.map(p => `
                <div class="opt-pass-card">
                  <div class="opt-pass-header">
                    <span class="opt-pass-title">${p.name}</span>
                    <span class="opt-pass-tech">${p.technique}</span>
                  </div>
                  <div class="opt-pass-desc">${escapeHTML(p.description)}</div>
                </div>`).join('')}
            </div>` : `
            <div class="compiler-notice-box">
              No optimization passes applicable for this query (intermediate code is already in canonical form).
            </div>`}
        </div>

        <div class="view-panel">
          <div class="panel-subhead">Intermediate Code Comparison (Before vs. After Optimization)</div>
          <div class="cmp-grid">
            <div class="cmp-column">
              <div class="cmp-col-header">Initial Intermediate Code (Before)</div>
              <pre class="tac-code-block">${escapeHTML(beforeCode || '(Empty)')}</pre>
            </div>
            <div class="cmp-column cmp-col-opt">
              <div class="cmp-col-header">Optimized Intermediate Code (After)</div>
              <pre class="tac-code-block">${escapeHTML(afterCode || '(Empty)')}</pre>
            </div>
          </div>
        </div>
      </div>`;
  }

  /* ── 07: Execution Plan ── */
  function renderExecutionPhase() {
    const { nodes, totalCost } = compilation.execution;

    if (!nodes || nodes.length === 0) {
      phaseView.innerHTML = `
        <div class="phase-container">
          <div class="phase-title-bar">
            <h3>Phase 07: Physical Execution Plan</h3>
            <span class="phase-meta-badge badge-err">No Plan Available</span>
          </div>
          <div class="compiler-notice-box">Execution plan requires valid intermediate code.</div>
        </div>`;
      return;
    }

    if (!selectedPlanNode) {
      selectedPlanNode = nodes[nodes.length - 1];
    }

    phaseView.innerHTML = `
      <div class="phase-container">
        <div class="phase-title-bar">
          <h3>Phase 07: Physical Execution Plan</h3>
          <span class="phase-meta-badge">Estimated Cost: ${totalCost.toFixed(1)}</span>
        </div>
        <p class="phase-summary-text">
          The physical execution plan arranges physical relational algebra operators into an executable pipeline tree, estimating tuple cardinality and computation cost at each stage. Click any operator to inspect its properties.
        </p>

        <div class="plan-split-layout">
          <div class="plan-tree-pane">
            <div class="panel-subhead">Execution Operator Pipeline Tree</div>
            <div class="plan-vertical-chain">
              ${renderPlanChain(nodes)}
            </div>
          </div>
          <div class="plan-inspector-pane">
            <div class="panel-subhead">Operator Details Inspector</div>
            <div class="inspector-card" id="planInspectorCard">
              ${renderPlanNodeDetails(selectedPlanNode)}
            </div>

            <div class="panel-subhead" style="margin-top: 1rem;">Cost Breakdown Table</div>
            <div class="table-container">
              <table class="compiler-table cost-table">
                <thead>
                  <tr>
                    <th>Operator</th>
                    <th>Access Method</th>
                    <th>Est. Rows</th>
                    <th>Cost</th>
                  </tr>
                </thead>
                <tbody>
                  ${nodes.map(n => `
                    <tr>
                      <td><code>${n.operation}</code></td>
                      <td>${n.accessMethod}</td>
                      <td>${n.estimatedRows.toLocaleString()}</td>
                      <td><code>${n.estimatedCost.toFixed(1)}</code></td>
                    </tr>`).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>`;

    // Attach click events on plan nodes
    document.querySelectorAll('.plan-chain-node').forEach(elem => {
      elem.addEventListener('click', () => {
        document.querySelectorAll('.plan-chain-node').forEach(n => n.classList.remove('selected'));
        elem.classList.add('selected');
        const nodeId = elem.dataset.nodeId;
        const targetNode = compilation.execution.nodes.find(n => n.id === nodeId);
        if (targetNode) {
          selectedPlanNode = targetNode;
          document.getElementById('planInspectorCard').innerHTML = renderPlanNodeDetails(targetNode);
        }
      });
    });
  }

  function renderPlanChain(nodes) {
    // Top-to-bottom pipeline: PROJECT -> SORT -> FILTER -> TABLE SCAN
    // Reverse array so top operator is at the top
    const reversed = [...nodes].reverse();
    return reversed.map((node, i) => {
      const isSelected = (selectedPlanNode && selectedPlanNode.id === node.id) ? 'selected' : '';
      const isLast = i === reversed.length - 1;
      return `
        <div class="plan-chain-node ${isSelected}" data-node-id="${node.id}">
          <div class="plan-node-badge">${node.operation}</div>
          <div class="plan-node-summary">${escapeHTML(node.detail || node.accessMethod)}</div>
          <div class="plan-node-meta">Est: ${node.estimatedRows} rows | Cost: ${node.estimatedCost.toFixed(1)}</div>
        </div>
        ${!isLast ? `
          <div class="plan-chain-arrow">
            <span>│</span>
            <span>▼</span>
          </div>` : ''}`;
    }).join('');
  }

  function renderPlanNodeDetails(node) {
    if (!node) return '<p class="text-muted">Select an operator from the tree.</p>';
    return `
      <table class="inspector-table">
        <tbody>
          <tr><td class="insp-key">Operator</td><td class="insp-val"><code>${node.operation}</code></td></tr>
          <tr><td class="insp-key">Access Method</td><td class="insp-val">${node.accessMethod}</td></tr>
          <tr><td class="insp-key">Condition / Spec</td><td class="insp-val"><code>${escapeHTML(node.condition || '(None)')}</code></td></tr>
          <tr><td class="insp-key">Input Source</td><td class="insp-val"><code>${escapeHTML(node.input || 'Buffer')}</code></td></tr>
          <tr><td class="insp-key">Estimated Cardinality</td><td class="insp-val"><code>${node.estimatedRows.toLocaleString()} rows</code></td></tr>
          <tr><td class="insp-key">Estimated Cost</td><td class="insp-val"><code>${node.estimatedCost.toFixed(1)} units</code></td></tr>
        </tbody>
      </table>`;
  }

  /* ──────────────── Utility ──────────────── */
  function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ──────────────── Boot ──────────────── */
  document.addEventListener('DOMContentLoaded', init);
})();
