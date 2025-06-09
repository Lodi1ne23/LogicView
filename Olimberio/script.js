// --- Utility Functions for Logic Parsing ---
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

// Tokenize the input string into variables, operators, and parenthesis
function tokenize(expr) {
    expr = expr.replace(/\s+/g, '');
    let tokens = [];
    let i = 0;
    while (i < expr.length) {
        // Multi-character operators
        if (expr.substr(i, 3) === '<->') { tokens.push('<->'); i += 3; continue; }
        if (expr.substr(i, 2) === '->') { tokens.push('->'); i += 2; continue; }
        // Single-char operators or parenthesis
        if (OP_SYMBOLS.includes(expr[i]) || expr[i] === '(' || expr[i] === ')') {
            tokens.push(expr[i]);
            i++; continue;
        }
        // Latin letters as variables
        if (/[A-Za-z]/.test(expr[i])) {
            let v = '';
            while (i < expr.length && /[A-Za-z0-9_]/.test(expr[i])) {
                v += expr[i++];
            }
            tokens.push(v);
            continue;
        }
        // Unicode logic symbols as operators
        if ('¬∧∨→↔'.includes(expr[i])) {
            tokens.push(expr[i]);
            i++; continue;
        }
        showError(`Unexpected character: "${expr[i]}"`);
        throw new Error('Invalid character');
    }
    return tokens;
}

// Shunting Yard Algorithm: Infix -> Postfix (RPN)
function infixToPostfix(tokens) {
    let output = [];
    let stack = [];
    for (let i = 0; i < tokens.length; i++) {
        let t = tokens[i];
        if (/[A-Za-z][A-Za-z0-9_]*/.test(t)) {
            output.push(t);
        } else if (OP_SYMBOLS.includes(t) || MULTI_CHAR_OPS.includes(t)) {
            let op1 = t;
            while (stack.length > 0) {
                let op2 = stack[stack.length - 1];
                if ((OP_SYMBOLS.includes(op2) || MULTI_CHAR_OPS.includes(op2)) &&
                    ((OPERATORS[op1].assoc === 'left' && OPERATORS[op1].precedence <= OPERATORS[op2].precedence) ||
                        (OPERATORS[op1].assoc === 'right' && OPERATORS[op1].precedence < OPERATORS[op2].precedence))) {
                    output.push(stack.pop());
                } else break;
            }
            stack.push(op1);
        } else if (t === '(') {
            stack.push(t);
        } else if (t === ')') {
            let foundLeftParen = false;
            while (stack.length > 0) {
                let op = stack.pop();
                if (op === '(') {
                    foundLeftParen = true;
                    break;
                } else {
                    output.push(op);
                }
            }
            if (!foundLeftParen) throw new Error('Mismatched parentheses');
        } else {
            throw new Error('Invalid token');
        }
    }
    while (stack.length > 0) {
        let op = stack.pop();
        if (op === '(' || op === ')') throw new Error('Mismatched parentheses');
        output.push(op);
    }
    return output;
}

// Extract unique variables from tokens
function extractVariables(tokens) {
    let vars = [];
    tokens.forEach(t => {
        if (/[A-Za-z][A-Za-z0-9_]*/.test(t) && !vars.includes(t)) {
            vars.push(t);
        }
    });
    vars.sort();
    return vars;
}

// Evaluate RPN with given variable assignment
function evalPostfix(postfix, assignment) {
    let stack = [];
    for (let t of postfix) {
        if (/[A-Za-z][A-Za-z0-9_]*/.test(t)) {
            stack.push(assignment[t]);
        } else if (OP_SYMBOLS.includes(t) || MULTI_CHAR_OPS.includes(t)) {
            let op = OPERATORS[t];
            if (!op) throw new Error(`Unknown operator: ${t}`);
            if (op.arity === 1) {
                if (stack.length < 1) throw new Error('Invalid expression');
                let a = stack.pop();
                stack.push(op.func(a));
            } else if (op.arity === 2) {
                if (stack.length < 2) throw new Error('Invalid expression');
                let b = stack.pop();
                let a = stack.pop();
                stack.push(op.func(a, b));
            }
        }
    }
    if (stack.length !== 1) throw new Error('Invalid expression');
    return stack[0];
}

