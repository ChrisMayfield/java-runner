// Math class runtime

import { Interpreter } from '../interpreter/interpreter';
import { JavaValue, makeDouble, makeInt, makeLong, makeFloat, toNumber } from '../interpreter/types';

export function registerMath(interp: Interpreter): void {
  const registry = interp.getRegistry();

  registry.register({
    name: 'Math',
    superClass: null,
    interfaces: [],
    fields: [],
    methods: [],
    constructors: [],
    modifiers: ['public', 'final'],
    isBuiltIn: true,
    innerClasses: [],
  });

  const s = (name: string, fn: (args: JavaValue[], line: number) => Promise<JavaValue>) => {
    registry.registerStaticMethod('Math', name, async (_obj, args, line) => fn(args, line));
  };

  // Constants
  s('PI', async () => makeDouble(Math.PI));
  s('E', async () => makeDouble(Math.E));

  // Register PI and E as static fields
  const globalEnv = interp.getGlobalEnv();
  globalEnv.define('Math.PI', makeDouble(Math.PI), true);
  globalEnv.define('Math.E', makeDouble(Math.E), true);

  // Trig
  s('sin', async (a) => makeDouble(Math.sin(toNumber(a[0]))));
  s('cos', async (a) => makeDouble(Math.cos(toNumber(a[0]))));
  s('tan', async (a) => makeDouble(Math.tan(toNumber(a[0]))));
  s('asin', async (a) => makeDouble(Math.asin(toNumber(a[0]))));
  s('acos', async (a) => makeDouble(Math.acos(toNumber(a[0]))));
  s('atan', async (a) => makeDouble(Math.atan(toNumber(a[0]))));
  s('atan2', async (a) => makeDouble(Math.atan2(toNumber(a[0]), toNumber(a[1]))));
  s('toRadians', async (a) => makeDouble(toNumber(a[0]) * Math.PI / 180));
  s('toDegrees', async (a) => makeDouble(toNumber(a[0]) * 180 / Math.PI));

  // Exponential / log
  s('exp', async (a) => makeDouble(Math.exp(toNumber(a[0]))));
  s('log', async (a) => makeDouble(Math.log(toNumber(a[0]))));
  s('log10', async (a) => makeDouble(Math.log10(toNumber(a[0]))));
  s('sqrt', async (a) => makeDouble(Math.sqrt(toNumber(a[0]))));
  s('cbrt', async (a) => makeDouble(Math.cbrt(toNumber(a[0]))));
  s('pow', async (a) => makeDouble(Math.pow(toNumber(a[0]), toNumber(a[1]))));

  // Rounding
  s('ceil', async (a) => makeDouble(Math.ceil(toNumber(a[0]))));
  s('floor', async (a) => makeDouble(Math.floor(toNumber(a[0]))));
  s('round', async (a) => {
    const n = toNumber(a[0]);
    // Java Math.round returns long for double, int for float
    return makeLong(Math.round(n));
  });
  s('rint', async (a) => makeDouble(Math.round(toNumber(a[0]))));

  // Abs, min, max
  s('abs', async (a) => {
    const v = a[0];
    const n = toNumber(v);
    if (v.type === 'int' || v.type === 'short' || v.type === 'byte') return makeInt(Math.abs(n));
    if (v.type === 'long') return makeLong(Math.abs(n));
    if (v.type === 'float') return makeFloat(Math.abs(n));
    return makeDouble(Math.abs(n));
  });

  s('max', async (a) => {
    const an = toNumber(a[0]), bn = toNumber(a[1]);
    const result = Math.max(an, bn);
    if (a[0].type === 'double' || a[1].type === 'double') return makeDouble(result);
    if (a[0].type === 'float' || a[1].type === 'float') return makeFloat(result);
    if (a[0].type === 'long' || a[1].type === 'long') return makeLong(result);
    return makeInt(result);
  });

  s('min', async (a) => {
    const an = toNumber(a[0]), bn = toNumber(a[1]);
    const result = Math.min(an, bn);
    if (a[0].type === 'double' || a[1].type === 'double') return makeDouble(result);
    if (a[0].type === 'float' || a[1].type === 'float') return makeFloat(result);
    if (a[0].type === 'long' || a[1].type === 'long') return makeLong(result);
    return makeInt(result);
  });

  // Random
  s('random', async () => makeDouble(Math.random()));

  // Sign
  s('signum', async (a) => makeDouble(Math.sign(toNumber(a[0]))));

  // Misc
  s('hypot', async (a) => makeDouble(Math.hypot(toNumber(a[0]), toNumber(a[1]))));
  s('floorMod', async (a) => {
    const x = toNumber(a[0]) | 0, y = toNumber(a[1]) | 0;
    return makeInt(((x % y) + y) % y);
  });
  s('floorDiv', async (a) => {
    const x = toNumber(a[0]) | 0, y = toNumber(a[1]) | 0;
    return makeInt(Math.floor(x / y));
  });
  s('addExact', async (a) => makeInt(toNumber(a[0]) + toNumber(a[1])));
  s('subtractExact', async (a) => makeInt(toNumber(a[0]) - toNumber(a[1])));
  s('multiplyExact', async (a) => makeInt(toNumber(a[0]) * toNumber(a[1])));
}
