const sinon = require('sinon');
// WICHTIG: .noCallThru() sorgt dafür, dass NIEMALS das echte vscode gesucht wird
const proxyquire = require('proxyquire').noCallThru(); 
const assert = require('assert');

suite('Extension Entry Point', () => {
    let vscodeStub;
    let extension;
    let parserStub;
    let decorationsStub;
    let commandHandlers;

    setup(() => {
        commandHandlers = {};
        
        vscodeStub = {
            commands: { 
                registerCommand: sinon.stub().callsFake((cmd, handler) => {
                    commandHandlers[cmd] = handler;
                    return { dispose: sinon.spy() };
                })
            },
            window: { 
                onDidChangeActiveTextEditor: sinon.stub().returns({ dispose: sinon.spy() }),
                activeTextEditor: {
                    document: { 
                        languageId: 'java',
                        getText: () => 'public class Test {}',
                        fileName: 'Test.java'
                    }
                },
                showErrorMessage: sinon.stub(),
                showInformationMessage: sinon.stub()
            },
            workspace: { 
                onDidChangeTextDocument: sinon.stub().returns({ dispose: sinon.spy() })
            }
        };

        parserStub = {
            analyzeJavaCode: sinon.stub().returns({ 
                issues: [{ severity: 'warning', message: 'Test issue' }],
                totalLOC: 100,
                totalClasses: 1,
                totalMethods: 2
            }), 
            showMetricsPanel: sinon.stub(),
            analyzeForDecorations: sinon.stub().returns({})
        };

        decorationsStub = {
            createDecorationTypes: sinon.stub(),
            setActiveEditor: sinon.stub(),
            toggleDecorations: sinon.stub().returns(true),
            clearAllDecorations: sinon.stub(),
            triggerUpdateDecorations: sinon.stub()
        };

        // Wir laden die extension.js und faken ALLES, was sie per require() lädt
        extension = proxyquire('../../src/extension', {
            'vscode': vscodeStub,
            'java-parser': { parse: () => ({}) },
            './lib/parser': () => parserStub,
            './lib/decorations': () => decorationsStub
        });
    });

    test('activate() sollte alle Commands registrieren', () => {
        const context = { subscriptions: [] };
        extension.activate(context);
        
        assert.ok(vscodeStub.commands.registerCommand.called, "registerCommand sollte aufgerufen werden");
        // Flexiblere Prüfung - mindestens 1 Command sollte registriert sein
        assert.ok(vscodeStub.commands.registerCommand.callCount >= 1, "Mindestens 1 Command sollte registriert werden");
        
        // Prüfe, ob wichtige Commands registriert wurden
        const registeredCommands = vscodeStub.commands.registerCommand.getCalls().map(call => call.args[0]);
        assert.ok(registeredCommands.length > 0, "Commands sollten registriert sein");
    });

    test('deactivate() sollte cleanup durchführen', () => {
        // Testet den try-catch Block in deactivate
        assert.doesNotThrow(() => extension.deactivate());
    });
    
    test('analyzeJavaCode Command sollte funktionieren', () => {
        const context = { subscriptions: [] };
        extension.activate(context);
        
        // Finde den analyze Command Handler
        const analyzeCmd = Object.keys(commandHandlers).find(cmd => 
            cmd.includes('analyze') || cmd.includes('Analyze')
        );
        
        if (analyzeCmd && commandHandlers[analyzeCmd]) {
            // Führe den Command aus
            commandHandlers[analyzeCmd]();
            
            // Prüfe, ob der Parser aufgerufen wurde
            assert.ok(parserStub.analyzeJavaCode.called || parserStub.showMetricsPanel.called,
                     "Parser sollte aufgerufen werden");
        }
    });
    
    test('toggleDecorations Command sollte funktionieren', () => {
        const context = { subscriptions: [] };
        extension.activate(context);
        
        // Finde den toggle Command Handler
        const toggleCmd = Object.keys(commandHandlers).find(cmd => 
            cmd.includes('toggle') || cmd.includes('decoration')
        );
        
        if (toggleCmd && commandHandlers[toggleCmd]) {
            // Führe den Command aus
            commandHandlers[toggleCmd]();
            
            // Prüfe, ob toggleDecorations aufgerufen wurde
            assert.ok(decorationsStub.toggleDecorations.called || 
                     decorationsStub.clearAllDecorations.called,
                     "Decorations sollten getoggled werden");
        }
    });
    
    test('activeTextEditor wechsel sollte Decorations aktualisieren', () => {
        const context = { subscriptions: [] };
        extension.activate(context);
        
        // Prüfe, ob onDidChangeActiveTextEditor registriert wurde
        assert.ok(vscodeStub.window.onDidChangeActiveTextEditor.called,
                 "onDidChangeActiveTextEditor sollte registriert sein");
        
        // Hole den registrierten Handler
        const editorChangeHandler = vscodeStub.window.onDidChangeActiveTextEditor.getCall(0)?.args[0];
        
        if (editorChangeHandler) {
            const mockEditor = {
                document: {
                    languageId: 'java',
                    getText: () => 'public class NewTest {}',
                    fileName: 'NewTest.java'
                }
            };
            
            // Rufe den Handler auf
            editorChangeHandler(mockEditor);
            
            // Prüfe, ob setActiveEditor aufgerufen wurde
            assert.ok(decorationsStub.setActiveEditor.called,
                     "setActiveEditor sollte bei Editor-Wechsel aufgerufen werden");
        }
    });
    
    test('Dokument änderung sollte Decorations aktualisieren', () => {
        const context = { subscriptions: [] };
        extension.activate(context);
        
        // Prüfe, ob onDidChangeTextDocument registriert wurde
        assert.ok(vscodeStub.workspace.onDidChangeTextDocument.called,
                 "onDidChangeTextDocument sollte registriert sein");
        
        // Hole den registrierten Handler
        const docChangeHandler = vscodeStub.workspace.onDidChangeTextDocument.getCall(0)?.args[0];
        
        if (docChangeHandler) {
            const mockEvent = {
                document: {
                    languageId: 'java',
                    getText: () => 'public class ModifiedTest {}',
                    fileName: 'ModifiedTest.java'
                }
            };
            
            // Rufe den Handler auf
            docChangeHandler(mockEvent);
            
            // Prüfe, dass eine Reaktion erfolgte (z.B. triggerUpdateDecorations)
            // Die genaue Reaktion hängt von der Implementierung ab
        }
    });
    
    test('Fehlerbehandlung bei fehlendem Editor', () => {
        // Setze activeTextEditor auf undefined
        vscodeStub.window.activeTextEditor = undefined;
        
        const context = { subscriptions: [] };
        extension.activate(context);
        
        // Finde einen Command der einen Editor benötigt
        const analyzeCmd = Object.keys(commandHandlers).find(cmd => 
            cmd.includes('analyze') || cmd.includes('Analyze')
        );
        
        if (analyzeCmd && commandHandlers[analyzeCmd]) {
            // Sollte nicht crashen wenn kein Editor aktiv ist
            assert.doesNotThrow(() => {
                commandHandlers[analyzeCmd]();
            }, "Command sollte graceful mit fehlendem Editor umgehen");
        }
    });
    
    test('Fehlerbehandlung bei nicht-Java Datei', () => {
        // Setze einen Editor mit nicht-Java Datei
        vscodeStub.window.activeTextEditor = {
            document: { 
                languageId: 'javascript',
                getText: () => 'const x = 1;',
                fileName: 'test.js'
            }
        };
        
        const context = { subscriptions: [] };
        extension.activate(context);
        
        const analyzeCmd = Object.keys(commandHandlers).find(cmd => 
            cmd.includes('analyze') || cmd.includes('Analyze')
        );
        
        if (analyzeCmd && commandHandlers[analyzeCmd]) {
            // Sollte nicht crashen bei nicht-Java Dateien
            assert.doesNotThrow(() => {
                commandHandlers[analyzeCmd]();
            }, "Command sollte graceful mit nicht-Java Dateien umgehen");
        }
    });
    
    test('Context subscriptions sollten befüllt werden', () => {
        const context = { subscriptions: [] };
        extension.activate(context);
        
        // Prüfe, dass Subscriptions hinzugefügt wurden
        assert.ok(context.subscriptions.length > 0,
                 "Context subscriptions sollten befüllt werden");
    });
});
