import { describe, it, expect } from 'vitest';
import { run, runExpectError } from './helpers';

describe('Complex Programs', () => {
  it('FizzBuzz', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          for (int i = 1; i <= 15; i++) {
            if (i % 15 == 0) {
              System.out.println("FizzBuzz");
            } else if (i % 3 == 0) {
              System.out.println("Fizz");
            } else if (i % 5 == 0) {
              System.out.println("Buzz");
            } else {
              System.out.println(i);
            }
          }
        }
      }
    `)).toBe('1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz');
  });

  it('bubble sort', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          int[] arr = {64, 34, 25, 12, 22, 11, 90};
          int n = arr.length;
          for (int i = 0; i < n - 1; i++) {
            for (int j = 0; j < n - i - 1; j++) {
              if (arr[j] > arr[j + 1]) {
                int temp = arr[j];
                arr[j] = arr[j + 1];
                arr[j + 1] = temp;
              }
            }
          }
          for (int i = 0; i < n; i++) {
            System.out.print(arr[i]);
            if (i < n - 1) System.out.print(" ");
          }
        }
      }
    `)).toBe('11 12 22 25 34 64 90');
  });

  it('word frequency counter', async () => {
    expect(await run(`
      import java.util.HashMap;
      import java.util.ArrayList;
      import java.util.Collections;
      public class Test {
        public static void main(String[] args) {
          String text = "the cat sat on the mat the cat";
          String[] words = text.split(" ");
          HashMap<String, Integer> freq = new HashMap<>();
          for (String w : words) {
            freq.put(w, freq.getOrDefault(w, 0) + 1);
          }
          ArrayList<String> keys = new ArrayList<>();
          for (String k : freq.keySet()) {
            keys.add(k);
          }
          Collections.sort(keys);
          for (String k : keys) {
            System.out.println(k + ": " + freq.get(k));
          }
        }
      }
    `)).toBe('cat: 2\nmat: 1\non: 1\nsat: 1\nthe: 3');
  });

  it('linked list implementation', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          LinkedList list = new LinkedList();
          list.add(10);
          list.add(20);
          list.add(30);
          list.print();
          System.out.println(list.size());
        }
      }

      class Node {
        int data;
        Node next;
        public Node(int data) {
          this.data = data;
          this.next = null;
        }
      }

      class LinkedList {
        private Node head;
        private int count;

        public LinkedList() {
          head = null;
          count = 0;
        }

        public void add(int data) {
          Node newNode = new Node(data);
          if (head == null) {
            head = newNode;
          } else {
            Node current = head;
            while (current.next != null) {
              current = current.next;
            }
            current.next = newNode;
          }
          count++;
        }

        public void print() {
          Node current = head;
          while (current != null) {
            System.out.print(current.data + " ");
            current = current.next;
          }
          System.out.println();
        }

        public int size() { return count; }
      }
    `)).toBe('10 20 30 \n3');
  });

  it('GCD recursive', async () => {
    expect(await run(`
      public class Test {
        public static int gcd(int a, int b) {
          if (b == 0) return a;
          return gcd(b, a % b);
        }
        public static void main(String[] args) {
          System.out.println(gcd(48, 18));
          System.out.println(gcd(100, 75));
        }
      }
    `)).toBe('6\n25');
  });

  it('palindrome checker', async () => {
    expect(await run(`
      public class Test {
        public static boolean isPalindrome(String s) {
          s = s.toLowerCase();
          int left = 0;
          int right = s.length() - 1;
          while (left < right) {
            if (s.charAt(left) != s.charAt(right)) {
              return false;
            }
            left++;
            right--;
          }
          return true;
        }
        public static void main(String[] args) {
          System.out.println(isPalindrome("racecar"));
          System.out.println(isPalindrome("hello"));
          System.out.println(isPalindrome("Madam"));
        }
      }
    `)).toBe('true\nfalse\ntrue');
  });

  it('temperature converter', async () => {
    expect(await run(`
      public class Test {
        public static double celsiusToFahrenheit(double c) {
          return c * 9.0 / 5.0 + 32;
        }
        public static double fahrenheitToCelsius(double f) {
          return (f - 32) * 5.0 / 9.0;
        }
        public static void main(String[] args) {
          System.out.printf("%.1f%n", celsiusToFahrenheit(100));
          System.out.printf("%.1f%n", fahrenheitToCelsius(32));
          System.out.printf("%.1f%n", fahrenheitToCelsius(212));
        }
      }
    `)).toBe('212.0\n0.0\n100.0');
  });
});

describe('Inheritance Patterns', () => {
  it('abstract class pattern', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          Shape[] shapes = new Shape[2];
          shapes[0] = new Circle(5);
          shapes[1] = new Rectangle(3, 4);
          for (Shape s : shapes) {
            System.out.printf("%.1f%n", s.area());
          }
        }
      }

      abstract class Shape {
        public abstract double area();
      }

      class Circle extends Shape {
        double radius;
        public Circle(double r) { this.radius = r; }
        public double area() { return Math.PI * radius * radius; }
      }

      class Rectangle extends Shape {
        double width, height;
        public Rectangle(double w, double h) {
          this.width = w;
          this.height = h;
        }
        public double area() { return width * height; }
      }
    `)).toBe('78.5\n12.0');
  });

  it('interface implementation', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          Greetable g = new Polite();
          System.out.println(g.greet("Alice"));
        }
      }

      interface Greetable {
        String greet(String name);
      }

      class Polite implements Greetable {
        public String greet(String name) {
          return "Good day, " + name + "!";
        }
      }
    `)).toBe('Good day, Alice!');
  });

  it('multiple constructor chaining with super', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          C obj = new C();
          System.out.println(obj.getValue());
        }
      }

      class A {
        int val;
        public A(int v) { this.val = v; }
        public int getValue() { return val; }
      }

      class B extends A {
        public B(int v) { super(v * 2); }
      }

      class C extends B {
        public C() { super(5); }
      }
    `)).toBe('10');
  });
});

