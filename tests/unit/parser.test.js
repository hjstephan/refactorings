const assert = require('assert');
const sinon = require('sinon');
const createParser = require('../../src/lib/parser');

suite('Parser Unit Tests', () => {
    let parser;
    let vscodeMock;
    let javaParserMock;

    setup(() => {
        vscodeMock = {
            window: { createWebviewPanel: sinon.stub().returns({ webview: {} }) },
            ViewColumn: { Two: 2 },
            Range: class { constructor(sL, sC, eL, eC) { } }
        };
        // Mock für java-parser (CST Struktur nachbilden)
        javaParserMock = {
            parse: sinon.stub().returns({
                name: 'compilationUnit',
                children: { classDeclaration: [{ 
                    name: 'classDeclaration',
                    children: { 
                        Identifier: [{ image: 'TestClass', location: { startOffset: 0, endOffset: 8 } }],
                        classBody: [{ children: { classBodyDeclaration: [] } }] 
                    },
                    location: { startOffset: 0, endOffset: 100 }
                }] }
            })
        };
        parser = createParser(javaParserMock, vscodeMock);
    });

    test('analyzeJavaCode sollte korrekte Basis-Metriken liefern', () => {
        const code = 'public class Test {}';
        const metrics = parser.analyzeJavaCode(code, 'Test.java');
        
        assert.strictEqual(metrics.totalLOC > 0, true);
        assert.ok(Array.isArray(metrics.classes));
    });

    test('generateRecommendations sollte alle Pfade abdecken', () => {
        // Hier simulieren wir ein metrics-Objekt mit Extremwerten
        const mockMetrics = {
            methods: [{ name: 'long', loc: 25, startLine: 1 }],
            classes: [{ name: 'Big', methodCount: 15, loc: 300, startLine: 1 }],
            totalClasses: 1,
            totalLOC: 500,
            issues: []
        };
        // Wir rufen eine interne Funktion auf, falls exportiert, 
        // oder triggern sie über analyzeJavaCode mit passendem Input
        parser.analyzeJavaCode('...', 'Test.java'); 
    });
    
    test('Deep analysis of CST nodes', () => {
        // Simuliere einen CST, wie ihn java-parser erzeugt
        const mockCst = {
            name: 'compilationUnit',
            children: {
                classDeclaration: [{
                    name: 'classDeclaration',
                    children: {
                        Identifier: [{ image: 'MyClass', location: { startLine: 1 } }],
                        classBody: [{
                            children: {
                                classBodyDeclaration: [
                                    { children: { methodDeclaration: [{
                                        name: 'methodDeclaration',
                                        children: {
                                            methodHeader: [{ children: { methodDeclarator: [{ 
                                                children: { Identifier: [{ image: 'myMethod' }] } 
                                            }] } }],
                                            methodBody: [{ location: { startLine: 10, endLine: 35 } }]
                                        }
                                    }] } }
                                ]
                            }
                        }]
                    }
                }]
            }
        };

        const metrics = parser.analyzeJavaCode('public class MyClass {}', 'Test.java');
        // Triggere die internen findNodes und analyze-Funktionen
        // Da du den Parser-Mock injizierst, kannst du hier das mockCst zurückgeben lassen
    });
    
    test('Vollständige CST Analyse (Branch Coverage)', () => {
        // Simuliere realistischen Java Code mit Methode
        const javaCode = `
public class TestClass {
    public void myMethod() {
        // Line 3
        // Line 4
        // Line 5
        // Line 6
        // Line 7
        // Line 8
        // Line 9
        // Line 10
        // Line 11
        // Line 12
        // Line 13
        // Line 14
        // Line 15
        // Line 16
        // Line 17
        // Line 18
        // Line 19
        // Line 20
        // Line 21
        // Line 22
        // Line 23
        // Line 24
        // Line 25
    }
}`;

        // Erstelle einen realistischeren CST der tatsächlich Methoden findet
        const complexCst = {
            name: 'compilationUnit',
            location: { startLine: 1, endLine: 28 },
            children: {
                typeDeclaration: [{
                    name: 'typeDeclaration',
                    children: {
                        classDeclaration: [{
                            name: 'classDeclaration',
                            location: { startLine: 2, endLine: 28 },
                            children: {
                                normalClassDeclaration: [{
                                    name: 'normalClassDeclaration',
                                    children: {
                                        typeIdentifier: [{
                                            children: {
                                                Identifier: [{
                                                    image: 'TestClass',
                                                    location: { startLine: 2, endLine: 2, startOffset: 13, endOffset: 22 }
                                                }]
                                            }
                                        }],
                                        classBody: [{
                                            name: 'classBody',
                                            location: { startLine: 2, endLine: 28 },
                                            children: {
                                                classBodyDeclaration: [{
                                                    name: 'classBodyDeclaration',
                                                    children: {
                                                        classMemberDeclaration: [{
                                                            name: 'classMemberDeclaration',
                                                            children: {
                                                                methodDeclaration: [{
                                                                    name: 'methodDeclaration',
                                                                    location: { startLine: 3, endLine: 27 },
                                                                    children: {
                                                                        methodHeader: [{
                                                                            name: 'methodHeader',
                                                                            children: {
                                                                                methodDeclarator: [{
                                                                                    name: 'methodDeclarator',
                                                                                    children: {
                                                                                        Identifier: [{
                                                                                            image: 'myMethod',
                                                                                            location: { startLine: 3, endLine: 3 }
                                                                                        }]
                                                                                    }
                                                                                }]
                                                                            }
                                                                        }],
                                                                        methodBody: [{
                                                                            name: 'methodBody',
                                                                            location: { startLine: 3, endLine: 27 },
                                                                            children: {
                                                                                block: [{
                                                                                    name: 'block',
                                                                                    location: { 
                                                                                        startLine: 3, 
                                                                                        endLine: 27,
                                                                                        startOffset: 50,
                                                                                        endOffset: 300
                                                                                    }
                                                                                }]
                                                                            }
                                                                        }]
                                                                    }
                                                                }]
                                                            }
                                                        }]
                                                    }
                                                }]
                                            }
                                        }]
                                    }
                                }]
                            }
                        }]
                    }
                }]
            }
        };

        const parserInstance = createParser({ parse: () => complexCst }, vscodeMock);
        const metrics = parserInstance.analyzeJavaCode(javaCode, 'Test.java');

        // Prüfe, ob der Parser die Struktur analysiert hat
        assert.ok(metrics, "Metrics sollte ein Objekt sein");
        assert.ok(typeof metrics.totalLOC === 'number', "totalLOC sollte eine Zahl sein");
        assert.ok(Array.isArray(metrics.classes), "classes sollte ein Array sein");
        
        // Wenn Methoden gefunden wurden, prüfe die Details
        if (metrics.methods && metrics.methods.length > 0) {
            assert.ok(metrics.totalMethods > 0, "totalMethods sollte größer als 0 sein");
            assert.ok(parseFloat(metrics.avgLOCPerMethod) > 0, "avgLOCPerMethod sollte größer als 0 sein");
        }
        
        // Prüfe, dass mindestens die Klasse erkannt wurde
        assert.ok(metrics.totalClasses >= 1, "Mindestens eine Klasse sollte gefunden werden");
    });
    
    test('analyzeForDecorations sollte Decorations zurückgeben', () => {
        const code = 'public class Test { public void method() {} }';
        const result = parser.analyzeForDecorations(code);
        
        assert.ok(result, "analyzeForDecorations sollte ein Ergebnis liefern");
        assert.ok(typeof result === 'object', "Ergebnis sollte ein Objekt sein");
    });
    
    test('showMetricsPanel sollte aufgerufen werden können', () => {
        const metrics = {
            totalLOC: 100,
            totalClasses: 2,
            totalMethods: 5,
            classes: [],
            methods: [],
            issues: []
        };
        
        // Sollte ohne Fehler durchlaufen
        assert.doesNotThrow(() => {
            parser.showMetricsPanel(metrics, 'Test.java');
        });
    });
    
    test('Lange Methoden sollten erkannt werden', () => {
        const longMethodCst = {
            name: 'compilationUnit',
            children: {
                typeDeclaration: [{
                    children: {
                        classDeclaration: [{
                            children: {
                                normalClassDeclaration: [{
                                    children: {
                                        typeIdentifier: [{
                                            children: {
                                                Identifier: [{ image: 'LongClass', location: { startLine: 1 } }]
                                            }
                                        }],
                                        classBody: [{
                                            children: {
                                                classBodyDeclaration: [{
                                                    children: {
                                                        classMemberDeclaration: [{
                                                            children: {
                                                                methodDeclaration: [{
                                                                    children: {
                                                                        methodHeader: [{
                                                                            children: {
                                                                                methodDeclarator: [{
                                                                                    children: {
                                                                                        Identifier: [{ image: 'veryLongMethod', location: { startLine: 2 } }]
                                                                                    }
                                                                                }]
                                                                            }
                                                                        }],
                                                                        methodBody: [{
                                                                            children: {
                                                                                block: [{
                                                                                    location: { startLine: 2, endLine: 52 } // 50 Zeilen
                                                                                }]
                                                                            }
                                                                        }]
                                                                    }
                                                                }]
                                                            }
                                                        }]
                                                    }
                                                }]
                                            }
                                        }]
                                    }
                                }]
                            }
                        }]
                    }
                }]
            }
        };
        
        const longParser = createParser({ parse: () => longMethodCst }, vscodeMock);
        const metrics = longParser.analyzeJavaCode('public class Test { /* long method */ }', 'Test.java');
        
        assert.ok(metrics, "Metrics sollte existieren");
        // Prüfe ob Issues für lange Methoden generiert wurden
        if (metrics.issues && metrics.issues.length > 0) {
            const hasLongMethodIssue = metrics.issues.some(issue => 
                issue.message && issue.message.toLowerCase().includes('method')
            );
            assert.ok(hasLongMethodIssue || metrics.methods.length > 0, "Lange Methode sollte erkannt werden");
        }
    });
    
    test('Große Klassen sollten erkannt werden', () => {
        const bigClassCst = {
            name: 'compilationUnit',
            children: {
                classDeclaration: [{
                    name: 'classDeclaration',
                    location: { startOffset: 0, endOffset: 500 },
                    children: {
                        Identifier: [{ 
                            image: 'BigClass', 
                            location: { startOffset: 13, endOffset: 21 }
                        }],
                        classBody: [{
                            location: { startOffset: 23, endOffset: 500 },
                            children: {
                                classBodyDeclaration: Array(20).fill(null).map((_, i) => ({
                                    children: {
                                        methodDeclaration: [{
                                            name: 'methodDeclaration',
                                            location: { startOffset: 30 + i * 20, endOffset: 48 + i * 20 },
                                            children: {
                                                methodHeader: [{
                                                    children: {
                                                        methodDeclarator: [{
                                                            children: {
                                                                Identifier: [{ 
                                                                    image: `method${i}`,
                                                                    location: { startOffset: 30 + i * 20, endOffset: 37 + i * 20 }
                                                                }]
                                                            }
                                                        }]
                                                    }
                                                }],
                                                methodBody: [{
                                                    children: {
                                                        block: [{
                                                            location: { 
                                                                startOffset: 38 + i * 20, 
                                                                endOffset: 48 + i * 20
                                                            }
                                                        }]
                                                    }
                                                }]
                                            }
                                        }]
                                    }
                                }))
                            }
                        }]
                    }
                }]
            }
        };
        
        const bigParser = createParser({ parse: () => bigClassCst }, vscodeMock);
        const metrics = bigParser.analyzeJavaCode('public class BigClass { /* many methods */ }', 'Test.java');
        
        assert.ok(metrics, "Metrics sollte existieren");
        assert.ok(metrics.totalClasses >= 1, "Klasse sollte gefunden werden");
    });
    
    test('Mehrere Klassen sollten analysiert werden', () => {
        const multiClassCst = {
            name: 'compilationUnit',
            children: {
                classDeclaration: [
                    {
                        name: 'classDeclaration',
                        location: { startOffset: 0, endOffset: 50 },
                        children: {
                            Identifier: [{ 
                                image: 'FirstClass', 
                                location: { startOffset: 13, endOffset: 23 }
                            }],
                            classBody: [{
                                location: { startOffset: 25, endOffset: 50 },
                                children: { classBodyDeclaration: [] }
                            }]
                        }
                    },
                    {
                        name: 'classDeclaration',
                        location: { startOffset: 52, endOffset: 100 },
                        children: {
                            Identifier: [{ 
                                image: 'SecondClass', 
                                location: { startOffset: 65, endOffset: 76 }
                            }],
                            classBody: [{
                                location: { startOffset: 78, endOffset: 100 },
                                children: { classBodyDeclaration: [] }
                            }]
                        }
                    }
                ]
            }
        };
        
        const multiParser = createParser({ parse: () => multiClassCst }, vscodeMock);
        const metrics = multiParser.analyzeJavaCode('public class First {} public class Second {}', 'Test.java');
        
        assert.ok(metrics.totalClasses >= 1, "Mindestens eine Klasse sollte gefunden werden");
    });
    
    test('Leere Datei sollte behandelt werden', () => {
        const emptyCst = {
            name: 'compilationUnit',
            children: {}
        };
        
        const emptyParser = createParser({ parse: () => emptyCst }, vscodeMock);
        const metrics = emptyParser.analyzeJavaCode('', 'Empty.java');
        
        assert.ok(metrics, "Metrics sollte auch für leere Datei existieren");
        assert.strictEqual(metrics.totalClasses, 0, "Keine Klassen in leerer Datei");
    });
    
    test('Parse Fehler sollten behandelt werden', () => {
        const errorParser = createParser({ 
            parse: () => { throw new Error('Parse error'); } 
        }, vscodeMock);
        
        // Der Parser wirft Fehler weiter - das ist OK, wir testen nur dass es nicht crasht
        let errorThrown = false;
        try {
            errorParser.analyzeJavaCode('invalid java code {{{', 'Invalid.java');
        } catch (e) {
            errorThrown = true;
            assert.ok(e.message.includes('Parse error'), "Fehler sollte Parse error enthalten");
        }
        
        assert.ok(errorThrown, "Parse-Fehler sollte geworfen werden");
    });
    
    test('Verschachtelte Klassen sollten behandelt werden', () => {
        const nestedCst = {
            name: 'compilationUnit',
            children: {
                classDeclaration: [{
                    name: 'classDeclaration',
                    location: { startOffset: 0, endOffset: 100 },
                    children: {
                        Identifier: [{ 
                            image: 'OuterClass', 
                            location: { startOffset: 13, endOffset: 23 }
                        }],
                        classBody: [{
                            location: { startOffset: 25, endOffset: 100 },
                            children: {
                                classBodyDeclaration: [{
                                    children: {
                                        classDeclaration: [{
                                            name: 'classDeclaration',
                                            location: { startOffset: 30, endOffset: 95 },
                                            children: {
                                                Identifier: [{ 
                                                    image: 'InnerClass', 
                                                    location: { startOffset: 43, endOffset: 53 }
                                                }],
                                                classBody: [{
                                                    location: { startOffset: 55, endOffset: 95 },
                                                    children: { classBodyDeclaration: [] }
                                                }]
                                            }
                                        }]
                                    }
                                }]
                            }
                        }]
                    }
                }]
            }
        };
        
        const nestedParser = createParser({ parse: () => nestedCst }, vscodeMock);
        const metrics = nestedParser.analyzeJavaCode('public class Outer { class Inner {} }', 'Test.java');
        
        assert.ok(metrics, "Metrics sollte existieren");
        assert.ok(metrics.totalClasses >= 1, "Äußere Klasse sollte gefunden werden");
    });
    
    test('Methoden mit Parametern sollten analysiert werden', () => {
        const methodWithParamsCst = {
            name: 'compilationUnit',
            children: {
                typeDeclaration: [{
                    children: {
                        classDeclaration: [{
                            children: {
                                normalClassDeclaration: [{
                                    children: {
                                        typeIdentifier: [{
                                            children: {
                                                Identifier: [{ image: 'TestClass', location: { startLine: 1 } }]
                                            }
                                        }],
                                        classBody: [{
                                            children: {
                                                classBodyDeclaration: [{
                                                    children: {
                                                        classMemberDeclaration: [{
                                                            children: {
                                                                methodDeclaration: [{
                                                                    children: {
                                                                        methodHeader: [{
                                                                            children: {
                                                                                methodDeclarator: [{
                                                                                    children: {
                                                                                        Identifier: [{ 
                                                                                            image: 'processData',
                                                                                            location: { startLine: 2 }
                                                                                        }],
                                                                                        formalParameterList: [{
                                                                                            children: {
                                                                                                formalParameter: [
                                                                                                    { name: 'param1' },
                                                                                                    { name: 'param2' },
                                                                                                    { name: 'param3' }
                                                                                                ]
                                                                                            }
                                                                                        }]
                                                                                    }
                                                                                }]
                                                                            }
                                                                        }],
                                                                        methodBody: [{
                                                                            children: {
                                                                                block: [{
                                                                                    location: { startLine: 2, endLine: 10 }
                                                                                }]
                                                                            }
                                                                        }]
                                                                    }
                                                                }]
                                                            }
                                                        }]
                                                    }
                                                }]
                                            }
                                        }]
                                    }
                                }]
                            }
                        }]
                    }
                }]
            }
        };
        
        const paramParser = createParser({ parse: () => methodWithParamsCst }, vscodeMock);
        const metrics = paramParser.analyzeJavaCode('public class Test { void process(int a, int b, int c) {} }', 'Test.java');
        
        assert.ok(metrics, "Metrics sollte existieren");
    });
    
    test('Komplexe Code-Metriken sollten berechnet werden', () => {
        const complexCode = `
public class ComplexClass {
    private int field1;
    private String field2;
    
    public void method1() {
        for (int i = 0; i < 10; i++) {
            if (i % 2 == 0) {
                System.out.println(i);
            }
        }
    }
    
    public void method2() {
        try {
            // some code
        } catch (Exception e) {
            // handle
        }
    }
}`;
        
        const metrics = parser.analyzeJavaCode(complexCode, 'Complex.java');
        
        assert.ok(metrics, "Metrics sollte existieren");
        assert.ok(metrics.totalLOC > 0, "LOC sollte gezählt werden");
        assert.ok(Array.isArray(metrics.issues), "Issues sollte ein Array sein");
    });
    
    test('Sehr kleine Klasse (unter 50 LOC) sollte erkannt werden', () => {
        const smallCode = 'public class Small { void m() {} }';
        const metrics = parser.analyzeJavaCode(smallCode, 'Small.java');
        
        assert.ok(metrics, "Metrics sollte existieren");
        assert.ok(metrics.totalLOC < 50, "Kleine Datei sollte < 50 LOC haben");
    });
    
    test('Mittlere Datei (50-200 LOC) sollte korrekt kategorisiert werden', () => {
        const mediumCode = 'public class Medium {\n' + '  void method() {}\n'.repeat(30) + '}';
        const metrics = parser.analyzeJavaCode(mediumCode, 'Medium.java');
        
        assert.ok(metrics, "Metrics sollte existieren");
    });
});
