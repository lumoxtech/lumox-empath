export const emptyMemory = () => ({
  version: 1,
  responsePreference: null,
  corrections: [],
  outcomes: [],
});
const states = new Set([
  "urgent_safety",
  "physical_safety",
  "low_recovery",
  "mixed_signals",
  "enthusiasm",
  "frustration",
  "travel",
  "barrier",
  "user_corrected",
  "uncertain",
]);
const slug = (value) => {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(value))
    throw Error("Invalid Empath memory identifier.");
  return value;
};
export function validateMemory(value) {
  if (value === undefined || value === null) return emptyMemory();
  if (
    value.version !== 1 ||
    !Array.isArray(value.corrections) ||
    !Array.isArray(value.outcomes) ||
    value.corrections.length > 20 ||
    value.outcomes.length > 20
  )
    throw Error("Unsupported Empath memory.");
  if (
    value.responsePreference !== null &&
    !["action", "evidence", "listen"].includes(value.responsePreference)
  )
    throw Error("Invalid response preference.");
  return {
    version: 1,
    responsePreference: value.responsePreference,
    corrections: value.corrections.map((c) => {
      if (
        !states.has(c.from) ||
        !states.has(c.to) ||
        !["turn", "communication"].includes(c.scope)
      )
        throw Error("Invalid correction memory.");
      return {
        decisionId: slug(c.decisionId),
        domain: slug(c.domain),
        from: c.from,
        to: c.to,
        scope: c.scope,
      };
    }),
    outcomes: value.outcomes.map((o) => {
      if (!states.has(o.context) || typeof o.useful !== "boolean")
        throw Error("Invalid outcome memory.");
      return {
        decisionId: slug(o.decisionId),
        domain: slug(o.domain),
        context: o.context,
        strategy: slug(o.strategy),
        useful: o.useful,
      };
    }),
  };
}
export function updateMemory(memory, decision, consent = {}) {
  if (consent.emotionalHistory !== true) return emptyMemory();
  const next = validateMemory(memory);
  if (decision.responsePreference)
    next.responsePreference = decision.responsePreference;
  if (decision.correction) {
    next.corrections = next.corrections.filter(
      (c) => c.decisionId !== decision.id,
    );
    next.corrections.push({
      decisionId: decision.id,
      domain: decision.domain,
      from: decision.supersedes || "uncertain",
      to:
        decision.state.correctedInterpretation || decision.state.interpretation,
      scope: decision.responsePreference ? "communication" : "turn",
    });
  }
  if (decision.followUp) {
    next.outcomes = next.outcomes.filter((o) => o.decisionId !== decision.id);
    next.outcomes.push({
      decisionId: decision.id,
      domain: decision.domain,
      context:
        decision.state.correctedInterpretation || decision.state.interpretation,
      strategy: decision.response.strategy,
      useful: decision.followUp.useful,
    });
  }
  next.corrections = next.corrections.slice(-20);
  next.outcomes = next.outcomes.slice(-20);
  return validateMemory(next);
}
