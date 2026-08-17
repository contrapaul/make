/**
 * Entry point for `npm run checks`. Each phase file registers its checks on
 * import; report() prints them and sets a non-zero exit code on any failure.
 */
import './phase1';
import './phase2';
import { report } from './harness';

report();
