import test from "node:test";
import assert from "node:assert/strict";
import {
  coach,
  buildEvidenceBundle,
  consentAllows,
  ingestCorrection,
  verifyEffect,
  decisionTrace,
} from "./index.mjs";
import { scenarios } from "./scenarios.mjs";
for (const [name, input, expected] of scenarios)
  test(name, () => {
    const d = coach(input, { acoustics: true });
    assert.equal(d.state.interpretation, expected);
    assert.ok(d.response.action);
    assert.ok(
      d.trace.evidenceClasses.every((e) => e.source && e.evidenceClass),
    );
    if (expected === "urgent_safety")
      assert.equal(d.response.strategy, "urgent_support");
    if (expected === "physical_safety")
      assert.equal(d.response.strategy, "protect_recovery");
  });
test("at least 40 distinct evaluation scenarios", () =>
  assert.ok(scenarios.length >= 40));
test("acoustic input is dropped without explicit consent", () => {
  const input = {
    acoustics: {
      baseline: {},
      consentedCapture: true,
      energyRatio: 5,
      rawAudio: "PRIVATE",
    },
  };
  assert.equal(buildEvidenceBundle(input, {}).evidence.length, 0);
  assert.equal(consentAllows({ acoustics: "true" }, "acoustics"), false);
});
test("baseline and capture consent are required together", () => {
  assert.equal(
    buildEvidenceBundle({ acoustics: { energyRatio: 3 } }, { acoustics: true })
      .evidence.length,
    0,
  );
});
test("raw audio is never retained even with consent", () => {
  const d = coach(
    {
      acoustics: {
        baseline: { energy: 1 },
        consentedCapture: true,
        energyRatio: 2,
        paceRatio: { rawAudio: "PRIVATE" },
        rawAudio: "PRIVATE",
      },
    },
    { acoustics: true, emotionalHistory: true },
  );
  assert.ok(!JSON.stringify(d).includes("PRIVATE"));
});
test("correction changes immediate interpretation and strategy", () => {
  const d = coach({ text: "I am frustrated" });
  const corrected = coach(
    { text: "No, I was excited", correction: "I was excited" },
    {},
    d,
  );
  assert.equal(corrected.state.interpretation, "user_corrected");
  assert.equal(corrected.response.strategy, "accept_correction");
  assert.equal(corrected.correction, "I was excited");
  assert.throws(() => ingestCorrection(d, ""));
});
test("new pain cannot be overridden by a correction", () => {
  const d = coach({ text: "I am tired" });
  const corrected = coach(
    { text: "I have pain", correction: "No excuses" },
    {},
    d,
  );
  assert.equal(corrected.state.interpretation, "physical_safety");
});
test("feedback changes suggested strategy when unhelpful", () => {
  const d = verifyEffect(coach({ text: "I missed yesterday" }), {
    useful: false,
    outcome: "Prefer a concrete action",
  });
  assert.equal(d.followUp.nextStrategy, "ask_user_preference");
});
test("trace contains no raw text or acoustic data", () => {
  const d = coach({ text: "PERSONAL SECRET" });
  const trace = JSON.stringify(decisionTrace(d));
  assert.ok(!trace.includes("PERSONAL"));
  assert.equal(d.trace.retentionConsent, false);
});
test("domain evidence differs from a fixed train-today baseline", () => {
  const pain = coach({ text: "I have knee pain" }),
    travel = coach({ text: "I am in a hotel" });
  assert.notEqual(pain.response.strategy, travel.response.strategy);
  assert.match(pain.response.action, /Pause/);
  assert.match(travel.response.action, /bodyweight/);
});
test("prior correction is evidence, not a permanent interpretation", () => {
  const d = coach(
    { text: "I am excited", priorCorrection: "Previously frustrated" },
    { emotionalHistory: true },
  );
  assert.equal(d.state.interpretation, "enthusiasm");
  assert.ok(d.bundle.evidence.some((e) => e.source === "user_correction"));
});
test("unhelpful prior outcome adapts the next conversational turn", () => {
  const previous = verifyEffect(coach({ text: "I missed training" }), {
    useful: false,
  });
  const next = coach({ text: "Still stuck" }, {}, previous);
  assert.equal(next.response.strategy, "ask_user_preference");
});
test("audit trace redacts free-text follow-up outcomes", () => {
  const d = verifyEffect(coach({ text: "Hello" }), {
    useful: true,
    outcome: "PRIVATE health information",
  });
  assert.ok(!JSON.stringify(d.trace).includes("PRIVATE"));
});
