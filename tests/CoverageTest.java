public class CoverageTest {
    // Pfad 1: Alles okay (<10 Zeilen)
    public void ok() {
        int x = 1;
    }

    // Pfad 2: Warnung (11-20 Zeilen)
    public void warning() {
        System.out.println("1"); System.out.println("2");
        System.out.println("3"); System.out.println("4");
        System.out.println("5"); System.out.println("6");
        System.out.println("7"); System.out.println("8");
        System.out.println("9"); System.out.println("10");
        System.out.println("11");
    }

    // Pfad 3: Error (>20 Zeilen)
    public void error() {
        // Hier 21 Zeilen einfügen...
        System.out.println("Trigger Red");
    }
}
