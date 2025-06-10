// --- Logic Parsing and Table Generation with Sub-expression Tracing and All Requested Features ---
const OPERATORS = {
    '~': { precedence: 4, assoc: 'right', arity: 1, func: a => !a, symbol: '¬', tooltip: "NOT" },
    '¬': { precedence: 4, assoc: 'right', arity: 1, func: a => !a, symbol: '¬', tooltip: "NOT" },
    '&': { precedence: 3, assoc: 'left', arity: 2, func: (a, b) => a && b, symbol: '∧', tooltip: "AND" },
    '∧': { precedence: 3, assoc: 'left', arity: 2, func: (a, b) => a && b, symbol: '∧', tooltip: "AND" },
    '|': { precedence: 2, assoc: 'left', arity: 2, func: (a, b) => a || b, symbol: '∨', tooltip: "OR" },
    '∨': { precedence: 2, assoc: 'left', arity: 2, func: (a, b) => a || b, symbol: '∨', tooltip: "OR" },
    '->': { precedence: 1, assoc: 'right', arity: 2, func: (a, b) => (!a) || b, symbol: '→', tooltip: "IMPLIES" },
    '→': { precedence: 1, assoc: 'right', arity: 2, func: (a, b) => (!a) || b, symbol: '→', tooltip: "IMPLIES" },
    '<->': { precedence: 0, assoc: 'left', arity: 2, func: (a, b) => a === b, symbol: '↔', tooltip: "BICONDITIONAL" },
    '↔': { precedence: 0, assoc: 'left', arity: 2, func: (a, b) => a === b, symbol: '↔', tooltip: "BICONDITIONAL" },
};
const OP_SYMBOLS = Object.keys(OPERATORS);
const MULTI_CHAR_OPS = ['->', '<->'];
const tableHistoryKey = 'logicview_history_v2';

const CLASSIFICATION_MEANINGS = {
    "Tautology": "A tautology is a propositional logic formula that is always true, regardless of the truth values of its variables.",
    "Contradiction": "A contradiction is a propositional logic formula that is always false, regardless of the truth values of its variables.",
    "Contingency": "A contingency is a propositional logic formula that is true for some assignments of its variables and false for others."
};

function showError(msg) {
    const el = document.getElementById('errorMsg');
    el.textContent = msg;
    el.style.display = 'block';
}
function hideError() {
    const el = document.getElementById('errorMsg');
    el.textContent = "";
    el.style.display = 'none';
}

// --- Expression Parsing with sub-expression extraction ---
function tokenize(expr) {
    expr = expr.replace(/\s+/g, '');
    let tokens = [];
    let i = 0;
    while (i < expr.length) {
        if (expr.substr(i, 3) === '<->') { tokens.push('<->'); i += 3; continue; }
        if (expr.substr(i, 2) === '->') { tokens.push('->'); i += 2; continue; }
        if (OP_SYMBOLS.includes(expr[i]) || expr[i] === '(' || expr[i] === ')') {
            tokens.push(expr[i]);
            i++; continue;
        }
        if (/[A-Za-z]/.test(expr[i])) {
            let v = '';
            while (i < expr.length && /[A-Za-z0-9_]/.test(expr[i])) {
                v += expr[i++];
            }
            tokens.push(v);
            continue;
        }
        if ('¬∧∨→↔'.includes(expr[i])) {
            tokens.push(expr[i]);
            i++; continue;
        }
        showError(`Unexpected character: "${expr[i]}"`);
        throw new Error('Invalid character');
    }
    return tokens;
}

