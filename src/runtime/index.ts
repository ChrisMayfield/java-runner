// Runtime barrel: registers all built-in classes on an interpreter

import { Interpreter, InterpreterIO } from '../interpreter/interpreter'
import { registerSystem } from './system'
import { registerScanner } from './scanner'
import { registerMath } from './math'
import { registerCollections } from './collections'
import { registerWrappers } from './wrappers'
import { registerArrays } from './arrays'
import { registerRandom } from './random'
import { registerFileIO } from './fileio'

export function registerAll(interp: Interpreter, io: InterpreterIO): void {
  registerSystem(interp, io)
  registerScanner(interp, io)
  registerMath(interp)
  registerCollections(interp)
  registerWrappers(interp)
  registerArrays(interp)
  registerRandom(interp)
  registerFileIO(interp)
}
