"use client";

import { ListenModel, SpeechModel, ThinkModel } from "@/app/lib/Models"
import { Mic } from "../mic/Mic";
import { useState, useRef } from "react";
import { AgentEvents, DeepgramClient, type AgentLiveClient } from "@deepgram/sdk";
import { voiceAgentLog } from "@/app/lib/Logger";
import styles from "./Body.module.css";

/**
 * Main voice agent interface component
 * Handles authentication, connection, audio processing, and conversation display
 */
export const Body = () => {
    // UI and connection state
    const [micState, setMicState] = useState<"open" | "loading" | "closed">("closed");
    const [error, setError] = useState<string | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [connected, setConnected] = useState<boolean>(false);

    // Agent configuration
    const [listenModel, setListenModel] = useState<ListenModel>(ListenModel.General);
    const [thinkModel, setThinkModel] = useState<ThinkModel>(ThinkModel.Claude);
    const [speechModel, setSpeechModel] = useState<SpeechModel>(SpeechModel.Thalia);

    // Client and conversation state
    const [client, setClient] = useState<AgentLiveClient | null>(null);
    const [transcript, setTranscript] = useState<Array<{ role: string, content: string }>>([]);
    const [isAgentSpeaking, setIsAgentSpeaking] = useState<boolean>(false);

    // Audio playback management refs
    const audioContextRef = useRef<AudioContext | null>(null);
    const currentAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
    const nextStartTimeRef = useRef<number>(0);
    const audioQueueRef = useRef<Uint8Array[]>([]);

    // Initialize or get audio context
    const getAudioContext = async (): Promise<AudioContext> => {
        if (!audioContextRef.current) {
            audioContextRef.current = new AudioContext();
            console.log("🔊 AUDIO: Created new AudioContext");
        }

        // Resume audio context if suspended (required for modern browsers)
        if (audioContextRef.current.state === 'suspended') {
            await audioContextRef.current.resume();
            console.log("▶️ AUDIO: Resumed AudioContext after user interaction");
        }

        return audioContextRef.current;
    };

    // Stop any currently playing audio
    const stopCurrentAudio = () => {
        if (currentAudioSourceRef.current) {
            try {
                currentAudioSourceRef.current.stop();
                console.log("🛑 AUDIO: Stopped current audio playback");
            } catch {
                // Audio might already be stopped
                console.log("⚠️ AUDIO: Audio already stopped");
            }
            currentAudioSourceRef.current = null;
        }
        setIsAgentSpeaking(false);
    };

    // === AUTHENTICATION ===
    const authenticate = () => {
        voiceAgentLog.auth("Starting authentication process...");
        fetch("/api/token", {
            method: "GET",
            headers: {
                "Content-Type": "application/json"
            }
        }).then(async response => {
            if (response.ok) {
                const data = await response.json();
                voiceAgentLog.auth("Authentication successful - Token received and stored");
                setToken(data.token);
            } else {
                const errorText = await response.text();
                voiceAgentLog.error(`Authentication failed: ${errorText}`);
                setError(`Authentication failed: ${errorText}`);
            }
        }).catch((error) => {
            voiceAgentLog.error(`Authentication failed: ${error.message}`);
            setError(`Authentication failed: ${error.message}`);
        })
    }

    // === CONNECTION MANAGEMENT ===
    const disconnect = () => {
        if (!client) {
            console.warn("⚠️ DISCONNECT: No client connected to disconnect.");
            setError("No client connected to disconnect.");
            return;
        }

        console.log("🔌 DISCONNECTING: Initiating graceful shutdown...");
        try {
            client.disconnect();
            console.log("✅ DISCONNECT: Client disconnected successfully");
        } catch (error) {
            console.error("❌ DISCONNECT ERROR:", error);
        }

        // Stop any playing audio
        stopCurrentAudio();

        // Close audio context
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
            console.log("🔊 AUDIO: Closed AudioContext");
        }

        // Clean up state
        setClient(null);
        setConnected(false);
        setMicState("closed");
        setToken(null);
        setError(null);
        setTranscript([]);

        // Clear audio queue and reset timing
        audioQueueRef.current = [];
        nextStartTimeRef.current = 0;
        setIsAgentSpeaking(false);
        console.log("🧹 CLEANUP: All state cleared, ready for new connection");
    }

    const connect = () => {
        if (!token) {
            setError("No token available. Please authenticate first.");
            return;
        }

        voiceAgentLog.connection("Creating Deepgram Agent client...");
        const client = new DeepgramClient({ accessToken: token }).agent();
        setClient(client);

        voiceAgentLog.connection("Deepgram Agent client created successfully");
        client.once(AgentEvents.Welcome, (welcomeMessage) => {
            voiceAgentLog.agentEvent("Welcome - Connected to Deepgram agent", welcomeMessage);
            const settings = {
                audio: {
                    input: {
                        encoding: "linear16",
                        sample_rate: 24000
                    },
                    output: {
                        encoding: "linear16",
                        sample_rate: 24000,
                        container: "none"
                    }
                },
                agent: {
                    greeting: "hey! So you've just downloaded the Nuffield Health app. I'm curious, why?",
                    listen: {
                        provider: {
                            type: "deepgram",
                            model: listenModel,
                        }
                    },
                    speak: {
                        provider: {
                            type: "deepgram",
                            model: speechModel
                        }
                    },
                    think: {
                        provider: {
                            type: thinkModel === ThinkModel.Claude ? "anthropic" : "open_ai",
                            model: thinkModel
                        },
                        prompt: "You are a friendly virtual sports coach. Ask one short question at a time, then wait for the user’s answer before continuing. Start by asking why they opened the app today. Ask a few quick questions about their exercise habits to learn their goals. If they want to train now, guide a short workout; otherwise suggest a time and offer to set a reminder. Celebrate completed sessions, mention the nearest gym is 10 minutes away, and offer a morning intro visit with coach Barnie."
                    }
                }
            };
            voiceAgentLog.agentEvent("Applying agent configuration", settings);
            client.configure(settings)
        })
        client.once(AgentEvents.SettingsApplied, (appliedSettings) => {
            voiceAgentLog.agentEvent("SettingsApplied - Configuration successful", appliedSettings);
            setConnected(true);
            setMicState("open");

            // Initialize audio context for immediate playback readiness
            getAudioContext().then(() => {
                console.log("🔊 AUDIO: AudioContext initialized and ready for agent responses");
            }).catch(error => {
                console.error("❌ AUDIO: Failed to initialize AudioContext:", error);
            });

            // Set up keep-alive mechanism
            console.log("💓 KEEPALIVE: Starting keep-alive mechanism");
            client.keepAlive();
            const keepAliveInterval = setInterval(() => {
                if (client) {
                    console.log("💓 KEEPALIVE: Sending keep-alive ping");
                    client.keepAlive();
                } else {
                    clearInterval(keepAliveInterval);
                }
            }, 8000);
        })
        client.on(AgentEvents.Error, (error) => {
            voiceAgentLog.error("Agent error occurred", error);
            setError(`Agent error: ${error.message}`);
        })
        client.on(AgentEvents.Audio, async (audio: Uint8Array) => {
            voiceAgentLog.audio(`Audio chunk received: ${audio.length} bytes`);
            // Add chunk to queue for sequential playback
            audioQueueRef.current.push(audio);
            processAudioQueue();
        })
        client.on(AgentEvents.AgentAudioDone, () => {
            voiceAgentLog.agentEvent("AgentAudioDone - Agent finished speaking");
            // Don't set isAgentSpeaking false here - let the queue finish
        })

        // Process queued audio chunks for seamless playback
        const processAudioQueue = async () => {
            if (audioQueueRef.current.length === 0) return;

            try {
                const audioContext = await getAudioContext();
                const currentTime = audioContext.currentTime;

                // Initialize start time if this is the first chunk
                if (nextStartTimeRef.current < currentTime) {
                    nextStartTimeRef.current = currentTime;
                }

                // Process all queued chunks sequentially
                while (audioQueueRef.current.length > 0) {
                    const audioChunk = audioQueueRef.current.shift()!;

                    // Convert raw audio bytes to linear16 format
                    const audioData = new Int16Array(audioChunk.buffer);

                    if (audioData.length === 0) continue; // Skip empty chunks

                    // Create AudioBuffer for this chunk at 24kHz
                    const buffer = audioContext.createBuffer(1, audioData.length, 24000);
                    const channelData = buffer.getChannelData(0);

                    // Convert Int16 to Float32 for Web Audio API
                    for (let i = 0; i < audioData.length; i++) {
                        channelData[i] = audioData[i] / 0x7FFF; // Normalize to [-1, 1]
                    }

                    // Create and configure audio source
                    const source = audioContext.createBufferSource();
                    source.buffer = buffer;
                    source.connect(audioContext.destination);

                    // Schedule this chunk to start exactly when the previous one ends
                    const startTime = nextStartTimeRef.current;
                    source.start(startTime);

                    // Update next start time to end of this chunk
                    nextStartTimeRef.current = startTime + buffer.duration;

                    setIsAgentSpeaking(true);

                    // Set up completion handler for the last chunk
                    source.onended = () => {
                        // Check if this was the last scheduled chunk
                        if (audioContext.currentTime >= nextStartTimeRef.current - 0.1) {
                            if (audioQueueRef.current.length === 0) {
                                setIsAgentSpeaking(false);
                                voiceAgentLog.audio("Agent finished speaking");
                            }
                        }
                    };

                    currentAudioSourceRef.current = source;
                }

            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                voiceAgentLog.error("Audio queue processing error", errorMessage);
            }
        }
        client.on(AgentEvents.ConversationText, (message) => {
            voiceAgentLog.conversation(`${message.role.toUpperCase()}: "${message.content}"`, message);
            setTranscript(prev => [...prev, { role: message.role, content: message.content }]);
        })

        // === EVENT HANDLERS ===
        // Additional event handlers for comprehensive logging
        client.on(AgentEvents.UserStartedSpeaking, () => {
            voiceAgentLog.agentEvent("UserStartedSpeaking - User began speaking");
            // Handle user interruption: clear audio queue and stop playback
            audioQueueRef.current = [];
            nextStartTimeRef.current = 0;
            setIsAgentSpeaking(false);
            voiceAgentLog.audio("User interruption - cleared audio queue");
        });

        client.on(AgentEvents.AgentStartedSpeaking, (data) => {
            voiceAgentLog.agentEvent("AgentStartedSpeaking - Agent began response", data);
        });

        client.on(AgentEvents.Close, (closeEvent) => {
            voiceAgentLog.connection("Agent connection closed", closeEvent);
        });
    }

    // === UI RENDER ===
    return (
        <main className={styles.main}>
            <div className={styles.container}>
                {error && (
                    <div className={styles.error}>
                        {error}
                    </div>
                )}

                {!token && (
                    <section className={styles.panel}>
                        <div className={styles.authActions}>
                            <button className={styles.primaryButton} onClick={authenticate}>
                                Authenticate
                            </button>
                        </div>
                    </section>
                )}

                {token && !connected && (
                    <section className={styles.panel}>
                        <form className={styles.form}>
                            <label>
                                Listen
                                <select
                                    name="listen"
                                    value={listenModel}
                                    onChange={(e) => setListenModel(e.target.value as ListenModel)}
                                >
                                    <option value={ListenModel.General}>General Purpose</option>
                                    <option value={ListenModel.Medical}>Medical</option>
                                </select>
                            </label>
                            <label>
                                Think
                                <select
                                    name="think"
                                    value={thinkModel}
                                    onChange={(e) => setThinkModel(e.target.value as ThinkModel)}
                                >
                                    <option value={ThinkModel.Claude}>Claude</option>
                                    <option value={ThinkModel.GPT}>GPT</option>
                                </select>
                            </label>
                            <label>
                                Voice
                                <select
                                    name="speech"
                                    value={speechModel}
                                    onChange={(e) => setSpeechModel(e.target.value as SpeechModel)}
                                >
                                    <option value={SpeechModel.Thalia}>Thalia</option>
                                    <option value={SpeechModel.Andromeda}>Andromeda</option>
                                    <option value={SpeechModel.Helena}>Helena</option>
                                    <option value={SpeechModel.Apollo}>Apollo</option>
                                    <option value={SpeechModel.Arcas}>Arcas</option>
                                    <option value={SpeechModel.Aries}>Aries</option>
                                </select>
                            </label>
                            <button type="button" onClick={connect}>
                                Connect
                            </button>
                        </form>
                    </section>
                )}

                {connected && (
                    <section className={styles.chatPanel}>
                        <div className={styles.toolbar}>
                            <Mic state={micState} client={client} onError={setError} />
                            <button
                                type="button"
                                className={styles.iconButton}
                                onClick={disconnect}
                                aria-label="Disconnect session"
                            >
                                ⏼
                            </button>
                        </div>
                        <div className={styles.messagesOuter}>
                            <div className={styles.messagesInner}>
                                {transcript.length === 0 ? (
                                    <div className={styles.empty}>
                                        Messages will appear here
                                    </div>
                                ) : (
                                    transcript.map((message, index) => (
                                        <div
                                            key={index}
                                            className={`${styles.bubble} ${message.role === 'user' ? styles.user : styles.agent}`}
                                        >
                                            <span className={styles.label}>
                                                {message.role === 'user' ? 'You' : 'Assistant'}
                                            </span>
                                            <div className={styles.text}>{message.content}</div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </section>
                )}
            </div>
        </main>
    );
}
