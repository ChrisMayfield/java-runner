import { describe, it, expect } from 'vitest';
import { run } from './helpers';

describe('Basics', () => {
  it('Hello World', async () => {
    expect(await run(`
      public class Hello {
        public static void main(String[] args) {
          System.out.println("Hello, World!");
        }
      }
    `)).toBe('Hello, World!');
  });

  it('multiple println statements', async () => {
    expect(await run(`
      public class Multi {
        public static void main(String[] args) {
          System.out.println("one");
          System.out.println("two");
          System.out.println("three");
        }
      }
    `)).toBe('one\ntwo\nthree');
  });

  it('print without newline', async () => {
    expect(await run(`
      public class PrintTest {
        public static void main(String[] args) {
          System.out.print("a");
          System.out.print("b");
          System.out.print("c");
        }
      }
    `)).toBe('abc');
  });

  it('empty main', async () => {
    expect(await run(`
      public class Empty {
        public static void main(String[] args) {
        }
      }
    `)).toBe('');
  });
});

describe('Variables and Types', () => {
  it('int variable', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          int x = 42;
          System.out.println(x);
        }
      }
    `)).toBe('42');
  });

  it('double variable', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          double d = 3.14;
          System.out.println(d);
        }
      }
    `)).toBe('3.14');
  });

  it('boolean variable', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          boolean b = true;
          System.out.println(b);
          b = false;
          System.out.println(b);
        }
      }
    `)).toBe('true\nfalse');
  });

  it('char variable', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          char c = 'A';
          System.out.println(c);
        }
      }
    `)).toBe('A');
  });

  it('String variable', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          String s = "hello";
          System.out.println(s);
        }
      }
    `)).toBe('hello');
  });

  it('multiple declarations on one line', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          int a = 1, b = 2, c = 3;
          System.out.println(a + b + c);
        }
      }
    `)).toBe('6');
  });

  it('default values', async () => {
    expect(await run(`
      public class Test {
        static int x;
        static double d;
        static boolean b;
        public static void main(String[] args) {
          System.out.println(x);
          System.out.println(d);
          System.out.println(b);
        }
      }
    `)).toBe('0\n0.0\nfalse');
  });
});

describe('Arithmetic', () => {
  it('basic operations', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          System.out.println(10 + 3);
          System.out.println(10 - 3);
          System.out.println(10 * 3);
          System.out.println(10 / 3);
          System.out.println(10 % 3);
        }
      }
    `)).toBe('13\n7\n30\n3\n1');
  });

  it('integer division truncates', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          System.out.println(7 / 2);
          System.out.println(-7 / 2);
        }
      }
    `)).toBe('3\n-3');
  });

  it('double division', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          System.out.println(7.0 / 2);
          System.out.println(7 / 2.0);
        }
      }
    `)).toBe('3.5\n3.5');
  });

  it('compound assignment operators', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          int x = 10;
          x += 5;
          System.out.println(x);
          x -= 3;
          System.out.println(x);
          x *= 2;
          System.out.println(x);
          x /= 6;
          System.out.println(x);
          x %= 3;
          System.out.println(x);
        }
      }
    `)).toBe('15\n12\n24\n4\n1');
  });

  it('increment and decrement', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          int x = 5;
          System.out.println(x++);
          System.out.println(x);
          System.out.println(++x);
          System.out.println(x--);
          System.out.println(x);
          System.out.println(--x);
        }
      }
    `)).toBe('5\n6\n7\n7\n6\n5');
  });

  it('unary minus and plus', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          int x = 5;
          System.out.println(-x);
          System.out.println(+x);
        }
      }
    `)).toBe('-5\n5');
  });

  it('operator precedence', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          System.out.println(2 + 3 * 4);
          System.out.println((2 + 3) * 4);
          System.out.println(10 - 4 / 2);
          System.out.println(10 % 3 + 1);
        }
      }
    `)).toBe('14\n20\n8\n2');
  });
});

describe('Comparison and Logical Operators', () => {
  it('comparison operators', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          System.out.println(5 > 3);
          System.out.println(5 < 3);
          System.out.println(5 >= 5);
          System.out.println(5 <= 4);
          System.out.println(5 == 5);
          System.out.println(5 != 5);
        }
      }
    `)).toBe('true\nfalse\ntrue\nfalse\ntrue\nfalse');
  });

  it('logical operators', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          System.out.println(true && true);
          System.out.println(true && false);
          System.out.println(false || true);
          System.out.println(false || false);
          System.out.println(!true);
          System.out.println(!false);
        }
      }
    `)).toBe('true\nfalse\ntrue\nfalse\nfalse\ntrue');
  });

  it('short-circuit evaluation', async () => {
    expect(await run(`
      public class Test {
        static boolean sideEffect() {
          System.out.println("called");
          return true;
        }
        public static void main(String[] args) {
          boolean r1 = false && sideEffect();
          System.out.println("---");
          boolean r2 = true || sideEffect();
        }
      }
    `)).toBe('---');
  });

  it('ternary operator', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          int x = 10;
          String result = x > 5 ? "big" : "small";
          System.out.println(result);
          result = x > 20 ? "big" : "small";
          System.out.println(result);
        }
      }
    `)).toBe('big\nsmall');
  });
});

