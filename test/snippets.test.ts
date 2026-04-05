import { describe, it, expect } from 'vitest';
import { run, runExpectError } from './helpers';

describe('Snippets', () => {
  it('bare println statement', async () => {
    expect(await run(`
      System.out.println("Hello, World!");
    `)).toBe('Hello, World!');
  });

  it('multiple statements', async () => {
    expect(await run(`
      int x = 5;
      System.out.println("x is " + x);
    `)).toBe('x is 5');
  });

  it('variable declarations and arithmetic', async () => {
    expect(await run(`
      int a = 10;
      int b = 20;
      System.out.println(a + b);
    `)).toBe('30');
  });

  it('if-else statement', async () => {
    expect(await run(`
      int x = 42;
      if (x > 10) {
        System.out.println("big");
      } else {
        System.out.println("small");
      }
    `)).toBe('big');
  });

  it('for loop', async () => {
    expect(await run(`
      for (int i = 0; i < 5; i++) {
        System.out.print(i + " ");
      }
    `)).toBe('0 1 2 3 4');
  });

  it('while loop', async () => {
    expect(await run(`
      int n = 1;
      while (n <= 4) {
        System.out.print(n + " ");
        n++;
      }
    `)).toBe('1 2 3 4');
  });

  it('Scanner auto-imported', async () => {
    expect(await run(`
      Scanner sc = new Scanner(System.in);
      String name = sc.nextLine();
      System.out.println("Hello, " + name + "!");
    `, ['Alice'])).toBe('Hello, Alice!');
  });

  it('Random auto-imported', async () => {
    expect(await run(`
      Random rand = new Random(42);
      int n = rand.nextInt(100);
      System.out.println(n >= 0 && n < 100);
    `)).toBe('true');
  });

  it('ArrayList auto-imported', async () => {
    expect(await run(`
      ArrayList<String> list = new ArrayList<>();
      list.add("a");
      list.add("b");
      list.add("c");
      System.out.println(list.size());
    `)).toBe('3');
  });

  it('HashMap auto-imported', async () => {
    expect(await run(`
      HashMap<String, Integer> map = new HashMap<>();
      map.put("x", 10);
      System.out.println(map.get("x"));
    `)).toBe('10');
  });

  it('Math usage (no import needed)', async () => {
    expect(await run(`
      System.out.println(Math.max(3, 7));
    `)).toBe('7');
  });

  it('arrays in snippet', async () => {
    expect(await run(`
      int[] nums = {1, 2, 3, 4, 5};
      int sum = 0;
      for (int n : nums) {
        sum += n;
      }
      System.out.println(sum);
    `)).toBe('15');
  });

  it('string operations', async () => {
    expect(await run(`
      String s = "Hello";
      System.out.println(s.length());
      System.out.println(s.toUpperCase());
    `)).toBe('5\nHELLO');
  });

  it('full program still works', async () => {
    expect(await run(`
      public class Test {
        public static void main(String[] args) {
          System.out.println("full program");
        }
      }
    `)).toBe('full program');
  });

  it('methods without class (class-only wrapping)', async () => {
    expect(await run(`
      public static int square(int n) {
          return n * n;
      }

      public static void main(String[] args) {
          System.out.println(square(5));
      }
    `)).toBe('25');
  });

  it('recursive method without class', async () => {
    expect(await run(`
      public static int fib(int n) {
          if (n <= 1) return n;
          return fib(n - 1) + fib(n - 2);
      }

      public static void main(String[] args) {
          for (int i = 0; i <= 10; i++) {
              System.out.print(fib(i) + " ");
          }
          System.out.println();
      }
    `)).toBe('0 1 1 2 3 5 8 13 21 34 55');
  });

  it('snippet with parse error reports correct line', async () => {
    const err = await runExpectError(`System.out.println("ok");
int x = ;`);
    expect(err).toContain('error');
  });
});
