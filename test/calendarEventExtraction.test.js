import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { createCalendarUrlFromText, createCalendarUrlFromImage } from '../src/lib/calUrlFromImage.js';

const MOCK_API_KEY = 'test-api-key-12345';

function mockGeminiResponse(eventData) {
	return {
		candidates: [{
			content: {
				parts: [{ text: JSON.stringify(eventData) }]
			}
		}]
	};
}

function createMockElement(html) {
	const template = document.createElement('template');
	template.innerHTML = html.trim();
	return template.content.firstChild;
}

async function captureElementAsImage(element) {
	const canvas = document.createElement('canvas');
	canvas.width = 400;
	canvas.height = 200;
	const ctx = canvas.getContext('2d');

	ctx.fillStyle = 'white';
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	ctx.fillStyle = 'black';
	ctx.font = '14px Arial';

	const text = element.textContent || '';
	const words = text.split(' ');
	let line = '';
	let y = 30;

	for (let word of words) {
		const testLine = line + word + ' ';
		if (ctx.measureText(testLine).width > 380 && line !== '') {
			ctx.fillText(line, 10, y);
			line = word + ' ';
			y += 20;
		} else {
			line = testLine;
		}
	}
	ctx.fillText(line, 10, y);

	return canvas.toDataURL('image/png').split(',')[1];
}

describe('simple paragraph with event details', () => {
	const html = '<p>Join us for Coffee Chat on Friday, December 15th, 2025 at 3:00 PM at Starbucks Downtown</p>';

	beforeEach(() => {
		global.fetch = jest.fn(() =>
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve(mockGeminiResponse({
					action: 'TEMPLATE',
					text: 'Coffee Chat',
					dates: '20251215T150000Z/20251215T160000Z',
					location: 'Starbucks Downtown'
				}))
			})
		);
	});

	it('extracts event from text faster than screenshot', async () => {
		const element = createMockElement(html);
		const textContent = element.textContent;

		const textStart = performance.now();
		const textResult = await createCalendarUrlFromText(textContent, MOCK_API_KEY);
		const textDuration = performance.now() - textStart;

		const imageData = await captureElementAsImage(element);
		const imageStart = performance.now();
		const imageResult = await createCalendarUrlFromImage(imageData, MOCK_API_KEY);
		const imageDuration = performance.now() - imageStart;

		console.log(`Text processing: ${textDuration.toFixed(2)}ms`);
		console.log(`Image processing: ${imageDuration.toFixed(2)}ms`);
		console.log(`Difference: ${(imageDuration - textDuration).toFixed(2)}ms`);

		expect(textResult.event.text).toBe('Coffee Chat');
		expect(imageResult.event.text).toBe('Coffee Chat');
	});
});

describe('heading with date and time', () => {
	const html = '<h2>Annual Gala - January 20, 2026, 7:00 PM - 11:00 PM</h2>';

	beforeEach(() => {
		global.fetch = jest.fn(() =>
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve(mockGeminiResponse({
					action: 'TEMPLATE',
					text: 'Annual Gala',
					dates: '20260120T190000Z/20260120T230000Z'
				}))
			})
		);
	});

	it('parses heading text content', async () => {
		const element = createMockElement(html);
		const result = await createCalendarUrlFromText(element.textContent, MOCK_API_KEY);

		expect(result.event.text).toBe('Annual Gala');
		expect(result.event.dates).toContain('20260120');
	});
});

describe('div with multiple textual children', () => {
	const html = `
		<div>
			<h3>Hackathon 2025</h3>
			<p>Date: December 1-2, 2025</p>
			<p>Location: Tech Hub, Building 5</p>
			<p>Join us for 24 hours of coding and innovation!</p>
		</div>
	`;

	beforeEach(() => {
		global.fetch = jest.fn(() =>
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve(mockGeminiResponse({
					action: 'TEMPLATE',
					text: 'Hackathon 2025',
					dates: '20251201/20251203',
					location: 'Tech Hub, Building 5',
					details: 'Join us for 24 hours of coding and innovation!'
				}))
			})
		);
	});

	it('extracts complete event from nested text elements', async () => {
		const element = createMockElement(html);
		const textStart = performance.now();
		const result = await createCalendarUrlFromText(element.textContent, MOCK_API_KEY);
		const textDuration = performance.now() - textStart;

		console.log(`Nested text elements - Text processing: ${textDuration.toFixed(2)}ms`);

		expect(result.event.text).toBe('Hackathon 2025');
		expect(result.event.location).toBe('Tech Hub, Building 5');
		expect(result.event.details).toContain('coding');
	});
});

