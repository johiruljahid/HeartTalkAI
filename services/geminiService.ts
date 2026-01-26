
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { ConnectionState, UserProfile, Mood, ConversationMode } from "../types";
import { GET_RIYA_INSTRUCTION, MODEL_NAME, GET_VOICE_NAME, SAFETY_SETTINGS } from "../constants";

interface GeminiServiceCallbacks {
  onStateChange: (state: ConnectionState) => void;
  onTranscript: (text: string, isUser: boolean) => void;
  onAudioData: (amplitude: number, isAI: boolean) => void; 
  onError: (error: string) => void;
  onUserUpdate: (user: UserProfile) => void;
  onToolAction: (message: string, type: 'memory' | 'event' | 'routine' | 'emotion' | 'reminder') => void;
  onMoodChange: (mood: Mood) => void;
}

export class GeminiService {
  private ai: GoogleGenAI | null = null;
  private currentSession: any = null;
  private sessionPromise: Promise<any> | null = null;
  
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private inputSource: MediaStreamAudioSourceNode | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private outputNode: GainNode | null = null;
  private inputGainNode: GainNode | null = null;
  
  private nextStartTime = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private callbacks: GeminiServiceCallbacks;

  private currentUser: UserProfile | null = null;
  private currentMode: ConversationMode = 'dirty';
  private isIntentionalDisconnect = false;
  private isConnecting = false;
  private stream: MediaStream | null = null;
  
  private connectionMonitor: any = null;
  private networkListener: (() => void) | null = null;

  constructor(callbacks: GeminiServiceCallbacks) {
    this.callbacks = callbacks;
  }

  public async connect(user: UserProfile, mode: ConversationMode = 'dirty') {
    if (this.currentSession || this.isConnecting) return;
    
    this.isConnecting = true;
    this.currentUser = user;
    this.currentMode = mode;
    this.isIntentionalDisconnect = false;
    this.callbacks.onStateChange(ConnectionState.CONNECTING);

    if (!this.networkListener) {
        this.networkListener = () => {
            if (navigator.onLine && !this.isIntentionalDisconnect && !this.currentSession) {
                this.reconnect();
            }
        };
        window.addEventListener('online', this.networkListener);
        window.addEventListener('offline', () => this.callbacks.onStateChange(ConnectionState.DISCONNECTED));
    }

    this.startConnectionMonitor();

    try {
      await this.cleanupResources();
      await this.initializeSession(user, mode);
    } catch (err: any) {
      console.error("Connection Failed:", err);
      this.callbacks.onStateChange(ConnectionState.ERROR);
      this.cleanupResources();
      this.isConnecting = false;
      
      if (!this.isIntentionalDisconnect) {
          setTimeout(() => this.reconnect(), 3000);
      }
    }
  }

