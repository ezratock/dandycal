import { createCalendarUrlFromImage } from "./lib/cal-url-from-image.js";

const imagePath = process.argv[2];

if (!imagePath) {
	console.error("Usage: npm start -- <image-path>");
	process.exit(1);
}

createCalendarUrlFromImage(imagePath)
	.then(({ event, url }) => {
		console.log("Structured event JSON:");
		console.log(JSON.stringify(event, null, 2));
		console.log("\nGoogle Calendar URL:");
		console.log(url);
	})
	.catch((err) => {
		console.error("Error:", err);
		process.exit(1);
	});
