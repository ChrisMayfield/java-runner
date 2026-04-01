// Random class runtime

import { Interpreter } from '../interpreter/interpreter';
import {
  JavaValue, makeInt, makeDouble, makeBool, makeObject, toNumber
} from '../interpreter/types';

export function registerRandom(interp: Interpreter): void {
  const reg = interp.getRegistry();

  reg.register({
    name: 'Random',
    superClass: 'Object',
    interfaces: [],
    fields: [],
    methods: [],
    constructors: [],
    modifiers: ['public'],
    isBuiltIn: true,
    innerClasses: [],
  });

  reg.registerConstructor('Random', async (_obj, _args, _line) => {
    return makeObject('Random', new Map());
  });

  reg.registerMethod('Random', 'nextInt', async (_obj, args, _line) => {
    if (args.length > 0) {
      const bound = toNumber(args[0]);
      return makeInt(Math.floor(Math.random() * bound));
    }
    return makeInt(Math.floor(Math.random() * 4294967296) - 2147483648);
  });

  reg.registerMethod('Random', 'nextDouble', async (_obj, _args, _line) => {
    return makeDouble(Math.random());
  });

  reg.registerMethod('Random', 'nextFloat', async (_obj, _args, _line) => {
    return makeDouble(Math.random());
  });

  reg.registerMethod('Random', 'nextBoolean', async (_obj, _args, _line) => {
    return makeBool(Math.random() < 0.5);
  });

  reg.registerMethod('Random', 'nextLong', async (_obj, _args, _line) => {
    return makeInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
  });

  reg.registerMethod('Random', 'nextGaussian', async (_obj, _args, _line) => {
    // Box-Muller transform
    const u1 = Math.random();
    const u2 = Math.random();
    return makeDouble(Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2));
  });
}