  private async initializeSession(user: UserProfile, mode: ConversationMode) {
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true, 
          noiseSuppression: true, 
          autoGainControl: true,
          sampleRate: 16000,
          channelCount: 1
        } 
      });

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.inputAudioContext = new AudioCtx({ sampleRate: 16000 });
      this.outputAudioContext = new AudioCtx({ sampleRate: 24000 });
      
      await this.inputAudioContext.resume();
      await this.outputAudioContext.resume();

      this.outputNode = this.outputAudioContext.createGain();
      this.outputNode.connect(this.outputAudioContext.destination);

      this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const voiceName = GET_VOICE_NAME(user.gender || 'male', mode);

      this.sessionPromise = this.ai.live.connect({
        model: MODEL_NAME,
        callbacks: {
          onopen: () => this.handleOpen(),
          onmessage: (msg) => this.handleMessage(msg),
          onclose: (e) => this.handleClose(),
          onerror: (err) => {
            console.error("Gemini Error:", err);
            this.handleClose();
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { 
            voiceConfig: { prebuiltVoiceConfig: { voiceName } } 
          },
          systemInstruction: GET_RIYA_INSTRUCTION(user, mode),
          safetySettings: SAFETY_SETTINGS,
          outputAudioTranscription: {}, // Enabled for mentor report generation
        },
      });

      this.currentSession = await this.sessionPromise;
      this.isConnecting = false;
  }

  private startConnectionMonitor() {
    if (this.connectionMonitor) clearInterval(this.connectionMonitor);
    this.connectionMonitor = setInterval(async () => {
        if (this.isIntentionalDisconnect) {
            clearInterval(this.connectionMonitor);
            return;
        }
        if (!navigator.onLine) {
            this.callbacks.onStateChange(ConnectionState.DISCONNECTED);
            return;
        }
        if (!this.currentSession && !this.isConnecting) {
             this.reconnect();
        }
    }, 3000);
  }

  private async reconnect() {
      if (this.isIntentionalDisconnect || !this.currentUser) return;
      await this.connect(this.currentUser, this.currentMode);
  }

  private handleOpen = () => {
    if (!this.stream || !this.inputAudioContext) return;
    this.callbacks.onStateChange(ConnectionState.CONNECTED);

    this.inputSource = this.inputAudioContext.createMediaStreamSource(this.stream);
    this.inputGainNode = this.inputAudioContext.createGain();
    this.inputGainNode.gain.value = 3.5; 

    this.scriptProcessor = this.inputAudioContext.createScriptProcessor(2048, 1, 1);
    this.scriptProcessor.onaudioprocess = (e) => {
      if (this.isIntentionalDisconnect || !this.currentSession) return;
      const inputData = e.inputBuffer.getChannelData(0);
      let sum = 0;
      for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
      const rms = Math.sqrt(sum / inputData.length);
      
      if (this.sources.size === 0) {
        this.callbacks.onAudioData(rms * 100, false);
      }

      this.sessionPromise?.then(session => {
        try {
          session.sendRealtimeInput({ media: this.createBlob(inputData) });
        } catch (err) {}
      });
    };

    this.inputSource.connect(this.inputGainNode);
    this.inputGainNode.connect(this.scriptProcessor);
    this.scriptProcessor.connect(this.inputAudioContext.destination);
  };

  private handleMessage = async (message: LiveServerMessage) => {
    if (message.serverContent?.interrupted) {
      this.sources.forEach(s => { try { s.stop(); } catch(e){} });
      this.sources.clear();
      this.nextStartTime = 0;
      return;
    }

    if (message.serverContent?.outputTranscription) {
      this.callbacks.onTranscript(message.serverContent.outputTranscription.text, false);
    }
    if (message.serverContent?.inputTranscription) {
      this.callbacks.onTranscript(message.serverContent.inputTranscription.text, true);
    }

    const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    if (audioData) {
      await this.playAudio(audioData);
    }

    if (message.toolCall) {
      for (const fc of message.toolCall.functionCalls) {
        this.sessionPromise?.then(session => {
          session.sendToolResponse({
            functionResponses: [{ id: fc.id, name: fc.name, response: { result: "ok" } }]
          });
        });
      }
    }
  };

  private playAudio = async (base64Audio: string) => {
    if (!this.outputAudioContext || !this.outputNode) return;
    try {
      const audioBuffer = await this.decodeAudioData(
        this.decode(base64Audio),
        this.outputAudioContext,
        24000,
        1
      );
      const aiData = audioBuffer.getChannelData(0);
      let aiSum = 0;
      for (let i = 0; i < aiData.length; i++) aiSum += aiData[i] * aiData[i];
      const aiRms = Math.sqrt(aiSum / aiData.length);

      this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
      const source = this.outputAudioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.outputNode);
      source.onended = () => {
        this.sources.delete(source);
        if (this.sources.size === 0) this.callbacks.onAudioData(0, true);
      };
      source.start(this.nextStartTime);
      this.nextStartTime += audioBuffer.duration;
      this.sources.add(source);
      this.callbacks.onAudioData(aiRms * 120, true);
    } catch (e) {}
  };

  private handleClose = () => {
    if (!this.isIntentionalDisconnect && this.currentUser) {
      this.currentSession = null;
      this.callbacks.onStateChange(ConnectionState.CONNECTING);
      setTimeout(() => this.reconnect(), 500);
    } else {
      this.callbacks.onStateChange(ConnectionState.DISCONNECTED);
    }
  };

  public async disconnect() {
    this.isIntentionalDisconnect = true;
    if (this.connectionMonitor) clearInterval(this.connectionMonitor);
    if (this.networkListener) window.removeEventListener('online', this.networkListener);
    this.networkListener = null;
    await this.cleanupResources();
    this.callbacks.onStateChange(ConnectionState.DISCONNECTED);
  }

  private async cleanupResources() {
    this.sources.forEach(s => { try { s.stop(); } catch(e){} });
    this.sources.clear();
    this.nextStartTime = 0;
    if (this.scriptProcessor) { try { this.scriptProcessor.disconnect(); } catch(e){} this.scriptProcessor = null; }
    if (this.inputSource) { try { this.inputSource.disconnect(); } catch(e){} this.inputSource = null; }
    if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; }
    if (this.inputAudioContext) { try { await this.inputAudioContext.close(); } catch(e){} this.inputAudioContext = null; }
    if (this.outputAudioContext) { try { await this.outputAudioContext.close(); } catch(e){} this.outputAudioContext = null; }
    this.currentSession = null;
    this.sessionPromise = null;
  }

  private createBlob(data: Float32Array) {
    const int16 = new Int16Array(data.length);
    for (let i = 0; i < data.length; i++) {
      int16[i] = Math.max(-1, Math.min(1, data[i])) * 32767;
    }
    return { data: this.encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
  }

  private encode(bytes: Uint8Array) {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  private decode(base64: string) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
    return bytes;
  }

  private async decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  }
}
