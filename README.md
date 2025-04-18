<div align="center">
  <br>
  <img src="assets/CAMBRIAN_DESIGN_4-52 (2).jpg">
  <br>
</div>

<h4 align="center">The SDK for Building AI AGENTS on <a href="https://www.sei.io/" target="_blank">SEI</a> Blockchain</h4>


<hr>

<h2 align="center">Coming Soon... Stay tuned on <a href="https://x.com/cambrian_ai">Twitter</a> for updates</h2>

## Features

### Symphony Integration

The SEI Agent Kit includes integration with Symphony, a DeFi aggregator for token swaps:

```typescript
import { swap } from 'sei-agent-kit';

// Example usage
const result = await swap(
  agent,           // SeiAgentKit instance
  "1.5",           // Amount to swap as a string
  "0x...",         // Token address to swap from
  "0x..."          // Token address to swap to
);
console.log(result); // Transaction hash
```

---
