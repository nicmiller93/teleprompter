import * as React from "react"
import { addPropertyControls, ControlType } from "framer"

interface Props {
    script: string
    fontSize: number
    scrollSpeed: number
    backgroundColor: string
    textColor: string
    enableVoiceControl: boolean
    highlightColor: string
    width: number
    height: number
}

export default function TeleprompterRealtime(props: Props) {
    const {
        script = "Welcome to the teleprompter. Start speaking to scroll through your script automatically.",
        fontSize = 32,
        scrollSpeed = 2,
        backgroundColor = "#000000",
        textColor = "#FFFFFF",
        enableVoiceControl = true,
        highlightColor = "#FFD700",
        width,
        height,
    } = props

    const [isListening, setIsListening] = React.useState(false)
    const [currentWordIndex, setCurrentWordIndex] = React.useState(0)
    const [scrollPosition, setScrollPosition] = React.useState(0)
    const [error, setError] = React.useState<string>("")
    const [connectionStatus, setConnectionStatus] = React.useState<string>("disconnected")

    const scriptRef = React.useRef<HTMLDivElement>(null)
    const wsRef = React.useRef<WebSocket | null>(null)
    const audioContextRef = React.useRef<AudioContext | null>(null)
    const processorRef = React.useRef<ScriptProcessorNode | null>(null)
    const sourceRef = React.useRef<MediaStreamAudioSourceNode | null>(null)
    const streamRef = React.useRef<MediaStream | null>(null)
    const words = React.useMemo(() => script.split(/\s+/), [script])

    const VERCEL_TOKEN_URL = "https://speed-sermon-rttp.vercel.app/api/token"
    const RENDER_WS_URL = "wss://teleprompter-ws-bridge.onrender.com"

    // Cleanup on unmount
    React.useEffect(() => {
        return () => {
            if (wsRef.current) {
                wsRef.current.close()
            }
            if (processorRef.current) {
                processorRef.current.disconnect()
            }
            if (sourceRef.current) {
                sourceRef.current.disconnect()
            }
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop())
            }
            if (audioContextRef.current) {
                audioContextRef.current.close()
            }
        }
    }, [])

    // Convert Float32 audio to PCM16
    const floatTo16BitPCM = (float32Array: Float32Array): ArrayBuffer => {
        const pcm16 = new Int16Array(float32Array.length)
        for (let i = 0; i < float32Array.length; i++) {
            const s = Math.max(-1, Math.min(1, float32Array[i]))
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
        }
        return pcm16.buffer
    }

    const startVoiceControl = async () => {
        try {
            setError("")
            setConnectionStatus("connecting")

            // Step 1: Get JWT token from Vercel
            const tokenResponse = await fetch(VERCEL_TOKEN_URL)
            if (!tokenResponse.ok) {
                throw new Error("Failed to get authentication token")
            }
            const { token } = await tokenResponse.json()

            // Step 2: Connect to WebSocket bridge on Render
            const ws = new WebSocket(RENDER_WS_URL)
            wsRef.current = ws

            ws.onopen = () => {
                console.log("WebSocket connected, authenticating...")
                // Send authentication
                ws.send(JSON.stringify({ type: "auth", token }))
            }

            ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data)
                    console.log("Received:", message.type, message)

                    if (message.type === "connected") {
                        setConnectionStatus("connected")
                        setIsListening(true)
                        // Start capturing audio
                        startAudioCapture(ws)
                    } else if (message.type === "disconnected") {
                        console.error("OpenAI disconnected:", message.message)
                        setError(`OpenAI disconnected: ${message.message || "Unknown reason"}`)
                        setConnectionStatus("error")
                        stopVoiceControl()
                    } else if (message.type === "conversation.item.input_audio_transcription.completed") {
                        // Handle transcription
                        const transcript = message.transcript.toLowerCase()
                        console.log("Transcript:", transcript)
                        processTranscript(transcript)
                    } else if (message.type === "error") {
                        console.error("Error from server:", message.message)
                        setError(message.message)
                        setConnectionStatus("error")
                    }
                } catch (err) {
                    // Binary data or non-JSON, ignore
                }
            }

            ws.onerror = (error) => {
                console.error("WebSocket error:", error)
                setError("Connection error")
                setConnectionStatus("error")
            }

            ws.onclose = () => {
                console.log("WebSocket closed")
                setConnectionStatus("disconnected")
                setIsListening(false)
            }
        } catch (err: any) {
            console.error("Error starting voice control:", err)
            setError(err?.message || "Failed to start voice control")
            setConnectionStatus("error")
        }
    }

    const startAudioCapture = async (ws: WebSocket) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    channelCount: 1,
                    sampleRate: 24000,
                    echoCancellation: true,
                    noiseSuppression: true,
                }
            })
            streamRef.current = stream

            // Create audio context at 24kHz to match OpenAI requirements
            const audioContext = new AudioContext({ sampleRate: 24000 })
            audioContextRef.current = audioContext

            const source = audioContext.createMediaStreamSource(stream)
            sourceRef.current = source

            // Use ScriptProcessorNode for direct PCM access (deprecated but widely supported)
            // Buffer size: 4096 samples = ~170ms at 24kHz (good balance of latency and efficiency)
            const processor = audioContext.createScriptProcessor(4096, 1, 1)
            processorRef.current = processor

            processor.onaudioprocess = (e) => {
                if (ws.readyState === WebSocket.OPEN) {
                    const inputData = e.inputBuffer.getChannelData(0)
                    const pcm16 = floatTo16BitPCM(inputData)
                    ws.send(pcm16)
                }
            }

            // Connect: source -> processor -> destination (required for processing)
            source.connect(processor)
            processor.connect(audioContext.destination)
        } catch (err) {
            console.error("Error capturing audio:", err)
            setError("Microphone access denied")
        }
    }

    const processTranscript = (transcript: string) => {
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
                        const scriptDiv = scriptRef.current.querySelector('div')
                        if (scriptDiv && scriptDiv.children[j]) {
                            const wordElement = scriptDiv.children[j] as HTMLElement
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

    const stopVoiceControl = () => {
        if (wsRef.current) {
            wsRef.current.close()
        }
        if (processorRef.current) {
            processorRef.current.disconnect()
            processorRef.current = null
        }
        if (sourceRef.current) {
            sourceRef.current.disconnect()
            sourceRef.current = null
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop())
            streamRef.current = null
        }
        if (audioContextRef.current) {
            audioContextRef.current.close()
            audioContextRef.current = null
        }
        setIsListening(false)
        setConnectionStatus("disconnected")
    }

    const resetTeleprompter = () => {
        setCurrentWordIndex(0)
        setScrollPosition(0)
        if (isListening) {
            stopVoiceControl()
        }
    }

    // Auto-scroll effect
    React.useEffect(() => {
        if (scriptRef.current) {
            scriptRef.current.scrollTop = scrollPosition
        }
    }, [scrollPosition])

    // Manual scroll when voice control is off
    React.useEffect(() => {
        if (!enableVoiceControl || !isListening) {
            const interval = setInterval(() => {
                setScrollPosition((prev: number) => prev + scrollSpeed)
            }, 50)
            return () => clearInterval(interval)
        }
    }, [enableVoiceControl, isListening, scrollSpeed])

    return (
        <div
            style={{
                width: "100%",
                height: "100%",
                backgroundColor,
                position: "relative",
                overflow: "hidden",
            }}
        >
            {/* Script Display */}
            <div
                ref={scriptRef}
                style={{
                    width: "100%",
                    height: "calc(100% - 100px)",
                    overflowY: "auto",
                    overflowX: "hidden",
                    padding: "40px",
                    scrollBehavior: "smooth",
                }}
            >
                <div style={{ 
                    fontSize, 
                    color: textColor, 
                    lineHeight: 1.8,
                    wordWrap: "break-word",
                    whiteSpace: "normal",
                }}>
                    {words.map((word: string, index: number) => (
                        <span
                            key={index}
                            style={{
                                backgroundColor:
                                    index < currentWordIndex
                                        ? highlightColor
                                        : "transparent",
                                padding: "2px 4px",
                                marginRight: "8px",
                                display: "inline",
                                transition: "background-color 0.3s",
                            }}
                        >
                            {word}{" "}
                        </span>
                    ))}
                </div>
            </div>

            {/* Controls */}
            <div
                style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: "100px",
                    backgroundColor: "rgba(0, 0, 0, 0.8)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "20px",
                    padding: "20px",
                }}
            >
                {enableVoiceControl && (
                    <button
                        onClick={isListening ? stopVoiceControl : startVoiceControl}
                        disabled={connectionStatus === "connecting"}
                        style={{
                            padding: "12px 24px",
                            fontSize: "16px",
                            borderRadius: "8px",
                            border: "none",
                            backgroundColor: isListening ? "#ff4444" : "#4CAF50",
                            color: "white",
                            cursor: connectionStatus === "connecting" ? "wait" : "pointer",
                            fontWeight: "bold",
                        }}
                    >
                        {connectionStatus === "connecting" ? "Connecting..." :
                         isListening ? "Stop Voice Control" : "Start Voice Control"}
                    </button>
                )}

                <button
                    onClick={resetTeleprompter}
                    style={{
                        padding: "12px 24px",
                        fontSize: "16px",
                        borderRadius: "8px",
                        border: "none",
                        backgroundColor: "#2196F3",
                        color: "white",
                        cursor: "pointer",
                        fontWeight: "bold",
                    }}
                >
                    Reset
                </button>

                {/* Status Indicator */}
                <div style={{ color: "white", fontSize: "14px" }}>
                    Status: {connectionStatus}
                    {currentWordIndex > 0 && ` | Progress: ${Math.round((currentWordIndex / words.length) * 100)}%`}
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div
                    style={{
                        position: "absolute",
                        top: "20px",
                        left: "20px",
                        right: "20px",
                        padding: "15px",
                        backgroundColor: "#ff4444",
                        color: "white",
                        borderRadius: "8px",
                        zIndex: 1000,
                    }}
                >
                    {error}
                </div>
            )}
        </div>
    )
}

addPropertyControls(TeleprompterRealtime, {
    script: {
        type: ControlType.String,
        defaultValue:
            "Welcome to the AI-powered teleprompter. Click 'Start Voice Control' and begin speaking your script. The teleprompter will automatically scroll and highlight your progress using OpenAI's Realtime API for accurate speech recognition.",
        displayTextArea: true,
    },
    fontSize: {
        type: ControlType.Number,
        defaultValue: 32,
        min: 16,
        max: 72,
        step: 1,
        unit: "px",
    },
    scrollSpeed: {
        type: ControlType.Number,
        defaultValue: 2,
        min: 1,
        max: 10,
        step: 0.5,
        displayStepper: true,
        description: "Manual scroll speed when voice control is off",
    },
    backgroundColor: {
        type: ControlType.Color,
        defaultValue: "#000000",
    },
    textColor: {
        type: ControlType.Color,
        defaultValue: "#FFFFFF",
    },
    highlightColor: {
        type: ControlType.Color,
        defaultValue: "#FFD700",
        description: "Color for spoken words",
    },
    enableVoiceControl: {
        type: ControlType.Boolean,
        defaultValue: true,
        description: "Enable AI-powered voice recognition",
    },
})