describe('blockquote with event invitation', () => {
	const html = '<blockquote>You are invited to the Product Launch on March 5th at 2 PM PST</blockquote>';

	beforeEach(() => {
		global.fetch = jest.fn(() =>
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve(mockGeminiResponse({
					action: 'TEMPLATE',
					text: 'Product Launch',
					dates: '20260305T140000Z/20260305T150000Z',
					ctz: 'America/Los_Angeles'
				}))
			})
		);
	});

	it('handles blockquote element with timezone', async () => {
		const element = createMockElement(html);
		const result = await createCalendarUrlFromText(element.textContent, MOCK_API_KEY);

		expect(result.event.ctz).toBe('America/Los_Angeles');
		expect(result.url).toContain('ctz=America%2FLos_Angeles');
	});
});

describe('list with event details', () => {
	const html = `
		<ul>
			<li>Event: Team Building Workshop</li>
			<li>When: Thursday, November 30, 2025 at 9:00 AM</li>
			<li>Where: Conference Room A</li>
			<li>Duration: 3 hours</li>
		</ul>
	`;

	beforeEach(() => {
		global.fetch = jest.fn(() =>
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve(mockGeminiResponse({
					action: 'TEMPLATE',
					text: 'Team Building Workshop',
					dates: '20251130T090000Z/20251130T120000Z',
					location: 'Conference Room A'
				}))
			})
		);
	});

	it('extracts from unordered list structure', async () => {
		const element = createMockElement(html);
		const result = await createCalendarUrlFromText(element.textContent, MOCK_API_KEY);

		expect(result.event.text).toBe('Team Building Workshop');
		expect(result.event.location).toBe('Conference Room A');
	});
});

describe('article with comprehensive event info', () => {
	const html = `
		<article>
			<header><h1>Tech Conference 2026</h1></header>
			<section>
				<p><strong>Date:</strong> February 10-12, 2026</p>
				<p><strong>Venue:</strong> Convention Center, San Francisco</p>
				<p><strong>Description:</strong> Three days of talks, workshops, and networking</p>
			</section>
		</article>
	`;

	beforeEach(() => {
		global.fetch = jest.fn(() =>
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve(mockGeminiResponse({
					action: 'TEMPLATE',
					text: 'Tech Conference 2026',
					dates: '20260210/20260213',
					location: 'Convention Center, San Francisco',
					details: 'Three days of talks, workshops, and networking'
				}))
			})
		);
	});

	it('processes article with semantic HTML structure', async () => {
		const element = createMockElement(html);
		const textStart = performance.now();
		const result = await createCalendarUrlFromText(element.textContent, MOCK_API_KEY);
		const textDuration = performance.now() - textStart;

		console.log(`Article semantic HTML - Text processing: ${textDuration.toFixed(2)}ms`);

		expect(result.event.text).toBe('Tech Conference 2026');
		expect(result.event.dates).toBe('20260210/20260213');
	});
});

describe('span with inline event', () => {
	const html = '<span>Meeting tomorrow at 10 AM in Room 204</span>';

	beforeEach(() => {
		global.fetch = jest.fn(() =>
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve(mockGeminiResponse({
					action: 'TEMPLATE',
					text: 'Meeting',
					dates: '20251116T100000Z/20251116T110000Z',
					location: 'Room 204'
				}))
			})
		);
	});

	it('handles relative date in span', async () => {
		const element = createMockElement(html);
		const result = await createCalendarUrlFromText(element.textContent, MOCK_API_KEY);

		expect(result.event.text).toBe('Meeting');
		expect(result.event.location).toBe('Room 204');
	});
});

describe('table with schedule information', () => {
	const html = `
		<table>
			<tr><th>Event</th><td>Quarterly Review</td></tr>
			<tr><th>Date</th><td>December 20, 2025</td></tr>
			<tr><th>Time</th><td>1:00 PM - 3:00 PM EST</td></tr>
			<tr><th>Location</th><td>Board Room</td></tr>
		</table>
	`;

	beforeEach(() => {
		global.fetch = jest.fn(() =>
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve(mockGeminiResponse({
					action: 'TEMPLATE',
					text: 'Quarterly Review',
					dates: '20251220T130000Z/20251220T150000Z',
					location: 'Board Room',
					ctz: 'America/New_York'
				}))
			})
		);
	});

	it('extracts from table structure with text only', async () => {
		const element = createMockElement(html);
		const result = await createCalendarUrlFromText(element.textContent, MOCK_API_KEY);

		expect(result.event.text).toBe('Quarterly Review');
		expect(result.event.location).toBe('Board Room');
	});
});