// Parser (recursive descent, handles precedence, sub-expr extraction)
function parseToAST(tokens) {
    let pos = 0;
    let subexprs = [];
    function parsePrimary() {
        if (tokens[pos] === '(') {
            pos++;
            let node = parseExpr();
            if (tokens[pos] !== ')') throw new Error("Mismatched parentheses");
            pos++;
            return node;
        }
        if (OP_SYMBOLS.includes(tokens[pos]) && OPERATORS[tokens[pos]].arity === 1) {
            let op = tokens[pos++];
            let child = parsePrimary();
            let label = OPERATORS[op].symbol + (child.label || child);
            let node = { type: 'op1', op, child, label };
            subexprs.push(label);
            node.sub = label;
            return node;
        }
        if (/[A-Za-z][A-Za-z0-9_]*/.test(tokens[pos])) {
            let varname = tokens[pos++];
            return { type: 'var', name: varname, label: varname };
        }
        throw new Error('Unexpected token: ' + tokens[pos]);
    }
    function parseLevel(precedence = 0) {
        let left = parsePrimary();
        while (pos < tokens.length && (OP_SYMBOLS.includes(tokens[pos]) || MULTI_CHAR_OPS.includes(tokens[pos]))) {
            let op = tokens[pos];
            let info = OPERATORS[op];
            if (!info || info.precedence < precedence) break;
            pos++;
            let right = parseLevel(info.precedence + (info.assoc === 'left' ? 1 : 0));
            let label = '(' + (left.label || left) + ' ' + info.symbol + ' ' + (right.label || right) + ')';
            let node = { type: 'op2', op, left, right, label };
            subexprs.push(label);
            node.sub = label;
            left = node;
        }
        return left;
    }
    function parseExpr() {
        return parseLevel();
    }
    let ast = parseExpr();
    if (pos !== tokens.length) throw new Error("Extra tokens at end");
    let subOrder = getUniqueSubexprOrder(ast, subexprs);
    return { ast, subOrder };
}
// Get unique sub-expressions in order of calculation
function getUniqueSubexprOrder(ast, subexprs) {
    let seen = new Set();
    let out = [];
    function walk(node) {
        if (!node) return;
        if (node.type === 'op1' || node.type === 'op2') {
            if (!seen.has(node.label)) {
                if (node.type === 'op1') walk(node.child);
                else { walk(node.left); walk(node.right);}
                out.push(node.label);
                seen.add(node.label);
            }
        }
    }
    walk(ast);
    return out;
}
function collectVars(ast) {
    let vars = [];
    function walk(node) {
        if (!node) return;
        if (node.type === 'var' && !vars.includes(node.name)) vars.push(node.name);
        if (node.type === 'op1') walk(node.child);
        if (node.type === 'op2') { walk(node.left); walk(node.right);}
    }
    walk(ast);
    vars.sort();
    return vars;
}
// Evaluate AST for a row, fill subexpression values
function evalWithSteps(ast, vars, assignment, subOrder) {
    let values = {};
    function walk(node) {
        if (!node) return;
        if (node.type === 'var') return assignment[node.name];
        if (node.type === 'op1') {
            let v = OPERATORS[node.op].func(walk(node.child));
            values[node.label] = v;
            return v;
        }
        if (node.type === 'op2') {
            let v = OPERATORS[node.op].func(walk(node.left), walk(node.right));
            values[node.label] = v;
            return v;
        }
    }
    // Fill in variables too
    for (const v of vars) values[v] = assignment[v];
    let final = walk(ast);
    // Fill subOrder columns
    let row = {};
    for (const s of vars.concat(subOrder)) row[s] = values[s];
    return row;
}
function generateTruthAssignments(variables) {
    const n = variables.length;
    const total = 1 << n;
    let assignments = [];
    for (let i = 0; i < total; i++) {
        let row = {};
        for (let j = 0; j < n; j++) {
            row[variables[j]] = !!(i & (1 << (n - j - 1)));
        }
        assignments.push(row);
    }
    return assignments;
}
function renderTruthTable(variables, subOrder, rows) {
    let html = `<table class="truth-table" id="truthTable"><thead><tr>`;
    variables.forEach(v => html += `<th data-var="${v}">${v}</th>`);
    subOrder.forEach((s,i) => {
        html += `<th class="expr-col" title="Step ${i+1}">${s}</th>`;
    });
    html += `</tr></thead><tbody>`;
    rows.forEach((row, idx) => {
        html += `<tr>`;
        variables.forEach(v => html += `<td data-var="${v}" data-row="${idx}">${row[v] ? '<span class="truth">T</span>' : '<span class="false">F</span>'}</td>`);
        subOrder.forEach(s => {
            let val = row[s];
            html += `<td class="expr-col ${val ? 'truth' : 'false'}" data-row="${idx}">${val ? 'T' : 'F'}</td>`;
        });
        html += `</tr>`;
    });
    html += `</tbody></table>`;
    return html;
}
function classifyExpression(results) {
    if (results.every(v => v === true)) return { label: "🟢 Tautology", type: "Tautology", color: "#51d88a", desc: CLASSIFICATION_MEANINGS["Tautology"] };
    if (results.every(v => v === false)) return { label: "🔴 Contradiction", type: "Contradiction", color: "#ff6161", desc: CLASSIFICATION_MEANINGS["Contradiction"] };
    return { label: "🟡 Contingency", type: "Contingency", color: "#ffd700", desc: CLASSIFICATION_MEANINGS["Contingency"] };
}

