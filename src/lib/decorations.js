module.exports = function (vscode, parser) {
    let decorationsEnabled = true;
    let activeEditor;
    let timeout;

    let methodDecorationType;
    let methodWarningDecorationType;
    let methodDangerDecorationType;
    let classDecorationType;
    let classWarningDecorationType;

    function createDecorationTypes() {
        methodDecorationType = vscode.window.createTextEditorDecorationType({
            after: {
                margin: '0 0 0 20px',
                color: new vscode.ThemeColor('editorCodeLens.foreground'),
                fontStyle: 'italic'
            }
        });

        methodWarningDecorationType = vscode.window.createTextEditorDecorationType({
            after: {
                margin: '0 0 0 20px',
                color: '#dcdcaa',
                fontWeight: 'bold',
                fontStyle: 'italic'
            },
            backgroundColor: 'rgba(220, 220, 170, 0.1)'
        });

        methodDangerDecorationType = vscode.window.createTextEditorDecorationType({
            after: {
                margin: '0 0 0 20px',
                color: '#f48771',
                fontWeight: 'bold',
                fontStyle: 'italic'
            },
            backgroundColor: 'rgba(244, 135, 113, 0.1)'
        });

        classDecorationType = vscode.window.createTextEditorDecorationType({
            after: {
                margin: '0 0 0 20px',
                color: new vscode.ThemeColor('editorCodeLens.foreground'),
                fontStyle: 'italic'
            }
        });

        classWarningDecorationType = vscode.window.createTextEditorDecorationType({
            after: {
                margin: '0 0 0 20px',
                color: '#dcdcaa',
                fontWeight: 'bold',
                fontStyle: 'italic'
            },
            backgroundColor: 'rgba(220, 220, 170, 0.1)'
        });
    }

    function triggerUpdateDecorations() {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(updateDecorations, 500);
    }

    function updateDecorations() {
        if (!activeEditor || !decorationsEnabled) return;

        const document = activeEditor.document;
        if (document.languageId !== 'java') return;

        const code = document.getText();
        const config = vscode.workspace.getConfiguration('javaRefactoringAnalyzer');
        const methodLocThreshold = config.get('methodLocThreshold', 10);
        const classMethodThreshold = config.get('classMethodThreshold', 10);

        try {
            const decorations = parser.analyzeForDecorations(code, methodLocThreshold, classMethodThreshold);

            activeEditor.setDecorations(methodDecorationType, decorations.methodGood);
            activeEditor.setDecorations(methodWarningDecorationType, decorations.methodWarning);
            activeEditor.setDecorations(methodDangerDecorationType, decorations.methodDanger);
            activeEditor.setDecorations(classDecorationType, decorations.classGood);
            activeEditor.setDecorations(classWarningDecorationType, decorations.classWarning);
        } catch (error) {
            console.error('Decoration update failed:', error);
        }
    }

    function clearAllDecorations() {
        if (activeEditor) {
            activeEditor.setDecorations(methodDecorationType, []);
            activeEditor.setDecorations(methodWarningDecorationType, []);
            activeEditor.setDecorations(methodDangerDecorationType, []);
            activeEditor.setDecorations(classDecorationType, []);
            activeEditor.setDecorations(classWarningDecorationType, []);
        }
    }

    function setActiveEditor(editor) {
        activeEditor = editor;
    }

    function toggleDecorations() {
        decorationsEnabled = !decorationsEnabled;
        if (decorationsEnabled) {
            if (activeEditor) triggerUpdateDecorations();
        } else {
            clearAllDecorations();
        }
        return decorationsEnabled;
    }

    return {
        createDecorationTypes,
        triggerUpdateDecorations,
        updateDecorations,
        clearAllDecorations,
        setActiveEditor,
        toggleDecorations
    };
};
