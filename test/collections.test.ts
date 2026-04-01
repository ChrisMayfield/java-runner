import { describe, it, expect } from 'vitest';
import { run } from './helpers';

describe('ArrayList', () => {
  it('add and get', async () => {
    expect(await run(`
      import java.util.ArrayList;
      public class Test {
        public static void main(String[] args) {
          ArrayList<String> list = new ArrayList<>();
          list.add("a");
          list.add("b");
          list.add("c");
          System.out.println(list.get(0));
          System.out.println(list.get(2));
          System.out.println(list.size());
        }
      }
    `)).toBe('a\nc\n3');
  });

  it('set and remove', async () => {
    expect(await run(`
      import java.util.ArrayList;
      public class Test {
        public static void main(String[] args) {
          ArrayList<Integer> list = new ArrayList<>();
          list.add(10);
          list.add(20);
          list.add(30);
          list.set(1, 25);
          System.out.println(list);
          list.remove(0);
          System.out.println(list);
        }
      }
    `)).toBe('[10, 25, 30]\n[25, 30]');
  });

  it('contains and indexOf', async () => {
    expect(await run(`
      import java.util.ArrayList;
      public class Test {
        public static void main(String[] args) {
          ArrayList<String> list = new ArrayList<>();
          list.add("alpha");
          list.add("beta");
          list.add("gamma");
          System.out.println(list.contains("beta"));
          System.out.println(list.contains("delta"));
          System.out.println(list.indexOf("gamma"));
          System.out.println(list.indexOf("delta"));
        }
      }
    `)).toBe('true\nfalse\n2\n-1');
  });

  it('isEmpty and clear', async () => {
    expect(await run(`
      import java.util.ArrayList;
      public class Test {
        public static void main(String[] args) {
          ArrayList<Integer> list = new ArrayList<>();
          System.out.println(list.isEmpty());
          list.add(1);
          System.out.println(list.isEmpty());
          list.clear();
          System.out.println(list.isEmpty());
          System.out.println(list.size());
        }
      }
    `)).toBe('true\nfalse\ntrue\n0');
  });

  it('for-each iteration', async () => {
    expect(await run(`
      import java.util.ArrayList;
      public class Test {
        public static void main(String[] args) {
          ArrayList<String> list = new ArrayList<>();
          list.add("x");
          list.add("y");
          list.add("z");
          for (String s : list) {
            System.out.print(s);
          }
        }
      }
    `)).toBe('xyz');
  });

  it('toString format', async () => {
    expect(await run(`
      import java.util.ArrayList;
      public class Test {
        public static void main(String[] args) {
          ArrayList<Integer> list = new ArrayList<>();
          list.add(1);
          list.add(2);
          list.add(3);
          System.out.println(list);
          ArrayList<String> empty = new ArrayList<>();
          System.out.println(empty);
        }
      }
    `)).toBe('[1, 2, 3]\n[]');
  });

  it('subList', async () => {
    expect(await run(`
      import java.util.ArrayList;
      import java.util.List;
      public class Test {
        public static void main(String[] args) {
          ArrayList<Integer> list = new ArrayList<>();
          list.add(10);
          list.add(20);
          list.add(30);
          list.add(40);
          list.add(50);
          System.out.println(list.subList(1, 4));
        }
      }
    `)).toBe('[20, 30, 40]');
  });
});

