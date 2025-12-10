# Voice-Activated Teleprompter for Framer

A Framer-compatible teleprompter component that uses the Web Speech API for voice-activated script scrolling.

## Features

- 🎤 **Voice-Activated Scrolling**: Uses Web Speech API to automatically scroll as you speak
- ✨ **Word Highlighting**: Highlights words as they're recognized by the speech recognition
- 🌍 **Multi-Language Support**: Supports 9 languages including English, Spanish, French, German, and more
- 🎨 **Fully Customizable**: Adjust font size, colors, scroll speed, and more
- 📱 **Responsive Design**: Works on desktop and mobile devices (where supported)
- 🔄 **Manual Controls**: Reset and toggle voice control with easy-to-use buttons
- 📊 **Progress Indicator**: Visual scroll progress bar

## Installation

1. **Copy the component to your Framer project**:

   - Copy the entire `teleprompter.tsx` file
   - Paste it into your Framer project's code folder

2. **Install dependencies** (if working locally):
   ```bash
   npm install
   ```

## Usage in Framer

1. Add the component to your canvas
2. Configure the properties in the right panel:
   - **Script**: Enter your teleprompter text
   - **Font Size**: Adjust text size (16-72px)
   - **Voice Control**: Enable/disable voice activation
   - **Language**: Select your preferred language
   - **Colors**: Customize background, text, and highlight colors
   - **Auto Scroll Speed**: Set manual scroll speed (when voice control is off)

## How Voice Control Works

1. Click the "Start Voice Control" button
2. Grant microphone permissions when prompted
3. Start speaking your script
4. The teleprompter will automatically:
   - Recognize your words
   - Highlight spoken words in the highlight color
   - Scroll to keep up with your pace
   - Track your progress through the script

## Browser Compatibility

The Web Speech API is supported in:

- ✅ Chrome/Edge (desktop & Android)
- ✅ Safari (macOS & iOS 14.5+)
- ❌ Firefox (limited support)

For browsers without support, the component will display an error message and fall back to manual scrolling.

## Tips for Best Results

1. **Speak clearly and naturally** - the API works best with natural speech
2. **Use proper punctuation** - helps the API recognize phrase boundaries
3. **Good microphone** - use a quality microphone for better recognition
4. **Quiet environment** - reduce background noise for accurate recognition
5. **Practice first** - do a test run to calibrate your speaking pace

## Customization Options

All properties are exposed as Framer controls:

| Property           | Type    | Default     | Description                                   |
| ------------------ | ------- | ----------- | --------------------------------------------- |
| script             | String  | Sample text | Your teleprompter script                      |
| fontSize           | Number  | 32          | Text size in pixels                           |
| scrollSpeed        | Number  | 2           | Auto-scroll speed (when voice control is off) |
| backgroundColor    | Color   | #000000     | Background color                              |
| textColor          | Color   | #FFFFFF     | Text color                                    |
| highlightColor     | Color   | #FFD700     | Color for highlighted/spoken words            |
| enableVoiceControl | Boolean | true        | Enable voice-activated scrolling              |
| voiceLanguage      | Enum    | en-US       | Recognition language                          |

## Privacy Note

This component uses the browser's built-in Web Speech API. Audio is processed by your browser and may be sent to cloud services (Google, Apple, etc.) for speech recognition. No audio is stored by this component.

## Troubleshooting

**"Web Speech API not supported"**: Your browser doesn't support the API. Try Chrome or Safari.

**"Error: not-allowed"**: You need to grant microphone permissions.

**Words not highlighting**: Speak more clearly or check that your microphone is working.

**Auto-scroll too fast/slow**: Adjust the scroll speed or speak at a different pace.

## License

Free to use in your Framer projects!
