import * as React from "react"
import { addPropertyControls, ControlType } from "framer"

interface Props {
    script: string
    fontSize: number
    scrollSpeed: number
    backgroundColor: string
    textColor: string
    enableVoiceControl: boolean
    voiceLanguage: string
    highlightColor: string
    width: number
    height: number
}

export default function Teleprompter(props: Props) {
    const {
        script = "Welcome to the teleprompter. Start speaking to scroll through your script automatically.",
        fontSize = 32,
        scrollSpeed = 2,
        backgroundColor = "#000000",
        textColor = "#FFFFFF",
        enableVoiceControl = true,
        voiceLanguage = "en-US",
        highlightColor = "#FFD700",
        width,
        height,
    } = props

    const [isListening, setIsListening] = React.useState(false)
    const [currentWordIndex, setCurrentWordIndex] = React.useState(0)
    const [scrollPosition, setScrollPosition] = React.useState(0)
    const [recognition, setRecognition] = React.useState<any>(null)
    const [error, setError] = React.useState<string>("")

    const scriptRef = React.useRef<HTMLDivElement>(null)
    const isListeningRef = React.useRef(false)
    const words = React.useMemo(() => script.split(/\s+/), [script])

    // Initialize Web Speech API
    React.useEffect(() => {
        if (!enableVoiceControl) return

        // Check if browser supports Web Speech API
        const SpeechRecognition =
            (window as any).SpeechRecognition ||
            (window as any).webkitSpeechRecognition

        if (!SpeechRecognition) {
            setError("Web Speech API not supported in this browser")
            return
        }

        const recognitionInstance = new SpeechRecognition()
        recognitionInstance.continuous = true
        recognitionInstance.interimResults = true
        recognitionInstance.lang = voiceLanguage

        recognitionInstance.onresult = (event: any) => {
            const transcript = Array.from(event.results)
                .map((result: any) => result[0].transcript)
                .join(" ")
                .toLowerCase()

            // Find matching words in the script
            const spokenWords = transcript.split(/\s+/)
            let matchIndex = currentWordIndex

            for (let i = 0; i < spokenWords.length; i++) {
                const spokenWord = spokenWords[i].replace(/[^\w]/g, "")
                
                // Look ahead in the script for matching words
                for (let j = matchIndex; j < words.length; j++) {
                    const scriptWord = words[j].toLowerCase().replace(/[^\w]/g, "")
                    
                    if (scriptWord.includes(spokenWord) || spokenWord.includes(scriptWord)) {
                        matchIndex = j + 1
                        setCurrentWordIndex(matchIndex)
                        
                        // Auto-scroll based on word position
                        if (scriptRef.current) {
                            const wordElement = scriptRef.current.children[j] as HTMLElement
                            if (wordElement) {
                                const containerHeight = scriptRef.current.clientHeight
                                const wordTop = wordElement.offsetTop
                                const targetScroll = Math.max(0, wordTop - containerHeight / 3)
                                setScrollPosition(targetScroll)
                            }
                        }
                        break
                    }
                }
            }
        }

        recognitionInstance.onerror = (event: any) => {
            // Handle different error types
            if (event.error === "network") {
                setError("Network error - check your internet connection")
                setIsListening(false)
            } else if (event.error === "not-allowed") {
                setError("Microphone access denied - please allow permissions")
                setIsListening(false)
            } else if (event.error === "no-speech") {
                // Don't show error for no-speech, just continue listening
                return
            } else if (event.error === "aborted") {
                // Aborted is expected when stopping, don't show error
                return
            } else {
                setError(`Error: ${event.error}`)
                setIsListening(false)
            }
        }

        recognitionInstance.onend = () => {
            // Only restart if we're supposed to be listening (use ref to avoid stale closure)
            if (isListeningRef.current) {
                try {
                    recognitionInstance.start()
                } catch (e) {
                    console.error("Failed to restart recognition:", e)
                    setIsListening(false)
                    isListeningRef.current = false
                    setError("Recognition stopped unexpectedly")
                }
            }
        }

        setRecognition(recognitionInstance)

        return () => {
            if (recognitionInstance) {
                recognitionInstance.stop()
            }
        }
    }, [enableVoiceControl, voiceLanguage])

    // Handle listening toggle
    const toggleListening = () => {
        if (!recognition) {
            setError("Voice recognition not initialized. Please refresh the page.")
            return
        }

        if (isListening) {
            recognition.stop()
            setIsListening(false)
            isListeningRef.current = false
        } else {
            try {
                setError("") // Clear any previous errors
                recognition.start()
                setIsListening(true)
                isListeningRef.current = true
            } catch (e: any) {
                console.error("Failed to start recognition:", e)
                const errorMsg = e.message || "Failed to start voice recognition"
                setError(`${errorMsg}. Please check microphone permissions and internet connection.`)
                setIsListening(false)
                isListeningRef.current = false
            }
        }
    }

    // Auto-scroll with manual speed control
    React.useEffect(() => {
        if (isListening || !enableVoiceControl) {
            return
        }

        const interval = setInterval(() => {
            setScrollPosition((prev) => prev + scrollSpeed)
        }, 50)

        return () => clearInterval(interval)
    }, [isListening, scrollSpeed, enableVoiceControl])

    // Apply scroll position
    React.useEffect(() => {
        if (scriptRef.current) {
            scriptRef.current.scrollTop = scrollPosition
        }
    }, [scrollPosition])

    const handleManualScroll = (e: React.UIEvent<HTMLDivElement>) => {
        setScrollPosition(e.currentTarget.scrollTop)
    }

    const resetTeleprompter = () => {
        setCurrentWordIndex(0)
        setScrollPosition(0)
        setError("") // Clear errors on reset
        if (isListening && recognition) {
            recognition.stop()
            setIsListening(false)
            isListeningRef.current = false
        }
    }

    return (
        <div
            style={{
                width: "100%",
                height: "100%",
                backgroundColor,
                display: "flex",
                flexDirection: "column",
                position: "relative",
                overflow: "hidden",
            }}
        >
            {/* Control Panel */}
            <div
                style={{
                    padding: "16px",
                    backgroundColor: "rgba(0, 0, 0, 0.8)",
                    display: "flex",
                    gap: "12px",
                    alignItems: "center",
                    justifyContent: "center",
                    flexWrap: "wrap",
                }}
            >
                {enableVoiceControl && (
                    <button
                        onClick={toggleListening}
                        style={{
                            padding: "12px 24px",
                            fontSize: "16px",
                            fontWeight: "600",
                            border: "none",
                            borderRadius: "8px",
                            cursor: "pointer",
                            backgroundColor: isListening ? "#FF4444" : "#4CAF50",
                            color: "#FFFFFF",
                            transition: "all 0.3s ease",
                        }}
                    >
                        {isListening ? "🎤 Stop Listening" : "🎤 Start Voice Control"}
                    </button>
                )}
                
                <button
                    onClick={resetTeleprompter}
                    style={{
                        padding: "12px 24px",
                        fontSize: "16px",
                        fontWeight: "600",
                        border: "none",
                        borderRadius: "8px",
                        cursor: "pointer",
                        backgroundColor: "#2196F3",
                        color: "#FFFFFF",
                    }}
                >
                    ↺ Reset
                </button>

                {error && (
                    <div
                        style={{
                            color: "#FF6B6B",
                            fontSize: "14px",
                            padding: "8px 16px",
                            backgroundColor: "rgba(255, 107, 107, 0.2)",
                            borderRadius: "4px",
                        }}
                    >
                        {error}
                    </div>
                )}

                {isListening && (
                    <div
                        style={{
                            color: highlightColor,
                            fontSize: "14px",
                            fontWeight: "600",
                        }}
                    >
                        Listening... ({currentWordIndex}/{words.length} words)
                    </div>
                )}
            </div>

            {/* Script Display */}
            <div
                ref={scriptRef}
                onScroll={handleManualScroll}
                style={{
                    flex: 1,
                    padding: "60px 40px",
                    overflowY: "auto",
                    overflowX: "hidden",
                    scrollBehavior: "smooth",
                    textAlign: "center",
                    lineHeight: 1.8,
                }}
            >
                <div
                    style={{
                        fontSize: `${fontSize}px`,
                        color: textColor,
                        fontWeight: "500",
                        fontFamily: "system-ui, -apple-system, sans-serif",
                    }}
                >
                    {words.map((word, index) => (
                        <span
                            key={index}
                            style={{
                                backgroundColor:
                                    enableVoiceControl && index < currentWordIndex
                                        ? highlightColor
                                        : "transparent",
                                color:
                                    enableVoiceControl && index < currentWordIndex
                                        ? "#000000"
                                        : textColor,
                                padding: "4px 6px",
                                margin: "0 4px",
                                borderRadius: "4px",
                                transition: "all 0.3s ease",
                                display: "inline-block",
                            }}
                        >
                            {word}
                        </span>
                    ))}
                </div>
            </div>

            {/* Scroll Progress Indicator */}
            <div
                style={{
                    position: "absolute",
                    right: "8px",
                    top: "100px",
                    bottom: "20px",
                    width: "4px",
                    backgroundColor: "rgba(255, 255, 255, 0.2)",
                    borderRadius: "2px",
                }}
            >
                <div
                    style={{
                        width: "100%",
                        height: `${
                            scriptRef.current
                                ? (scrollPosition /
                                      (scriptRef.current.scrollHeight -
                                          scriptRef.current.clientHeight)) *
                                  100
                                : 0
                        }%`,
                        backgroundColor: highlightColor,
                        borderRadius: "2px",
                        transition: "height 0.3s ease",
                    }}
                />
            </div>
        </div>
    )
}

