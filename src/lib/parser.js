module.exports = function (javaParserModule, vscode) {
    // normalize parser usage
    function parseJavaToCst(code) {
        try {
            if (typeof javaParserModule === 'function') {
                const parser = new javaParserModule();
                if (typeof parser.parse === 'function') return parser.parse(code);
            }

            if (javaParserModule && typeof javaParserModule.parse === 'function') return javaParserModule.parse(code);

            if (javaParserModule && javaParserModule.default && typeof javaParserModule.default.parse === 'function') return javaParserModule.default.parse(code);
        } catch (e) {
            throw e;
        }

        throw new Error('Unsupported java-parser API');
    }

    function getLineFromOffset(code, offset) {
        const textBefore = code.substring(0, offset);
        return textBefore.split('\n').length - 1;
    }

    function getEndPositionOfLine(code, lineNumber) {
        const lines = code.split('\n');
        if (lineNumber < lines.length) {
            return lines[lineNumber].length;
        }
        return 0;
    }

    function findNodes(node, type) {
        const results = [];
        function traverse(n) {
            if (!n) return;
            if (n.name === type) {
                results.push(n);
            }
            if (n.children) {
                Object.values(n.children).forEach(child => {
                    if (Array.isArray(child)) {
                        child.forEach(c => traverse(c));
                    } else {
                        traverse(child);
                    }
                });
            }
        }
        traverse(node);
        return results;
    }

    function findNode(node, type) {
        const results = findNodes(node, type);
        return results.length > 0 ? results[0] : null;
    }

    function getNodeText(node, code) {
        if (!node || !node.location) return '';
        const start = node.location.startOffset;
        const end = node.location.endOffset;
        return code.substring(start, end + 1);
    }

    function getNodeLocation(node, code) {
        if (!node || !node.location) {
            return { startLine: 0, endLine: 0, loc: 0 };
        }
        const startOffset = node.location.startOffset;
        const endOffset = node.location.endOffset;
        const textBefore = code.substring(0, startOffset);
        const textBetween = code.substring(startOffset, endOffset + 1);
        const startLine = textBefore.split('\n').length;
        const lines = textBetween.split('\n');
        const endLine = startLine + lines.length - 1;
        const loc = lines.filter(line => line.trim().length > 0).length;
        return { startLine, endLine, loc };
    }

    function generateRecommendations(metrics) {
        const longMethods = metrics.methods.filter(m => m.loc > 20);
        longMethods.forEach(method => {
            metrics.issues.push({
                type: 'warning',
                severity: 'high',
                message: `Method '${method.name}' has ${method.loc} lines. Consider extracting to smaller methods (target: <20 LOC).`,
                line: method.startLine,
                suggestion: 'Extract method, break into smaller units'
            });
        });

        const mediumMethods = metrics.methods.filter(m => m.loc > 10 && m.loc <= 20);
        if (mediumMethods.length > 0) {
            metrics.issues.push({
                type: 'info',
                severity: 'medium',
                message: `${mediumMethods.length} method(s) between 10-20 lines. Consider if they can be simplified.`,
                line: mediumMethods[0].startLine
            });
        }

        const bigClasses = metrics.classes.filter(c => c.methodCount > 10);
        bigClasses.forEach(cls => {
            metrics.issues.push({
                type: 'warning',
                severity: 'high',
                message: `Class '${cls.name}' has ${cls.methodCount} methods. Consider splitting into multiple classes (Single Responsibility Principle).`,
                line: cls.startLine,
                suggestion: 'Extract class, apply design patterns (Strategy, Facade, etc.)'
            });
        });

        const largeClasses = metrics.classes.filter(c => c.loc > 200);
        largeClasses.forEach(cls => {
            metrics.issues.push({
                type: 'warning',
                severity: 'high',
                message: `Class '${cls.name}' has ${cls.loc} lines. Very large class - high refactoring priority.`,
                line: cls.startLine,
                suggestion: 'Split into multiple cohesive classes'
            });
        });

        if (metrics.totalClasses === 1 && metrics.totalLOC > 200) {
            metrics.issues.push({
                type: 'suggestion',
                severity: 'medium',
                message: `Only 1 class found with ${metrics.totalLOC} LOC. Strong candidate for extracting additional classes.`,
                line: 1,
                suggestion: 'Identify cohesive responsibilities and extract them into new classes'
            });
        } else if (metrics.totalClasses < 3 && metrics.totalLOC > 300) {
            metrics.issues.push({
                type: 'suggestion',
                severity: 'medium',
                message: `Only ${metrics.totalClasses} classes found with ${metrics.totalLOC} LOC. Consider extracting more classes.`,
                line: 1,
                suggestion: 'Look for data + behavior that belongs together'
            });
        }

        const goodMethods = metrics.methods.filter(m => m.loc <= 10);
        if (goodMethods.length === metrics.totalMethods && metrics.totalMethods > 0) {
            metrics.issues.push({
                type: 'success',
                severity: 'low',
                message: `Excellent! All methods are ≤10 lines. Great adherence to the principle of small methods.`,
                line: 1
            });
        }

        if (metrics.totalClasses >= 5) {
            metrics.issues.push({
                type: 'success',
                severity: 'low',
                message: `Good class separation with ${metrics.totalClasses} classes. This promotes maintainability.`,
                line: 1
            });
        }
    }

    function analyzeCompilationUnit(cst, code, metrics) {
        if (!cst || !cst.children) return;

        const classDeclarations = findNodes(cst, 'classDeclaration');
        const interfaceDeclarations = findNodes(cst, 'interfaceDeclaration');
        const enumDeclarations = findNodes(cst, 'enumDeclaration');

        const allTypeDeclarations = [
            ...classDeclarations,
            ...interfaceDeclarations,
            ...enumDeclarations
        ];

        metrics.totalClasses = allTypeDeclarations.length;

        allTypeDeclarations.forEach(typeDecl => {
            analyzeTypeDeclaration(typeDecl, code, metrics);
        });
    }

    function analyzeTypeDeclaration(typeDecl, code, metrics) {
        const identifier = findNode(typeDecl, 'Identifier');
        const className = identifier ? getNodeText(identifier, code) : 'Anonymous';

        const location = getNodeLocation(typeDecl, code);

        const methodDeclarations = findNodes(typeDecl, 'methodDeclaration');
        const constructorDeclarations = findNodes(typeDecl, 'constructorDeclaration');

        const allMethods = [...methodDeclarations, ...constructorDeclarations];

        const classInfo = {
            name: className,
            loc: location.loc,
            methodCount: allMethods.length,
            startLine: location.startLine,
            endLine: location.endLine
        };

        metrics.classes.push(classInfo);

        allMethods.forEach(method => {
            analyzeMethod(method, code, metrics, className);
        });
    }

    function analyzeMethod(methodNode, code, metrics, className) {
        const identifier = findNode(methodNode, 'Identifier');
        const methodName = identifier ? getNodeText(identifier, code) : 'constructor';

        const location = getNodeLocation(methodNode, code);

        const methodBody = findNode(methodNode, 'block');
        let bodyLOC = location.loc;

        if (methodBody) {
            const bodyLocation = getNodeLocation(methodBody, code);
            bodyLOC = bodyLocation.loc;
        }

        const methodInfo = {
            name: `${className}.${methodName}`,
            loc: bodyLOC,
            startLine: location.startLine,
            endLine: location.endLine
        };

        metrics.methods.push(methodInfo);
        metrics.totalMethods++;
    }

    function generateHTML(metrics, fileName) {
        const methodsHTML = metrics.methods
            .sort((a, b) => b.loc - a.loc)
            .slice(0, 15)
            .map(m => {
                const color = m.loc > 20 ? '#f48771' : m.loc > 10 ? '#dcdcaa' : '#4ec9b0';
                const status = m.loc > 20 ? '❌ Too long' : m.loc > 10 ? '⚠️ Medium' : '✅ Good';
                return `<tr>
                <td>${m.name}</td>
                <td style="color: ${color}; font-weight: bold;">${m.loc}</td>
                <td style="color: ${color};">${status}</td>
                <td>Lines ${m.startLine}-${m.endLine}</td>
            </tr>`;
            }).join('');

        const classesHTML = metrics.classes
            .map(c => {
                const methodColor = c.methodCount > 10 ? '#f48771' : c.methodCount > 5 ? '#dcdcaa' : '#4ec9b0';
                return `<tr>
                <td>${c.name}</td>
                <td>${c.loc}</td>
                <td style="color: ${methodColor}; font-weight: bold;">${c.methodCount}</td>
                <td>Lines ${c.startLine}-${c.endLine}</td>
            </tr>`;
            }).join('');

        const issuesHTML = metrics.issues
            .sort((a, b) => {
                const severityOrder = { high: 0, medium: 1, low: 2 };
                return severityOrder[a.severity] - severityOrder[b.severity];
            })
            .map(i => {
                let icon, bgColor;
                switch (i.type) {
                    case 'warning': icon = '⚠️'; bgColor = 'rgba(255, 165, 0, 0.15)'; break;
                    case 'info': icon = 'ℹ️'; bgColor = 'rgba(100, 181, 246, 0.15)'; break;
                    case 'success': icon = '✅'; bgColor = 'rgba(76, 201, 176, 0.15)'; break;
                    default: icon = '💡'; bgColor = 'rgba(220, 220, 170, 0.15)';
                }
                return `<div class="issue ${i.type}" style="background-color: ${bgColor};">
                <div class="issue-header">
                    <span class="icon">${icon}</span>
                    <span class="issue-message">${i.message}</span>
                </div>
                ${i.suggestion ? `<div class="issue-suggestion">💡 ${i.suggestion}</div>` : ''}
            </div>`;
            }).join('');

        const classScore = Math.min(100, metrics.totalClasses * 15);
        const avgLOC = parseFloat(metrics.avgLOCPerMethod);
        const methodScore = Math.max(0, 100 - (avgLOC * 3));
        const totalScore = ((classScore + methodScore) / 2).toFixed(0);
        const scoreColor = totalScore > 70 ? '#4ec9b0' : totalScore > 40 ? '#dcdcaa' : '#f48771';
        const scoreText = totalScore > 70 ? 'Excellent' : totalScore > 40 ? 'Good' : 'Needs Improvement';

        return `<!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            body { 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                padding: 20px;
                color: var(--vscode-foreground);
                background-color: var(--vscode-editor-background);
                line-height: 1.6;
            }
            h1 { 
                color: var(--vscode-textLink-foreground);
                margin-bottom: 10px;
                font-size: 28px;
            }
            .subtitle {
                color: var(--vscode-descriptionForeground);
                margin-bottom: 30px;
                font-size: 14px;
            }
            h2 { 
                color: var(--vscode-textLink-foreground); 
                margin-top: 35px;
                margin-bottom: 15px;
                border-bottom: 2px solid var(--vscode-panel-border);
                padding-bottom: 8px;
                font-size: 20px;
            }
            table { 
                border-collapse: collapse; 
                width: 100%; 
                margin-top: 15px;
                background-color: var(--vscode-editor-background);
            }
            th, td { 
                padding: 12px; 
                text-align: left; 
                border-bottom: 1px solid var(--vscode-panel-border);
            }
            th { 
                background-color: var(--vscode-editor-selectionBackground);
                font-weight: 600;
                text-transform: uppercase;
                font-size: 11px;
                letter-spacing: 0.5px;
            }
            tr:hover {
                background-color: var(--vscode-list-hoverBackground);
            }
            .metrics-container {
                display: flex;
                justify-content: center;
                gap: 20px;
                margin: 30px 0;
                flex-wrap: wrap;
            }
            .metric-box {
                padding: 20px 30px;
                border-radius: 8px;
                background-color: var(--vscode-editor-selectionBackground);
                border: 1px solid var(--vscode-panel-border);
                min-width: 180px;
                text-align: center;
            }
            .metric-value {
                font-size: 36px;
                font-weight: bold;
                color: var(--vscode-textLink-activeForeground);
                margin: 10px 0;
            }
            .metric-label {
                font-size: 13px;
                color: var(--vscode-descriptionForeground);
                text-transform: uppercase;
                letter-spacing: 1px;
            }
            .metric-goal {
                font-size: 12px;
                color: var(--vscode-descriptionForeground);
                margin-top: 5px;
            }
            .score-container {
                text-align: center;
                padding: 30px;
                margin: 20px 0;
                background: linear-gradient(135deg, var(--vscode-editor-selectionBackground) 0%, var(--vscode-editor-background) 100%);
                border-radius: 12px;
                border: 2px solid var(--vscode-panel-border);
            }
            .score {
                font-size: 64px;
                font-weight: bold;
                color: ${scoreColor};
                margin: 10px 0;
            }
            .score-label {
                font-size: 16px;
                color: var(--vscode-descriptionForeground);
                margin-bottom: 5px;
            }
            .score-text {
                font-size: 24px;
                color: ${scoreColor};
                font-weight: 600;
                margin-top: 10px;
            }
            .issue {
                padding: 15px;
                margin: 12px 0;
                border-radius: 6px;
                border-left: 4px solid;
            }
            .issue.warning {
                border-color: #ce9178;
            }
            .issue.info {
                border-color: #64b5f6;
            }
            .issue.suggestion {
                border-color: #dcdcaa;
            }
            .issue.success {
                border-color: #4ec9b0;
            }
            .issue-header {
                display: flex;
                align-items: flex-start;
            }
            .icon {
                margin-right: 12px;
                font-size: 20px;
                flex-shrink: 0;
            }
            .issue-message {
                flex-grow: 1;
                font-size: 14px;
                line-height: 1.5;
            }
            .issue-suggestion {
                margin-top: 10px;
                margin-left: 32px;
                padding: 10px;
                background-color: rgba(220, 220, 170, 0.1);
                border-radius: 4px;
                font-size: 13px;
                font-style: italic;
            }
            .legend {
                display: flex;
                gap: 20px;
                margin: 15px 0;
                font-size: 12px;
                flex-wrap: wrap;
            }
            .legend-item {
                display: flex;
                align-items: center;
                gap: 5px;
            }
            .legend-color {
                width: 12px;
                height: 12px;
                border-radius: 2px;
            }
            .feature-highlight {
                background-color: rgba(100, 181, 246, 0.1);
                padding: 20px;
                border-radius: 8px;
                margin: 20px 0;
                border-left: 4px solid #64b5f6;
            }
            .feature-highlight h3 {
                color: #64b5f6;
                margin-bottom: 10px;
            }
        </style>
    </head>
    <body>
        <h1>☕ Java Refactoring Analysis</h1>
        <div class="subtitle">File: ${fileName}</div>
        
        <div class="feature-highlight">
            <h3>🔄 Real-time Decorations Active</h3>
            <p>LOC counts and method counts are now displayed inline in your editor!</p>
            <ul style="margin-left: 20px; margin-top: 10px;">
                <li>📏 <strong>Green:</strong> Methods ≤10 LOC (excellent)</li>
                <li>📏 <strong>Yellow:</strong> Methods 11-20 LOC (warning)</li>
                <li>📏 <strong>Red:</strong> Methods &gt;20 LOC (needs refactoring)</li>
                <li>⚡ <strong>Yellow:</strong> Classes with &gt;10 methods</li>
            </ul>
        </div>
        
        <div class="score-container">
            <div class="score-label">Refactoring Quality Score</div>
            <div class="score">${totalScore}/100</div>
            <div class="score-text">${scoreText}</div>
        </div>

        <div class="metrics-container">
            <div class="metric-box">
                <div class="metric-label">Total Classes</div>
                <div class="metric-value">${metrics.totalClasses}</div>
                <div class="metric-goal">🎯 Goal: Maximize</div>
            </div>
            <div class="metric-box">
                <div class="metric-label">Avg LOC/Method</div>
                <div class="metric-value">${metrics.avgLOCPerMethod}</div>
                <div class="metric-goal">🎯 Goal: Minimize (&lt;10)</div>
            </div>
            <div class="metric-box">
                <div class="metric-label">Total Methods</div>
                <div class="metric-value">${metrics.totalMethods}</div>
                <div class="metric-goal">ℹ️ Info</div>
            </div>
            <div class="metric-box">
                <div class="metric-label">Total LOC</div>
                <div class="metric-value">${metrics.totalLOC}</div>
                <div class="metric-goal">ℹ️ Info</div>
            </div>
        </div>

        <h2>🔍 Recommendations & Issues</h2>
        ${issuesHTML || '<div class="issue success" style="background-color: rgba(76, 201, 176, 0.15);"><div class="issue-header"><span class="icon">🎉</span><span class="issue-message">Perfect! No issues found. Your code structure is excellent.</span></div></div>'}

        <h2>📊 Methods Analysis (Top 15 by LOC)</h2>
        <div class="legend">
            <div class="legend-item">
                <div class="legend-color" style="background-color: #4ec9b0;"></div>
                <span>≤10 LOC (Excellent)</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background-color: #dcdcaa;"></div>
                <span>11-20 LOC (Acceptable)</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background-color: #f48771;"></div>
                <span>&gt;20 LOC (Refactor)</span>
            </div>
        </div>
        <table>
            <tr>
                <th>Method Name</th>
                <th>Lines of Code</th>
                <th>Status</th>
                <th>Location</th>
            </tr>
            ${methodsHTML || '<tr><td colspan="4" style="text-align: center; padding: 20px;">No methods found</td></tr>'}
        </table>

        <h2>🏛️ Classes Overview</h2>
        <table>
            <tr>
                <th>Class Name</th>
                <th>Total LOC</th>
                <th>Method Count</th>
                <th>Location</th>
            </tr>
            ${classesHTML || '<tr><td colspan="4" style="text-align: center; padding: 20px;">No classes found</td></tr>'}
        </table>

        <div style="margin-top: 40px; padding: 20px; background-color: var(--vscode-editor-selectionBackground); border-radius: 8px;">
            <h3 style="margin-bottom: 10px;">💡 Refactoring Tips</h3>
            <ul style="margin-left: 20px; line-height: 2;">
                <li><strong>Extract Method:</strong> Break long methods into smaller, focused ones</li>
                <li><strong>Extract Class:</strong> If a class has too many methods, identify cohesive groups and extract them</li>
                <li><strong>Single Responsibility:</strong> Each class should have one reason to change</li>
                <li><strong>Small Methods:</strong> Aim for methods under 10 lines - they're easier to test and understand</li>
            </ul>
        </div>
        
        <div style="margin-top: 20px; padding: 15px; background-color: rgba(100, 181, 246, 0.1); border-radius: 8px; border-left: 4px solid #64b5f6;">
            <p><strong>💡 Tip:</strong> Use the command "Toggle Real-time Decorations" to turn inline metrics on/off.</p>
        </div>
    </body>
    </html>`;
    }

    function showMetricsPanel(metrics, fileName) {
        const panel = vscode.window.createWebviewPanel(
            'javaRefactoringMetrics',
            'Java Refactoring Metrics',
            vscode.ViewColumn.Two,
            { enableScripts: true }
        );

        panel.webview.html = generateHTML(metrics, fileName);
    }

    function analyzeForDecorations(code, methodLocThreshold, classMethodThreshold) {
        const cst = parseJavaToCst(code);

        const decorations = {
            methodGood: [],
            methodWarning: [],
            methodDanger: [],
            classGood: [],
            classWarning: []
        };

        const classDeclarations = findNodes(cst, 'classDeclaration');
        const interfaceDeclarations = findNodes(cst, 'interfaceDeclaration');
        const enumDeclarations = findNodes(cst, 'enumDeclaration');

        const allTypeDeclarations = [
            ...classDeclarations,
            ...interfaceDeclarations,
            ...enumDeclarations
        ];

        allTypeDeclarations.forEach(typeDecl => {
            const identifier = findNode(typeDecl, 'Identifier');
            if (!identifier || !identifier.location) return;

            const methodDeclarations = findNodes(typeDecl, 'methodDeclaration');
            const constructorDeclarations = findNodes(typeDecl, 'constructorDeclaration');
            const methodCount = methodDeclarations.length + constructorDeclarations.length;

            const classLine = getLineFromOffset(code, identifier.location.startOffset);
            const classEndPos = getEndPositionOfLine(code, classLine);

            const classDecoration = {
                range: new vscode.Range(classLine, classEndPos, classLine, classEndPos),
                renderOptions: {
                    after: {
                        contentText: `  ⚡ ${methodCount} method${methodCount !== 1 ? 's' : ''}`
                    }
                }
            };

            if (methodCount > classMethodThreshold) {
                decorations.classWarning.push(classDecoration);
            } else {
                decorations.classGood.push(classDecoration);
            }

            const allMethods = [...methodDeclarations, ...constructorDeclarations];
            allMethods.forEach(method => {
                const methodIdentifier = findNode(method, 'Identifier');
                if (!methodIdentifier || !methodIdentifier.location) return;

                const location = getNodeLocation(method, code);
                const methodBody = findNode(method, 'block');
                let bodyLOC = location.loc;
                if (methodBody) {
                    const bodyLocation = getNodeLocation(methodBody, code);
                    bodyLOC = bodyLocation.loc;
                }

                const methodLine = getLineFromOffset(code, methodIdentifier.location.startOffset);
                const methodEndPos = getEndPositionOfLine(code, methodLine);

                const methodDecoration = {
                    range: new vscode.Range(methodLine, methodEndPos, methodLine, methodEndPos),
                    renderOptions: {
                        after: {
                            contentText: `  📏 ${bodyLOC} LOC`
                        }
                    }
                };

                if (bodyLOC > 20) {
                    decorations.methodDanger.push(methodDecoration);
                } else if (bodyLOC > methodLocThreshold) {
                    decorations.methodWarning.push(methodDecoration);
                } else {
                    decorations.methodGood.push(methodDecoration);
                }
            });
        });

        return decorations;
    }

    function analyzeJavaCode(code, fileName) {
        const cst = parseJavaToCst(code);

        const metrics = {
            fileName: fileName,
            totalClasses: 0,
            totalMethods: 0,
            totalLOC: 0,
            methods: [],
            classes: [],
            avgLOCPerMethod: 0,
            issues: []
        };

        const lines = code.split('\n');
        metrics.totalLOC = lines.filter(line => {
            const trimmed = line.trim();
            return trimmed.length > 0 &&
                !trimmed.startsWith('//') &&
                !trimmed.startsWith('/*') &&
                !trimmed.startsWith('*');
        }).length;

        analyzeCompilationUnit(cst, code, metrics);

        if (metrics.totalMethods > 0) {
            const totalMethodLOC = metrics.methods.reduce((sum, m) => sum + m.loc, 0);
            metrics.avgLOCPerMethod = (totalMethodLOC / metrics.totalMethods).toFixed(2);
        }

        generateRecommendations(metrics);

        return metrics;
    }

    return {
        analyzeJavaCode,
        analyzeForDecorations,
        showMetricsPanel
    };
};