function processTable(expr, addToHistory = true) {
    hideError();
    document.getElementById('classification').textContent = '';
    document.getElementById('tableContainer').classList.remove('faded');
    document.getElementById('tableContainer').innerHTML = '';
    document.getElementById('copyRow').style.display = 'none';
    document.getElementById('infoPopup').style.display = 'none';
    if (!expr) {
        showError("Please enter a logic expression.");
        return;
    }
    try {
        expr = expr.replace(/<->/g, '↔')
                   .replace(/<=>/g, '↔')
                   .replace(/->/g, '→')
                   .replace(/=>/g, '→')
                   .replace(/~/g, '¬')
                   .replace(/\bAND\b/gi, '∧')
                   .replace(/\bOR\b/gi, '∨')
                   .replace(/\bNOT\b/gi, '¬');
        let tokens = tokenize(expr);
        let { ast, subOrder } = parseToAST(tokens);
        let variables = collectVars(ast);
        if (variables.length === 0) {
            showError("No logical variables found (use letters like P, Q, R, etc).");
            return;
        }
        if (variables.length > 7) {
            showError("Please use 7 or fewer variables to keep the table readable.");
            return;
        }
        let assignments = generateTruthAssignments(variables);
        let rows = [];
        let resultValues = [];
        for (let row of assignments) {
            const stepVals = evalWithSteps(ast, variables, row, subOrder);
            rows.push(stepVals);
            resultValues.push(stepVals[subOrder[subOrder.length - 1]]);
        }
        document.getElementById('tableContainer').innerHTML = renderTruthTable(variables, subOrder, rows);
        let c = classifyExpression(resultValues);
        document.getElementById('classification').innerHTML =
            `<span style="color:${c.color}">${c.label}</span>
             <button class="info-btn" id="infoBtn" title="What does this mean?">ℹ️</button>`;
        addTableHover();
        showCopyButtons(variables, subOrder, rows);
        if (addToHistory) saveToHistory(expr);
        // Info popup binding
        document.getElementById("infoBtn").onclick = function(e) {
            showInfoPopup(c.type, c.desc);
        };
    } catch (err) {
        showError("Syntax error: " + err.message);
    }
}
function showInfoPopup(type, desc) {
    let popup = document.getElementById("infoPopup");
    popup.innerHTML = `<button class="close-btn" onclick="document.getElementById('infoPopup').style.display='none'">&times;</button>
        <h3>${type}</h3><p>${desc}</p>`;
    popup.style.display = "block";
    setTimeout(() => {
        popup.onclick = e => { if(e.target === popup) popup.style.display='none'; };
    }, 0);
}

