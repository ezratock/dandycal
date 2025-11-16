import { describe, it, expect } from '@jest/globals';

function createMockElement(html) {
	const template = document.createElement('template');
	template.innerHTML = html.trim();
	return template.content.firstChild;
}

function isTextualElement(element) {
	if (!element) return false;

	const textualTags = new Set([
		'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
		'SPAN', 'A', 'STRONG', 'EM', 'B', 'I', 'U',
		'LI', 'UL', 'OL', 'BLOCKQUOTE', 'PRE', 'CODE',
		'LABEL', 'LEGEND', 'CAPTION', 'TH', 'TD',
		'DT', 'DD', 'CITE', 'Q', 'SMALL', 'MARK',
		'DEL', 'INS', 'SUB', 'SUP', 'ABBR', 'TIME'
	]);

	if (textualTags.has(element.tagName)) {
		return true;
	}

	const containerTags = new Set([
		'DIV', 'SECTION', 'ARTICLE', 'ASIDE', 'HEADER',
		'FOOTER', 'NAV', 'MAIN', 'FIGURE', 'FIGCAPTION'
	]);

	if (containerTags.has(element.tagName)) {
		const hasImages = element.querySelector('img, svg, canvas, video, picture, iframe');
		if (hasImages) {
			return false;
		}

		const textContent = (element.innerText || element.textContent || '').trim();
		if (textContent.length === 0) {
			return false;
		}

		const allChildren = Array.from(element.querySelectorAll('*'));
		const hasNonTextualChildren = allChildren.some(child => {
			const tag = child.tagName;
			if (['IMG', 'SVG', 'CANVAS', 'VIDEO', 'PICTURE', 'IFRAME'].includes(tag)) {
				return true;
			}
			return false;
		});

		if (hasNonTextualChildren) {
			return false;
		}

		return true;
	}

	const visualTags = new Set([
		'IMG', 'SVG', 'CANVAS', 'VIDEO', 'PICTURE', 'IFRAME'
	]);

	if (visualTags.has(element.tagName)) {
		return false;
	}

	if (element.tagName === 'TABLE') {
		const hasImages = element.querySelector('img, svg, canvas, video, picture');
		return !hasImages;
	}

	const textContent = (element.innerText || element.textContent || '').trim();
	if (textContent.length > 0) {
		const hasImages = element.querySelector('img, svg, canvas, video, picture, iframe');
		return !hasImages;
	}

	return false;
}

describe('paragraph element', () => {
	it('identifies as textual', () => {
		const element = createMockElement('<p>Event details here</p>');
		expect(isTextualElement(element)).toBe(true);
	});
});

describe('heading elements', () => {
	it('identifies h1 as textual', () => {
		const element = createMockElement('<h1>Main Event</h1>');
		expect(isTextualElement(element)).toBe(true);
	});

	it('identifies h2 as textual', () => {
		const element = createMockElement('<h2>Sub Event</h2>');
		expect(isTextualElement(element)).toBe(true);
	});

	it('identifies h3 through h6 as textual', () => {
		['h3', 'h4', 'h5', 'h6'].forEach(tag => {
			const element = createMockElement(`<${tag}>Heading</${tag}>`);
			expect(isTextualElement(element)).toBe(true);
		});
	});
});

describe('inline text elements', () => {
	it('identifies span as textual', () => {
		const element = createMockElement('<span>Text content</span>');
		expect(isTextualElement(element)).toBe(true);
	});

	it('identifies strong as textual', () => {
		const element = createMockElement('<strong>Important</strong>');
		expect(isTextualElement(element)).toBe(true);
	});

	it('identifies em as textual', () => {
		const element = createMockElement('<em>Emphasized</em>');
		expect(isTextualElement(element)).toBe(true);
	});

	it('identifies anchor as textual', () => {
		const element = createMockElement('<a href="#">Link text</a>');
		expect(isTextualElement(element)).toBe(true);
	});
});

describe('list elements', () => {
	it('identifies ul as textual', () => {
		const element = createMockElement('<ul><li>Item 1</li><li>Item 2</li></ul>');
		expect(isTextualElement(element)).toBe(true);
	});

	it('identifies ol as textual', () => {
		const element = createMockElement('<ol><li>First</li><li>Second</li></ol>');
		expect(isTextualElement(element)).toBe(true);
	});

	it('identifies li as textual', () => {
		const element = createMockElement('<li>List item</li>');
		expect(isTextualElement(element)).toBe(true);
	});
});

describe('blockquote and code elements', () => {
	it('identifies blockquote as textual', () => {
		const element = createMockElement('<blockquote>Quoted text</blockquote>');
		expect(isTextualElement(element)).toBe(true);
	});

	it('identifies pre as textual', () => {
		const element = createMockElement('<pre>Preformatted text</pre>');
		expect(isTextualElement(element)).toBe(true);
	});

	it('identifies code as textual', () => {
		const element = createMockElement('<code>const x = 5;</code>');
		expect(isTextualElement(element)).toBe(true);
	});
});

