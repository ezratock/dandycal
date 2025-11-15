// calendar-from-image.js
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

// ---------- Gemini client ----------

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
	throw new Error(
		"GEMINI_API_KEY is not set. Add it to your environment or .env file."
	);
}

const ai = new GoogleGenAI({ apiKey });

// ---------- Zod schema for structured output ----------

const calendarEventSchema = z.object({
	action: z
		.literal("TEMPLATE")
		.describe("Always 'TEMPLATE' for Google Calendar template URLs."),
	text: z
		.string()
		.min(1)
		.describe("Short event title (no emojis)."),
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

/**
 * Take an event image, extract calendar fields via Gemini structured output,
 * and build a Google Calendar template URL.
 *
 * @param {string} imagePath
 * @returns {Promise<{ event: z.infer<typeof calendarEventSchema>, url: string }>}
 */
export async function createCalendarUrlFromImage(imagePath) {
	const absPath = path.resolve(imagePath);
	const imageBytes = await fs.readFile(absPath);
	const base64Image = imageBytes.toString("base64");
	const mimeType = guessMimeTypeFromPath(absPath);

	const prompt = [
		"You are given an image containing a calendar event.",
		"Extract the event details and populate the JSON object defined by the",
		"responseJsonSchema. Follow these rules:",
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
	].join("\n");

	const response = await ai.models.generateContent({
		model: "gemini-2.5-flash",
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
		config: {
			responseMimeType: "application/json",
			responseJsonSchema: calendarEventJsonSchema,
		},
	});

	// Gemini returns a JSON string that already conforms to the schema.
	const rawJson = response.text;
	const event = calendarEventSchema.parse(JSON.parse(rawJson));

	const url = buildGoogleCalendarUrl(event);
	return { event, url };
}

// ---------- Helpers ----------

function guessMimeTypeFromPath(filePath) {
	const ext = path.extname(filePath).toLowerCase();
	if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
	if (ext === ".png") return "image/png";
	if (ext === ".webp") return "image/webp";
	return "image/png";
}

/**
 * Build the Google Calendar event creation URL from structured params.
 *
 * @param {z.infer<typeof calendarEventSchema>} event
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

// ---------- Simple CLI usage ----------
//
//   node calendar-from-image.js path/to/event-flyer.png
//

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const imageArg = process.argv[2];
	if (!imageArg) {
		console.error("Usage: node calendar-from-image.js <image-path>");
		process.exit(1);
	}

	createCalendarUrlFromImage(imageArg)
		.then(({ event, url }) => {
			console.log("Structured event JSON from Gemini:");
			console.log(JSON.stringify(event, null, 2));
			console.log("\nGoogle Calendar URL:");
			console.log(url);
		})
		.catch((err) => {
			console.error("Error:", err.message);
			process.exit(1);
		});
}
