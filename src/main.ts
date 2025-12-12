import { ArbitrageEngine } from './arb';
import { ValrStream } from './valrStream';

const stream = new ValrStream();
const arbEngine = new ArbitrageEngine(stream);

// Poll every 2 seconds to check prices
setInterval(() => {
  arbEngine.checkCycle();
}, 2000);
