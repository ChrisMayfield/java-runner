import { parseSnippet } from '../src/parser/snippet';
import { Interpreter, InterpreterIO } from '../src/interpreter/interpreter';
import { registerAll } from '../src/runtime/index';

export async function runJava(source: string, inputs: string[] = []): Promise<string> {
  const { ast } = parseSnippet(source);
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
  registerAll(interp, io);

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
