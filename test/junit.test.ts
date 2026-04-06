import { describe, it, expect } from 'vitest'
import { parseSnippet } from '../src/parser/snippet'
import { Interpreter, InterpreterIO, TestResult } from '../src/interpreter/interpreter'
import { registerAll } from '../src/runtime/index'
import { run, runExpectError } from './helpers'

async function runTests(source: string): Promise<TestResult[]> {
  const { ast } = parseSnippet(source)
  const io: InterpreterIO = {
    print: () => {},
    println: () => {},
    requestInput: async () => '',
  }
  const interp = new Interpreter(io)
  registerAll(interp, io)
  return interp.runTests(ast)
}

describe('JUnit', () => {
  describe('@Test annotation parsing', () => {
    it('finds @Test methods', async () => {
      const results = await runTests(`
public class MyTest {
    @Test
    public void testSomething() {
        assertTrue(true);
    }
}
      `)
      expect(results).toHaveLength(1)
      expect(results[0].status).toBe('pass')
      expect(results[0].methodName).toBe('testSomething')
    })

    it('finds multiple @Test methods', async () => {
      const results = await runTests(`
public class MyTest {
    @Test
    public void testOne() {
        assertTrue(true);
    }

    @Test
    public void testTwo() {
        assertEquals(4, 2 + 2);
    }

    public void helperMethod() {
        // not a test
    }
}
      `)
      expect(results).toHaveLength(2)
      expect(results.every(r => r.status === 'pass')).toBe(true)
    })

    it('finds tests across multiple classes', async () => {
      const results = await runTests(`
public class TestA {
    @Test
    public void testA() {
        assertTrue(true);
    }
}

public class TestB {
    @Test
    public void testB() {
        assertEquals(1, 1);
    }
}
      `)
      expect(results).toHaveLength(2)
      expect(results[0].className).toBe('TestA')
      expect(results[1].className).toBe('TestB')
    })
  })

  describe('assertEquals', () => {
    it('passes for equal ints', async () => {
      const results = await runTests(`
public class T {
    @Test
    public void test() {
        assertEquals(42, 42);
    }
}
      `)
      expect(results[0].status).toBe('pass')
    })

    it('fails for unequal ints', async () => {
      const results = await runTests(`
public class T {
    @Test
    public void test() {
        assertEquals(1, 2);
    }
}
      `)
      expect(results[0].status).toBe('fail')
      expect(results[0].message).toContain('expected')
      expect(results[0].message).toContain('1')
      expect(results[0].message).toContain('2')
    })

    it('passes for equal strings', async () => {
      const results = await runTests(`
public class T {
    @Test
    public void test() {
        assertEquals("hello", "hello");
    }
}
      `)
      expect(results[0].status).toBe('pass')
    })

    it('fails for unequal strings', async () => {
      const results = await runTests(`
public class T {
    @Test
    public void test() {
        assertEquals("hello", "world");
    }
}
      `)
      expect(results[0].status).toBe('fail')
    })

    it('passes for equal doubles with delta', async () => {
      const results = await runTests(`
public class T {
    @Test
    public void test() {
        assertEquals(0.333, 1.0 / 3.0, 0.001);
    }
}
      `)
      expect(results[0].status).toBe('pass')
    })

    it('fails for doubles outside delta', async () => {
      const results = await runTests(`
public class T {
    @Test
    public void test() {
        assertEquals(0.5, 1.0 / 3.0, 0.001);
    }
}
      `)
      expect(results[0].status).toBe('fail')
    })

    it('passes for equal booleans', async () => {
      const results = await runTests(`
public class T {
    @Test
    public void test() {
        assertEquals(true, true);
        assertEquals(false, false);
    }
}
      `)
      expect(results[0].status).toBe('pass')
    })
  })

  describe('assertTrue / assertFalse', () => {
    it('assertTrue passes for true', async () => {
      const results = await runTests(`
public class T {
    @Test
    public void test() {
        assertTrue(1 < 2);
    }
}
      `)
      expect(results[0].status).toBe('pass')
    })

    it('assertTrue fails for false', async () => {
      const results = await runTests(`
public class T {
    @Test
    public void test() {
        assertTrue(1 > 2);
    }
}
      `)
      expect(results[0].status).toBe('fail')
    })

    it('assertFalse passes for false', async () => {
      const results = await runTests(`
public class T {
    @Test
    public void test() {
        assertFalse(1 > 2);
    }
}
      `)
      expect(results[0].status).toBe('pass')
    })

    it('assertFalse fails for true', async () => {
      const results = await runTests(`
public class T {
    @Test
    public void test() {
        assertFalse(1 < 2);
    }
}
      `)
      expect(results[0].status).toBe('fail')
    })
  })

  describe('assertNull', () => {
    it('passes for null', async () => {
      const results = await runTests(`
public class T {
    @Test
    public void test() {
        String s = null;
        assertNull(s);
    }
}
      `)
      expect(results[0].status).toBe('pass')
    })

    it('fails for non-null', async () => {
      const results = await runTests(`
public class T {
    @Test
    public void test() {
        String s = "hello";
        assertNull(s);
    }
}
      `)
      expect(results[0].status).toBe('fail')
    })
  })

  describe('assertSame', () => {
    it('passes for same reference', async () => {
      const results = await runTests(`
public class T {
    @Test
    public void test() {
        ArrayList<String> list = new ArrayList<>();
        ArrayList<String> same = list;
        assertSame(list, same);
    }
}
      `)
      expect(results[0].status).toBe('pass')
    })

    it('fails for different references', async () => {
      const results = await runTests(`
public class T {
    @Test
    public void test() {
        ArrayList<String> a = new ArrayList<>();
        ArrayList<String> b = new ArrayList<>();
        assertSame(a, b);
    }
}
      `)
      expect(results[0].status).toBe('fail')
    })
  })

  describe('assertArrayEquals', () => {
    it('passes for equal int arrays', async () => {
      const results = await runTests(`
public class T {
    @Test
    public void test() {
        int[] a = {1, 2, 3};
        int[] b = {1, 2, 3};
        assertArrayEquals(a, b);
    }
}
      `)
      expect(results[0].status).toBe('pass')
    })

    it('fails for different int arrays', async () => {
      const results = await runTests(`
public class T {
    @Test
    public void test() {
        int[] a = {1, 2, 3};
        int[] b = {1, 2, 4};
        assertArrayEquals(a, b);
    }
}
      `)
      expect(results[0].status).toBe('fail')
      expect(results[0].message).toContain('index [2]')
    })

    it('fails for different length arrays', async () => {
      const results = await runTests(`
public class T {
    @Test
    public void test() {
        int[] a = {1, 2};
        int[] b = {1, 2, 3};
        assertArrayEquals(a, b);
    }
}
      `)
      expect(results[0].status).toBe('fail')
      expect(results[0].message).toContain('lengths differ')
    })

    it('passes for both null', async () => {
      const results = await runTests(`
public class T {
    @Test
    public void test() {
        int[] a = null;
        int[] b = null;
        assertArrayEquals(a, b);
    }
}
      `)
      expect(results[0].status).toBe('pass')
    })
  })

  describe('test with exceptions', () => {
    it('reports exception as error', async () => {
      const results = await runTests(`
public class T {
    @Test
    public void test() {
        int[] arr = {1, 2};
        int x = arr[5];
    }
}
      `)
      expect(results[0].status).toBe('error')
      expect(results[0].message).toContain('ArrayIndexOutOfBounds')
    })
  })

  describe('test calling user-defined methods', () => {
    it('test class can call methods on another class', async () => {
      const results = await runTests(`
public class Math2 {
    public static int square(int x) {
        return x * x;
    }
}

public class Math2Test {
    @Test
    public void testSquare() {
        assertEquals(25, Math2.square(5));
        assertEquals(0, Math2.square(0));
        assertEquals(1, Math2.square(-1));
    }
}
      `)
      expect(results).toHaveLength(1)
      expect(results[0].status).toBe('pass')
    })
  })

  describe('mixed pass and fail', () => {
    it('reports each test independently', async () => {
      const results = await runTests(`
public class T {
    @Test
    public void testPass() {
        assertEquals(1, 1);
    }

    @Test
    public void testFail() {
        assertEquals(1, 2);
    }

    @Test
    public void testError() {
        String s = null;
        int len = s.length();
    }
}
      `)
      expect(results).toHaveLength(3)
      expect(results[0].status).toBe('pass')
      expect(results[1].status).toBe('fail')
      expect(results[2].status).toBe('error')
    })
  })

  describe('non-static test methods', () => {
    it('runs instance test methods with this', async () => {
      const results = await runTests(`
public class T {
    @Test
    public void testInstance() {
        assertTrue(true);
    }
}
      `)
      expect(results[0].status).toBe('pass')
    })
  })
})
