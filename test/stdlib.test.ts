import { describe, it, expect } from 'vitest';
import { run, runJava } from './helpers';

describe('Math class', () => {
  it('constants', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          System.out.println(Math.PI > 3.14);
          System.out.println(Math.PI < 3.15);
          System.out.println(Math.E > 2.71);
          System.out.println(Math.E < 2.72);
        }
      }
    `)).toBe('true\ntrue\ntrue\ntrue');
  });

  it('abs', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          System.out.println(Math.abs(-5));
          System.out.println(Math.abs(5));
          System.out.println(Math.abs(-3.14));
        }
      }
    `)).toBe('5\n5\n3.14');
  });

  it('min and max', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          System.out.println(Math.min(3, 7));
          System.out.println(Math.max(3, 7));
          System.out.println(Math.min(2.5, 1.5));
          System.out.println(Math.max(2.5, 1.5));
        }
      }
    `)).toBe('3\n7\n1.5\n2.5');
  });

  it('sqrt and pow', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          System.out.println(Math.sqrt(16.0));
          System.out.println(Math.pow(2, 10));
          System.out.println(Math.cbrt(27.0));
        }
      }
    `)).toBe('4.0\n1024.0\n3.0');
  });

  it('rounding', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          System.out.println(Math.ceil(2.3));
          System.out.println(Math.floor(2.7));
          System.out.println(Math.round(2.5));
          System.out.println(Math.round(2.4));
        }
      }
    `)).toBe('3.0\n2.0\n3\n2');
  });

  it('log and exp', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          System.out.println(Math.log(1.0));
          System.out.println(Math.log10(100.0));
          System.out.println(Math.exp(0.0));
        }
      }
    `)).toBe('0.0\n2.0\n1.0');
  });

  it('trigonometric', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          System.out.println(Math.sin(0.0));
          System.out.println(Math.cos(0.0));
          System.out.println(Math.tan(0.0));
        }
      }
    `)).toBe('0.0\n1.0\n0.0');
  });

  it('floorMod and floorDiv', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          System.out.println(Math.floorMod(7, 3));
          System.out.println(Math.floorMod(-7, 3));
          System.out.println(Math.floorDiv(7, 3));
          System.out.println(Math.floorDiv(-7, 3));
        }
      }
    `)).toBe('1\n2\n2\n-3');
  });

  it('hypot', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          System.out.println(Math.hypot(3.0, 4.0));
        }
      }
    `)).toBe('5.0');
  });

  it('signum', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          System.out.println(Math.signum(42.0));
          System.out.println(Math.signum(-3.0));
          System.out.println(Math.signum(0.0));
        }
      }
    `)).toBe('1.0\n-1.0\n0.0');
  });

  it('random returns [0,1)', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          double r = Math.random();
          System.out.println(r >= 0.0 && r < 1.0);
        }
      }
    `)).toBe('true');
  });
});

describe('Wrapper Classes', () => {
  it('Integer.parseInt', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          int x = Integer.parseInt("42");
          System.out.println(x);
          int y = Integer.parseInt("FF", 16);
          System.out.println(y);
        }
      }
    `)).toBe('42\n255');
  });

  it('Integer constants', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          System.out.println(Integer.MAX_VALUE);
          System.out.println(Integer.MIN_VALUE);
        }
      }
    `)).toBe('2147483647\n-2147483648');
  });

  it('Integer.toString with radix', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          System.out.println(Integer.toString(255, 16));
          System.out.println(Integer.toBinaryString(10));
          System.out.println(Integer.toHexString(255));
          System.out.println(Integer.toOctalString(8));
        }
      }
    `)).toBe('ff\n1010\nff\n10');
  });

  it('Integer.compare', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          System.out.println(Integer.compare(5, 3));
          System.out.println(Integer.compare(3, 5));
          System.out.println(Integer.compare(5, 5));
        }
      }
    `)).toBe('1\n-1\n0');
  });

  it('Double.parseDouble', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          double d = Double.parseDouble("3.14");
          System.out.println(d);
        }
      }
    `)).toBe('3.14');
  });

  it('Double.isNaN and isInfinite', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          System.out.println(Double.isNaN(Double.NaN));
          System.out.println(Double.isNaN(1.0));
          System.out.println(Double.isInfinite(Double.POSITIVE_INFINITY));
          System.out.println(Double.isInfinite(1.0));
        }
      }
    `)).toBe('true\nfalse\ntrue\nfalse');
  });

  it('Character methods', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          System.out.println(Character.isLetter('A'));
          System.out.println(Character.isDigit('5'));
          System.out.println(Character.isLetter('5'));
          System.out.println(Character.isUpperCase('A'));
          System.out.println(Character.isLowerCase('a'));
          System.out.println(Character.toUpperCase('a'));
          System.out.println(Character.toLowerCase('A'));
        }
      }
    `)).toBe('true\ntrue\nfalse\ntrue\ntrue\nA\na');
  });

  it('Boolean.parseBoolean', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          System.out.println(Boolean.parseBoolean("true"));
          System.out.println(Boolean.parseBoolean("TRUE"));
          System.out.println(Boolean.parseBoolean("false"));
          System.out.println(Boolean.parseBoolean("anything"));
        }
      }
    `)).toBe('true\ntrue\nfalse\nfalse');
  });
});

describe('Arrays utility', () => {
  it('Arrays.sort', async () => {
    expect(await run(`
      import java.util.Arrays;
      public class Test {
        public static void main(String[] args) {
          int[] arr = {5, 2, 8, 1, 9};
          Arrays.sort(arr);
          System.out.println(Arrays.toString(arr));
        }
      }
    `)).toBe('[1, 2, 5, 8, 9]');
  });

  it('Arrays.toString', async () => {
    expect(await run(`
      import java.util.Arrays;
      public class Test {
        public static void main(String[] args) {
          String[] arr = {"hello", "world"};
          System.out.println(Arrays.toString(arr));
          int[] empty = {};
          System.out.println(Arrays.toString(empty));
        }
      }
    `)).toBe('[hello, world]\n[]');
  });

  it('Arrays.fill', async () => {
    expect(await run(`
      import java.util.Arrays;
      public class Test {
        public static void main(String[] args) {
          int[] arr = new int[5];
          Arrays.fill(arr, 7);
          System.out.println(Arrays.toString(arr));
        }
      }
    `)).toBe('[7, 7, 7, 7, 7]');
  });

  it('Arrays.copyOf', async () => {
    expect(await run(`
      import java.util.Arrays;
      public class Test {
        public static void main(String[] args) {
          int[] orig = {1, 2, 3};
          int[] copy = Arrays.copyOf(orig, 5);
          System.out.println(Arrays.toString(copy));
        }
      }
    `)).toBe('[1, 2, 3, 0, 0]');
  });

  it('Arrays.equals', async () => {
    expect(await run(`
      import java.util.Arrays;
      public class Test {
        public static void main(String[] args) {
          int[] a = {1, 2, 3};
          int[] b = {1, 2, 3};
          int[] c = {1, 2, 4};
          System.out.println(Arrays.equals(a, b));
          System.out.println(Arrays.equals(a, c));
        }
      }
    `)).toBe('true\nfalse');
  });

  it('Arrays.binarySearch', async () => {
    expect(await run(`
      import java.util.Arrays;
      public class Test {
        public static void main(String[] args) {
          int[] arr = {1, 3, 5, 7, 9};
          System.out.println(Arrays.binarySearch(arr, 5));
          System.out.println(Arrays.binarySearch(arr, 4));
        }
      }
    `)).toBe('2\n-3');
  });

  it('Arrays.asList', async () => {
    expect(await run(`
      import java.util.Arrays;
      import java.util.ArrayList;
      public class Test {
        public static void main(String[] args) {
          ArrayList<String> list = new ArrayList<>(Arrays.asList("a", "b", "c"));
          System.out.println(list);
        }
      }
    `)).toBe('[a, b, c]');
  });
});

describe('Random', () => {
  it('nextInt with bound', async () => {
    expect(await run(`
      import java.util.Random;
      public class Test {
        public static void main(String[] args) {
          Random rng = new Random();
          boolean allInRange = true;
          for (int i = 0; i < 100; i++) {
            int n = rng.nextInt(10);
            if (n < 0 || n >= 10) allInRange = false;
          }
          System.out.println(allInRange);
        }
      }
    `)).toBe('true');
  });

  it('nextDouble in [0,1)', async () => {
    expect(await run(`
      import java.util.Random;
      public class Test {
        public static void main(String[] args) {
          Random rng = new Random();
          boolean allInRange = true;
          for (int i = 0; i < 100; i++) {
            double d = rng.nextDouble();
            if (d < 0.0 || d >= 1.0) allInRange = false;
          }
          System.out.println(allInRange);
        }
      }
    `)).toBe('true');
  });

  it('nextBoolean returns boolean', async () => {
    expect(await run(`
      import java.util.Random;
      public class Test {
        public static void main(String[] args) {
          Random rng = new Random();
          boolean b = rng.nextBoolean();
          System.out.println(b == true || b == false);
        }
      }
    `)).toBe('true');
  });
});

describe('File I/O', () => {
  it('write and read file', async () => {
    expect(await run(`
      import java.io.*;
      public class Test {
        public static void main(String[] args) throws Exception {
          PrintWriter pw = new PrintWriter("test.txt");
          pw.println("Hello");
          pw.println("World");
          pw.close();

          BufferedReader br = new BufferedReader(new FileReader("test.txt"));
          String line;
          while ((line = br.readLine()) != null) {
            System.out.println(line);
          }
          br.close();
        }
      }
    `)).toBe('Hello\nWorld');
  });

  it('File exists and delete', async () => {
    expect(await run(`
      import java.io.*;
      public class Test {
        public static void main(String[] args) throws Exception {
          File f = new File("data.txt");
          System.out.println(f.exists());
          f.createNewFile();
          System.out.println(f.exists());
          f.delete();
          System.out.println(f.exists());
        }
      }
    `)).toBe('false\ntrue\nfalse');
  });

  it('File getName and getPath', async () => {
    expect(await run(`
      import java.io.*;
      public class Test {
        public static void main(String[] args) {
          File f = new File("/home/user/data.txt");
          System.out.println(f.getName());
          System.out.println(f.getPath());
        }
      }
    `)).toBe('data.txt\n/home/user/data.txt');
  });

  it('FileNotFoundException', async () => {
    expect(await run(`
      import java.io.*;
      public class Test {
        public static void main(String[] args) {
          try {
            BufferedReader br = new BufferedReader(new FileReader("nonexistent.txt"));
          } catch (FileNotFoundException e) {
            System.out.println("file not found");
          }
        }
      }
    `)).toBe('file not found');
  });
});

describe('System.out.printf and String.format', () => {
  it('basic printf %d %s', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          System.out.printf("Name: %s, Age: %d%n", "Alice", 30);
        }
      }
    `)).toBe('Name: Alice, Age: 30');
  });

  it('printf with width and precision', async () => {
    expect((await runJava(`
      public class Test {
        public static void main(String[] args) {
          System.out.printf("%10d%n", 42);
          System.out.printf("%.2f%n", 3.14159);
          System.out.printf("%10.2f%n", 3.14159);
        }
      }
    `)).replace(/\n$/, '')).toBe('        42\n3.14\n      3.14');
  });

  it('String.format', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          String s = String.format("(%d, %d)", 3, 4);
          System.out.println(s);
        }
      }
    `)).toBe('(3, 4)');
  });

  it('printf zero-padded', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          System.out.printf("%05d%n", 42);
        }
      }
    `)).toBe('00042');
  });

  it('printf hex and octal', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          System.out.printf("%x%n", 255);
          System.out.printf("%o%n", 8);
          System.out.printf("%#x%n", 255);
        }
      }
    `)).toBe('ff\n10\n0xff');
  });

  it('String.valueOf and String.join', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          System.out.println(String.valueOf(42));
          System.out.println(String.valueOf(true));
          System.out.println(String.join(", ", "a", "b", "c"));
        }
      }
    `)).toBe('42\ntrue\na, b, c');
  });
});