// Framer property controls
addPropertyControls(Teleprompter, {
    script: {
        type: ControlType.String,
        title: "Script",
        displayTextArea: true,
        defaultValue:
            "Welcome to the teleprompter. Start speaking to scroll through your script automatically. The Web Speech API will recognize your voice and highlight the words you've spoken. Try speaking naturally and the teleprompter will follow along with you.",
    },
    fontSize: {
        type: ControlType.Number,
        title: "Font Size",
        min: 16,
        max: 72,
        step: 2,
        defaultValue: 32,
        unit: "px",
    },
    scrollSpeed: {
        type: ControlType.Number,
        title: "Auto Scroll Speed",
        min: 0,
        max: 10,
        step: 0.5,
        defaultValue: 2,
        hidden: (props) => props.enableVoiceControl,
    },
    backgroundColor: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "#000000",
    },
    textColor: {
        type: ControlType.Color,
        title: "Text Color",
        defaultValue: "#FFFFFF",
    },
    highlightColor: {
        type: ControlType.Color,
        title: "Highlight Color",
        defaultValue: "#FFD700",
    },
    enableVoiceControl: {
        type: ControlType.Boolean,
        title: "Voice Control",
        defaultValue: true,
    },
    voiceLanguage: {
        type: ControlType.Enum,
        title: "Language",
        options: ["en-US", "en-GB", "es-ES", "fr-FR", "de-DE", "it-IT", "pt-BR", "ja-JP", "zh-CN"],
        optionTitles: [
            "English (US)",
            "English (UK)",
            "Spanish",
            "French",
            "German",
            "Italian",
            "Portuguese",
            "Japanese",
            "Chinese",
        ],
        defaultValue: "en-US",
        hidden: (props) => !props.enableVoiceControl,
    },
})
