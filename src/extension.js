// extension.js - thin wrapper wiring parser and decorations modules
const vscode = require('vscode');
const JavaParser = require('java-parser');

const createParser = require('./lib/parser');
const createDecorations = require('./lib/decorations');

// instantiate modules with dependencies
const parser = createParser(JavaParser, vscode);
const decorations = createDecorations(vscode, parser);

function activate(context) {
    // Initialize
    decorations.createDecorationTypes();
    decorations.setActiveEditor(vscode.window.activeTextEditor);

    // Register analyze command
    const analyzeCmd = vscode.commands.registerCommand('java-refactoring-analyzer.analyze', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }

        const document = editor.document;
        if (document.languageId !== 'java') {
            vscode.window.showErrorMessage('This extension only works with Java files');
            return;
        }

        const code = document.getText();
        const fileName = document.fileName.split(/[\/\\]/).pop();
        try {
            const metrics = parser.analyzeJavaCode(code, fileName);
            parser.showMetricsPanel(metrics, fileName);
            vscode.window.showInformationMessage('Analysis complete! Check the Refactoring Metrics panel.');
        } catch (err) {
            vscode.window.showErrorMessage(`Analysis failed: ${err.message}`);
            console.error(err);
        }
    });

    // Register toggle decorations command
    const toggleCmd = vscode.commands.registerCommand('java-refactoring-analyzer.toggleDecorations', () => {
        const enabled = decorations.toggleDecorations();
        vscode.window.showInformationMessage(enabled ? 'Real-time decorations enabled' : 'Real-time decorations disabled');
    });

    // Track active editor changes
    const onActive = vscode.window.onDidChangeActiveTextEditor(editor => {
        decorations.setActiveEditor(editor);
        if (editor && editor.document && editor.document.languageId === 'java') {
            decorations.triggerUpdateDecorations();
        }
    });

    // Track document edits
    const onChange = vscode.workspace.onDidChangeTextDocument(event => {
        if (event && event.document && vscode.window.activeTextEditor && event.document === vscode.window.activeTextEditor.document) {
            decorations.triggerUpdateDecorations();
        }
    });

    // Initial trigger
    const active = vscode.window.activeTextEditor;
    if (active && active.document && active.document.languageId === 'java') {
        decorations.triggerUpdateDecorations();
    }

    // push disposables
    context.subscriptions.push(analyzeCmd, toggleCmd, onActive, onChange);
}

function deactivate() {
    try {
        decorations.clearAllDecorations();
    } catch (e) {
        // noop
    }
}

module.exports = { activate, deactivate };
