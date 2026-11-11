import { fitnessDomain, generalDomain } from "./domains.mjs";
import { emptyMemory, validateMemory, updateMemory } from "./memory.mjs";
export {
  fitnessDomain,
  generalDomain,
  emptyMemory,
  validateMemory,
  updateMemory,
};

// Rules support a decision, not a diagnosis; the host owns retention and hardware permissions.
export const consentAllows = (consent, feature) => consent?.[feature] === true;
const clip = (value) => String(value ?? "").slice(0, 4000);
const numeric = (value) => (Number.isFinite(value) ? value : undefined);
const preference = (text) =>
  /one (?:concrete )?(?:action|step)|just (?:one|tell me)|less questioning|fewer questions/.test(
    text,
  )
    ? "action"
    : /show (?:me )?(?:the )?(?:evidence|data|logs)|more analy/.test(text)
      ? "evidence"
      : /just listen|hear me out|space to explain/.test(text)
        ? "listen"
        : null;
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
        energy: numeric(input.checkin.energy),
        sleep: numeric(input.checkin.sleep),
        soreness: numeric(input.checkin.soreness),
        pain: input.checkin.pain === true,
        illness: input.checkin.illness === true,
        motivation: numeric(input.checkin.motivation),
      },
    });
  if (input.context)
    evidence.push({
      source: "context",
      evidenceClass: "self_reported",
      observation: {
        travel: input.context.travel === true,
        missed: Math.max(0, numeric(input.context.missed) || 0),
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
    input.acoustics.consentedCapture === true
  ) {
    const { paceRatio, pauseRatio, energyRatio } = input.acoustics;
    evidence.push({
      source: "local_acoustics",
      evidenceClass: "measured",
      observation: Object.fromEntries(
        Object.entries({ paceRatio, pauseRatio, energyRatio }).filter(
          ([, value]) => Number.isFinite(value) && value >= 0,
        ),
      ),
      limitation:
        "Relative to this user’s baseline; device and noise affect readings. No emotion inferred.",
    });
  }
  return {
    evidence,
    retentionConsent: consentAllows(consent, "emotionalHistory"),
  };
}
function normalise(text) {
  return text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\bpain[- ]free\b/g, "")
    .replace(
      /\b(?:no|without|not|do not have|don't have|not having)\s+(?:(?:any|new|chest|knee|back|shoulder|sharp)\s+){0,3}(?:pain|injur\w*|fever|tired|frustrat\w*|angry|excited|travell?ing)\b/g,
      "",
    )
    .replace(/\b(?:dard|bukhar|chot|thakaan|thaka)\s+(?:nahi|nahin)\b/g, "")
    .replace(/(?:दर्द|चोट|बुखार|थकान|गुस्सा|खुश)\s+नहीं/g, "");
}
function textSignals(text) {
  const words = normalise(text),
    signals = [];
  if (
    /chest pain|\bfaint(?:ed|ing)\b|\b(?:feel(?:ing)?|might|may|about to) faint\b|cannot breathe|can't breathe|severe breath|सीने में दर्द|बेहोश|सांस नहीं आ|seene? (?:mein|me) dard|saans nahi (?:aa|aati|le)/.test(
      words,
    )
  )
    signals.push("urgent_safety");
  if (
    /\b(?:pain|injur\w*|illness|fever|sharp ache|dard|chot|bukhar)\b|दर्द|चोट|बुखार/.test(
      words,
    )
  )
    signals.push("physical_safety");
  if (/\b(?:exhaust\w*|fatigu\w*|tired)\b|थक|thak|neend/.test(words))
    signals.push("low_recovery");
  if (
    /great.*(?:not|again)|yeah right|just perfect|fine.*(?:whatever|sure)|love.*(?:failing|missing)/.test(
      words,
    )
  )
    signals.push("mixed_signals");
  if (/excited|can't wait|let's go|pumped|खुश|maza|mazza/.test(words))
    signals.push("enthusiasm");
  if (
    /frustrat|angry|useless|fed up|nothing works|गुस्सा|bekaar|bekar|kuch nahi/.test(
      words,
    )
  )
    signals.push("frustration");
  if (/travel|hotel|airport|यात्रा|safar/.test(words)) signals.push("travel");
  if (
    /missed|skip|distract|party|time nahi|mann nahi|man nahi|unmotivated|low motivation|no motivation|lack of motivation|overwhelm|stressed|deadline/.test(
      words,
    )
  )
    signals.push("barrier");
  return signals;
}
const priority = [
  "urgent_safety",
  "physical_safety",
  "low_recovery",
  "mixed_signals",
  "enthusiasm",
  "frustration",
  "travel",
  "barrier",
];
export function tentativeState(bundle, correction) {
  const candidates = new Map(),
    contradictions = [];
  const add = (interpretation, source, certainty = "tentative") => {
    const candidate = candidates.get(interpretation) || {
      interpretation,
      evidenceClass: "hypothesis",
      sources: [],
      certainty,
    };
    if (!candidate.sources.includes(source)) candidate.sources.push(source);
    if (certainty === "self_reported") candidate.certainty = certainty;
    candidates.set(interpretation, candidate);
  };
  for (const e of bundle.evidence.filter((e) =>
    ["user_words", "declared_state"].includes(e.source),
  ))
    for (const interpretation of textSignals(e.observation))
      add(
        interpretation,
        e.source,
        e.source === "declared_state" ? "self_reported" : "tentative",
      );
  const c =
    bundle.evidence.find((e) => e.source === "checkin")?.observation || {};
  const context =
    bundle.evidence.find((e) => e.source === "context")?.observation || {};
  if (c.pain || c.illness) add("physical_safety", "checkin");
  if (
    (Number.isFinite(c.sleep) && c.sleep < 5) ||
    (Number.isFinite(c.energy) && c.energy <= 2) ||
    (Number.isFinite(c.soreness) && c.soreness >= 4)
  )
    add("low_recovery", "checkin");
  if (context.travel) add("travel", "context");
  if (context.missed > 0) add("barrier", "context");
  if (candidates.has("enthusiasm") && candidates.has("frustration"))
    contradictions.push("enthusiasm_and_frustration");
  if (candidates.has("enthusiasm") && candidates.has("low_recovery"))
    contradictions.push("enthusiasm_and_low_recovery");
  const declared = bundle.evidence.find((e) => e.source === "declared_state");
  const explicit = declared ? textSignals(declared.observation)[0] : null;
  let interpretation =
    priority.find((key) => candidates.has(key)) || "uncertain";
  const safety = ["urgent_safety", "physical_safety"].includes(interpretation);
  if (!safety && interpretation !== "low_recovery") {
    if (explicit) interpretation = explicit;
    else if (contradictions.includes("enthusiasm_and_frustration"))
      interpretation = "mixed_signals";
  }
  let correctedInterpretation = null;
  if (correction && !safety) {
    correctedInterpretation =
      priority.find((key) => textSignals(clip(correction)).includes(key)) ||
      "uncertain";
    interpretation = "user_corrected";
  }
  const words =
    bundle.evidence.find((e) => e.source === "user_words")?.observation || "";
  const hypothetical =
    !c.pain &&
    !c.illness &&
    /how (?:can|do) (?:i|you|we) (?:avoid|prevent)|what if|hypothetical|for example/i.test(
      words,
    );
  return {
    interpretation,
    evidenceClass: "hypothesis",
    confidence: safety
      ? "precautionary"
      : correction
        ? "user_confirmed"
        : explicit
          ? "self_reported"
          : "tentative",
    correction: correction ? clip(correction) : null,
    correctedInterpretation,
    hypotheses: [...candidates.values()],
    contradictions,
    safetySignal: safety ? (hypothetical ? "hypothetical" : "reported") : null,
  };
}
export function needsClarification(state) {
  return (
    [
      "uncertain",
      "mixed_signals",
      "frustration",
      "barrier",
      "physical_safety",
    ].includes(state.interpretation) || state.contradictions?.length > 0
  );
}
function domainFor(domain) {
  if (
    !domain ||
    typeof domain.id !== "string" ||
    !/^[a-z0-9_-]{1,60}$/.test(domain.id) ||
    !domain.strategies?.uncertain
  )
    throw Error("Provide a domain ID and an uncertain-response strategy.");
  return domain;
}
export function selectStrategy(
  state,
  style = "adaptive",
  domain = fitnessDomain,
) {
  domainFor(domain);
  const safety = ["urgent_safety", "physical_safety"].includes(
    state.interpretation,
  );
  const selected =
    state.interpretation === "user_corrected" &&
    state.correctedInterpretation !== "uncertain"
      ? state.correctedInterpretation
      : state.interpretation;
  const table =
    safety && domain.id !== "fitness"
      ? generalDomain.strategies
      : domain.strategies;
  const choice = table[selected] || domain.strategies.uncertain;
  if (
    !Array.isArray(choice) ||
    typeof choice[0] !== "string" ||
    typeof choice[1] !== "string" ||
    choice[1].length > 4000 ||
    (choice[2] !== null && typeof choice[2] !== "string")
  )
    throw Error("Invalid domain response strategy.");
  let [strategy, action, clarification] = choice;
  if (state.interpretation === "user_corrected") {
    strategy = "accept_correction";
    action =
      "Thanks for correcting me. I’ll drop the earlier interpretation. " +
      action;
  }
  if (
    state.contradictions?.includes("enthusiasm_and_low_recovery") &&
    !safety
  ) {
    action = "You reported enthusiasm alongside low recovery. " + action;
    clarification =
      "Would you prefer rest or a genuinely lighter commitment today?";
  }
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
  const bundle = {
    ...previous.bundle,
    evidence: [
      ...previous.bundle.evidence.filter(
        (e) => !["user_words", "declared_state"].includes(e.source),
      ),
      {
        source: "user_words",
        evidenceClass: "self_reported",
        observation: clip(text),
      },
    ],
  };
  return {
    ...previous,
    bundle,
    state: tentativeState(bundle, text),
    correction: clip(text),
    responsePreference: preference(normalise(clip(text))),
    supersedes:
      previous.state.correctedInterpretation || previous.state.interpretation,
  };
}
export function decisionTrace(decision, consent = {}) {
  return {
    version: 2,
    domain: decision.domain,
    evidenceClasses: decision.bundle.evidence.map((e) => ({
      source: e.source,
      evidenceClass: e.evidenceClass,
    })),
    interpretation: decision.state.interpretation,
    uncertainty: decision.state.confidence,
    hypotheses: decision.state.hypotheses.map((h) => ({
      interpretation: h.interpretation,
      sources: h.sources,
      certainty: h.certainty,
    })),
    contradictions: decision.state.contradictions,
    correctedInterpretation: decision.state.correctedInterpretation,
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
export function coach(
  input = {},
  consent = {},
  previous,
  domain = fitnessDomain,
) {
  domainFor(domain);
  const bundle = buildEvidenceBundle(input, consent);
  let decision = {
    id: crypto.randomUUID(),
    domain: domain.id,
    bundle,
    state: tentativeState(bundle),
  };
  if (previous && input.correction) {
    const currentState = decision.state;
    decision = ingestCorrection(
      { ...previous, id: decision.id, domain: domain.id, bundle },
      input.correction,
    );
    if (
      ["urgent_safety", "physical_safety"].includes(currentState.interpretation)
    ) {
      decision.state = currentState;
      decision.bundle = bundle;
    }
  }
  decision.response = selectStrategy(decision.state, input.style, domain);
  const memory = consentAllows(consent, "emotionalHistory")
    ? validateMemory(input.memory)
    : emptyMemory();
  const explicitPreference = ["action", "evidence", "listen"].includes(
    input.responsePreference,
  )
    ? input.responsePreference
    : null;
  const responsePreference =
    explicitPreference ||
    decision.responsePreference ||
    previous?.responsePreference ||
    memory.responsePreference ||
    (consentAllows(consent, "emotionalHistory")
      ? preference(normalise(clip(input.priorCorrection)))
      : null);
  decision.responsePreference = responsePreference;
  const safety = ["urgent_safety", "physical_safety"].includes(
    decision.state.interpretation,
  );
  const outcomes = memory.outcomes
    .filter(
      (o) =>
        o.domain === domain.id && o.context === decision.state.interpretation,
    )
    .slice(-2);
  if (
    !safety &&
    (previous?.followUp?.nextStrategy === "ask_user_preference" ||
      (outcomes.length === 2 && outcomes.every((o) => !o.useful))) &&
    !responsePreference
  ) {
    decision.response = {
      ...decision.response,
      strategy: "ask_user_preference",
      clarification:
        "Would one concrete action, a review of the evidence, or space to explain help more?",
    };
  }
  if (
    responsePreference === "action" &&
    !safety &&
    decision.state.interpretation !== "mixed_signals"
  )
    decision.response.clarification = null;
  if (responsePreference === "evidence" && !safety)
    decision.response = {
      ...decision.response,
      action:
        "Evidence available: " +
        (bundle.evidence.map((e) => e.source.replaceAll("_", " ")).join(", ") ||
          "no recorded input") +
        ". Interpretation: " +
        decision.state.interpretation.replaceAll("_", " ") +
        " (" +
        decision.state.confidence +
        "). " +
        decision.response.action,
    };
  if (responsePreference === "listen" && !safety)
    decision.response = {
      ...decision.response,
      strategy: "listen",
      action: "I’ll leave room for your explanation before suggesting a plan.",
      clarification: "What would you like me to understand?",
    };
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
