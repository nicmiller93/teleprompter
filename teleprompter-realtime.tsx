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
    enableVideoRecording: boolean
    uploadcarePublicKey: string
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
        enableVideoRecording = false,
        uploadcarePublicKey = "",
        width,
        height,
    } = props

    const [isListening, setIsListening] = React.useState(false)
    const [currentWordIndex, setCurrentWordIndex] = React.useState(0)
    const [scrollPosition, setScrollPosition] = React.useState(0)
    const [error, setError] = React.useState<string>("")
    const [connectionStatus, setConnectionStatus] = React.useState<string>("disconnected")
    
    // Video recording state
    const [isRecording, setIsRecording] = React.useState(false)
    const [recordedVideo, setRecordedVideo] = React.useState<Blob | null>(null)
    const [showSubmissionModal, setShowSubmissionModal] = React.useState(false)
    const [uploadProgress, setUploadProgress] = React.useState(0)
    const [uploadStatus, setUploadStatus] = React.useState<"idle" | "uploading" | "success" | "error">("idle")
    const [uploadedFileUrl, setUploadedFileUrl] = React.useState<string>("") 
    const [userName, setUserName] = React.useState("")
    const [userEmail, setUserEmail] = React.useState("")
    const [countdown, setCountdown] = React.useState<number | null>(null)
    const [isPreparingRecording, setIsPreparingRecording] = React.useState(false)
    const [showRetryOption, setShowRetryOption] = React.useState(false)
    const [isCameraEnabled, setIsCameraEnabled] = React.useState(false)
    const [showCameraPrompt, setShowCameraPrompt] = React.useState(false)
    const [videoPreviewUrl, setVideoPreviewUrl] = React.useState<string>("")    

    const scriptRef = React.useRef<HTMLDivElement>(null)
    const peerConnectionRef = React.useRef<RTCPeerConnection | null>(null)
    const dataChannelRef = React.useRef<RTCDataChannel | null>(null)
    const audioElementRef = React.useRef<HTMLAudioElement | null>(null)
    const lastMatchIndexRef = React.useRef<number>(0)
    const currentWordBufferRef = React.useRef<string>("")
    const lastProcessedWordRef = React.useRef<string>("")
    
    // Video recording refs
    const mediaRecorderRef = React.useRef<MediaRecorder | null>(null)
    const videoStreamRef = React.useRef<MediaStream | null>(null)
    const recordedChunksRef = React.useRef<Blob[]>([])
    const videoPreviewRef = React.useRef<HTMLVideoElement | null>(null)
    const playbackVideoRef = React.useRef<HTMLVideoElement | null>(null)
    
    // Split script into paragraphs and words while preserving structure
    const paragraphs = React.useMemo(() => {
        // Split on single newlines and filter empty lines
        return script.split(/\n/).map(line => line.trim()).filter(line => line.length > 0)
    }, [script])
    
    const words = React.useMemo(() => {
        // Flatten all paragraphs into a single word array for tracking
        // Filter out stage directions (text in square brackets like "[PAUSE]")
        return paragraphs.flatMap((para: string) => 
            para.split(/\s+/).filter((word: string) => !word.match(/^\[.*\]$/))
        )
    }, [paragraphs])
    
    const normalizedWords = React.useMemo(() => 
        words.map((w: string) => w.toLowerCase().replace(/[^\w]/g, "")),
        [words]
    )

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
            if (videoStreamRef.current) {
                videoStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop())
            }
        }
    }, [])

    // Toggle camera preview
    const toggleCamera = async () => {
        if (isCameraEnabled) {
            // Disable camera
            if (videoStreamRef.current) {
                videoStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop())
                videoStreamRef.current = null
            }
            setIsCameraEnabled(false)
        } else {
            // Enable camera
            try {
                setError("")
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 1920 },
                        height: { ideal: 1080 },
                        frameRate: { ideal: 30 }
                    },
                    audio: true
                })
                
                videoStreamRef.current = stream
                setIsCameraEnabled(true)
            } catch (err: any) {
                console.error("Error enabling camera:", err)
                setError(err?.message || "Failed to access camera. Please allow camera and microphone access.")
            }
        }
    }

    // Unified recording function with countdown
    const startRecording = async () => {
        // Check for actual stream instead of state (more reliable)
        if (!videoStreamRef.current) {
            setShowCameraPrompt(true)
            return
        }
        
        try {
            setError("")
            setIsPreparingRecording(true)
            
            // Step 1: Use existing camera stream
            const stream = videoStreamRef.current
            if (!stream) {
                throw new Error("Camera stream not available")
            }
            
            // Step 2: Show 3-2-1 countdown
            for (let i = 3; i > 0; i--) {
                setCountdown(i)
                await new Promise(resolve => setTimeout(resolve, 1000))
            }
            setCountdown(null)
            setIsPreparingRecording(false)
            
            // Step 3: Start video recording
            recordedChunksRef.current = []
            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'video/webm;codecs=vp9'
            })
            
            mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    recordedChunksRef.current.push(event.data)
                }
            }
            
            mediaRecorder.onstop = () => {
                const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' })
                setRecordedVideo(blob)
                // Create URL for video preview
                const url = URL.createObjectURL(blob)
                setVideoPreviewUrl(url)
                // Don't auto-show submission modal - wait for user decision
                // Camera stream stays active if user enabled it manually
            }
            
            mediaRecorder.start(1000)
            mediaRecorderRef.current = mediaRecorder
            setIsRecording(true)
            
            // Step 4: Start voice control
            await startVoiceControl()
            
        } catch (err: any) {
            console.error("Error starting recording:", err)
            setError(err?.message || "Failed to start recording. Please allow camera and microphone access.")
            setIsPreparingRecording(false)
            setCountdown(null)
            
            // Clean up if camera was activated
            if (videoStreamRef.current) {
                videoStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop())
                videoStreamRef.current = null
            }
        }
    }

    const stopRecording = () => {
        // Stop video recording
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop()
            mediaRecorderRef.current = null
        }
        
        // Stop voice control
        if (isListening) {
            stopVoiceControl()
        }
        
        setIsRecording(false)
        setShowRetryOption(true) // Show retry dialog first
    }

    const handleRetry = () => {
        // Clean up video preview URL
        if (videoPreviewUrl) {
            URL.revokeObjectURL(videoPreviewUrl)
            setVideoPreviewUrl("")
        }
        
        // Discard current recording
        setRecordedVideo(null)
        recordedChunksRef.current = []
        setShowRetryOption(false)
        
        // Reset teleprompter
        setCurrentWordIndex(0)
        setScrollPosition(0)
        lastMatchIndexRef.current = 0
        currentWordBufferRef.current = ""
        lastProcessedWordRef.current = ""
        
        // Don't auto-start recording - let user click Record button
    }

    const handleKeepRecording = () => {
        // Clean up video preview URL since we're moving to submission
        if (videoPreviewUrl) {
            URL.revokeObjectURL(videoPreviewUrl)
            setVideoPreviewUrl("")
        }
        
        // Turn off camera
        if (videoStreamRef.current) {
            videoStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop())
            videoStreamRef.current = null
        }
        setIsCameraEnabled(false)
        
        setShowRetryOption(false)
        setShowSubmissionModal(true)
    }

    const handleSubmitVideo = async () => {
        if (!recordedVideo || !userName || !userEmail || !uploadcarePublicKey) {
            setError("Please fill in all fields and provide an Uploadcare public key.")
            return
        }
        
        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(userEmail)) {
            setError("Please enter a valid email address.")
            return
        }

        try {
            setUploadStatus("uploading")
            setError("")
            setUploadProgress(10)
            
            // Use Uploadcare Upload API directly (no npm package needed)
            const formData = new FormData()
            formData.append('UPLOADCARE_PUB_KEY', uploadcarePublicKey)
            formData.append('UPLOADCARE_STORE', '1')
            
            // Create filename: name_email_timestamp.webm
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
            const sanitizedName = userName.replace(/[^a-zA-Z0-9]/g, '_')
            const sanitizedEmail = userEmail.replace(/[^a-zA-Z0-9@.]/g, '_')
            const filename = `${sanitizedName}_${sanitizedEmail}_${timestamp}.webm`
            
            formData.append('file', recordedVideo, filename)
            
            // Add metadata as separate form fields
            formData.append('metadata[name]', userName)
            formData.append('metadata[email]', userEmail)
            formData.append('metadata[recordedAt]', new Date().toISOString())
            
            setUploadProgress(30)
            
            const response = await fetch('https://upload.uploadcare.com/base/', {
                method: 'POST',
                body: formData
            })
            
            setUploadProgress(90)
            
            if (!response.ok) {
                throw new Error(`Upload failed: ${response.status} ${response.statusText}`)
            }
            
            const result = await response.json()
            
            if (!result.file) {
                throw new Error('Upload failed: No file ID returned')
            }
            
            // Construct CDN URL
            const cdnUrl = `https://ucarecdn.com/${result.file}/`
            setUploadedFileUrl(cdnUrl)
            setUploadProgress(100)
            setUploadStatus("success")
            
            // Send confirmation email via secure backend endpoint
            try {
                await fetch('https://speed-sermon-rttp.vercel.app/api/send-confirmation', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        userName,
                        userEmail,
                        filename
                    })
                })
            } catch (emailErr) {
                console.error('Failed to send confirmation email:', emailErr)
                // Don't fail the whole operation if email fails
            }
            
        } catch (err: any) {
            console.error("Upload error:", err)
            setError(err?.message || "Failed to upload video. Please try again.")
            setUploadStatus("error")
        }
    }

    const handleCancelSubmission = () => {
        setShowSubmissionModal(false)
        setRecordedVideo(null)
        setUserName("")
        setUserEmail("")
        setUploadProgress(0)
        setUploadStatus("idle")
        setUploadedFileUrl("")
        recordedChunksRef.current = []
    }

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
                    console.log("Received event:", event.type, event)

                    // Handle input audio transcription events
                    if (event.type === "conversation.item.input_audio_transcription.completed") {
                        const transcript = event.transcript.toLowerCase()
                        console.log("Transcript completed:", transcript)
                        currentWordBufferRef.current = ""
                        processTranscript(transcript)
                    } else if (event.type === "conversation.item.input_audio_transcription.delta") {
                        // Accumulate deltas and process word-by-word
                        const delta = event.delta.toLowerCase()
                        console.log("Transcript delta:", delta)
                        currentWordBufferRef.current += delta
                        
                        // Check if we have a complete word (ends with space)
                        if (delta.includes(" ")) {
                            const words = currentWordBufferRef.current.trim().split(/\s+/)
                            // Process all complete words except the last partial one
                            const completeWords = words.slice(0, -1)
                            if (completeWords.length > 0) {
                                const newCompleteText = completeWords.join(" ")
                                processWord(newCompleteText)
                                // Keep only the partial word
                                currentWordBufferRef.current = words[words.length - 1] || ""
                            }
                        }
                    } else if (event.type === "error") {
                        console.error("Error:", event.error)
                        setError(event.error.message || "Connection error")
                        setConnectionStatus("error")
                    } else if (event.type === "session.updated") {
                        console.log("Session configured:", event.session)
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



    const processWord = React.useCallback((wordText: string) => {
        const spokenWord = wordText.trim().replace(/[^\w]/g, "")
        if (!spokenWord || spokenWord.length < 2) return
        
        // Avoid processing the same word twice
        if (spokenWord === lastProcessedWordRef.current) return
        lastProcessedWordRef.current = spokenWord
        
        let matchIndex = lastMatchIndexRef.current
        
        // Look for exact match in a small window
        const searchLimit = Math.min(matchIndex + 5, normalizedWords.length)
        
        for (let j = matchIndex; j < searchLimit; j++) {
            const scriptWord = normalizedWords[j]
            if (!scriptWord) continue
            
            // Only exact matches
            if (scriptWord === spokenWord) {
                matchIndex = j + 1
                lastMatchIndexRef.current = matchIndex
                setCurrentWordIndex(matchIndex)
                
                // Auto-scroll
                requestAnimationFrame(() => {
                    if (scriptRef.current) {
                        const container = scriptRef.current
                        const wordElement = container.querySelector(`[data-word-index="${j}"]`) as HTMLElement
                        if (wordElement) {
                            const containerHeight = container.clientHeight
                            const containerScrollTop = container.scrollTop
                            
                            // Get word position relative to container
                            const wordTop = wordElement.offsetTop
                            const wordBottom = wordTop + wordElement.offsetHeight
                            
                            // Only scroll if word is near bottom of visible area
                            const visibleBottom = containerScrollTop + containerHeight
                            const scrollThreshold = containerScrollTop + (containerHeight * 0.7)
                            
                            if (wordBottom > scrollThreshold) {
                                // Scroll just enough to keep word in upper 1/3 of screen
                                const targetScroll = wordTop - (containerHeight * 0.3)
                                setScrollPosition(Math.max(0, targetScroll))
                            }
                        }
                    }
                })
                break
            }
        }
    }, [normalizedWords])

    const processTranscript = React.useCallback((transcript: string) => {
        // Process any remaining words from the completed transcript
        const spokenWords = transcript.split(/\s+/).filter((w: string) => w.length > 0)
        if (spokenWords.length === 0) return
        
        // Process each word that hasn't been processed yet
        for (const word of spokenWords) {
            processWord(word)
        }
        
        // Reset processed word tracker for next turn
        lastProcessedWordRef.current = ""
    }, [processWord])

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

    // Auto-scroll effect
    React.useEffect(() => {
        if (scriptRef.current) {
            scriptRef.current.scrollTop = scrollPosition
        }
    }, [scrollPosition])

    // Connect video stream to video element when camera is enabled
    React.useEffect(() => {
        if (isCameraEnabled && videoPreviewRef.current && videoStreamRef.current) {
            videoPreviewRef.current.srcObject = videoStreamRef.current
        } else if (!isCameraEnabled && videoPreviewRef.current) {
            videoPreviewRef.current.srcObject = null
        }
    }, [isCameraEnabled])

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
            {/* Video Preview Background (when camera is enabled) */}
            {isCameraEnabled && (
                <video
                    ref={videoPreviewRef}
                    autoPlay
                    muted
                    playsInline
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        transform: "scaleX(-1)", // Mirror the video
                        filter: "blur(8px)",
                        zIndex: 0,
                    }}
                />
            )}
            
            {/* Semi-transparent overlay when camera is enabled */}
            {isCameraEnabled && (
                <div
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        backgroundColor: "rgba(0, 0, 0, 0.65)",
                        zIndex: 1,
                    }}
                />
            )}
            
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
                    display: "flex",
                    justifyContent: "center",
                    position: "relative",
                    zIndex: 2,
                }}
            >
                <div style={{ 
                    fontSize, 
                    color: textColor, 
                    lineHeight: 1.8,
                    wordWrap: "break-word",
                    whiteSpace: "pre-wrap",
                    maxWidth: "800px",
                    width: "100%",
                }}>
                    {(() => {
                        let wordIndex = 0
                        return paragraphs.map((paragraph: string, paraIndex: number) => {
                            const paraWords = paragraph.split(/\s+/)
                            const paraWordElements = paraWords.map((word: string, localIndex: number) => {
                                const globalIndex = wordIndex++
                                return (
                                    <span
                                        key={globalIndex}
                                        data-word-index={globalIndex}
                                        style={{
                                            backgroundColor:
                                                globalIndex < currentWordIndex
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
                                )
                            })
                            return (
                                <div key={paraIndex} style={{ marginBottom: "0.8em" }}>
                                    {paraWordElements}
                                </div>
                            )
                        })
                    })()}
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
                    padding: "20px",
                    zIndex: 3,
                }}
            >
                {/* Centered Record Button */}
                {enableVideoRecording && uploadcarePublicKey ? (
                    <button
                        onClick={isRecording ? stopRecording : startRecording}
                        disabled={isPreparingRecording}
                        style={{
                            position: "absolute",
                            left: "50%",
                            top: "50%",
                            transform: "translate(-50%, -50%)",
                            padding: "12px 24px",
                            fontSize: "16px",
                            borderRadius: "8px",
                            border: "none",
                            backgroundColor: isRecording ? "#ff4444" : isPreparingRecording ? "#666" : "#e91e63",
                            color: "white",
                            cursor: isPreparingRecording ? "wait" : "pointer",
                            fontWeight: "bold",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                        }}
                    >
                        {isRecording && <div style={{
                            width: "10px",
                            height: "10px",
                            borderRadius: "50%",
                            backgroundColor: "white",
                            animation: "pulse 1.5s infinite"
                        }} />}
                        {isPreparingRecording ? "Preparing..." : isRecording ? "Stop Recording" : "Record"}
                    </button>
                ) : enableVoiceControl && (
                    <button
                        onClick={isListening ? stopVoiceControl : startVoiceControl}
                        disabled={connectionStatus === "connecting"}
                        style={{
                            position: "absolute",
                            left: "50%",
                            top: "50%",
                            transform: "translate(-50%, -50%)",
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

                {/* Right-aligned Status Indicator */}
                <div style={{ 
                    position: "absolute",
                    right: "20px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "white", 
                    fontSize: "14px",
                    textAlign: "right"
                }}>
                    {isRecording ? "🔴 Recording" : connectionStatus}
                    {currentWordIndex > 0 && ` | Progress: ${Math.round((currentWordIndex / words.length) * 100)}%`}
                </div>
            </div>

            {/* Retry/Keep Recording Dialog */}
            {showRetryOption && (
                <div
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: "rgba(0, 0, 0, 0.9)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 1800,
                    }}
                >
                    <div
                        style={{
                            backgroundColor: "#1a1a1a",
                            padding: "40px",
                            borderRadius: "12px",
                            maxWidth: "600px",
                            width: "90%",
                            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.5)",
                        }}
                    >
                        <h2 style={{ color: "white", marginTop: 0, marginBottom: "20px", textAlign: "center" }}>
                            Recording Complete
                        </h2>
                        
                        {/* Video Preview Player */}
                        {videoPreviewUrl && (
                            <div style={{ marginBottom: "20px", borderRadius: "8px", overflow: "hidden" }}>
                                <video
                                    ref={playbackVideoRef}
                                    src={videoPreviewUrl}
                                    controls
                                    style={{
                                        width: "100%",
                                        maxHeight: "400px",
                                        backgroundColor: "#000",
                                        display: "block",
                                    }}
                                />
                            </div>
                        )}
                        
                        <p style={{ color: "#ccc", marginBottom: "30px", textAlign: "center" }}>
                            Review your recording above. Keep it or try again?
                        </p>
                        <div style={{ display: "flex", gap: "12px" }}>
                            <button
                                onClick={handleRetry}
                                style={{
                                    flex: 1,
                                    padding: "12px 24px",
                                    fontSize: "16px",
                                    borderRadius: "8px",
                                    border: "none",
                                    backgroundColor: "#ff9800",
                                    color: "white",
                                    cursor: "pointer",
                                    fontWeight: "bold",
                                }}
                            >
                                Try Again
                            </button>
                            <button
                                onClick={handleKeepRecording}
                                style={{
                                    flex: 1,
                                    padding: "12px 24px",
                                    fontSize: "16px",
                                    borderRadius: "8px",
                                    border: "none",
                                    backgroundColor: "#4CAF50",
                                    color: "white",
                                    cursor: "pointer",
                                    fontWeight: "bold",
                                }}
                            >
                                Save Recording
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Camera Enable Prompt */}
            {showCameraPrompt && (
                <div
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: "rgba(0, 0, 0, 0.9)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 1800,
                    }}
                >
                    <div
                        style={{
                            backgroundColor: "#1a1a1a",
                            padding: "40px",
                            borderRadius: "12px",
                            maxWidth: "500px",
                            width: "90%",
                            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.5)",
                            position: "relative",
                        }}
                    >
                        {/* Close X button */}
                        <button
                            onClick={() => setShowCameraPrompt(false)}
                            style={{
                                position: "absolute",
                                top: "12px",
                                right: "12px",
                                width: "32px",
                                height: "32px",
                                borderRadius: "50%",
                                border: "none",
                                backgroundColor: "rgba(255, 255, 255, 0.1)",
                                color: "#fff",
                                fontSize: "20px",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                transition: "background-color 0.2s",
                                padding: "0",
                                lineHeight: "1",
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.2)"
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.1)"
                            }}
                        >
                            ×
                        </button>
                        
                        <h2 style={{ color: "white", marginTop: 0, marginBottom: "20px", textAlign: "center" }}>
                          Ready to record?
                        </h2>
                        <p style={{ color: "#ccc", marginBottom: "30px", textAlign: "center" }}>
                            Your camera will appear as a blurred background behind the teleprompter. Recording starts after a 3-second countdown.
                        </p>
                        <button
                            onClick={async () => {
                                setShowCameraPrompt(false)
                                try {
                                    const stream = await navigator.mediaDevices.getUserMedia({
                                        video: {
                                            width: { ideal: 1920 },
                                            height: { ideal: 1080 },
                                            frameRate: { ideal: 30 }
                                        },
                                        audio: true
                                    })
                                    videoStreamRef.current = stream
                                    setIsCameraEnabled(true)
                                    // Automatically start recording after camera is enabled
                                    await startRecording()
                                } catch (err: any) {
                                    console.error("Error enabling camera:", err)
                                    setError(err?.message || "Failed to access camera. Please allow camera and microphone access.")
                                }
                            }}
                            style={{
                                width: "100%",
                                padding: "12px 24px",
                                fontSize: "16px",
                                borderRadius: "8px",
                                border: "none",
                                backgroundColor: "#4CAF50",
                                color: "white",
                                cursor: "pointer",
                                fontWeight: "bold",
                            }}
                        >
                            Start Recording
                        </button>
                    </div>
                </div>
            )}

            {/* Countdown Overlay */}
            {countdown !== null && (
                <div
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: "rgba(0, 0, 0, 0.8)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 1500,
                    }}
                >
                    <div style={{
                        fontSize: "120px",
                        fontWeight: "bold",
                        color: "white",
                        animation: "pulse 1s ease-in-out"
                    }}>
                        {countdown}
                    </div>
                </div>
            )}

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
                        zIndex: 3000,
                    }}
                >
                    {error}
                </div>
            )}

            {/* Submission Modal */}
            {showSubmissionModal && (
                <div
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: "rgba(0, 0, 0, 0.9)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 2000,
                    }}
                >
                    <div
                        style={{
                            backgroundColor: "#1a1a1a",
                            padding: "40px",
                            borderRadius: "12px",
                            maxWidth: "500px",
                            width: "90%",
                            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.5)",
                        }}
                    >
                        {uploadStatus === "success" ? (
                            <>
                                <h2 style={{ color: "#4CAF50", marginTop: 0, marginBottom: "20px" }}>
                                    ✓ Upload Successful!
                                </h2>
                                <p style={{ color: "white", marginBottom: "20px" }}>
                                    Your video has been uploaded successfully.
                                </p>
                                <button
                                    onClick={handleCancelSubmission}
                                    style={{
                                        padding: "12px 24px",
                                        fontSize: "16px",
                                        borderRadius: "8px",
                                        border: "none",
                                        backgroundColor: "#4CAF50",
                                        color: "white",
                                        cursor: "pointer",
                                        fontWeight: "bold",
                                        width: "100%",
                                    }}
                                >
                                    Done
                                </button>
                            </>
                        ) : (
                            <>
                                <h2 style={{ color: "white", marginTop: 0, marginBottom: "20px" }}>
                                    Submit Your Recording
                                </h2>
                                
                                <div style={{ marginBottom: "20px" }}>
                                    <label style={{ color: "white", display: "block", marginBottom: "8px" }}>
                                        Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={userName}
                                        onChange={(e) => setUserName(e.target.value)}
                                        disabled={uploadStatus === "uploading"}
                                        style={{
                                            width: "100%",
                                            padding: "12px",
                                            fontSize: "16px",
                                            borderRadius: "8px",
                                            border: "1px solid #444",
                                            backgroundColor: "#2a2a2a",
                                            color: "white",
                                            boxSizing: "border-box",
                                        }}
                                        placeholder="Enter your name"
                                    />
                                </div>

                                <div style={{ marginBottom: "20px" }}>
                                    <label style={{ color: "white", display: "block", marginBottom: "8px" }}>
                                        Email *
                                    </label>
                                    <input
                                        type="email"
                                        value={userEmail}
                                        onChange={(e) => setUserEmail(e.target.value)}
                                        disabled={uploadStatus === "uploading"}
                                        style={{
                                            width: "100%",
                                            padding: "12px",
                                            fontSize: "16px",
                                            borderRadius: "8px",
                                            border: "1px solid #444",
                                            backgroundColor: "#2a2a2a",
                                            color: "white",
                                            boxSizing: "border-box",
                                        }}
                                        placeholder="Enter your email"
                                    />
                                </div>

                                {uploadStatus === "uploading" && (
                                    <div style={{ marginBottom: "20px" }}>
                                        <div style={{ color: "white", marginBottom: "8px" }}>
                                            Uploading: {uploadProgress}%
                                        </div>
                                        <div style={{
                                            width: "100%",
                                            height: "8px",
                                            backgroundColor: "#333",
                                            borderRadius: "4px",
                                            overflow: "hidden",
                                        }}>
                                            <div style={{
                                                width: `${uploadProgress}%`,
                                                height: "100%",
                                                backgroundColor: "#4CAF50",
                                                transition: "width 0.3s",
                                            }} />
                                        </div>
                                    </div>
                                )}

                                <div style={{ display: "flex", gap: "12px" }}>
                                    <button
                                        onClick={handleCancelSubmission}
                                        disabled={uploadStatus === "uploading"}
                                        style={{
                                            flex: 1,
                                            padding: "12px 24px",
                                            fontSize: "16px",
                                            borderRadius: "8px",
                                            border: "none",
                                            backgroundColor: "#666",
                                            color: "white",
                                            cursor: uploadStatus === "uploading" ? "not-allowed" : "pointer",
                                            fontWeight: "bold",
                                            opacity: uploadStatus === "uploading" ? 0.5 : 1,
                                        }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSubmitVideo}
                                        disabled={uploadStatus === "uploading" || !userName || !userEmail}
                                        style={{
                                            flex: 1,
                                            padding: "12px 24px",
                                            fontSize: "16px",
                                            borderRadius: "8px",
                                            border: "none",
                                            backgroundColor: "#4CAF50",
                                            color: "white",
                                            cursor: (uploadStatus === "uploading" || !userName || !userEmail) ? "not-allowed" : "pointer",
                                            fontWeight: "bold",
                                            opacity: (uploadStatus === "uploading" || !userName || !userEmail) ? 0.5 : 1,
                                        }}
                                    >
                                        {uploadStatus === "uploading" ? "Uploading..." : "Submit"}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

addPropertyControls(TeleprompterRealtime, {
    script: {
        type: ControlType.String,
        defaultValue:
            `[LOOK AT CAMERA]
Hello. I'm recording this sample to help create an accurate digital voice model.
[PAUSE]
Let me start by talking about something we all experience: communication. The way we share ideas matters. It shapes how people understand us, trust us, and decide whether to work with us.
[SLOW DOWN]
Good communication isn't about using fancy words or complex sentences. It's about clarity. It's about saying what you mean without making people work to understand you.
[PAUSE]
Think about the last time someone explained something complicated to you. Maybe it was a technical process, a legal document, or instructions for assembling furniture.
[PAUSE]
Was it clear? Or did you have to read it three times to figure out what they actually meant?
[PAUSE]
That frustration happens everywhere. In business. In education. In everyday conversations. And it's usually because the person communicating wasn't thinking about their audience.
[PAUSE]
Let me give you an example.
[SLOW DOWN]
Imagine you're writing an email to a colleague about a project deadline. You could say: "Per our previous discussion regarding the deliverable timeline, we should synergize our efforts to ensure optimal outcomes."
[PAUSE]
Or you could say: "Based on our last conversation, we need to coordinate better to hit this deadline."
[PAUSE]
Same message. One is clear. The other is dressed up in jargon that adds nothing.
[PAUSE]
[EMPHASIZE] I think about this a lot when I'm working on projects. Whether it's writing, planning, or problem-solving, the goal should always be clarity first.
[PAUSE]
Short sentences work well for emphasis. They land hard.
[SPEED UP SLIGHTLY]
Longer sentences give you room to build an argument, add context, or explain something that needs more than a few words to make sense.
[PAUSE]
Then you pull back to short again.
[PAUSE]
Variety matters. It keeps people engaged. It prevents your communication from becoming monotonous or predictable. And it helps you control the rhythm of what you're saying.
[LONG PAUSE]
Now let's talk about problem-solving. Every project, every business, every team faces problems. That's normal.
[EMPHASIZE]
What separates good outcomes from bad ones is how you approach those problems.
[PAUSE]
Do you jump to solutions immediately?
[PAUSE - BRIEF]
Or do you take time to understand what's actually wrong?
[PAUSE]
Most people rush. They want to fix things quickly. But quick fixes often miss the root cause. You end up solving symptoms instead of the actual problem.
[PAUSE]
[SLOW DOWN]
Better approach: slow down. Ask questions. Figure out what's really happening before you decide what to do about it.
[PAUSE]
This applies to creative work too. Writing, design, video production—whatever you're making. First drafts are rarely good.
[PAUSE]
The magic happens in revision. In testing. In getting feedback and making it better.
[PAUSE]
I've worked on projects where we went through five, six, seven iterations before landing on something that actually worked. That's not failure.
[PAUSE - BRIEF]
That's process.
[PAUSE]
[CONVERSATIONAL TONE]
Let me shift gears and talk about technology for a minute. We're living through a massive change in how technology impacts our daily lives. Artificial intelligence, automation, digital tools—they're everywhere.
[PAUSE]
Some people are excited about this. Some people are worried.
[PAUSE - BRIEF]
Both reactions make sense.
[PAUSE]
Technology is a tool. Like any tool, it can be used well or poorly.
[SLOW DOWN]
The question isn't whether we should use it. The question is how we use it, and what problems we're trying to solve.
[PAUSE]
Are we using technology to make things genuinely better? Or are we using it just because it's new and impressive?
[PAUSE]
[EMPHASIZE]
That distinction matters.
[LONG PAUSE]
I also think about this when it comes to presenting information. Whether you're giving a presentation, recording a video, or writing a report, your job is to make your audience's life easier.
[PAUSE]
Don't make them dig for the point. Lead with what matters. Give them context when they need it, but don't bury the important stuff under layers of preamble.
[PAUSE]
[EMPHASIZE]
Respect their time. Respect their intelligence.
[PAUSE]
[SPEED UP SLIGHTLY]
This applies to teaching too. Good teachers don't just dump information on students. They structure it. They build from simple to complex. They check for understanding before moving forward.
[PAUSE]
Bad teaching assumes everyone learns the same way at the same speed. Good teaching adapts.
[LONG PAUSE]
[SLOW DOWN]
So what does all of this have in common? Communication. Problem-solving. Teaching. Technology. They all require the same basic approach: clarity, intention, and respect for your audience.
[PAUSE]
Whether you're writing an email, building a product, or just having a conversation, those principles apply.
[PAUSE]
Be clear about what you're saying. Be intentional about why you're saying it. And remember that the person on the other end is trying to understand you.
[PAUSE]
[EMPHASIZE]
Make that easy for them.
[LONG PAUSE]
[LOOK AT CAMERA]
Thanks for listening to this sample. I hope it serves its purpose well.`,
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
    enableVideoRecording: {
        type: ControlType.Boolean,
        defaultValue: false,
        description: "Enable video recording with Uploadcare upload",
    },
    uploadcarePublicKey: {
        type: ControlType.String,
        defaultValue: "",
        description: "Your Uploadcare public API key (required for video recording)",
        hidden: (props: Props) => !props.enableVideoRecording,
    },
})