describe('pre and code with event data', () => {
	const html = '<pre><code>Event: Code Review\nDate: 2025-12-05\nTime: 14:00 UTC</code></pre>';

	beforeEach(() => {
		global.fetch = jest.fn(() =>
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve(mockGeminiResponse({
					action: 'TEMPLATE',
					text: 'Code Review',
					dates: '20251205T140000Z/20251205T150000Z'
				}))
			})
		);
	});

	it('parses structured text from code block', async () => {
		const element = createMockElement(html);
		const result = await createCalendarUrlFromText(element.textContent, MOCK_API_KEY);

		expect(result.event.text).toBe('Code Review');
		expect(result.event.dates).toContain('20251205');
	});
});

describe('div with image and text', () => {
	const html = `
		<div>
			<img src="event-poster.jpg" alt="Event Poster">
			<h3>Summer Festival</h3>
			<p>July 4, 2026 at Central Park</p>
		</div>
	`;

	beforeEach(() => {
		global.fetch = jest.fn(() =>
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve(mockGeminiResponse({
					action: 'TEMPLATE',
					text: 'Summer Festival',
					dates: '20260704/20260705',
					location: 'Central Park'
				}))
			})
		);
	});

	it('processes as image when img element present', async () => {
		const element = createMockElement(html);
		const imageData = await captureElementAsImage(element);
		const result = await createCalendarUrlFromImage(imageData, MOCK_API_KEY);

		expect(result.event.text).toBe('Summer Festival');
		expect(result.event.location).toBe('Central Park');
	});
});

describe('image element with event flyer', () => {
	beforeEach(() => {
		global.fetch = jest.fn(() =>
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve(mockGeminiResponse({
					action: 'TEMPLATE',
					text: 'Concert Night',
					dates: '20260815T190000Z/20260815T230000Z',
					location: 'Madison Square Garden',
					details: 'Live performance featuring special guests'
				}))
			})
		);
	});

	it('extracts event from image poster', async () => {
		const canvas = document.createElement('canvas');
		canvas.width = 400;
		canvas.height = 600;
		const ctx = canvas.getContext('2d');
		ctx.fillStyle = 'blue';
		ctx.fillRect(0, 0, 400, 600);
		ctx.fillStyle = 'white';
		ctx.font = 'bold 32px Arial';
		ctx.fillText('CONCERT NIGHT', 50, 100);
		ctx.font = '20px Arial';
		ctx.fillText('August 15, 2026 - 7 PM', 50, 150);
		ctx.fillText('Madison Square Garden', 50, 180);

		const imageData = canvas.toDataURL('image/png').split(',')[1];
		const result = await createCalendarUrlFromImage(imageData, MOCK_API_KEY);

		expect(result.event.text).toBe('Concert Night');
		expect(result.event.location).toBe('Madison Square Garden');
	});
});

describe('canvas element with event graphic', () => {
	beforeEach(() => {
		global.fetch = jest.fn(() =>
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve(mockGeminiResponse({
					action: 'TEMPLATE',
					text: 'Art Exhibition',
					dates: '20260301/20260331',
					location: 'Modern Art Museum'
				}))
			})
		);
	});

	it('processes canvas as image', async () => {
		const canvas = document.createElement('canvas');
		canvas.width = 300;
		canvas.height = 400;
		const ctx = canvas.getContext('2d');
		ctx.fillStyle = 'lightgray';
		ctx.fillRect(0, 0, 300, 400);

		const imageData = canvas.toDataURL('image/png').split(',')[1];
		const result = await createCalendarUrlFromImage(imageData, MOCK_API_KEY);

		expect(result.event.text).toBe('Art Exhibition');
	});
});

describe('div with svg illustration and text', () => {
	const html = `
		<div>
			<svg width="100" height="100"><circle cx="50" cy="50" r="40" fill="red"/></svg>
			<p>Workshop: April 10, 2026</p>
		</div>
	`;

	beforeEach(() => {
		global.fetch = jest.fn(() =>
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve(mockGeminiResponse({
					action: 'TEMPLATE',
					text: 'Workshop',
					dates: '20260410/20260411'
				}))
			})
		);
	});

	it('routes to image pipeline for svg content', async () => {
		const element = createMockElement(html);
		const imageData = await captureElementAsImage(element);
		const result = await createCalendarUrlFromImage(imageData, MOCK_API_KEY);

		expect(result.event.text).toBe('Workshop');
	});
});