describe('Exception Handling Advanced', () => {
  it('multiple catch blocks', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          for (int i = 0; i < 3; i++) {
            try {
              if (i == 0) {
                int x = 1 / 0;
              } else if (i == 1) {
                int[] arr = new int[1];
                int y = arr[5];
              } else {
                String s = null;
                s.length();
              }
            } catch (ArithmeticException e) {
              System.out.println("arithmetic");
            } catch (ArrayIndexOutOfBoundsException e) {
              System.out.println("array index");
            } catch (NullPointerException e) {
              System.out.println("null pointer");
            }
          }
        }
      }
    `)).toBe('arithmetic\narray index\nnull pointer');
  });

  it('catch parent exception type', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          try {
            int x = 1 / 0;
          } catch (Exception e) {
            System.out.println("caught as Exception");
          }
        }
      }
    `)).toBe('caught as Exception');
  });

  it('nested try-catch', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          try {
            try {
              int x = 1 / 0;
            } catch (NullPointerException e) {
              System.out.println("inner catch");
            }
          } catch (ArithmeticException e) {
            System.out.println("outer catch");
          }
        }
      }
    `)).toBe('outer catch');
  });

  it('NumberFormatException', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          try {
            int x = Integer.parseInt("abc");
          } catch (NumberFormatException e) {
            System.out.println("bad number format");
          }
        }
      }
    `)).toBe('bad number format');
  });
});

