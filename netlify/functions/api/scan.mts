import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

/**
 * Fields pulled off a photographed label. The API is told to return exactly
 * this shape via structured outputs; the zod schema re-checks it defensively.
 */
const LABEL_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "species",
    "cut_name",
    "weight_kg",
    "price_per_kg",
    "fixed_price",
    "harvested_on",
    "packed_on",
    "best_before",
    "raw_text",
  ],
  properties: {
    species: {
      type: ["string", "null"],
      description: "Wildart, z. B. Reh, Rothirsch, Wildschwein",
    },
    cut_name: {
      type: ["string", "null"],
      description: "Teilstück, z. B. Rücken, Keule, Gulasch",
    },
    weight_kg: { type: ["number", "null"], description: "Gewicht in Kilogramm" },
    price_per_kg: { type: ["number", "null"], description: "Preis pro Kilogramm in Euro" },
    fixed_price: {
      type: ["number", "null"],
      description: "Gesamtpreis in Euro, falls kein Kilopreis angegeben ist",
    },
    harvested_on: { type: ["string", "null"], description: "Erlegungsdatum als JJJJ-MM-TT" },
    packed_on: { type: ["string", "null"], description: "Verpackungsdatum als JJJJ-MM-TT" },
    best_before: {
      type: ["string", "null"],
      description: "Mindesthaltbarkeitsdatum als JJJJ-MM-TT",
    },
    raw_text: { type: "string", description: "Der komplette lesbare Text des Etiketts" },
  },
} as const;

const labelSchema = z.object({
  species: z.string().nullable(),
  cut_name: z.string().nullable(),
  weight_kg: z.number().nullable(),
  price_per_kg: z.number().nullable(),
  fixed_price: z.number().nullable(),
  harvested_on: z.string().nullable(),
  packed_on: z.string().nullable(),
  best_before: z.string().nullable(),
  raw_text: z.string(),
});

export type LabelScan = z.infer<typeof labelSchema>;

const SYSTEM_PROMPT = `Du liest Etiketten von Wildbret-Verpackungen und überträgst die Angaben in strukturierte Felder.

Regeln:
- Gib nur wieder, was tatsächlich auf dem Bild steht. Rate nichts und ergänze nichts.
- Ist ein Feld nicht erkennbar, setze es auf null.
- Deutsche Zahlen verwenden das Komma als Dezimaltrennzeichen: "1,25 kg" ist 1.25.
- Datumsangaben wie "10.08.26" oder "10.08.2026" gibst du als "2026-08-10" zurück.
- Bei einem Preis pro Kilogramm füllst du price_per_kg, bei einem reinen Gesamtpreis fixed_price.
- In raw_text kommt der gesamte lesbare Text des Etiketts.`;

const SUPPORTED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type MediaType = (typeof SUPPORTED_MEDIA_TYPES)[number];

export const scanRequestSchema = z.object({
  image: z.string().min(1),
  media_type: z.enum(SUPPORTED_MEDIA_TYPES).default("image/jpeg"),
});

export function scanConfigError(): string | null {
  const key = Netlify.env.get("ANTHROPIC_API_KEY");
  return key && key.length > 0
    ? null
    : "Die Texterkennung ist nicht eingerichtet: Es fehlt der Schlüssel ANTHROPIC_API_KEY.";
}

export async function scanLabel(image: string, mediaType: MediaType): Promise<LabelScan | null> {
  const client = new Anthropic({ apiKey: Netlify.env.get("ANTHROPIC_API_KEY") });

  const response = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    // Reading a label is a plain extraction, so it does not need deep reasoning.
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: LABEL_JSON_SCHEMA as unknown as Record<string, unknown> },
    },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: image },
          },
          { type: "text", text: "Lies dieses Etikett aus." },
        ],
      },
    ],
  });

  if (response.stop_reason === "refusal") return null;

  const text = response.content.find((block) => block.type === "text");
  if (!text || text.type !== "text") return null;

  try {
    const parsed = labelSchema.safeParse(JSON.parse(text.text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
