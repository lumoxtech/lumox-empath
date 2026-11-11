export const fitnessDomain = {
  id: "fitness",
  strategies: {
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
  },
};

export const generalDomain = {
  id: "general",
  strategies: {
    urgent_safety: [
      "urgent_support",
      "If these potentially urgent symptoms are current or severe, stop what you are doing and seek urgent medical help. Contact local emergency services when needed.",
      null,
    ],
    physical_safety: [
      "protect_recovery",
      "Pause the activity associated with pain or illness. Seek qualified medical advice for new, persistent or worsening symptoms.",
      "Is this a symptom you are experiencing now, or a general question?",
    ],
    low_recovery: [
      "reduce_demand",
      "Reduce today’s demands and make room for rest. Choose a small, comfortable next step rather than forcing the original workload.",
      "Would rest or a smaller commitment be more useful?",
    ],
    mixed_signals: [
      "confirm_meaning",
      "There is more than one possible reading of what you shared.",
      "How would you describe the situation in your own words?",
    ],
    enthusiasm: [
      "channel_energy",
      "Use that energy for one realistic next step, while keeping the scope sustainable.",
      null,
    ],
    frustration: [
      "investigate",
      "Let’s look at what happened before changing the approach.",
      "Is the obstacle the result, the process, or something outside the task?",
    ],
    travel: [
      "simplify_schedule",
      "Adapt the next commitment to where you are and the resources you have. Reschedule anything that cannot reasonably fit.",
      null,
    ],
    barrier: [
      "accountability",
      "Choose one achievable next step and a realistic time for it.",
      "What is the main obstacle: time, energy, clarity, or something else?",
    ],
    user_corrected: [
      "accept_correction",
      "Thanks for the correction. I’ll drop the earlier interpretation.",
      "What would help you move forward now?",
    ],
    uncertain: [
      "listen",
      "I can work from what you share and the evidence available.",
      "What would be most useful right now?",
    ],
  },
};