describe('div with only text children', () => {
	it('identifies as textual when containing only paragraphs', () => {
		const element = createMockElement(`
			<div>
				<p>First paragraph</p>
				<p>Second paragraph</p>
			</div>
		`);
		expect(isTextualElement(element)).toBe(true);
	});

	it('identifies as textual with headings and paragraphs', () => {
		const element = createMockElement(`
			<div>
				<h2>Title</h2>
				<p>Description</p>
			</div>
		`);
		expect(isTextualElement(element)).toBe(true);
	});

	it('identifies as textual with nested spans and strong', () => {
		const element = createMockElement(`
			<div>
				<span>Some <strong>bold</strong> text</span>
			</div>
		`);
		expect(isTextualElement(element)).toBe(true);
	});
});

describe('div with images', () => {
	it('identifies as non-textual when containing img', () => {
		const element = createMockElement(`
			<div>
				<img src="event.jpg" alt="Event">
				<p>Event details</p>
			</div>
		`);
		expect(isTextualElement(element)).toBe(false);
	});

	it('identifies as non-textual when containing svg', () => {
		const element = createMockElement(`
			<div>
				<svg width="100" height="100"></svg>
				<p>Text</p>
			</div>
		`);
		expect(isTextualElement(element)).toBe(false);
	});

	it('identifies as non-textual when containing canvas', () => {
		const element = createMockElement(`
			<div>
				<canvas id="myCanvas"></canvas>
				<span>Caption</span>
			</div>
		`);
		expect(isTextualElement(element)).toBe(false);
	});

	it('identifies as non-textual when containing video', () => {
		const element = createMockElement(`
			<div>
				<video src="promo.mp4"></video>
				<p>Video description</p>
			</div>
		`);
		expect(isTextualElement(element)).toBe(false);
	});

	it('identifies as non-textual when containing iframe', () => {
		const element = createMockElement(`
			<div>
				<iframe src="embed.html"></iframe>
			</div>
		`);
		expect(isTextualElement(element)).toBe(false);
	});
});

describe('image elements', () => {
	it('identifies img as non-textual', () => {
		const element = createMockElement('<img src="poster.jpg" alt="Event Poster">');
		expect(isTextualElement(element)).toBe(false);
	});

	it('identifies svg as non-textual', () => {
		const element = createMockElement('<svg width="50" height="50"><circle cx="25" cy="25" r="20"/></svg>');
		expect(isTextualElement(element)).toBe(false);
	});

	it('identifies canvas as non-textual', () => {
		const element = createMockElement('<canvas width="300" height="200"></canvas>');
		expect(isTextualElement(element)).toBe(false);
	});

	it('identifies video as non-textual', () => {
		const element = createMockElement('<video controls><source src="video.mp4"></video>');
		expect(isTextualElement(element)).toBe(false);
	});
});

describe('section and article elements', () => {
	it('identifies section with text as textual', () => {
		const element = createMockElement(`
			<section>
				<h3>Event Info</h3>
				<p>Details here</p>
			</section>
		`);
		expect(isTextualElement(element)).toBe(true);
	});

	it('identifies article with text as textual', () => {
		const element = createMockElement(`
			<article>
				<header><h1>Title</h1></header>
				<p>Content</p>
			</article>
		`);
		expect(isTextualElement(element)).toBe(true);
	});

	it('identifies section with image as non-textual', () => {
		const element = createMockElement(`
			<section>
				<img src="banner.jpg">
				<p>Text</p>
			</section>
		`);
		expect(isTextualElement(element)).toBe(false);
	});
});

describe('table elements', () => {
	it('identifies table with only text as textual', () => {
		const element = createMockElement(`
			<table>
				<tr><th>Event</th><td>Meeting</td></tr>
				<tr><th>Date</th><td>Tomorrow</td></tr>
			</table>
		`);
		expect(isTextualElement(element)).toBe(true);
	});

	it('identifies table with images as non-textual', () => {
		const element = createMockElement(`
			<table>
				<tr><td><img src="icon.png"></td><td>Text</td></tr>
			</table>
		`);
		expect(isTextualElement(element)).toBe(false);
	});

	it('identifies th as textual', () => {
		const element = createMockElement('<th>Header Cell</th>');
		expect(isTextualElement(element)).toBe(true);
	});

	it('identifies td as textual', () => {
		const element = createMockElement('<td>Data Cell</td>');
		expect(isTextualElement(element)).toBe(true);
	});
});

describe('empty or null elements', () => {
	it('returns false for null element', () => {
		expect(isTextualElement(null)).toBe(false);
	});

	it('returns false for undefined element', () => {
		expect(isTextualElement(undefined)).toBe(false);
	});

	it('identifies empty div as non-textual', () => {
		const element = createMockElement('<div></div>');
		expect(isTextualElement(element)).toBe(false);
	});

	it('identifies div with only whitespace as non-textual', () => {
		const element = createMockElement('<div>   \n  \t  </div>');
		expect(isTextualElement(element)).toBe(false);
	});
});

