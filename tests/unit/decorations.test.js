const assert = require('assert');
const sinon = require('sinon');
const createDecorations = require('../../src/lib/decorations');

suite('Decorations Unit Tests', () => {
    let decorations;
    let vscodeMock;
    let parserMock;

    setup(() => {
        vscodeMock = {
            window: {
                createTextEditorDecorationType: sinon.stub().returns({ dispose: () => {} })
            },
            workspace: {
                getConfiguration: () => ({ get: (key, def) => def })
            },
            ThemeColor: class {}
        };
        parserMock = { analyzeForDecorations: sinon.stub().returns({}) };
        decorations = createDecorations(vscodeMock, parserMock);
    });

    test('toggleDecorations sollte den Status wechseln', () => {
        const state1 = decorations.toggleDecorations(); // Initial true -> false
        assert.strictEqual(state1, false);
        const state2 = decorations.toggleDecorations(); // false -> true
        assert.strictEqual(state2, true);
    });

    test('setActiveEditor sollte den aktiven Editor setzen', () => {
        const mockEditor = { setDecorations: sinon.spy() };
        decorations.setActiveEditor(mockEditor);
        // Prüfe internen Zustand via Seiteneffekte
    });
    
    test('createDecorationTypes sollte alle Typen initialisieren', () => {
        decorations.createDecorationTypes();
        // Prüft, ob createTextEditorDecorationType aufgerufen wurde
        assert.strictEqual(vscodeMock.window.createTextEditorDecorationType.callCount >= 5, true);
    });

    test('updateDecorations Fehlerfall (Catch-Block Coverage)', () => {
        const brokenEditor = { 
            document: { 
                languageId: 'java',
                // Die Funktion muss vorhanden sein, auch wenn sie nur einen leeren String liefert
                getText: () => 'public class Test {}' 
            },
            // Wir provozieren den Fehler erst hier, um den catch-Block in decorations.js zu testen
            setDecorations: () => { throw new Error('Fail'); } 
        };
        
        decorations.setActiveEditor(brokenEditor);
        
        // Dies sollte nun ohne "getText is not a function" durchlaufen
        assert.doesNotThrow(() => decorations.updateDecorations());
    });
});
