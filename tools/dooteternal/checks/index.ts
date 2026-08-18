/**
 * Entry point for `npm run checks`. Each phase file registers its checks on
 * import; report() prints them and sets a non-zero exit code on any failure.
 */
import './levels';
import './phase1';
import './phase2';
import './phase3';
import './phase4';
import './phase5';
import './phase6';
import './images';
import { report } from './harness';

report();
