"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { type AgentLiveClient } from "@deepgram/sdk";
import { voiceAgentLog } from "@/app/lib/Logger";

interface MicProps {
  state: "open" | "closed" | "loading";
  client?: AgentLiveClient | null;
  onError?: (error: string) => void;
}

export const Mic = ({ state, client, onError }: MicProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const isRecordingRef = useRef(false);

  // Simple Firefox detection
  const isFirefox = typeof window !== 'undefined' && navigator.userAgent.includes('Firefox');

  // === RECORDING CONTROL ===
  const startRecording = useCallback(async () => {
    try {
      voiceAgentLog.microphone("Starting real-time microphone streaming...");

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 24000, // Match agent configuration
          channelCount: 1
        }
      });

      streamRef.current = stream;

      // Match Deepgram agent expectation
      const audioContext = new AudioContext({ sampleRate: 24000 });
      audioContextRef.current = audioContext;


      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;

      // Use 2048 buffer size for lower latency
      const processor = audioContext.createScriptProcessor(2048, 1, 1);
      processorRef.current = processor;


      processor.onaudioprocess = (audioProcessingEvent) => {
        if (!client) return;

        const inputBuffer = audioProcessingEvent.inputBuffer;
        const inputData = inputBuffer.getChannelData(0);

        // Convert to linear16 format for agent compatibility
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          // Clamp to prevent distortion
          const sample = Math.max(-1, Math.min(1, inputData[i]));
          pcmData[i] = Math.round(sample * 0x7FFF);
        }


        const audioBuffer = pcmData.buffer;

        try {
          client.send(audioBuffer);
        } catch (error) {
          voiceAgentLog.error(`Error sending audio to agent: ${error}`);
          onError?.(`Error sending audio: ${error}`);
        }
      };


      source.connect(processor);
      processor.connect(audioContext.destination);

      isRecordingRef.current = true;
      setIsRecording(true);
      voiceAgentLog.microphone("Real-time microphone streaming started at 24kHz");

    } catch (error) {
      voiceAgentLog.error(`Error starting microphone: ${error}`);
      onError?.(`Microphone access error: ${error}`);
    }
  }, [client, onError]);

  const stopRecording = useCallback(() => {
    voiceAgentLog.microphone("Stopping microphone streaming...");
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }


    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }


    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    isRecordingRef.current = false;
    setIsRecording(false);
    voiceAgentLog.microphone("Microphone streaming stopped");
  }, []);

  useEffect(() => {
    if (state === "open" && client && !isRecordingRef.current) {
      startRecording();
    } else if (state === "closed" && isRecordingRef.current) {
      stopRecording();
    }

    return () => {
      if (isRecordingRef.current) {
        stopRecording();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, client]); // Exclude function deps to prevent infinite loop


  if (state === "loading") {
    return (
      <div className="dg-status dg-status--warning">
        🎤 Loading microphone...
      </div>
    );
  }

  if (state === "closed") {
    return (
      <div className="dg-status dg-status--info">
        🔇 Microphone disconnected
      </div>
    );
  }

  // Firefox warning
  if (isFirefox) {
    return (
      <div className="dg-status dg-status--warning">
        ⚠️ Firefox has microphone compatibility issues. Please try Chrome or Safari for best results.
      </div>
    );
  }

  return (
    <div className={`dg-status ${isRecording ? 'dg-status--success' : 'dg-status--primary'}`}>
      {isRecording ? (
        <>🎙️ Streaming audio to agent (24kHz linear16)</>
      ) : (
        <>🎤 Microphone ready for real-time streaming</>
      )}
    </div>
  );
};