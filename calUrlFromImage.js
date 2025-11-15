import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

// ---------- Zod schema for structured output ----------

const calendarEventSchema = z.object({
	action: z
		.literal("TEMPLATE")
		.describe("Always 'TEMPLATE' for Google Calendar template URLs."),
	text: z.string().min(1).describe("Short event title (no emojis)."),
	dates: z
		.string()
		.min(1)
		.describe(
			"Google Calendar 'dates' parameter. " +
			"Timed example: 20251231T193000Z/20251231T223000Z. " +
			"All-day example: 20251231/20260101 (end date is last day + 1)."
		),
	ctz: z
		.string()
		.nullable()
		.optional()
		.describe("IANA timezone name, e.g. 'America/New_York'."),
	details: z
		.string()
		.nullable()
		.optional()
		.describe("Longer description / notes for the event."),
	location: z
		.string()
		.nullable()
		.optional()
		.describe("Human-readable venue or address."),
	crm: z
		.enum(["AVAILABLE", "BUSY", "BLOCKING"])
		.nullable()
		.optional()
		.describe(
			"Calendar availability: AVAILABLE, BUSY, or BLOCKING (out of office)."
		),
	trp: z
		.boolean()
		.nullable()
		.optional()
		.describe(
			"If true, show as busy; if false, show as available; null if not sure."
		),
	sprop: z
		.object({
			website: z
				.string()
				.nullable()
				.optional()
				.describe("Source website URL for the event."),
			name: z
				.string()
				.nullable()
				.optional()
				.describe("Source site or organizer name."),
		})
		.nullable()
		.optional()
		.describe("Event source properties."),
	add: z
		.array(z.string())
		.optional()
		.describe("List of guest email addresses."),
	src: z
		.string()
		.nullable()
		.optional()
		.describe("Email of the calendar to add this event to (if not default)."),
	recur: z
		.string()
		.nullable()
		.optional()
		.describe("RRULE string, e.g. 'RRULE:FREQ=DAILY'."),
	vcon: z
		.enum(["meet"])
		.nullable()
		.optional()
		.describe("Set to 'meet' to include a Google Meet link."),
});

const calendarEventJsonSchema = zodToJsonSchema(calendarEventSchema);

// ---------- Core function: image → structured JSON → URL ----------

const GEMINI_API_URL =
	"https://generativelanguage.googleapis.com/v1beta/models" +
	"/gemini-2.5-flash:generateContent";

/**
 * Take an event image, extract calendar fields via Gemini structured output,
 * and build a Google Calendar template URL.
 *
 * @param {string} base64Image
 *   Base64-encoded image data. Can be:
 *   - raw base64: "iVBORw0KGgoAAAANSUhEUg..."
 *   - or a data URL: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg..."
 * @param {string} apiKey
 *   Gemini API key (store securely in your extension, not in repo).
 * @param {string} [mimeType='image/png']
 * @returns {Promise<{ event: import("zod").infer<typeof calendarEventSchema>, url: string }>}
 */
export async function createCalendarUrlFromImage(
	base64Image,
	apiKey,
	mimeType = "image/png"
) {
	if (!apiKey) {
		throw new Error("Gemini API key is required");
	}

	// Support data URLs: "data:image/png;base64,AAAA..."
	if (base64Image.startsWith("data:")) {
		const commaIndex = base64Image.indexOf(",");
		if (commaIndex !== -1) {
			base64Image = base64Image.slice(commaIndex + 1);
		}
	}

	const prompt = [
		"You are given an image containing a calendar event.",
		"Extract the event details and populate the JSON object defined by the",
		"responseSchema. Follow these rules:",
		"- 'action': always 'TEMPLATE'.",
		"- 'text': short event title.",
		"- 'dates': use Google Calendar 'dates' format:",
		"  * For timed events, convert to UTC and use",
		"    'YYYYMMDDTHHmmSSZ/YYYYMMDDTHHmmSSZ'.",
		"  * For all-day events, use 'YYYYMMDD/YYYYMMDD' where the end date",
		"    is last-day + 1.",
		"- Prefer the timezone mentioned in the flyer for 'ctz'; otherwise guess",
		"  from the location city or omit.",
		"- If some optional fields aren't present, omit them or use null where",
		"  allowed.",
		"- 'add' should be a list of visible email addresses; otherwise [].",
		"Return ONLY valid JSON that matches the response schema.",
	].join("\n");

	const requestBody = {
		contents: [
			{
				role: "user",
				parts: [
					{
						inlineData: {
							mimeType,
							data: base64Image,
						},
					},
					{ text: prompt },
				],
			},
		],
		generationConfig: {
			// Structured output: tell Gemini to return pure JSON
			responseMimeType: "application/json",
			responseSchema: calendarEventJsonSchema,
		},
	};

	const response = await fetch(
		`${GEMINI_API_URL}?key=${encodeURIComponent(apiKey)}`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(requestBody),
		}
	);

	if (!response.ok) {
		const errorText = await response.text().catch(() => "");
		throw new Error(
			`Gemini API error: ${response.status} ${response.statusText} ${errorText || ""
			}`
		);
	}

	const data = await response.json();

	const rawJson =
		data?.candidates?.[0]?.content?.parts
			?.map((p) => p.text || "")
			.join("")
			.trim() || "";

	if (!rawJson) {
		throw new Error("Empty or missing text response from Gemini");
	}

	// Validate against Zod schema
	const parsed = JSON.parse(rawJson);
	const event = calendarEventSchema.parse(parsed);

	const url = buildGoogleCalendarUrl(event);
	return { event, url };
}

// ---------- Helpers ----------

/**
 * Build the Google Calendar event creation URL from structured params.
 *
 * @param {import("zod").infer<typeof calendarEventSchema>} event
 * @returns {string}
 */
export function buildGoogleCalendarUrl(event) {
	const baseUrl = "https://calendar.google.com/calendar/render";
	const query = new URLSearchParams();

	// Required
	query.set("action", event.action || "TEMPLATE");
	query.set("text", event.text);
	query.set("dates", event.dates);

	// Optional
	if (event.ctz) query.set("ctz", event.ctz);
	if (event.details) query.set("details", event.details);
	if (event.location) query.set("location", event.location);
	if (event.crm) query.set("crm", event.crm);

	if (typeof event.trp === "boolean") {
		query.set("trp", event.trp ? "true" : "false");
	}

	if (event.sprop) {
		if (event.sprop.website) {
			query.append("sprop", `website:${event.sprop.website}`);
		}
		if (event.sprop.name) {
			query.append("sprop", `name:${event.sprop.name}`);
		}
	}

	if (event.add && event.add.length > 0) {
		query.set("add", event.add.join(","));
	}

	if (event.src) query.set("src", event.src);
	if (event.recur) query.set("recur", event.recur);
	if (event.vcon) query.set("vcon", event.vcon);

	return `${baseUrl}?${query.toString()}`;
}
