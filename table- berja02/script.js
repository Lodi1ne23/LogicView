document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('logicForm');
    const logicInput = document.getElementById('logicInput');
    const tableContainer = document.getElementById('tableContainer');
    const errorMsg = document.getElementById('errorMsg');
    const classification = document.getElementById('classification');
    const loadingOverlay = document.getElementById('loadingOverlay');

    form.addEventListener('submit', function(e) {
        e.preventDefault();
        generateTruthTable();
    });

    function generateTruthTable() {
        const expression = logicInput.value.trim();
        
        if (!expression) {
            showError('Please enter a logical expression');
            return;
        }

        showLoading(true);
        
        try {
            // Parse the expression and get variables
            const variables = extractVariables(expression);
            if (variables.length === 0) {
                showError('No valid variables found in the expression');
                showLoading(false);
                return;
            }

            // Generate all possible truth values
            const truthCombinations = generateTruthCombinations(variables.length);
            
            // Evaluate the expression for each combination
            const results = truthCombinations.map(combination => {
                const truthValues = {};
                variables.forEach((variable, index) => {
                    truthValues[variable] = combination[index];
                });
                
                const result = evaluateExpression(expression, truthValues);
                return [...combination, result];
            });

            // Generate and display the truth table
            displayTruthTable(variables, expression, results);
            
            // Classify the expression
            classifyExpression(results);
            
            errorMsg.style.display = 'none';
        } catch (error) {
            showError('Invalid expression: ' + error.message);
        } finally {
            showLoading(false);
        }
    }

    function extractVariables(expression) {
        // Match all uppercase letters (A-Z) that are not part of operators
        const variableRegex = /[A-Z]/g;
        const matches = expression.match(variableRegex);
        if (!matches) return [];
        
        // Get unique variables and sort them alphabetically
        const uniqueVariables = [...new Set(matches)];
        return uniqueVariables.sort();
    }

    function generateTruthCombinations(numVariables) {
        const combinations = [];
        const totalCombinations = Math.pow(2, numVariables);
        
        for (let i = 0; i < totalCombinations; i++) {
            const combination = [];
            for (let j = numVariables - 1; j >= 0; j--) {
                combination.push((i & (1 << j)) ? 1 : 0);
            }
            combinations.push(combination);
        }
        
        return combinations;
    }

    function evaluateExpression(expression, truthValues) {
        // Replace variables with their truth values
        let evalExpr = expression;
        for (const variable in truthValues) {
            const regex = new RegExp(variable, 'g');
            evalExpr = evalExpr.replace(regex, truthValues[variable]);
        }
        
        // Replace logical operators with JavaScript equivalents
        evalExpr = evalExpr
            .replace(/∧/g, '&&')
            .replace(/∨/g, '||')
            .replace(/¬/g, '!')
            .replace(/~/, '!')
            .replace(/→/g, '<=')
            .replace(/-&gt;/g, '<=')
            .replace(/↔/g, '===')
            .replace(/&lt;-&gt;/g, '===')
            .replace(/&amp;/g, '&&')
            .replace(/\|/g, '||');
        
        // Handle parentheses explicitly
        evalExpr = evalExpr.replace(/\(/g, '(').replace(/\)/g, ')');
        
        try {
            // Evaluate the expression
            // Note: Using Function constructor is safer than eval
            return new Function(`return (${evalExpr}) ? 1 : 0;`)();
        } catch (error) {
            throw new Error('Invalid expression syntax');
        }
    }

    function displayTruthTable(variables, expression, results) {
        // Create table element
        const table = document.createElement('table');
        
        // Create header row
        const headerRow = document.createElement('tr');
        
        // Add variable headers
        variables.forEach(variable => {
            const th = document.createElement('th');
            th.textContent = variable;
            headerRow.appendChild(th);
        });
        
        // Add expression header
        const exprTh = document.createElement('th');
        exprTh.textContent = expression;
        headerRow.appendChild(exprTh);
        
        table.appendChild(headerRow);
        
        // Add data rows
        results.forEach(result => {
            const row = document.createElement('tr');
            
            result.forEach((value, index) => {
                const td = document.createElement('td');
                td.textContent = value ? 'T' : 'F';
                row.appendChild(td);
            });
            
            table.appendChild(row);
        });
        
        // Clear previous table and add new one
        tableContainer.innerHTML = '';
        tableContainer.appendChild(table);
    }

    function classifyExpression(results) {
        const lastColumn = results.map(row => row[row.length - 1]);
        const allTrue = lastColumn.every(val => val === 1);
        const allFalse = lastColumn.every(val => val === 0);
        
        classification.className = '';
        classification.innerHTML = '';
        
        if (allTrue) {
            classification.classList.add('tautology');
            classification.textContent = 'This expression is a tautology (always true)';
        } else if (allFalse) {
            classification.classList.add('contradiction');
            classification.textContent = 'This expression is a contradiction (always false)';
        } else {
            classification.classList.add('contingency');
            classification.textContent = 'This expression is a contingency (sometimes true, sometimes false)';
        }
    }

    function showError(message) {
        errorMsg.textContent = message;
        errorMsg.style.display = 'block';
        tableContainer.innerHTML = '';
        classification.innerHTML = '';
    }

    function showLoading(show) {
        loadingOverlay.style.display = show ? 'flex' : 'none';
    }
});