// Generate all combinations of truth values for n variables
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

// --- UI & Main Logic ---
function renderTruthTable(variables, rows, exprLabel) {
    let html = `<table class="truth-table"><thead><tr>`;
    variables.forEach(v => {
        html += `<th>${v}</th>`;
    });
    html += `<th title="Result of expression">${exprLabel}</th>`;
    html += `</tr></thead><tbody>`;
    rows.forEach(row => {
        html += `<tr>`;
        variables.forEach(v => {
            html += `<td>${row[v] ? '<span class="truth">T</span>' : '<span class="false">F</span>'}</td>`;
        });
        html += `<td class="${row.result ? 'truth' : 'false'}">${row.result ? 'T' : 'F'}</td>`;
        html += `</tr>`;
    });
    html += `</tbody></table>`;
    return html;
}

function classifyExpression(results) {
    if (results.every(v => v === true)) return { label: "Tautology", color: "#51d88a", desc: "The expression is always true." };
    if (results.every(v => v === false)) return { label: "Contradiction", color: "#ff6161", desc: "The expression is always false." };
    return { label: "Contingency", color: "#ffd700", desc: "The expression is true in some cases and false in others." };
}

function getExprLabel(tokens) {
    // Render expression using logic symbols
    return tokens.map(t => {
        if (OPERATORS[t]) return `<span title="${OPERATORS[t].tooltip}">${OPERATORS[t].symbol}</span>`;
        else return t;
    }).join(' ');
}

document.getElementById('logicForm').addEventListener('submit', function (e) {
    e.preventDefault();
    hideError();
    document.getElementById('classification').textContent = '';
    document.getElementById('tableContainer').innerHTML = '';
    
    const expr = document.getElementById('logicInput').value.trim();
    if (!expr) {
        showError("Please enter a logic expression.");
        return;
    }

    // Show loading overlay
    const overlay = document.getElementById('loadingOverlay');
    overlay.style.display = 'flex';

    setTimeout(() => {
        try {
            // Normalize operators
            let cleanedExpr = expr.replace(/<->/g, '↔')
                                  .replace(/<=>/g, '↔')
                                  .replace(/->/g, '→')
                                  .replace(/=>/g, '→')
                                  .replace(/~/g, '¬')
                                  .replace(/\bAND\b/gi, '∧')
                                  .replace(/\bOR\b/gi, '∨')
                                  .replace(/\bNOT\b/gi, '¬');
    
            let tokens = tokenize(cleanedExpr);
            let variables = extractVariables(tokens);
            if (variables.length === 0) {
                showError("No logical variables found (use letters like P, Q, R, etc).");
                overlay.style.display = 'none'; // hide if error
                return;
            }

            let postfix = infixToPostfix(tokens);
            let assignments = generateTruthAssignments(variables);
            let rows = [];
            let resultValues = [];

            for (let row of assignments) {
                let val = evalPostfix(postfix, row);
                resultValues.push(val);
                rows.push({ ...row, result: val });
            }

            document.getElementById('tableContainer').innerHTML = renderTruthTable(variables, rows, getExprLabel(tokens));

            // Classification
            let c = classifyExpression(resultValues);
            document.getElementById('classification').innerHTML = `<span style="color:${c.color}">${c.label}</span> <span class="tooltip" title="${c.desc}">&#9432;</span>`;

        } catch (err) {
            showError("Syntax error: " + err.message);
        } finally {
            overlay.style.display = 'none'; // Always hide overlay after processing
        }
    }, 5000); // Delay for 5 seconds
});


// Allow copy-paste of logic symbols
document.getElementById('logicInput').addEventListener('paste', function (e) {
    setTimeout(() => {
        let v = this.value;
        this.value = v.replace(/<->/g, '↔').replace(/->/g, '→').replace(/~/g, '¬');
    }, 0);
});

// Hide error on input
document.getElementById('logicInput').addEventListener('input', hideError);

// Tooltip for logic classification
document.addEventListener('mouseover', function(e) {
    if (e.target.classList.contains('tooltip')) {
        e.target.setAttribute('title', e.target.title);
    }
});
