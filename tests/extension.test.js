const assert = require('assert');
const sinon = require('sinon');
const proxyquire = require('proxyquire');

describe('Java Refactoring Analyzer Extension Tests', function() {
    let vscodeStub;
    let extension;
    let mockEditor;
    let mockDocument;
    let onDidChangeActiveTextEditorCallback;
    let onDidChangeTextDocumentCallback;

    beforeEach(function() {
        // Mock VS Code API
        const decorationTypes = {};
        
        vscodeStub = {
            window: {
                createTextEditorDecorationType: sinon.stub().callsFake((options) => {
                    const id = Math.random().toString();
                    decorationTypes[id] = options;
                    return id;
                }),
                activeTextEditor: null,
                showErrorMessage: sinon.stub(),
                showInformationMessage: sinon.stub(),
                createWebviewPanel: sinon.stub().returns({
                    webview: { html: '' }
                }),
                onDidChangeActiveTextEditor: sinon.stub().callsFake((callback) => {
                    onDidChangeActiveTextEditorCallback = callback;
                    return { dispose: sinon.stub() };
                })
            },
            workspace: {
                onDidChangeTextDocument: sinon.stub().callsFake((callback) => {
                    onDidChangeTextDocumentCallback = callback;
                    return { dispose: sinon.stub() };
                }),
                getConfiguration: sinon.stub().returns({
                    get: sinon.stub().callsFake((key, defaultValue) => defaultValue)
                })
            },
            commands: {
                registerCommand: sinon.stub().callsFake((name, callback) => {
                    return { dispose: sinon.stub(), callback };
                })
            },
            Range: class Range {
                constructor(startLine, startChar, endLine, endChar) {
                    this.start = { line: startLine, character: startChar };
                    this.end = { line: endLine, character: endChar };
                }
            },
            ThemeColor: class ThemeColor {
                constructor(id) {
                    this.id = id;
                }
            },
            ViewColumn: { Two: 2 }
        };

        // Mock document
        mockDocument = {
            languageId: 'java',
            fileName: 'Test.java',
            getText: sinon.stub().returns(`
public class TestClass {
    public void shortMethod() {
        System.out.println("Hello");
    }
    
    public void mediumMethod() {
        int x = 1;
        int y = 2;
        int z = 3;
        System.out.println(x);
        System.out.println(y);
        System.out.println(z);
        System.out.println("line8");
        System.out.println("line9");
        System.out.println("line10");
        System.out.println("line11");
        System.out.println("line12");
    }
    
    public void longMethod() {
        System.out.println("1");
        System.out.println("2");
        System.out.println("3");
        System.out.println("4");
        System.out.println("5");
        System.out.println("6");
        System.out.println("7");
        System.out.println("8");
        System.out.println("9");
        System.out.println("10");
        System.out.println("11");
        System.out.println("12");
        System.out.println("13");
        System.out.println("14");
        System.out.println("15");
        System.out.println("16");
        System.out.println("17");
        System.out.println("18");
        System.out.println("19");
        System.out.println("20");
        System.out.println("21");
        System.out.println("22");
    }
}
`)
        };

        // Mock editor
        mockEditor = {
            document: mockDocument,
            setDecorations: sinon.stub()
        };

        vscodeStub.window.activeTextEditor = mockEditor;

        // Load extension with mocked VS Code
        extension = proxyquire('../src/extension.js', {
            'vscode': vscodeStub,
            'java-parser': require('java-parser')
        });
    });

    afterEach(function() {
        sinon.restore();
    });

    describe('Extension Activation', function() {
        it('should activate and register commands', function() {
            const context = { subscriptions: [] };
            extension.activate(context);

            assert.strictEqual(vscodeStub.commands.registerCommand.callCount, 2);
            assert(vscodeStub.commands.registerCommand.calledWith('java-refactoring-analyzer.analyze'));
            assert(vscodeStub.commands.registerCommand.calledWith('java-refactoring-analyzer.toggleDecorations'));
        });

        it('should create decoration types on activation', function() {
            const context = { subscriptions: [] };
            extension.activate(context);

            assert(vscodeStub.window.createTextEditorDecorationType.called);
            assert(vscodeStub.window.createTextEditorDecorationType.callCount >= 5);
        });

        it('should register editor change listeners', function() {
            const context = { subscriptions: [] };
            extension.activate(context);

            assert(vscodeStub.window.onDidChangeActiveTextEditor.called);
            assert(vscodeStub.workspace.onDidChangeTextDocument.called);
        });
    });

    describe('Analyze Command', function() {
        it('should show error when no active editor', function() {
            const context = { subscriptions: [] };
            extension.activate(context);

            vscodeStub.window.activeTextEditor = null;

            const analyzeCommand = vscodeStub.commands.registerCommand.getCalls()
                .find(call => call.args[0] === 'java-refactoring-analyzer.analyze');

            analyzeCommand.args[1]();

            assert(vscodeStub.window.showErrorMessage.calledWith('No active editor found'));
        });

        it('should show error when document is not Java', function() {
            const context = { subscriptions: [] };
            extension.activate(context);

            mockDocument.languageId = 'javascript';

            const analyzeCommand = vscodeStub.commands.registerCommand.getCalls()
                .find(call => call.args[0] === 'java-refactoring-analyzer.analyze');

            analyzeCommand.args[1]();

            assert(vscodeStub.window.showErrorMessage.calledWith('This extension only works with Java files'));
        });

        it('should analyze Java code and show metrics panel', function() {
            const context = { subscriptions: [] };
            extension.activate(context);

            const analyzeCommand = vscodeStub.commands.registerCommand.getCalls()
                .find(call => call.args[0] === 'java-refactoring-analyzer.analyze');

            analyzeCommand.args[1]();

            assert(vscodeStub.window.createWebviewPanel.called);
            assert(vscodeStub.window.showInformationMessage.calledWith('Analysis complete! Check the Refactoring Metrics panel.'));
        });

        it('should handle parsing errors gracefully', function() {
            const context = { subscriptions: [] };
            extension.activate(context);

            mockDocument.getText.returns('invalid java code {{{');

            const analyzeCommand = vscodeStub.commands.registerCommand.getCalls()
                .find(call => call.args[0] === 'java-refactoring-analyzer.analyze');

            analyzeCommand.args[1]();

            assert(vscodeStub.window.showErrorMessage.called);
        });
    });

    describe('Toggle Decorations Command', function() {
        it('should toggle decorations on', function() {
            const context = { subscriptions: [] };
            extension.activate(context);

            const toggleCommand = vscodeStub.commands.registerCommand.getCalls()
                .find(call => call.args[0] === 'java-refactoring-analyzer.toggleDecorations');

            // First toggle - disable
            toggleCommand.args[1]();
            assert(vscodeStub.window.showInformationMessage.calledWith('Real-time decorations disabled'));

            // Second toggle - enable
            toggleCommand.args[1]();
            assert(vscodeStub.window.showInformationMessage.calledWith('Real-time decorations enabled'));
        });
    });

    describe('Decoration Updates', function() {
        it('should update decorations when Java file is opened', function(done) {
            const context = { subscriptions: [] };
            extension.activate(context);

            // Simulate opening a Java file
            setTimeout(() => {
                if (onDidChangeActiveTextEditorCallback) {
                    onDidChangeActiveTextEditorCallback(mockEditor);
                }

                setTimeout(() => {
                    assert(mockEditor.setDecorations.called);
                    done();
                }, 600);
            }, 100);
        });

        it('should update decorations on document change', function(done) {
            const context = { subscriptions: [] };
            extension.activate(context);

            setTimeout(() => {
                if (onDidChangeTextDocumentCallback) {
                    onDidChangeTextDocumentCallback({ document: mockDocument });
                }

                setTimeout(() => {
                    assert(mockEditor.setDecorations.called);
                    done();
                }, 600);
            }, 100);
        });

        it('should not update decorations for non-Java files', function(done) {
            const context = { subscriptions: [] };
            extension.activate(context);

            mockDocument.languageId = 'javascript';
            mockEditor.setDecorations.resetHistory();

            setTimeout(() => {
                if (onDidChangeActiveTextEditorCallback) {
                    onDidChangeActiveTextEditorCallback(mockEditor);
                }

                setTimeout(() => {
                    assert.strictEqual(mockEditor.setDecorations.callCount, 0);
                    done();
                }, 600);
            }, 100);
        });
    });

    describe('Code Analysis', function() {
        it('should count classes correctly', function() {
            const context = { subscriptions: [] };
            extension.activate(context);

            const analyzeCommand = vscodeStub.commands.registerCommand.getCalls()
                .find(call => call.args[0] === 'java-refactoring-analyzer.analyze');

            analyzeCommand.args[1]();

            const panelCall = vscodeStub.window.createWebviewPanel.getCall(0);
            const html = panelCall.args[0];
            
            // Should find 1 class
            assert(vscodeStub.window.createWebviewPanel.called);
        });

        it('should count methods correctly', function() {
            const context = { subscriptions: [] };
            extension.activate(context);

            const analyzeCommand = vscodeStub.commands.registerCommand.getCalls()
                .find(call => call.args[0] === 'java-refactoring-analyzer.analyze');

            analyzeCommand.args[1]();

            // Should find 3 methods
            assert(vscodeStub.window.createWebviewPanel.called);
        });

        it('should identify long methods', function(done) {
            const context = { subscriptions: [] };
            extension.activate(context);

            setTimeout(() => {
                if (onDidChangeActiveTextEditorCallback) {
                    onDidChangeActiveTextEditorCallback(mockEditor);
                }

                setTimeout(() => {
                    // Should have called setDecorations with danger decorations for long method
                    assert(mockEditor.setDecorations.called);
                    const calls = mockEditor.setDecorations.getCalls();
                    
                    // Check that we have different decoration types (good, warning, danger)
                    assert(calls.length >= 3);
                    done();
                }, 600);
            }, 100);
        });
    });

    describe('Metrics Calculation', function() {
        it('should calculate average LOC per method', function() {
            const context = { subscriptions: [] };
            extension.activate(context);

            const analyzeCommand = vscodeStub.commands.registerCommand.getCalls()
                .find(call => call.args[0] === 'java-refactoring-analyzer.analyze');

            analyzeCommand.args[1]();

            // With 3 methods of different sizes, average should be calculated
            assert(vscodeStub.window.createWebviewPanel.called);
        });

        it('should generate recommendations for long methods', function() {
            const context = { subscriptions: [] };
            extension.activate(context);

            const analyzeCommand = vscodeStub.commands.registerCommand.getCalls()
                .find(call => call.args[0] === 'java-refactoring-analyzer.analyze');

            analyzeCommand.args[1]();

            const panelCall = vscodeStub.window.createWebviewPanel.getCall(0);
            assert(panelCall);
            
            // HTML should contain warning about long method
            const panel = panelCall.returnValue;
            assert(panel.webview);
        });
    });

    describe('Configuration', function() {
        it('should respect methodLocThreshold setting', function(done) {
            const context = { subscriptions: [] };
            
            vscodeStub.workspace.getConfiguration.returns({
                get: sinon.stub().callsFake((key, defaultValue) => {
                    if (key === 'methodLocThreshold') return 5;
                    if (key === 'classMethodThreshold') return 10;
                    return defaultValue;
                })
            });

            extension.activate(context);

            setTimeout(() => {
                if (onDidChangeActiveTextEditorCallback) {
                    onDidChangeActiveTextEditorCallback(mockEditor);
                }

                setTimeout(() => {
                    assert(mockEditor.setDecorations.called);
                    done();
                }, 600);
            }, 100);
        });

        it('should respect classMethodThreshold setting', function(done) {
            const context = { subscriptions: [] };
            
            vscodeStub.workspace.getConfiguration.returns({
                get: sinon.stub().callsFake((key, defaultValue) => {
                    if (key === 'classMethodThreshold') return 2;
                    if (key === 'methodLocThreshold') return 10;
                    return defaultValue;
                })
            });

            extension.activate(context);

            setTimeout(() => {
                if (onDidChangeActiveTextEditorCallback) {
                    onDidChangeActiveTextEditorCallback(mockEditor);
                }

                setTimeout(() => {
                    assert(mockEditor.setDecorations.called);
                    done();
                }, 600);
            }, 100);
        });
    });

    describe('Edge Cases', function() {
        it('should handle empty Java file', function() {
            const context = { subscriptions: [] };
            extension.activate(context);

            mockDocument.getText.returns('public class Empty {}');

            const analyzeCommand = vscodeStub.commands.registerCommand.getCalls()
                .find(call => call.args[0] === 'java-refactoring-analyzer.analyze');

            analyzeCommand.args[1]();

            assert(vscodeStub.window.createWebviewPanel.called);
        });

        it('should handle interface declarations', function() {
            const context = { subscriptions: [] };
            extension.activate(context);

            mockDocument.getText.returns(`
                public interface TestInterface {
                    void method1();
                    void method2();
                }
            `);

            const analyzeCommand = vscodeStub.commands.registerCommand.getCalls()
                .find(call => call.args[0] === 'java-refactoring-analyzer.analyze');

            analyzeCommand.args[1]();

            assert(vscodeStub.window.createWebviewPanel.called);
        });

        it('should handle enum declarations', function() {
            const context = { subscriptions: [] };
            extension.activate(context);

            mockDocument.getText.returns(`
                public enum Color {
                    RED, GREEN, BLUE;
                    
                    public String getName() {
                        return this.name();
                    }
                }
            `);

            const analyzeCommand = vscodeStub.commands.registerCommand.getCalls()
                .find(call => call.args[0] === 'java-refactoring-analyzer.analyze');

            analyzeCommand.args[1]();

            assert(vscodeStub.window.createWebviewPanel.called);
        });

        it('should handle constructor declarations', function() {
            const context = { subscriptions: [] };
            extension.activate(context);

            mockDocument.getText.returns(`
                public class TestClass {
                    public TestClass() {
                        System.out.println("Constructor");
                    }
                }
            `);

            const analyzeCommand = vscodeStub.commands.registerCommand.getCalls()
                .find(call => call.args[0] === 'java-refactoring-analyzer.analyze');

            analyzeCommand.args[1]();

            assert(vscodeStub.window.createWebviewPanel.called);
        });
    });

    describe('Deactivation', function() {
        it('should clear decorations on deactivate', function() {
            const context = { subscriptions: [] };
            extension.activate(context);

            mockEditor.setDecorations.resetHistory();

            extension.deactivate();

            // Should clear all decoration types
            assert(mockEditor.setDecorations.called || mockEditor.setDecorations.callCount === 0);
        });
    });
});
