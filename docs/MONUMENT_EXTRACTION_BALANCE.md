# Monument Extraction initial balance report

Generated with the production domain engine on 2026-07-10:

```powershell
php tools/simulate-monument-extraction.php --runs=10000
```

This ran 10,000 games per policy (50,000 total), distributed across Scout, Enforcer, and Scavenger. The feature remains disabled pending operator review. No tested policy/loadout exceeded 100% RTP.

| Policy | Overall RTP | Failure | Avg turns | Avg payout | P95 payout | Max payout |
|---|---:|---:|---:|---:|---:|---:|
| Conservative | 67.14% | 21.13% | 13.04 | 671.39 RP | 1,936 RP | 3,631 RP |
| Balanced | 85.65% | 22.56% | 10.65 | 856.47 RP | 2,600 RP | 4,962 RP |
| Aggressive | 78.63% | 41.98% | 12.17 | 786.31 RP | 3,396 RP | 8,193 RP |
| Random legal | 41.00% | 48.91% | 11.12 | 409.97 RP | 2,029 RP | 8,193 RP |
| Heuristic | 85.79% | 22.19% | 10.62 | 857.90 RP | 2,616 RP | 5,374 RP |

## RTP by loadout

| Policy | Scout | Enforcer | Scavenger |
|---|---:|---:|---:|
| Conservative | 65.88% | 68.37% | 67.18% |
| Balanced | 82.43% | 90.07% | 84.43% |
| Aggressive | 72.12% | 77.90% | 85.88% |
| Random legal | 37.87% | 40.78% | 44.34% |
| Heuristic | 83.01% | 89.46% | 84.90% |

The strongest tested common policy/loadout was Balanced Enforcer at 90.07%, inside the specification's recommended 90-94% strong-strategy band and below the configured 92% initial target. The lower overall policies are intentional consequences of early cash-out, uncontrolled random decisions, and high-alert failure risk. Operators should treat this as the first candidate configuration and keep the feature disabled until they approve the distribution, not only the headline RTP.