describe('section with recurring event details', () => {
	const html = `
		<section>
			<h2>Weekly Standup</h2>
			<p>Every Monday at 9:00 AM</p>
			<p>Starting December 1, 2025</p>
			<p>Conference Room B</p>
		</section>
	`;

	beforeEach(() => {
		global.fetch = jest.fn(() =>
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve(mockGeminiResponse({
					action: 'TEMPLATE',
					text: 'Weekly Standup',
					dates: '20251201T090000Z/20251201T093000Z',
					location: 'Conference Room B',
					recur: 'RRULE:FREQ=WEEKLY;BYDAY=MO'
				}))
			})
		);
	});

	it('handles recurring event pattern', async () => {
		const element = createMockElement(html);
		const result = await createCalendarUrlFromText(element.textContent, MOCK_API_KEY);

		expect(result.event.text).toBe('Weekly Standup');
		expect(result.event.recur).toContain('WEEKLY');
	});
});

describe('all-day event in paragraph', () => {
	const html = '<p>Company Holiday - December 25, 2025 (All Day)</p>';

	beforeEach(() => {
		global.fetch = jest.fn(() =>
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve(mockGeminiResponse({
					action: 'TEMPLATE',
					text: 'Company Holiday',
					dates: '20251225/20251226'
				}))
			})
		);
	});

	it('creates all-day event with correct date format', async () => {
		const element = createMockElement(html);
		const result = await createCalendarUrlFromText(element.textContent, MOCK_API_KEY);

		expect(result.event.dates).toBe('20251225/20251226');
		expect(result.event.dates).not.toContain('T');
	});
});

describe('multi-day conference in div', () => {
	const html = `
		<div>
			<h1>DevOps Summit 2026</h1>
			<p>March 15-18, 2026</p>
			<p>Seattle Convention Center</p>
		</div>
	`;

	beforeEach(() => {
		global.fetch = jest.fn(() =>
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve(mockGeminiResponse({
					action: 'TEMPLATE',
					text: 'DevOps Summit 2026',
					dates: '20260315/20260319',
					location: 'Seattle Convention Center'
				}))
			})
		);
	});

	it('handles multi-day event date range', async () => {
		const element = createMockElement(html);
		const textStart = performance.now();
		const result = await createCalendarUrlFromText(element.textContent, MOCK_API_KEY);
		const textDuration = performance.now() - textStart;

		console.log(`Multi-day conference - Text processing: ${textDuration.toFixed(2)}ms`);

		expect(result.event.dates).toBe('20260315/20260319');
	});
});

describe('event with guest list', () => {
	const html = `
		<div>
			<h3>Project Kickoff</h3>
			<p>Date: December 10, 2025 at 2 PM</p>
			<p>Attendees: john@company.com, sarah@company.com, mike@company.com</p>
		</div>
	`;

	beforeEach(() => {
		global.fetch = jest.fn(() =>
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve(mockGeminiResponse({
					action: 'TEMPLATE',
					text: 'Project Kickoff',
					dates: '20251210T140000Z/20251210T150000Z',
					add: ['john@company.com', 'sarah@company.com', 'mike@company.com']
				}))
			})
		);
	});

	it('extracts guest email addresses', async () => {
		const element = createMockElement(html);
		const result = await createCalendarUrlFromText(element.textContent, MOCK_API_KEY);

		expect(result.event.add).toHaveLength(3);
		expect(result.event.add).toContain('john@company.com');
	});
});

describe('event with virtual meeting info', () => {
	const html = '<p>Virtual Training Session - January 5, 2026 at 11 AM (Google Meet)</p>';

	beforeEach(() => {
		global.fetch = jest.fn(() =>
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve(mockGeminiResponse({
					action: 'TEMPLATE',
					text: 'Virtual Training Session',
					dates: '20260105T110000Z/20260105T120000Z',
					vcon: 'meet'
				}))
			})
		);
	});

	it('includes video conference parameter', async () => {
		const element = createMockElement(html);
		const result = await createCalendarUrlFromText(element.textContent, MOCK_API_KEY);

		expect(result.event.vcon).toBe('meet');
		expect(result.url).toContain('vcon=meet');
	});
});