// Table highlighting
function addTableHover() {
    const table = document.querySelector('table.truth-table');
    if (!table) return;
    const ths = [...table.querySelectorAll('th')];
    const tds = [...table.querySelectorAll('td')];
    tds.forEach(td => {
        td.addEventListener('mouseenter', () => {
            const varName = td.getAttribute('data-var');
            const rowIdx = td.getAttribute('data-row');
            if (varName) {
                ths.forEach(th => {
                    if (th.getAttribute('data-var') === varName) th.classList.add('var-highlight');
                });
                tds.forEach(cell => {
                    if (cell.getAttribute('data-var') === varName) cell.classList.add('var-highlight');
                });
            }
            if (rowIdx) {
                tds.forEach(cell => {
                    if (cell.getAttribute('data-row') === rowIdx) cell.classList.add('var-highlight');
                });
                table.querySelectorAll(`td.expr-col[data-row="${rowIdx}"]`).forEach(cell => cell.classList.add('var-highlight'));
            }
        });
        td.addEventListener('mouseleave', () => {
            ths.forEach(th => th.classList.remove('var-highlight'));
            tds.forEach(cell => cell.classList.remove('var-highlight'));
        });
    });
}

// Copy Table Buttons
function showCopyButtons(variables, subOrder, rows) {
    const copyRow = document.getElementById('copyRow');
    copyRow.style.display = 'flex';
    // Listeners
    document.getElementById('copyTextBtn').onclick = () => {
        // Tab separated text
        let txt = [...variables, ...subOrder].join('\t') + '\n';
        rows.forEach(row => {
            txt += [...variables, ...subOrder].map(k => (row[k] ? 'T' : 'F')).join('\t') + '\n';
        });
        copyTextToClipboard(txt);
        flashCopyBtn('copyTextBtn');
    };
    document.getElementById('copyTableBtn').onclick = () => {
        // HTML table
        let html = `<table border="1"><tr>${[...variables, ...subOrder].map(x=>`<th>${x}</th>`).join('')}</tr>`;
        rows.forEach(row => {
            html += `<tr>${[...variables, ...subOrder].map(k => `<td>${row[k] ? 'T' : 'F'}</td>`).join('')}</tr>`;
        });
        html += '</table>';
        copyHtmlTableToClipboard(html);
        flashCopyBtn('copyTableBtn');
    };
    document.getElementById('copyImageBtn').onclick = () => {
        const table = document.getElementById('truthTable');
        if (!table) return;
        // Copy background color for html2canvas
        const isDark = document.body.classList.contains('dark');
        html2canvas(table, {
            backgroundColor: isDark ? "#2e3650" : "#fff",
            scale: 2,
            useCORS: true,
            onclone: (doc) => {
                // make sure text colors are correct in the canvas
                if (isDark) {
                    doc.body.style.background = "#2e3650";
                    doc.querySelectorAll("td.truth").forEach(td => td.style.background = "#6ee7b7");
                    doc.querySelectorAll("td.false").forEach(td => td.style.background = "#fca5a5");
                    doc.querySelectorAll("table").forEach(tb => tb.style.background = "#2e3650");
                    doc.querySelectorAll("th").forEach(th => th.style.background = "#314e74");
                }
            }
        }).then(canvas => {
            canvas.toBlob(blob => {
                const item = new ClipboardItem({'image/png': blob});
                navigator.clipboard.write([item]);
            });
        });
        flashCopyBtn('copyImageBtn');
    };
}
function copyTextToClipboard(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text);
    } else {
        let ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
    }
}
function copyHtmlTableToClipboard(html) {
    if (navigator.clipboard && window.ClipboardItem) {
        const blob = new Blob([html], {type: 'text/html'});
        const item = new ClipboardItem({'text/html': blob});
        navigator.clipboard.write([item]);
    } else {
        // fallback
        let ta = document.createElement('textarea');
        ta.value = html;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
    }
}
function flashCopyBtn(id) {
    const btn = document.getElementById(id);
    const txt = btn.textContent;
    btn.textContent = "✅ Copied!";
    setTimeout(() => btn.textContent = txt, 1200);
}