describe('Casting and Type Operations', () => {
  it('numeric casting', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          double d = 3.99;
          int i = (int) d;
          System.out.println(i);
          int x = 65;
          char c = (char) x;
          System.out.println(c);
        }
      }
    `)).toBe('3\nA');
  });

  it('widening conversion', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          int i = 42;
          double d = i;
          System.out.println(d);
        }
      }
    `)).toBe('42.0');
  });
});

describe('Bitwise Operators', () => {
  it('bitwise AND OR XOR', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          System.out.println(0b1010 & 0b1100);
          System.out.println(0b1010 | 0b1100);
          System.out.println(0b1010 ^ 0b1100);
        }
      }
    `)).toBe('8\n14\n6');
  });

  it('bitwise NOT', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          System.out.println(~0);
          System.out.println(~1);
        }
      }
    `)).toBe('-1\n-2');
  });

  it('shift operators', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          System.out.println(1 << 3);
          System.out.println(16 >> 2);
          System.out.println(-1 >>> 28);
        }
      }
    `)).toBe('8\n4\n15');
  });
});

describe('Scope and Variable Shadowing', () => {
  it('block scoping', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          int x = 1;
          {
            int y = 2;
            System.out.println(x + y);
          }
          System.out.println(x);
        }
      }
    `)).toBe('3\n1');
  });

  it('loop variable scoping', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          for (int i = 0; i < 3; i++) {
            int temp = i * 10;
            System.out.println(temp);
          }
        }
      }
    `)).toBe('0\n10\n20');
  });
});

describe('Escape Sequences', () => {
  it('string escape sequences', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          System.out.println("tab:\\there");
          System.out.println("quote:\\"hi\\"");
          System.out.println("backslash:\\\\");
        }
      }
    `)).toBe('tab:\there\nquote:"hi"\nbackslash:\\');
  });

  it('char escape sequences', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          char tab = '\\t';
          char newline = '\\n';
          char quote = '\\'';
          System.out.println(tab == '\\t');
          System.out.println(newline == '\\n');
          System.out.println(quote == '\\'');
        }
      }
    `)).toBe('true\ntrue\ntrue');
  });
});