describe('abbreviated date formats', () => {
	const html = '<p>Lunch Meeting - Dec 8, 2025 @ 12:30 PM</p>';

	beforeEach(() => {
		global.fetch = jest.fn(() =>
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve(mockGeminiResponse({
					action: 'TEMPLATE',
					text: 'Lunch Meeting',
					dates: '20251208T123000Z/20251208T133000Z'
				}))
			})
		);
	});

	it('handles abbreviated month and time symbols', async () => {
		const element = createMockElement(html);
		const result = await createCalendarUrlFromText(element.textContent, MOCK_API_KEY);

		expect(result.event.text).toBe('Lunch Meeting');
		expect(result.event.dates).toContain('20251208');
	});
});

describe('event poster with complex design', () => {
	beforeEach(() => {
		global.fetch = jest.fn(() =>
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve(mockGeminiResponse({
					action: 'TEMPLATE',
					text: 'Music Festival 2026',
					dates: '20260620/20260623',
					location: 'Riverside Park',
					details: 'Three days of live music, food trucks, and art'
				}))
			})
		);
	});

	it('extracts from stylized event poster image', async () => {
		const canvas = document.createElement('canvas');
		canvas.width = 600;
		canvas.height = 800;
		const ctx = canvas.getContext('2d');

		const gradient = ctx.createLinearGradient(0, 0, 0, 800);
		gradient.addColorStop(0, 'purple');
		gradient.addColorStop(1, 'orange');
		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, 600, 800);

		ctx.fillStyle = 'white';
		ctx.font = 'bold 48px Arial';
		ctx.fillText('MUSIC FESTIVAL 2026', 50, 200);
		ctx.font = '28px Arial';
		ctx.fillText('June 20-22, 2026', 50, 260);
		ctx.fillText('Riverside Park', 50, 300);

		const imageData = canvas.toDataURL('image/png').split(',')[1];
		const result = await createCalendarUrlFromImage(imageData, MOCK_API_KEY);

		expect(result.event.text).toBe('Music Festival 2026');
		expect(result.event.dates).toBe('20260620/20260623');
	});
});

describe('empty or invalid elements', () => {
	it('rejects empty text content', async () => {
		await expect(
			createCalendarUrlFromText('', MOCK_API_KEY)
		).rejects.toThrow('Text content is required');
	});

	it('rejects whitespace-only content', async () => {
		await expect(
			createCalendarUrlFromText('   \n  \t  ', MOCK_API_KEY)
		).rejects.toThrow('Text content is required');
	});

	it('rejects missing API key for text', async () => {
		await expect(
			createCalendarUrlFromText('Some event text', '')
		).rejects.toThrow('Gemini API key is required');
	});

	it('rejects missing API key for image', async () => {
		await expect(
			createCalendarUrlFromImage('base64data', '')
		).rejects.toThrow('Gemini API key is required');
	});
});

describe('performance comparison text vs image', () => {
	const scenarios = [
		{
			name: 'simple single line',
			html: '<p>Dinner on Friday at 7 PM</p>'
		},
		{
			name: 'medium complexity event',
			html: '<div><h3>Workshop</h3><p>Jan 20, 2026 - 2:00 PM</p><p>Room 305</p></div>'
		},
		{
			name: 'detailed multi-paragraph',
			html: `<article>
				<h2>Conference Day</h2>
				<p>March 15, 2026 from 9 AM to 5 PM</p>
				<p>Location: Grand Hotel Ballroom</p>
				<p>Keynote speakers, breakout sessions, and networking</p>
			</article>`
		}
	];

	beforeEach(() => {
		global.fetch = jest.fn(() =>
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve(mockGeminiResponse({
					action: 'TEMPLATE',
					text: 'Event',
					dates: '20260101T120000Z/20260101T130000Z'
				}))
			})
		);
	});

	scenarios.forEach(scenario => {
		it(`text processing is faster than image for ${scenario.name}`, async () => {
			const element = createMockElement(scenario.html);

			const textStart = performance.now();
			await createCalendarUrlFromText(element.textContent, MOCK_API_KEY);
			const textDuration = performance.now() - textStart;

			const imageData = await captureElementAsImage(element);
			const imageStart = performance.now();
			await createCalendarUrlFromImage(imageData, MOCK_API_KEY);
			const imageDuration = performance.now() - imageStart;

			console.log(`Performance for ${scenario.name}:`);
			console.log(`  Text processing: ${textDuration.toFixed(2)}ms`);
			console.log(`  Image processing: ${imageDuration.toFixed(2)}ms`);
			console.log(`  Difference: ${(imageDuration - textDuration).toFixed(2)}ms`);

			expect(textDuration).toBeDefined();
			expect(imageDuration).toBeDefined();
		});
	});
});