describe('HashMap', () => {
  it('put and get', async () => {
    expect(await run(`
      import java.util.HashMap;
      public class Test {
        public static void main(String[] args) {
          HashMap<String, Integer> map = new HashMap<>();
          map.put("a", 1);
          map.put("b", 2);
          map.put("c", 3);
          System.out.println(map.get("a"));
          System.out.println(map.get("b"));
          System.out.println(map.get("c"));
          System.out.println(map.size());
        }
      }
    `)).toBe('1\n2\n3\n3');
  });

  it('containsKey and containsValue', async () => {
    expect(await run(`
      import java.util.HashMap;
      public class Test {
        public static void main(String[] args) {
          HashMap<String, Integer> map = new HashMap<>();
          map.put("x", 10);
          System.out.println(map.containsKey("x"));
          System.out.println(map.containsKey("y"));
          System.out.println(map.containsValue(10));
          System.out.println(map.containsValue(20));
        }
      }
    `)).toBe('true\nfalse\ntrue\nfalse');
  });

  it('remove', async () => {
    expect(await run(`
      import java.util.HashMap;
      public class Test {
        public static void main(String[] args) {
          HashMap<String, Integer> map = new HashMap<>();
          map.put("a", 1);
          map.put("b", 2);
          map.remove("a");
          System.out.println(map.containsKey("a"));
          System.out.println(map.size());
        }
      }
    `)).toBe('false\n1');
  });

  it('getOrDefault', async () => {
    expect(await run(`
      import java.util.HashMap;
      public class Test {
        public static void main(String[] args) {
          HashMap<String, Integer> map = new HashMap<>();
          map.put("a", 1);
          System.out.println(map.getOrDefault("a", 0));
          System.out.println(map.getOrDefault("b", 42));
        }
      }
    `)).toBe('1\n42');
  });

  it('putIfAbsent', async () => {
    expect(await run(`
      import java.util.HashMap;
      public class Test {
        public static void main(String[] args) {
          HashMap<String, Integer> map = new HashMap<>();
          map.put("a", 1);
          map.putIfAbsent("a", 99);
          map.putIfAbsent("b", 2);
          System.out.println(map.get("a"));
          System.out.println(map.get("b"));
        }
      }
    `)).toBe('1\n2');
  });

  it('isEmpty and clear', async () => {
    expect(await run(`
      import java.util.HashMap;
      public class Test {
        public static void main(String[] args) {
          HashMap<String, Integer> map = new HashMap<>();
          System.out.println(map.isEmpty());
          map.put("k", 1);
          System.out.println(map.isEmpty());
          map.clear();
          System.out.println(map.isEmpty());
        }
      }
    `)).toBe('true\nfalse\ntrue');
  });

  it('keySet iteration', async () => {
    expect(await run(`
      import java.util.HashMap;
      import java.util.ArrayList;
      import java.util.Collections;
      public class Test {
        public static void main(String[] args) {
          HashMap<String, Integer> map = new HashMap<>();
          map.put("c", 3);
          map.put("a", 1);
          map.put("b", 2);
          ArrayList<String> keys = new ArrayList<>();
          for (String k : map.keySet()) {
            keys.add(k);
          }
          Collections.sort(keys);
          System.out.println(keys);
        }
      }
    `)).toBe('[a, b, c]');
  });
});

describe('HashSet', () => {
  it('add and contains', async () => {
    expect(await run(`
      import java.util.HashSet;
      public class Test {
        public static void main(String[] args) {
          HashSet<String> set = new HashSet<>();
          set.add("a");
          set.add("b");
          set.add("a");
          System.out.println(set.size());
          System.out.println(set.contains("a"));
          System.out.println(set.contains("c"));
        }
      }
    `)).toBe('2\ntrue\nfalse');
  });

  it('remove', async () => {
    expect(await run(`
      import java.util.HashSet;
      public class Test {
        public static void main(String[] args) {
          HashSet<Integer> set = new HashSet<>();
          set.add(1);
          set.add(2);
          set.add(3);
          set.remove(2);
          System.out.println(set.size());
          System.out.println(set.contains(2));
        }
      }
    `)).toBe('2\nfalse');
  });

  it('for-each iteration', async () => {
    expect(await run(`
      import java.util.HashSet;
      import java.util.ArrayList;
      import java.util.Collections;
      public class Test {
        public static void main(String[] args) {
          HashSet<String> set = new HashSet<>();
          set.add("b");
          set.add("a");
          set.add("c");
          ArrayList<String> sorted = new ArrayList<>();
          for (String s : set) {
            sorted.add(s);
          }
          Collections.sort(sorted);
          System.out.println(sorted);
        }
      }
    `)).toBe('[a, b, c]');
  });
});

describe('Collections utility', () => {
  it('sort', async () => {
    expect(await run(`
      import java.util.ArrayList;
      import java.util.Collections;
      public class Test {
        public static void main(String[] args) {
          ArrayList<Integer> list = new ArrayList<>();
          list.add(3);
          list.add(1);
          list.add(4);
          list.add(1);
          list.add(5);
          Collections.sort(list);
          System.out.println(list);
        }
      }
    `)).toBe('[1, 1, 3, 4, 5]');
  });

  it('reverse', async () => {
    expect(await run(`
      import java.util.ArrayList;
      import java.util.Collections;
      public class Test {
        public static void main(String[] args) {
          ArrayList<String> list = new ArrayList<>();
          list.add("a");
          list.add("b");
          list.add("c");
          Collections.reverse(list);
          System.out.println(list);
        }
      }
    `)).toBe('[c, b, a]');
  });

  it('min and max', async () => {
    expect(await run(`
      import java.util.ArrayList;
      import java.util.Collections;
      public class Test {
        public static void main(String[] args) {
          ArrayList<Integer> list = new ArrayList<>();
          list.add(5);
          list.add(2);
          list.add(8);
          list.add(1);
          System.out.println(Collections.min(list));
          System.out.println(Collections.max(list));
        }
      }
    `)).toBe('1\n8');
  });

  it('frequency', async () => {
    expect(await run(`
      import java.util.ArrayList;
      import java.util.Collections;
      public class Test {
        public static void main(String[] args) {
          ArrayList<String> list = new ArrayList<>();
          list.add("a");
          list.add("b");
          list.add("a");
          list.add("c");
          list.add("a");
          System.out.println(Collections.frequency(list, "a"));
          System.out.println(Collections.frequency(list, "b"));
          System.out.println(Collections.frequency(list, "d"));
        }
      }
    `)).toBe('3\n1\n0');
  });
});