describe('Edge Cases', () => {
  it('string equality with == vs equals', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          String a = "hello";
          String b = "hello";
          System.out.println(a.equals(b));
          System.out.println(a == b);
        }
      }
    `)).toBe('true\ntrue');
  });

  it('null handling', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          String s = null;
          System.out.println(s == null);
          System.out.println(s != null);
        }
      }
    `)).toBe('true\nfalse');
  });

  it('char arithmetic', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          char c = 'A';
          System.out.println(c + 1);
          System.out.println((char)(c + 1));
          System.out.println((char)(c + 32));
        }
      }
    `)).toBe('66\nB\na');
  });

  it('multiple classes in one file', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          Foo f = new Foo();
          Bar b = new Bar();
          System.out.println(f.name());
          System.out.println(b.name());
        }
      }

      class Foo {
        public String name() { return "Foo"; }
      }

      class Bar {
        public String name() { return "Bar"; }
      }
    `)).toBe('Foo\nBar');
  });

  it('array of objects', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          Pair[] pairs = new Pair[2];
          pairs[0] = new Pair("a", 1);
          pairs[1] = new Pair("b", 2);
          for (Pair p : pairs) {
            System.out.println(p.key + "=" + p.value);
          }
        }
      }

      class Pair {
        String key;
        int value;
        public Pair(String k, int v) {
          key = k;
          value = v;
        }
      }
    `)).toBe('a=1\nb=2');
  });

  it('early return in method', async () => {
    expect(await run(`
      public class Test {
        public static String check(int n) {
          if (n < 0) return "negative";
          if (n == 0) return "zero";
          return "positive";
        }
        public static void main(String[] args) {
          System.out.println(check(-5));
          System.out.println(check(0));
          System.out.println(check(5));
        }
      }
    `)).toBe('negative\nzero\npositive');
  });

  it('method chaining on strings', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          String s = "  Hello World  ";
          System.out.println(s.trim().toLowerCase().replace(" ", "-"));
        }
      }
    `)).toBe('hello-world');
  });

  it('nested array access', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          int[][] matrix = new int[3][3];
          int count = 1;
          for (int i = 0; i < 3; i++) {
            for (int j = 0; j < 3; j++) {
              matrix[i][j] = count++;
            }
          }
          System.out.println(matrix[0][0]);
          System.out.println(matrix[1][1]);
          System.out.println(matrix[2][2]);
        }
      }
    `)).toBe('1\n5\n9');
  });

  it('HashMap with integer keys', async () => {
    expect(await run(`
      import java.util.HashMap;
      public class Test {
        public static void main(String[] args) {
          HashMap<Integer, String> map = new HashMap<>();
          map.put(1, "one");
          map.put(2, "two");
          map.put(3, "three");
          System.out.println(map.get(2));
        }
      }
    `)).toBe('two');
  });

  it('ArrayList of ArrayList (nested collections)', async () => {
    expect(await run(`
      import java.util.ArrayList;
      public class Test {
        public static void main(String[] args) {
          ArrayList<ArrayList<Integer>> grid = new ArrayList<>();
          for (int i = 0; i < 3; i++) {
            ArrayList<Integer> row = new ArrayList<>();
            for (int j = 0; j < 3; j++) {
              row.add(i * 3 + j);
            }
            grid.add(row);
          }
          System.out.println(grid.get(0));
          System.out.println(grid.get(1));
          System.out.println(grid.get(2));
        }
      }
    `)).toBe('[0, 1, 2]\n[3, 4, 5]\n[6, 7, 8]');
  });

  it('for loop with empty body', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          int x = 0;
          for (int i = 0; i < 5; i++) x += i;
          System.out.println(x);
        }
      }
    `)).toBe('10');
  });

  it('ternary in expression', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          for (int i = 1; i <= 5; i++) {
            System.out.println(i + " is " + (i % 2 == 0 ? "even" : "odd"));
          }
        }
      }
    `)).toBe('1 is odd\n2 is even\n3 is odd\n4 is even\n5 is odd');
  });

  it('hex and binary literals', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          int hex = 0xFF;
          int bin = 0b1010;
          System.out.println(hex);
          System.out.println(bin);
        }
      }
    `)).toBe('255\n10');
  });
});
