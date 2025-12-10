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
    const peerConnectionRef = React.useRef<RTCPeerConnection | null>(null)
    const dataChannelRef = React.useRef<RTCDataChannel | null>(null)
    const audioElementRef = React.useRef<HTMLAudioElement | null>(null)
    const words = React.useMemo(() => script.split(/\s+/), [script])

    const VERCEL_TOKEN_URL = "https://speed-sermon-rttp.vercel.app/api/token"

    // Cleanup on unmount
    React.useEffect(() => {
        return () => {
            if (dataChannelRef.current) {
                dataChannelRef.current.close()
            }
            if (peerConnectionRef.current) {
                peerConnectionRef.current.close()
            }
            if (audioElementRef.current) {
                audioElementRef.current.srcObject = null
            }
        }
    }, [])



    const startVoiceControl = async () => {
        try {
            setError("")
            setConnectionStatus("connecting")

            // Step 1: Get ephemeral token from Vercel
            const tokenResponse = await fetch(VERCEL_TOKEN_URL)
            if (!tokenResponse.ok) {
                throw new Error("Failed to get authentication token")
            }
            const data = await tokenResponse.json()
            const ephemeralKey = data.value

            // Step 2: Create WebRTC peer connection
            const pc = new RTCPeerConnection()
            peerConnectionRef.current = pc

            // Set up audio element to play remote audio from the model
            const audioEl = document.createElement("audio")
            audioEl.autoplay = true
            audioElementRef.current = audioEl
            pc.ontrack = (e) => {
                console.log("Received audio track from OpenAI")
                audioEl.srcObject = e.streams[0]
            }

            // Add local audio track for microphone input
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    sampleRate: 24000,
                    echoCancellation: true,
                    noiseSuppression: true,
                }
            })
            pc.addTrack(stream.getTracks()[0])

            // Set up data channel for sending and receiving events
            const dc = pc.createDataChannel("oai-events")
            dataChannelRef.current = dc

            dc.onopen = () => {
                console.log("Data channel opened")
                setConnectionStatus("connected")
                setIsListening(true)
            }

            dc.onmessage = (e) => {
                try {
                    const event = JSON.parse(e.data)
                    console.log("Received event:", event.type)

                    if (event.type === "conversation.item.input_audio_transcription.completed") {
                        const transcript = event.transcript.toLowerCase()
                        console.log("Transcript:", transcript)
                        processTranscript(transcript)
                    } else if (event.type === "input_audio_transcription.completed") {
                        const transcript = (event.transcript || "").toLowerCase()
                        console.log("Transcript:", transcript)
                        processTranscript(transcript)
                    } else if (event.type === "error") {
                        console.error("Error:", event.error)
                        setError(event.error.message || "Connection error")
                        setConnectionStatus("error")
                    } else if (event.type === "session.updated") {
                        console.log("Session configured")
                    }
                } catch (err) {
                    console.error("Error parsing event:", err)
                }
            }

            dc.onerror = (error) => {
                console.error("Data channel error:", error)
                setError("Connection error")
                setConnectionStatus("error")
            }

            dc.onclose = () => {
                console.log("Data channel closed")
                setConnectionStatus("disconnected")
                setIsListening(false)
            }

            // Start the session using SDP
            const offer = await pc.createOffer()
            await pc.setLocalDescription(offer)

            console.log("Connecting to OpenAI Realtime API via WebRTC...")
            const sdpResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
                method: "POST",
                body: offer.sdp,
                headers: {
                    Authorization: `Bearer ${ephemeralKey}`,
                    "Content-Type": "application/sdp",
                },
            })

            if (!sdpResponse.ok) {
                throw new Error(`Failed to connect: ${sdpResponse.status}`)
            }

            const answerSdp = await sdpResponse.text()
            const answer = {
                type: "answer" as RTCSdpType,
                sdp: answerSdp,
            }
            await pc.setRemoteDescription(answer)

            console.log("WebRTC connection established")

        } catch (err: any) {
            console.error("Error starting voice control:", err)
            setError(err?.message || "Failed to start voice control")
            setConnectionStatus("error")
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
        if (dataChannelRef.current) {
            dataChannelRef.current.close()
            dataChannelRef.current = null
        }
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close()
            peerConnectionRef.current = null
        }
        if (audioElementRef.current) {
            audioElementRef.current.srcObject = null
            audioElementRef.current = null
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
