# Lumox Empath

A dependency-free, deterministic emotional-context engine. It separates self-report from hypotheses, chooses a coaching strategy, accepts corrections, and exposes a redacted decision trace. Fitness is its first adapter. It is not a clinical or emotion-recognition model.

```js
import {coach, verifyEffect} from './index.mjs';
const consent={emotionalHistory:false,acoustics:false};
const decision=coach({text:'I missed training because I am travelling',style:'supportive'},consent);
console.log(decision.response); // contextual action and optional clarification
const corrected=coach({text:'I meant a work schedule issue',correction:'I am not travelling'},consent,decision);
const outcome=verifyEffect(corrected,{useful:false,outcome:'Need a specific next step'},consent);
```

API:

| Function | Contract |
| --- | --- |
| `buildEvidenceBundle(input, consent)` | Whitelist text, self-reported check-in/context, and opt-in baseline-relative acoustic indicators. Drop raw audio and facial data. |
| `tentativeState(bundle, correction?)` | Precautionary safety handling or tentative interpretation. Does not infer emotion from acoustic volume. |
| `needsClarification(state)` | Whether ambiguity/barrier interpretation needs confirmation. |
| `selectStrategy(state, style)` | Strategy, action, clarification and style note. |
| `ingestCorrection(previous, text)` | Replace the interpretation; retain the superseded label for the current decision only. Safety evidence takes precedence. |
| `coach(input, consent, previous?)` | Complete decision including bundle, state, response and redacted trace. Prior unhelpful feedback asks for preferred approach. |
| `verifyEffect(decision, {useful, outcome}, consent)` | Record current follow-up and propose retaining/changing the strategy. |
| `decisionTrace(decision, consent)` | Source/classes, uncertainty, strategy, correction flag and follow-up. Free-text follow-up is excluded from the trace. |
| `consentAllows(consent, feature)` | Only the boolean `true` grants consent. |

Acoustics require `consent.acoustics === true`, `input.acoustics.consentedCapture === true` and a user baseline. Supported indicators: `energyRatio`, `paceRatio`, `pauseRatio`; extraction is the host’s responsibility. The Coach app measures relative energy and quiet-frame share locally, not speech pace or emotions. No audio is recorded. Never transmit model requests, save sensitive bundles, or enable hardware solely because this package returns a decision. `retentionConsent` is metadata; **hosts must implement retention enforcement**.

Evaluate with `npm test`: 46 varied scenarios plus correction, feedback, privacy and safety regressions. Cases cover Hindi/Hinglish, sarcasm, ambiguous and contradictory signals, pain, travel, fatigue, silence, baseline variation and communication styles. This is a small hand-authored regression set, not a validated psychometric benchmark.

Compared with a fixed “train today” baseline, contextual examples distinguish recovery/pain from motivation and adapt hotel/travel constraints. Tests verify those observable distinctions; no measured user-outcome improvement or statistical effectiveness is claimed.

MIT licensed. Future managed memory, enterprise configuration, integrations and developer analytics are ideas, not implemented commercial services. Any future paid service needs separate privacy, provider-eligibility and licence review.
