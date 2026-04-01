import { parse } from '../src/parser/index';
import { Interpreter, InterpreterIO } from '../src/interpreter/interpreter';
import { registerSystem } from '../src/runtime/system';
import { registerScanner } from '../src/runtime/scanner';
import { registerMath } from '../src/runtime/math';
import { registerCollections } from '../src/runtime/collections';
import { registerWrappers } from '../src/runtime/wrappers';
import { registerArrays } from '../src/runtime/arrays';
import { registerRandom } from '../src/runtime/random';
import { registerFileIO } from '../src/runtime/fileio';

export async function runJava(source: string, inputs: string[] = []): Promise<string> {
  const ast = parse(source);
  let output = '';
  let inputIdx = 0;

  const io: InterpreterIO = {
    print: (text) => { output += text; },
    println: (text) => { output += text + '\n'; },
    requestInput: async () => {
      if (inputIdx < inputs.length) return inputs[inputIdx++];
      return '';
    },
  };

  const interp = new Interpreter(io);
  registerSystem(interp, io);
  registerScanner(interp, io);
  registerMath(interp);
  registerCollections(interp);
  registerWrappers(interp);
  registerArrays(interp);
  registerRandom(interp);
  registerFileIO(interp);

  await interp.run(ast);
  return output;
}

/** Run and return trimmed output */
export async function run(source: string, inputs?: string[]): Promise<string> {
  return (await runJava(source, inputs)).trim();
}

/** Assert that running the source throws (parse or runtime error) */
export async function runExpectError(source: string, inputs?: string[]): Promise<string> {
  try {
    await runJava(source, inputs);
    throw new Error('Expected an error but none was thrown');
  } catch (e: any) {
    return e.message || String(e);
  }
}