describe('nested containers', () => {
	it('identifies deeply nested text as textual', () => {
		const element = createMockElement(`
			<div>
				<section>
					<article>
						<p>Event information</p>
					</article>
				</section>
			</div>
		`);
		expect(isTextualElement(element)).toBe(true);
	});

	it('identifies nested container with image as non-textual', () => {
		const element = createMockElement(`
			<div>
				<section>
					<div>
						<img src="photo.jpg">
					</div>
					<p>Caption</p>
				</section>
			</div>
		`);
		expect(isTextualElement(element)).toBe(false);
	});
});

describe('figure and figcaption', () => {
	it('identifies figure with only figcaption as textual', () => {
		const element = createMockElement(`
			<figure>
				<figcaption>Event description</figcaption>
			</figure>
		`);
		expect(isTextualElement(element)).toBe(true);
	});

	it('identifies figure with img as non-textual', () => {
		const element = createMockElement(`
			<figure>
				<img src="chart.png">
				<figcaption>Chart caption</figcaption>
			</figure>
		`);
		expect(isTextualElement(element)).toBe(false);
	});
});

describe('header and footer elements', () => {
	it('identifies header with text as textual', () => {
		const element = createMockElement(`
			<header>
				<h1>Page Title</h1>
				<p>Subtitle</p>
			</header>
		`);
		expect(isTextualElement(element)).toBe(true);
	});

	it('identifies footer with text as textual', () => {
		const element = createMockElement(`
			<footer>
				<p>Contact info</p>
			</footer>
		`);
		expect(isTextualElement(element)).toBe(true);
	});
});

describe('nav element', () => {
	it('identifies nav with links as textual', () => {
		const element = createMockElement(`
			<nav>
				<a href="#">Home</a>
				<a href="#">Events</a>
			</nav>
		`);
		expect(isTextualElement(element)).toBe(true);
	});
});

describe('form elements', () => {
	it('identifies label as textual', () => {
		const element = createMockElement('<label>Event Name:</label>');
		expect(isTextualElement(element)).toBe(true);
	});

	it('identifies legend as textual', () => {
		const element = createMockElement('<legend>Event Details</legend>');
		expect(isTextualElement(element)).toBe(true);
	});
});

describe('definition list elements', () => {
	it('identifies dt as textual', () => {
		const element = createMockElement('<dt>Event Type</dt>');
		expect(isTextualElement(element)).toBe(true);
	});

	it('identifies dd as textual', () => {
		const element = createMockElement('<dd>Conference</dd>');
		expect(isTextualElement(element)).toBe(true);
	});
});

describe('semantic text elements', () => {
	it('identifies cite as textual', () => {
		const element = createMockElement('<cite>Source citation</cite>');
		expect(isTextualElement(element)).toBe(true);
	});

	it('identifies q as textual', () => {
		const element = createMockElement('<q>Quoted text</q>');
		expect(isTextualElement(element)).toBe(true);
	});

	it('identifies small as textual', () => {
		const element = createMockElement('<small>Fine print</small>');
		expect(isTextualElement(element)).toBe(true);
	});

	it('identifies mark as textual', () => {
		const element = createMockElement('<mark>Highlighted</mark>');
		expect(isTextualElement(element)).toBe(true);
	});

	it('identifies time as textual', () => {
		const element = createMockElement('<time>2025-12-15</time>');
		expect(isTextualElement(element)).toBe(true);
	});

	it('identifies abbr as textual', () => {
		const element = createMockElement('<abbr title="Abbreviation">ABBR</abbr>');
		expect(isTextualElement(element)).toBe(true);
	});
});

describe('complex real-world scenarios', () => {
	it('identifies event card with only text as textual', () => {
		const element = createMockElement(`
			<div class="event-card">
				<h3>Workshop: Advanced JavaScript</h3>
				<p class="date">December 20, 2025</p>
				<p class="time">2:00 PM - 4:00 PM</p>
				<p class="location">Room 305, Tech Building</p>
				<p class="description">Learn advanced JS patterns and best practices</p>
			</div>
		`);
		expect(isTextualElement(element)).toBe(true);
	});

	it('identifies event poster card as non-textual', () => {
		const element = createMockElement(`
			<div class="event-poster">
				<img src="event-banner.jpg" alt="Event Banner">
				<div class="overlay">
					<h3>Summer Concert</h3>
					<p>July 15, 2026</p>
				</div>
			</div>
		`);
		expect(isTextualElement(element)).toBe(false);
	});

	it('identifies email-style event as textual', () => {
		const element = createMockElement(`
			<div class="email-body">
				<p>Subject: Team Lunch</p>
				<p>Date: Friday, November 17, 2025</p>
				<p>Time: 12:00 PM</p>
				<p>Location: Italian Restaurant Downtown</p>
				<p>Please RSVP by Thursday.</p>
			</div>
		`);
		expect(isTextualElement(element)).toBe(true);
	});

	it('identifies social media post with image as non-textual', () => {
		const element = createMockElement(`
			<article class="post">
				<div class="author">John Doe</div>
				<img src="event-photo.jpg" class="post-image">
				<p class="caption">Join us this Saturday!</p>
			</article>
		`);
		expect(isTextualElement(element)).toBe(false);
	});
});

