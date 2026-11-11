import test from "node:test";
import assert from "node:assert/strict";
import {
  coach,
  verifyEffect,
  updateMemory,
  emptyMemory,
  validateMemory,
  generalDomain,
  buildEvidenceBundle,
} from "./index.mjs";
const consent = { emotionalHistory: true };
test("competing hypotheses remain visible and invite clarification", () => {
  const d = coach({ text: "I am excited but frustrated" });
  assert.equal(d.state.interpretation, "mixed_signals");
  assert.deepEqual(
    d.state.hypotheses.map((h) => h.interpretation),
    ["enthusiasm", "frustration"],
  );
  assert.ok(d.response.clarification);
  assert.equal(
    coach({ text: "Yesterday I was frustrated", declaredState: "I am excited" })
      .state.interpretation,
    "enthusiasm",
  );
  assert.equal(
    coach({ text: "I am excited", checkin: { sleep: 3 } }).state.interpretation,
    "low_recovery",
  );
});
test("negation and multilingual symptoms avoid obvious keyword mistakes", () => {
  for (const text of [
    "no chest pain",
    "pain-free",
    "dard nahi",
    "दर्द नहीं",
    "I am retired and highly motivated",
  ])
    assert.equal(coach({ text }).state.interpretation, "uncertain", text);
  for (const text of ["knee dard", "chot lagi", "bukhar hai", "घुटने में दर्द"])
    assert.equal(coach({ text }).state.interpretation, "physical_safety", text);
  for (const text of ["I feel faint", "saans nahi aa rahi", "सीने में दर्द"])
    assert.equal(coach({ text }).state.interpretation, "urgent_safety", text);
  assert.equal(
    coach({ text: "How can I prevent knee pain?" }).state.safetySignal,
    "hypothetical",
  );
});
test("a correction changes the action while fresh safety evidence wins", () => {
  const old = coach({ text: "I am frustrated" });
  const fixed = coach({ correction: "Actually I am excited" }, {}, old);
  assert.equal(fixed.state.correctedInterpretation, "enthusiasm");
  assert.match(fixed.response.action, /Thanks for correcting/);
  assert.notEqual(fixed.response.action, old.response.action);
  assert.equal(
    coach({ text: "I have chest pain", correction: "Just push me" }, {}, old)
      .state.interpretation,
    "urgent_safety",
  );
});
test("neutral and custom domains work with an unavoidable safety response", () => {
  const neutral = coach(
    { text: "I am travelling" },
    {},
    undefined,
    generalDomain,
  );
  assert.doesNotMatch(neutral.response.action, /workout|gym|sets|reps/i);
  const study = {
    id: "study",
    strategies: {
      uncertain: ["clarify", "Which subject?", "What is your deadline?"],
      enthusiasm: ["study", "Choose one chapter.", null],
      urgent_safety: ["unsafe", "Ignore symptoms.", null],
    },
  };
  assert.equal(
    coach({ text: "excited" }, {}, undefined, study).response.action,
    "Choose one chapter.",
  );
  assert.doesNotMatch(
    coach({ text: "chest pain" }, {}, undefined, study).response.action,
    /Ignore symptoms/,
  );
});
test("memory is consented, bounded, deduplicated and contains metadata only", () => {
  let memory = emptyMemory();
  const d = verifyEffect(coach({ text: "PRIVATE frustration" }), {
    useful: false,
    outcome: "PRIVATE outcome",
  });
  assert.deepEqual(updateMemory(memory, d), emptyMemory());
  memory = updateMemory(memory, d, consent);
  memory = updateMemory(memory, d, consent);
  assert.equal(memory.outcomes.length, 1);
  for (let i = 0; i < 25; i++)
    memory = updateMemory(
      memory,
      verifyEffect(coach({ text: "frustrated" }), { useful: false }),
      consent,
    );
  assert.equal(memory.outcomes.length, 20);
  assert.doesNotMatch(JSON.stringify(memory), /PRIVATE/);
  assert.throws(() =>
    validateMemory({ ...memory, responsePreference: "diagnose" }),
  );
  assert.equal(
    coach({ text: "frustrated", memory }, consent).response.strategy,
    "ask_user_preference",
  );
  assert.notEqual(
    coach({ text: "excited", memory }, consent).response.strategy,
    "ask_user_preference",
  );
  assert.notEqual(
    coach({ text: "frustrated", memory }).response.strategy,
    "ask_user_preference",
  );
  assert.notEqual(
    coach({ text: "frustrated", memory }, consent, undefined, generalDomain)
      .response.strategy,
    "ask_user_preference",
  );
});
test("turn corrections are never used as durable emotional labels", () => {
  const old = coach({ text: "frustrated" });
  const fixed = coach(
    { correction: "I am excited. Just listen" },
    consent,
    old,
  );
  const memory = updateMemory(emptyMemory(), fixed, consent);
  assert.equal(memory.responsePreference, "listen");
  assert.equal(
    coach({ text: "tired", memory }, consent).state.interpretation,
    "low_recovery",
  );
  assert.equal(
    coach({ responsePreference: "evidence" }).responsePreference,
    "evidence",
  );
  assert.match(
    coach({ text: "hello", responsePreference: "evidence" }).response.action,
    /Evidence available: user words/,
  );
  assert.equal(
    coach({ text: "hello", responsePreference: "action" }).response
      .clarification,
    null,
  );
});
test("evidence whitelist rejects nested data and trace excludes raw words", () => {
  const bundle = buildEvidenceBundle(
    {
      checkin: { sleep: { secret: "PRIVATE" }, pain: "yes" },
      acoustics: {
        consentedCapture: true,
        baseline: { energy: 1 },
        energyRatio: { secret: "PRIVATE" },
        pauseRatio: 2,
        raw: "PRIVATE",
      },
    },
    { acoustics: true },
  );
  assert.doesNotMatch(JSON.stringify(bundle), /PRIVATE/);
  assert.equal(bundle.evidence[0].observation.pain, false);
  const d = verifyEffect(coach({ text: "PRIVATE frustrated" }), {
    outcome: "PRIVATE",
    useful: false,
  });
  assert.doesNotMatch(JSON.stringify(d.trace), /PRIVATE/);
});