// Examples
const examples = [
    "P → Q",
    "P ∧ Q",
    "P ∨ Q",
    "P → Q ∨ ¬R",
    "(P ∧ Q) → R",
    "A ∧ (B ∨ C)",
    "(P ↔ Q) ∧ (¬R ∨ Q)",
    "P ∨ (Q ∧ R)",
    "¬P ∨ Q",
    "(A → B) ∧ (B → C) → (A → C)",
    "(P ∨ Q) ∧ (¬P ∨ ¬Q)"
];
document.getElementById('exampleBtn').addEventListener('click', function () {
    const idx = Math.floor(Math.random() * examples.length);
    document.getElementById('logicInput').value = examples[idx];
    processTable(examples[idx], true);
});

// Theme toggle
const themeBtn = document.getElementById('themeBtn');
const themeIcon = document.getElementById('themeIcon');
function setTheme(dark) {
    document.body.classList.toggle('dark', dark);
    themeIcon.textContent = dark ? "☀️" : "🌙";
    localStorage.setItem('logicview_theme', dark ? 'dark' : 'light');
}
themeBtn.addEventListener('click', () => {
    setTheme(!document.body.classList.contains('dark'));
});
(function () {
    const stored = localStorage.getItem('logicview_theme');
    if (stored === 'dark') setTheme(true);
})();

// Input events
document.getElementById('logicForm').addEventListener('submit', function (e) {
    e.preventDefault();
    processTable(document.getElementById('logicInput').value.trim(), true);
});
document.getElementById('logicInput').addEventListener('paste', function (e) {
    setTimeout(() => {
        let v = this.value;
        this.value = v.replace(/<->/g, '↔').replace(/->/g, '→').replace(/~/g, '¬');
    }, 0);
});
document.getElementById('logicInput').addEventListener('input', hideError);
// Tooltip for logic classification
document.addEventListener('mouseover', function(e) {
    if (e.target.classList.contains('tooltip')) {
        e.target.setAttribute('title', e.target.title);
    }
});

// --- History Sidebar ---
const historySidebar = document.getElementById('historySidebar');
const openSidebar = document.getElementById('openSidebar');
const closeSidebar = document.getElementById('closeSidebar');
const historyList = document.getElementById('historyList');
openSidebar.addEventListener('click', () => historySidebar.classList.add('open'));
closeSidebar.addEventListener('click', () => historySidebar.classList.remove('open'));

function saveToHistory(expr) {
    let history = JSON.parse(localStorage.getItem(tableHistoryKey) || '[]');
    history = history.filter(e => e !== expr); // Remove duplicates
    history.unshift(expr);
    if (history.length > 20) history = history.slice(0, 20);
    localStorage.setItem(tableHistoryKey, JSON.stringify(history));
    renderHistory();
}
function renderHistory() {
    let history = JSON.parse(localStorage.getItem(tableHistoryKey) || '[]');
    historyList.innerHTML = '';
    history.forEach((expr, idx) => {
        const li = document.createElement('li');
        li.textContent = expr;
        li.onclick = () => {
            document.getElementById('logicInput').value = expr;
            processTable(expr, false);
            [...historyList.children].forEach(n => n.classList.remove('active'));
            li.classList.add('active');
        };
        historyList.appendChild(li);
    });
}
renderHistory();
// Hide copy row when no table
document.getElementById('tableContainer').addEventListener('DOMSubtreeModified', function () {
    const table = document.querySelector('table.truth-table');
    document.getElementById('copyRow').style.display = table ? 'flex' : 'none';
});
window.onclick = function(event) {
    let popup = document.getElementById('infoPopup');
    if (popup.style.display === "block" && !popup.contains(event.target) && event.target.id !== "infoBtn") {
        popup.style.display = "none";
    }
};
// Operator button insert feature
document.querySelectorAll('.op-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const input = document.getElementById('logicInput');
        const toInsert = btn.getAttribute('data-insert');
        // Insert symbol at cursor position
        const [start, end] = [input.selectionStart, input.selectionEnd];
        const value = input.value;
        input.value = value.slice(0, start) + toInsert + value.slice(end);
        input.focus();
        input.selectionStart = input.selectionEnd = start + toInsert.length;
    });
});

