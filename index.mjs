// Deterministic, explainable support; signals are evidence, never an emotion diagnosis.
export const consentAllows = (consent, feature) => consent?.[feature] === true;
const clip = (s) => String(s ?? "").slice(0, 4000);
export function buildEvidenceBundle(input = {}, consent = {}) {
  const evidence = [];
  if (input.text)
    evidence.push({
      source: "user_words",
      evidenceClass: "self_reported",
      observation: clip(input.text),
    });
  if (input.declaredState)
    evidence.push({
      source: "declared_state",
      evidenceClass: "self_reported",
      observation: clip(input.declaredState),
    });
  if (input.checkin)
    evidence.push({
      source: "checkin",
      evidenceClass: "self_reported",
      observation: {
        energy: input.checkin.energy,
        sleep: input.checkin.sleep,
        soreness: input.checkin.soreness,
        pain: input.checkin.pain,
        motivation: input.checkin.motivation,
      },
    });
  if (input.context)
    evidence.push({
      source: "context",
      evidenceClass: "self_reported",
      observation: {
        travel: Boolean(input.context.travel),
        missed: Number(input.context.missed) || 0,
      },
    });
  if (consentAllows(consent, "emotionalHistory") && input.priorCorrection)
    evidence.push({
      source: "user_correction",
      evidenceClass: "self_reported",
      observation: clip(input.priorCorrection),
    });
  if (
    consentAllows(consent, "acoustics") &&
    Number.isFinite(input.acoustics?.baseline?.energy) &&
    input.acoustics.baseline.energy > 0 &&
    input.acoustics?.consentedCapture === true
  ) {
    const { paceRatio, pauseRatio, energyRatio } = input.acoustics;
    const ratios = Object.fromEntries(
      Object.entries({ paceRatio, pauseRatio, energyRatio }).filter(
        ([, v]) => Number.isFinite(v) && v >= 0,
      ),
    );
    evidence.push({
      source: "local_acoustics",
      evidenceClass: "measured",
      observation: ratios,
      limitation:
        "Relative to this user’s baseline; device and noise affect readings. No emotion inferred.",
    });
  }
  return {
    evidence,
    retentionConsent: consentAllows(consent, "emotionalHistory"),
  };
}
export function tentativeState(bundle, correction) {
  const words = bundle.evidence
    .filter((e) => ["user_words", "declared_state"].includes(e.source))
    .map((e) => e.observation)
    .join(" ")
    .toLowerCase();
  const c =
    bundle.evidence.find((e) => e.source === "checkin")?.observation || {};
  const ctx =
    bundle.evidence.find((e) => e.source === "context")?.observation || {};
  const redFlag =
    /chest pain|faint(?:ed|ing)?|cannot breathe|can.t breathe|severe breath|सीने में दर्द|बेहोश/.test(
      words,
    );
  const pain =
    c.pain === true ||
    /\b(pain|injur\w*|illness|fever|sharp ache)\b|दर्द|चोट|बुखार/.test(
      words.replace(/\b(no|without) pain\b/g, ""),
    );
  let interpretation = "uncertain";
  if (redFlag) interpretation = "urgent_safety";
  else if (pain) interpretation = "physical_safety";
  else if (correction) interpretation = "user_corrected";
  else if (
    (Number.isFinite(c.sleep) && c.sleep < 5) ||
    (Number.isFinite(c.energy) && c.energy <= 2) ||
    /exhaust|fatigue|tired|थक|thak|neend/.test(
      words.replace(/\bnot tired\b/g, ""),
    )
  )
    interpretation = "low_recovery";
  else if (
    /great.*(?:not|again)|yeah right|just perfect|fine.*(?:whatever|sure)|love.*(?:failing|missing)/.test(
      words,
    )
  )
    interpretation = "mixed_signals";
  else if (/excited|can.t wait|let.s go|pumped|खुश|maza|mazza/.test(words))
    interpretation = "enthusiasm";
  else if (
    /frustrat|useless|fed up|nothing works|गुस्सा|bekaar|bekar|kuch nahi/.test(
      words,
    )
  )
    interpretation = "frustration";
  else if (ctx.travel || /travel|hotel|airport|यात्रा|safar/.test(words))
    interpretation = "travel";
  else if (
    ctx.missed > 0 ||
    /missed|skip|distract|party|time nahi|mann nahi|man nahi|motivat/.test(
      words,
    )
  )
    interpretation = "barrier";
  return {
    interpretation,
    evidenceClass: "hypothesis",
    confidence: ["urgent_safety", "physical_safety"].includes(interpretation)
      ? "precautionary"
      : correction
        ? "user_confirmed"
        : "tentative",
    correction: correction ? clip(correction) : null,
  };
}
export function needsClarification(state) {
  return ["uncertain", "mixed_signals", "frustration", "barrier"].includes(
    state.interpretation,
  );
}
export function selectStrategy(state, style = "adaptive") {
  const choices = {
    urgent_safety: [
      "urgent_support",
      "Stop exercise. Seek urgent medical help now for these symptoms. Contact local emergency services if symptoms are current or severe.",
      null,
    ],
    physical_safety: [
      "protect_recovery",
      "Pause the painful movement. Avoid loading through pain; seek qualified medical advice for new, persistent or worsening symptoms.",
      "Which movement hurts, and is the pain new?",
    ],
    low_recovery: [
      "reduce_demand",
      "Make today a recovery session: easy walking or mobility if comfortable. Reassess sleep and energy before loading again.",
      "Would a short walk or complete rest fit today?",
    ],
    mixed_signals: [
      "confirm_meaning",
      "I may be reading that wrong. We can keep the next step small.",
      "Was that encouragement, frustration, or something else?",
    ],
    enthusiasm: [
      "channel_energy",
      "Use that energy for the planned session. Keep the warmup and leave a couple of reps in reserve.",
      null,
    ],
    frustration: [
      "investigate",
      "That sounds difficult. Let’s use your actual logs before changing the plan.",
      "Is the sticking point progress, the routine, or something outside training?",
    ],
    travel: [
      "simplify_schedule",
      "Use a short bodyweight session where you are, or reschedule the gym session. Keep the habit achievable.",
      null,
    ],
    barrier: [
      "accountability",
      "Choose one achievable next session and protect a time for it.",
      "What got in the way: time, energy, enjoyment, or something else?",
    ],
    user_corrected: [
      "accept_correction",
      "Thanks for correcting me. I’ll use your explanation and drop the earlier interpretation.",
      "What would be the most useful next step?",
    ],
    uncertain: [
      "listen",
      "We can work from what you tell me and what you’ve actually logged.",
      "What would help most today: a session, recovery, or talking through a barrier?",
    ],
  };
  const [strategy, action, clarification] =
    choices[state.interpretation] || choices.uncertain;
  return {
    strategy,
    action,
    clarification,
    style,
    styleNote:
      style === "strict"
        ? "Direct, never shaming."
        : style === "analytical"
          ? "Prioritise recorded evidence."
          : "Respect autonomy.",
  };
}
export function ingestCorrection(previous, text) {
  if (!String(text || "").trim())
    throw Error("A correction needs your explanation.");
  return {
    ...previous,
    state: tentativeState(previous.bundle, text),
    correction: clip(text),
    supersedes: previous.state.interpretation,
  };
}
export function decisionTrace(decision, consent = {}) {
  return {
    version: 1,
    evidenceClasses: decision.bundle.evidence.map((e) => ({
      source: e.source,
      evidenceClass: e.evidenceClass,
    })),
    interpretation: decision.state.interpretation,
    uncertainty: decision.state.confidence,
    strategy: decision.response.strategy,
    retentionConsent: consentAllows(consent, "emotionalHistory"),
    corrected: Boolean(decision.correction),
    followUp: decision.followUp
      ? {
          useful: decision.followUp.useful,
          nextStrategy: decision.followUp.nextStrategy,
        }
      : null,
  };
}
export function coach(input = {}, consent = {}, previous) {
  const bundle = buildEvidenceBundle(input, consent);
  let decision = { bundle, state: tentativeState(bundle) };
  if (previous && input.correction)
    decision = ingestCorrection({ ...previous, bundle }, input.correction);
  decision.response = selectStrategy(decision.state, input.style);
  if (
    previous?.followUp?.nextStrategy === "ask_user_preference" &&
    !["urgent_safety", "physical_safety"].includes(
      decision.state.interpretation,
    )
  ) {
    decision.response = {
      ...decision.response,
      strategy: "ask_user_preference",
      clarification:
        "Would one concrete action, a review of your logs, or space to explain help more?",
    };
  }
  decision.trace = decisionTrace(decision, consent);
  return decision;
}
export function verifyEffect(decision, result, consent = {}) {
  const response = {
    ...decision,
    followUp: {
      useful: result.useful === true,
      outcome: clip(result.outcome),
      nextStrategy:
        result.useful === true
          ? decision.response.strategy
          : "ask_user_preference",
    },
  };
  response.trace = decisionTrace(response, consent);
  return response;
}
