import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Sonnet for persuasion quality on short copy; swap to claude-haiku-4-5 to cut cost.
const MODEL = "claude-sonnet-4-6";

export interface DraftContext {
  centreName: string;
  studentName: string;
  parentName?: string | null;
  subject?: string | null;
  lastAttended?: string | null; // human-readable, e.g. "May 2026"
  language?: "ms" | "en" | "mix";
}

const SYSTEM = `You write short, warm WhatsApp re-enrolment messages that a Malaysian tuition centre owner sends to a parent whose child has stopped attending.

Hard rules:
- Keep it under 45 words. WhatsApp, not email.
- Default to natural Malaysian Malay/English mix unless told otherwise.
- Warm and personal, like a teacher who genuinely noticed the child is gone — never salesy, never a mass-blast tone, never desperate.
- Mention the child by name and the subject if given. Reference that you noticed they haven't been around.
- One gentle, low-pressure call to action (offer to keep a slot / ask if they'd like to continue). Never pushy, no fake urgency, no discounts unless asked.
- No emoji spam (at most one, usually none). No ALL CAPS. No links.
- Output ONLY the message text. No preamble, no quotes, no options.`;

/** Generate a single personalised winback message. Returns plain text. */
export async function draftWinbackMessage(ctx: DraftContext): Promise<string> {
  const lang =
    ctx.language === "ms"
      ? "Write in Malay."
      : ctx.language === "en"
        ? "Write in English."
        : "Write in natural Malay/English mix.";

  const details = [
    `Centre: ${ctx.centreName}`,
    `Student: ${ctx.studentName}`,
    ctx.parentName ? `Parent: ${ctx.parentName}` : null,
    ctx.subject ? `Subject: ${ctx.subject}` : null,
    ctx.lastAttended ? `Last attended: ${ctx.lastAttended}` : null,
    lang,
  ]
    .filter(Boolean)
    .join("\n");

  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 300,
    system: SYSTEM,
    messages: [{ role: "user", content: details }],
  });

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  if (!text) throw new Error("AI returned an empty message");
  return text;
}
