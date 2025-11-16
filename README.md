# DandyCal

## Inspiration
I frequently get emails about cool events and think to myself, "I'll add that to my calendar later". Later turns into never. In a completely original idea of forcing AI into another product, we wanted to make an AI that could do it all for you.

## What it does
This Chrome extension allows you to select a region on your screen where an event is (doesn't matter if it's text or even an image). The content then gets sent to Google Gemini which figures out:
- An event title 
- When the event is
- The location of the event
- If it's an all day event or from certain times
- Potential people to invite to the event
- A description for the event
It then opens up a Google Calendar prompt where you can either confirm the event or edit any details you want.

Other features:
- Add your own API token in the options page.
- Changable shortcut to start content selection.
- Cancel a request
- Recurring events, guest invitations, and multi-day events detection
- Toggable sound
- Text selection or full screen capture options
- Cancel if you change your mind


## How we built it
We built DandyCal as a Chrome extension to make usage and integration super easy. The extension injects a content script that creates an interactive overlay allowing users to either hover over elements to select them or drag to create custom regions. 

Once captured, the screenshot is cropped using HTML Canvas and converted to base64. Or if the element is just text, extract just the text for better accuracy.

The image/text is then sent to Google Gemini's API.
It uses Gemini's structured output feature to respond with a JSON schema that maps to Google Calendar's URL parameters. 
The AI extracts all relevant event details and returns them in a standardized format, which we then transform into a Google Calendar template URL that opens directly in the user's browser.

## Challenges we ran into
Early on we didn't have great documentation for Google Calendar's URL parameter system until we found [this](https://github.com/InteractionDesignFoundation/add-event-to-calendar-docs/blob/main/services/google.md) great github page.

Another challenge was how to capture the content on the screen. We implemented a hybrid approach that supports both element-based selection (hover and click) and free-form drag selection. Getting the overlay z-index layering right and grabbing the correct element on hover was tricky.

The hardest part was figuring out how Chrome runs your code. Proper communication between the background service worker, content scripts, and popup, especially when dealing with async operations and keeping the UI updated during processing.

## Accomplishments that we're proud of
We're really proud of how seamlessly the extension works. All the complexity of communicating with the AI and processing the image is hidden from the user.

The AI accuracy is pretty impressive too, especially from an image. It's really cool to see the AI able to figure out obscure event details such when a 5 hour event that ends at 8pm starts.

The super cute logo! 

## What we learned
It was really fun to learn how to use the Gemeni API and how to create a Chrome extension. This was most of our first time working with the browsers dev tools particularly for extensions, they're very different from the tools for native code development.

## What's next for DandyCal
- Multi-event support: Being able to identify multiple events in one capture and process all of those events. 
