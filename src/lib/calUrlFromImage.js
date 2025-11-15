// ---------- JSON schema for structured output ----------

const calendarEventJsonSchema = {
	type: "object",
	properties: {
		action: {
			type: "string",
			description: "Always 'TEMPLATE' for Google Calendar template URLs."
		},
		text: {
			type: "string",
			description: "Short event title (no emojis)."
		},
		dates: {
			type: "string",
			description:
				"Google Calendar 'dates' parameter. " +
				"Timed example: 20251231T193000Z/20251231T223000Z. " +
				"All-day example: 20251231/20260101 (end date is last day + 1)."
		},
		ctz: {
			type: "string",
			nullable: true,
			description: "IANA timezone name, e.g. 'America/New_York'."
		},
		details: {
			type: "string",
			nullable: true,
			description: "Longer description / notes for the event."
		},
		location: {
			type: "string",
			nullable: true,
			description: "Human-readable venue or address."
		},
		crm: {
			type: "string",
			nullable: true,
			enum: ["AVAILABLE", "BUSY", "BLOCKING"],
			description:
				"Calendar availability: AVAILABLE, BUSY, or BLOCKING (out of office)."
		},
		trp: {
			type: "boolean",
			nullable: true,
			description:
				"If true, show as busy; if false, show as available; null if not sure."
		},
		sprop: {
			type: "object",
			nullable: true,
			properties: {
				website: {
					type: "string",
					nullable: true,
					description: "Source website URL for the event."
				},
				name: {
					type: "string",
					nullable: true,
					description: "Source site or organizer name."
				}
			},
			required: []
		},
		add: {
			type: "array",
			items: { type: "string" },
			description: "List of guest email addresses."
		},
		src: {
			type: "string",
			nullable: true,
			description:
				"Email of the calendar to add this event to (if not default)."
		},
		recur: {
			type: "string",
			nullable: true,
			description: "RRULE string, e.g. 'RRULE:FREQ=DAILY'."
		},
		vcon: {
			type: "string",
			nullable: true,
			enum: ["meet"],
			description: "Set to 'meet' to include a Google Meet link."
		}
	},
	required: ["action", "text", "dates"]
};

// ---------- Core function: image → structured JSON → URL ----------

const GEMINI_API_URL =
	"https://generativelanguage.googleapis.com/v1beta/models" +
	"/gemini-2.5-flash:generateContent";

/**
 * Take an event image, extract calendar fields via Gemini structured output,
 * and build a Google Calendar template URL.
 *
 * @param {string} base64Image
 *   Base64-encoded image data (raw base64, not a data URL).
 * @param {string} apiKey
 *   Gemini API key.
 * @param {string} [mimeType='image/png']
 * @returns {Promise<{ event: any, url: string }>}
 */
export async function createCalendarUrlFromImage(
	base64Image,
	apiKey,
	mimeType = "image/png"
) {
	if (!apiKey) {
		throw new Error("Gemini API key is required");
	}

	if (base64Image.startsWith("data:")) {
		const commaIndex = base64Image.indexOf(",");
		if (commaIndex !== -1) {
			base64Image = base64Image.slice(commaIndex + 1);
		}
	}

	// Get current date in a readable format for the AI
	const today = new Date();
	const dateStr = today.toLocaleDateString('en-US', { 
		weekday: 'long', 
		year: 'numeric', 
		month: 'long', 
		day: 'numeric' 
	});

	const prompt = [
		"You are given an image containing a calendar event.",
		"Extract the event details and populate the JSON object defined by the",
		"responseSchema. Follow these rules:",
		"",
		`TODAY'S DATE: ${dateStr}`,
		"Use this date to resolve relative dates like 'this Friday', 'next week', etc.",
		"If no year or month are specified assume the event is upcoming relative to current data",
		"Do not hallucinate dates or details not present in the image.",
		"",
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
		"Return ONLY valid JSON that matches the response schema."
	].join("\n");

	const requestBody = {
		contents: [
			{
				role: "user",
				parts: [
					{
						inlineData: {
							mimeType,
							data: base64Image
						}
					},
					{ text: prompt }
				]
			}
		],
		generationConfig: {
			responseMimeType: "application/json",
			responseSchema: calendarEventJsonSchema
		}
	};

	const response = await fetch(
		`${GEMINI_API_URL}?key=${encodeURIComponent(apiKey)}`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify(requestBody)
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

	const event = JSON.parse(rawJson);

	// Light sanity check instead of full Zod validation
	if (
		!event ||
		typeof event !== "object" ||
		typeof event.text !== "string" ||
		typeof event.dates !== "string"
	) {
		throw new Error("Invalid event structure from Gemini");
	}

	const url = buildGoogleCalendarUrl(event);
	return { event, url };
}

// ---------- Helpers ----------

/**
 * Build the Google Calendar event creation URL from structured params.
 *
 * @param {any} event
 * @returns {string}
 */
export function buildGoogleCalendarUrl(event) {
	const baseUrl = "https://calendar.google.com/calendar/render";
	const query = new URLSearchParams();

	query.set("action", event.action || "TEMPLATE");
	query.set("text", event.text);
	query.set("dates", event.dates);

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

	if (Array.isArray(event.add) && event.add.length > 0) {
		query.set("add", event.add.join(","));
	}

	if (event.src) query.set("src", event.src);
	if (event.recur) query.set("recur", event.recur);
	if (event.vcon) query.set("vcon", event.vcon);

	return `${baseUrl}?${query.toString()}`;
}