describe('String Operations', () => {
  it('concatenation', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          String s = "Hello" + " " + "World";
          System.out.println(s);
        }
      }
    `)).toBe('Hello World');
  });

  it('concatenation with other types', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          System.out.println("num: " + 42);
          System.out.println("bool: " + true);
          System.out.println("char: " + 'A');
          System.out.println(1 + 2 + " hello " + 3 + 4);
        }
      }
    `)).toBe('num: 42\nbool: true\nchar: A\n3 hello 34');
  });

  it('length and charAt', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          String s = "Hello";
          System.out.println(s.length());
          System.out.println(s.charAt(0));
          System.out.println(s.charAt(4));
        }
      }
    `)).toBe('5\nH\no');
  });

  it('substring', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          String s = "Hello World";
          System.out.println(s.substring(6));
          System.out.println(s.substring(0, 5));
        }
      }
    `)).toBe('World\nHello');
  });

  it('indexOf and contains', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          String s = "Hello World";
          System.out.println(s.indexOf("World"));
          System.out.println(s.indexOf("xyz"));
          System.out.println(s.contains("World"));
          System.out.println(s.contains("xyz"));
        }
      }
    `)).toBe('6\n-1\ntrue\nfalse');
  });

  it('case conversion', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          String s = "Hello World";
          System.out.println(s.toUpperCase());
          System.out.println(s.toLowerCase());
        }
      }
    `)).toBe('HELLO WORLD\nhello world');
  });

  it('trim and isEmpty', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          String s = "  hello  ";
          System.out.println(s.trim());
          System.out.println("".isEmpty());
          System.out.println("a".isEmpty());
          System.out.println("  ".isBlank());
        }
      }
    `)).toBe('hello\ntrue\nfalse\ntrue');
  });

  it('replace and split', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          String s = "a-b-c-d";
          System.out.println(s.replace("-", "/"));
          String[] parts = s.split("-");
          System.out.println(parts.length);
          System.out.println(parts[0]);
          System.out.println(parts[3]);
        }
      }
    `)).toBe('a/b/c/d\n4\na\nd');
  });

  it('equals and compareTo', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          String a = "hello";
          String b = "hello";
          String c = "Hello";
          System.out.println(a.equals(b));
          System.out.println(a.equals(c));
          System.out.println(a.equalsIgnoreCase(c));
          System.out.println("a".compareTo("b"));
          System.out.println("b".compareTo("a"));
          System.out.println("a".compareTo("a"));
        }
      }
    `)).toBe('true\nfalse\ntrue\n-1\n1\n0');
  });

  it('startsWith and endsWith', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          String s = "Hello World";
          System.out.println(s.startsWith("Hello"));
          System.out.println(s.startsWith("World"));
          System.out.println(s.endsWith("World"));
          System.out.println(s.endsWith("Hello"));
        }
      }
    `)).toBe('true\nfalse\ntrue\nfalse');
  });

  it('toCharArray', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          char[] chars = "abc".toCharArray();
          for (char c : chars) {
            System.out.print(c);
          }
          System.out.println();
        }
      }
    `)).toBe('abc');
  });

  it('concat and repeat', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          System.out.println("hello".concat(" world"));
          System.out.println("ab".repeat(3));
        }
      }
    `)).toBe('hello world\nababab');
  });
});

