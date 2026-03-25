# threshold-tuner Summary

Target profile: `standard`
Input alerts: 1200
Rules analysed: 7
Rules flagged for raise: 0
Overall conversion: 16.42%

## Backtest

| Scenario | Reviewed | Workload Reduction | Precision Proxy | Recall Proxy | Avg Days |
|---|---:|---:|---:|---:|---:|
| Baseline | 852 | 0% | 19.37% | 83.76% | 4.5 |
| Balanced Raise (+3) | 774 | 9.15% | 20.28% | 79.7% | 4.45 |
| Precision Raise (+8) | 626 | 26.53% | 22.2% | 70.56% | 4.26 |
| Coverage Lower (-5) | 960 | -12.68% | 18.85% | 91.88% | 4.6 |

## Drift Check

- Conversion delta: 1.5 pct points
- Reviewed volume delta: 0%
- Average score shift: 0.85