// --- Proposition highlight feature ---
let highlightOn = true;  // default: highlight the result column

function applyResultHighlight(type, subOrder) {
    // Remove old highlights
    document.querySelectorAll('.result-highlight-tautology, .result-highlight-contradiction, .result-highlight-contingency')
        .forEach(el => el.classList.remove('result-highlight-tautology', 'result-highlight-contradiction', 'result-highlight-contingency'));

    if (!highlightOn) return;

    const table = document.getElementById('truthTable');
    if (!table || !subOrder.length) return;
    const lastColIdx = subOrder.length - 1;
    // Find all result column cells (th.expr-col and td.expr-col for last column)
    const ths = table.querySelectorAll('th.expr-col');
    const tds = table.querySelectorAll(`td.expr-col`);
    // Only apply to the last expr-col
    if (ths.length && tds.length) {
        ths[ths.length - 1].classList.add('result-highlight-' + type);
        for (let i = lastColIdx; i < tds.length; i += subOrder.length) {
            tds[i].classList.add('result-highlight-' + type);
        }
    }
}

// Update the processTable function to include the highlight/toggle
function processTable(expr, addToHistory = true) {
    hideError();
    document.getElementById('classification').textContent = '';
    document.getElementById('tableContainer').classList.remove('faded');
    document.getElementById('tableContainer').innerHTML = '';
    document.getElementById('copyRow').style.display = 'none';
    document.getElementById('infoPopup').style.display = 'none';
    if (!expr) {
        showError("Please enter a logic expression.");
        return;
    }
    try {
        expr = expr.replace(/<->/g, '↔')
                   .replace(/<=>/g, '↔')
                   .replace(/->/g, '→')
                   .replace(/=>/g, '→')
                   .replace(/~/g, '¬')
                   .replace(/\bAND\b/gi, '∧')
                   .replace(/\bOR\b/gi, '∨')
                   .replace(/\bNOT\b/gi, '¬');
        let tokens = tokenize(expr);
        let { ast, subOrder } = parseToAST(tokens);
        let variables = collectVars(ast);
        if (variables.length === 0) {
            showError("No logical variables found (use letters like P, Q, R, etc).");
            return;
        }
        if (variables.length > 7) {
            showError("Please use 7 or fewer variables to keep the table readable.");
            return;
        }
        let assignments = generateTruthAssignments(variables);
        let rows = [];
        let resultValues = [];
        for (let row of assignments) {
            const stepVals = evalWithSteps(ast, variables, row, subOrder);
            rows.push(stepVals);
            resultValues.push(stepVals[subOrder[subOrder.length - 1]]);
        }
        document.getElementById('tableContainer').innerHTML = renderTruthTable(variables, subOrder, rows);
        let c = classifyExpression(resultValues);

        // Add highlight toggle button
        document.getElementById('classification').innerHTML =
            `<span style="color:${c.color}">${c.label}</span>
             <button class="info-btn" id="infoBtn" title="What does this mean?">ℹ️</button>
             <button id="tableHighlightBtn" title="Toggle table highlight" aria-label="Toggle table highlight">💡</button>`;

        window.currentSubOrder = subOrder; // for highlight toggle to access
        applyResultHighlight(c.type.toLowerCase(), subOrder);

        // Highlight toggle event
        document.getElementById("tableHighlightBtn").onclick = function() {
            highlightOn = !highlightOn;
            applyResultHighlight(c.type.toLowerCase(), subOrder);
        };

        addTableHover();
        showCopyButtons(variables, subOrder, rows);
        if (addToHistory) saveToHistory(expr);

        // Info popup binding
        document.getElementById("infoBtn").onclick = function(e) {
            showInfoPopup(c.type, c.desc);
        };
    } catch (err) {
        showError("Syntax error: " + err.message);
    }
}
