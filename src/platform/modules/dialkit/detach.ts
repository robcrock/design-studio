// Removing DialKit: each view that uses it keeps its dials' values in its code as plain constants (README.md).
import { removeDials } from './node/source.ts';

export default (source: string) => removeDials(source);