describe('Control Flow - If/Else', () => {
  it('simple if', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          int x = 10;
          if (x > 5) {
            System.out.println("yes");
          }
        }
      }
    `)).toBe('yes');
  });

  it('if-else', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          int x = 3;
          if (x > 5) {
            System.out.println("big");
          } else {
            System.out.println("small");
          }
        }
      }
    `)).toBe('small');
  });

  it('if-else if-else chain', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          int x = 75;
          if (x >= 90) {
            System.out.println("A");
          } else if (x >= 80) {
            System.out.println("B");
          } else if (x >= 70) {
            System.out.println("C");
          } else {
            System.out.println("F");
          }
        }
      }
    `)).toBe('C');
  });
});

describe('Control Flow - Loops', () => {
  it('for loop', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          int sum = 0;
          for (int i = 1; i <= 10; i++) {
            sum += i;
          }
          System.out.println(sum);
        }
      }
    `)).toBe('55');
  });

  it('while loop', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          int n = 5;
          int fact = 1;
          while (n > 0) {
            fact *= n;
            n--;
          }
          System.out.println(fact);
        }
      }
    `)).toBe('120');
  });

  it('do-while loop', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          int i = 0;
          do {
            System.out.println(i);
            i++;
          } while (i < 3);
        }
      }
    `)).toBe('0\n1\n2');
  });

  it('do-while executes at least once', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          int i = 10;
          do {
            System.out.println(i);
          } while (i < 5);
        }
      }
    `)).toBe('10');
  });

  it('enhanced for loop (for-each)', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          int[] nums = {1, 2, 3, 4, 5};
          int sum = 0;
          for (int n : nums) {
            sum += n;
          }
          System.out.println(sum);
        }
      }
    `)).toBe('15');
  });

  it('break in loop', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          for (int i = 0; i < 10; i++) {
            if (i == 5) break;
            System.out.print(i + " ");
          }
        }
      }
    `)).toBe('0 1 2 3 4');
  });

  it('continue in loop', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          for (int i = 0; i < 6; i++) {
            if (i % 2 == 0) continue;
            System.out.print(i + " ");
          }
        }
      }
    `)).toBe('1 3 5');
  });

  it('nested loops', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          for (int i = 1; i <= 3; i++) {
            for (int j = 1; j <= 3; j++) {
              System.out.print(i * j + " ");
            }
            System.out.println();
          }
        }
      }
    `)).toBe('1 2 3 \n2 4 6 \n3 6 9');
  });
});

describe('Control Flow - Switch', () => {
  it('switch with cases', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          int day = 3;
          switch (day) {
            case 1: System.out.println("Mon"); break;
            case 2: System.out.println("Tue"); break;
            case 3: System.out.println("Wed"); break;
            default: System.out.println("Other"); break;
          }
        }
      }
    `)).toBe('Wed');
  });

  it('switch fall-through', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          int x = 1;
          switch (x) {
            case 1:
            case 2:
              System.out.println("1 or 2");
              break;
            case 3:
              System.out.println("3");
              break;
          }
        }
      }
    `)).toBe('1 or 2');
  });

  it('switch default', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          int x = 99;
          switch (x) {
            case 1: System.out.println("one"); break;
            default: System.out.println("other"); break;
          }
        }
      }
    `)).toBe('other');
  });

  it('switch on String', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          String s = "hello";
          switch (s) {
            case "hello": System.out.println("greeting"); break;
            case "bye": System.out.println("farewell"); break;
            default: System.out.println("unknown"); break;
          }
        }
      }
    `)).toBe('greeting');
  });
});

describe('Methods', () => {
  it('static method with return value', async () => {
    expect(await run(`
      public class Test {
        public static int square(int n) {
          return n * n;
        }
        public static void main(String[] args) {
          System.out.println(square(7));
        }
      }
    `)).toBe('49');
  });

  it('static method with multiple parameters', async () => {
    expect(await run(`
      public class Test {
        public static int add(int a, int b) {
          return a + b;
        }
        public static void main(String[] args) {
          System.out.println(add(3, 4));
        }
      }
    `)).toBe('7');
  });

  it('recursion (fibonacci)', async () => {
    expect(await run(`
      public class Test {
        public static int fib(int n) {
          if (n <= 1) return n;
          return fib(n - 1) + fib(n - 2);
        }
        public static void main(String[] args) {
          System.out.println(fib(10));
        }
      }
    `)).toBe('55');
  });

  it('method overloading', async () => {
    expect(await run(`
      public class Test {
        public static int add(int a, int b) {
          return a + b;
        }
        public static int add(int a, int b, int c) {
          return a + b + c;
        }
        public static void main(String[] args) {
          System.out.println(add(1, 2));
          System.out.println(add(1, 2, 3));
        }
      }
    `)).toBe('3\n6');
  });

  it('void method', async () => {
    expect(await run(`
      public class Test {
        public static void greet(String name) {
          System.out.println("Hello, " + name + "!");
        }
        public static void main(String[] args) {
          greet("Alice");
          greet("Bob");
        }
      }
    `)).toBe('Hello, Alice!\nHello, Bob!');
  });
});

describe('Arrays', () => {
  it('array creation and access', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          int[] nums = new int[3];
          nums[0] = 10;
          nums[1] = 20;
          nums[2] = 30;
          System.out.println(nums[0] + nums[1] + nums[2]);
          System.out.println(nums.length);
        }
      }
    `)).toBe('60\n3');
  });

  it('array initializer', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          int[] nums = {5, 3, 1, 4, 2};
          for (int n : nums) {
            System.out.print(n + " ");
          }
        }
      }
    `)).toBe('5 3 1 4 2');
  });

  it('String array', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          String[] names = {"Alice", "Bob", "Charlie"};
          for (String name : names) {
            System.out.println(name);
          }
        }
      }
    `)).toBe('Alice\nBob\nCharlie');
  });

  it('array as method parameter', async () => {
    expect(await run(`
      public class Test {
        public static int sum(int[] arr) {
          int total = 0;
          for (int x : arr) {
            total += x;
          }
          return total;
        }
        public static void main(String[] args) {
          int[] nums = {1, 2, 3, 4, 5};
          System.out.println(sum(nums));
        }
      }
    `)).toBe('15');
  });

  it('2D array', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          int[][] grid = new int[2][3];
          grid[0][0] = 1;
          grid[0][1] = 2;
          grid[0][2] = 3;
          grid[1][0] = 4;
          grid[1][1] = 5;
          grid[1][2] = 6;
          System.out.println(grid[1][2]);
          System.out.println(grid.length);
          System.out.println(grid[0].length);
        }
      }
    `)).toBe('6\n2\n3');
  });
});

describe('Classes and Objects', () => {
  it('simple class with constructor', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          Point p = new Point(3, 4);
          System.out.println(p.getX());
          System.out.println(p.getY());
        }
      }

      class Point {
        private int x;
        private int y;
        public Point(int x, int y) {
          this.x = x;
          this.y = y;
        }
        public int getX() { return x; }
        public int getY() { return y; }
      }
    `)).toBe('3\n4');
  });

  it('instance methods', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          Counter c = new Counter();
          c.increment();
          c.increment();
          c.increment();
          System.out.println(c.getCount());
        }
      }

      class Counter {
        private int count;
        public Counter() { count = 0; }
        public void increment() { count++; }
        public int getCount() { return count; }
      }
    `)).toBe('3');
  });

  it('toString method', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          Person p = new Person("Alice", 30);
          System.out.println(p);
        }
      }

      class Person {
        String name;
        int age;
        public Person(String name, int age) {
          this.name = name;
          this.age = age;
        }
        public String toString() {
          return name + " (age " + age + ")";
        }
      }
    `)).toBe('Alice (age 30)');
  });

  it('static fields and methods', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          Dog.setSpecies("Canis lupus familiaris");
          Dog d1 = new Dog("Rex");
          Dog d2 = new Dog("Buddy");
          System.out.println(d1.getName() + " is a " + Dog.getSpecies());
          System.out.println(Dog.count);
        }
      }

      class Dog {
        static String species;
        static int count = 0;
        String name;
        public Dog(String name) {
          this.name = name;
          count++;
        }
        public String getName() { return name; }
        public static String getSpecies() { return species; }
        public static void setSpecies(String s) { species = s; }
      }
    `)).toBe('Rex is a Canis lupus familiaris\n2');
  });
});

describe('Inheritance', () => {
  it('basic inheritance', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          Dog d = new Dog("Rex", "Golden Retriever");
          System.out.println(d.getName());
          System.out.println(d.getBreed());
          d.speak();
        }
      }

      class Animal {
        private String name;
        public Animal(String name) { this.name = name; }
        public String getName() { return name; }
        public void speak() { System.out.println("..."); }
      }

      class Dog extends Animal {
        private String breed;
        public Dog(String name, String breed) {
          super(name);
          this.breed = breed;
        }
        public String getBreed() { return breed; }
        public void speak() { System.out.println("Woof!"); }
      }
    `)).toBe('Rex\nGolden Retriever\nWoof!');
  });

  it('polymorphism', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          Animal[] animals = new Animal[3];
          animals[0] = new Dog();
          animals[1] = new Cat();
          animals[2] = new Dog();
          for (Animal a : animals) {
            a.speak();
          }
        }
      }

      class Animal {
        public void speak() { System.out.println("..."); }
      }

      class Dog extends Animal {
        public void speak() { System.out.println("Woof"); }
      }

      class Cat extends Animal {
        public void speak() { System.out.println("Meow"); }
      }
    `)).toBe('Woof\nMeow\nWoof');
  });

  it('instanceof check', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          Animal a = new Dog();
          System.out.println(a instanceof Animal);
          System.out.println(a instanceof Dog);
        }
      }

      class Animal {}
      class Dog extends Animal {}
    `)).toBe('true\ntrue');
  });

  it('super method call', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          Child c = new Child();
          c.greet();
        }
      }

      class Parent {
        public String greeting() {
          return "Hello from Parent";
        }
      }

      class Child extends Parent {
        public void greet() {
          System.out.println(super.greeting());
          System.out.println("Hello from Child");
        }
      }
    `)).toBe('Hello from Parent\nHello from Child');
  });
});

describe('Exception Handling', () => {
  it('try-catch', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          try {
            int x = 10 / 0;
          } catch (ArithmeticException e) {
            System.out.println("caught: division by zero");
          }
          System.out.println("after");
        }
      }
    `)).toBe('caught: division by zero\nafter');
  });

  it('try-catch-finally', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          try {
            System.out.println("try");
            int x = 1 / 0;
          } catch (ArithmeticException e) {
            System.out.println("catch");
          } finally {
            System.out.println("finally");
          }
        }
      }
    `)).toBe('try\ncatch\nfinally');
  });

  it('finally runs even without exception', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          try {
            System.out.println("try");
          } finally {
            System.out.println("finally");
          }
        }
      }
    `)).toBe('try\nfinally');
  });

  it('throw custom exception', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          try {
            throw new RuntimeException("oops");
          } catch (RuntimeException e) {
            System.out.println("caught");
          }
        }
      }
    `)).toBe('caught');
  });

  it('exception propagation', async () => {
    expect(await run(`
      public class Test {
        public static void bad() {
          int x = 1 / 0;
        }
        public static void middle() {
          bad();
        }
        public static void main(String[] args) {
          try {
            middle();
          } catch (ArithmeticException e) {
            System.out.println("caught in main");
          }
        }
      }
    `)).toBe('caught in main');
  });

  it('NullPointerException', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          try {
            String s = null;
            int len = s.length();
          } catch (NullPointerException e) {
            System.out.println("null pointer caught");
          }
        }
      }
    `)).toBe('null pointer caught');
  });

  it('ArrayIndexOutOfBoundsException', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          try {
            int[] arr = {1, 2, 3};
            int x = arr[5];
          } catch (ArrayIndexOutOfBoundsException e) {
            System.out.println("index out of bounds");
          }
        }
      }
    `)).toBe('index out of bounds');
  });
});

describe('Scanner Input', () => {
  it('nextLine', async () => {
    expect(await run(`
      import java.util.Scanner;
      public class Test {
        public static void main(String[] args) {
          Scanner sc = new Scanner(System.in);
          String name = sc.nextLine();
          System.out.println("Hello, " + name + "!");
        }
      }
    `, ['Alice'])).toBe('Hello, Alice!');
  });

  it('nextInt', async () => {
    expect(await run(`
      import java.util.Scanner;
      public class Test {
        public static void main(String[] args) {
          Scanner sc = new Scanner(System.in);
          int x = sc.nextInt();
          int y = sc.nextInt();
          System.out.println(x + y);
        }
      }
    `, ['10', '20'])).toBe('30');
  });

  it('nextDouble', async () => {
    expect(await run(`
      import java.util.Scanner;
      public class Test {
        public static void main(String[] args) {
          Scanner sc = new Scanner(System.in);
          double d = sc.nextDouble();
          System.out.println(d * 2);
        }
      }
    `, ['3.14'])).toBe('6.28');
  });

  it('Scanner from String', async () => {
    expect(await run(`
      import java.util.Scanner;
      public class Test {
        public static void main(String[] args) {
          Scanner sc = new Scanner("10 20 30");
          int sum = 0;
          while (sc.hasNextInt()) {
            sum += sc.nextInt();
          }
          System.out.println(sum);
        }
      }
    `)).toBe('60');
  });

  it('multiple inputs', async () => {
    expect(await run(`
      import java.util.Scanner;
      public class Test {
        public static void main(String[] args) {
          Scanner sc = new Scanner(System.in);
          String name = sc.nextLine();
          int age = sc.nextInt();
          System.out.println(name + " is " + age);
        }
      }
    `, ['Bob', '25'])).toBe('Bob is 25');
  });
});
