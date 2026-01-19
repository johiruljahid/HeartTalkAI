
import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { ConnectionState, UserProfile, Mood } from "../types";
import { GET_RIYA_INSTRUCTION, MODEL_NAME, VOICE_NAME, THINKING_BUDGET } from "../constants";
import { DB } from "./db";

interface GeminiServiceCallbacks {
  onStateChange: (state: ConnectionState) => void;
  onTranscript: (text: string, isUser: boolean) => void;
  onAudioData: (amplitude: number) => void; 
  onError: (error: string) => void;
  onUserUpdate: (user: UserProfile) => void;
  onToolAction: (message: string, type: 'memory' | 'event' | 'routine' | 'emotion' | 'reminder') => void;
  onMoodChange: (mood: Mood) => void;
}

const googleSearchTool = { googleSearch: {} };

const timeTool: FunctionDeclaration = {
  name: "getCurrentTime",
  description: "Get the current real-time date and time in Bangladesh format.",
  parameters: { type: Type.OBJECT, properties: {} },
};

const setMoodTool: FunctionDeclaration = {
  name: "setMood",
  description: "Change the visual aura/color of Riya based on the emotional tone of the conversation.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      mood: { 
        type: Type.STRING, 
        description: "The mood to set.",
        enum: ['happy', 'romantic', 'calm', 'excited', 'sad', 'intense', 'default']
      }
    },
    required: ["mood"]
  }
};

const saveNoteTool: FunctionDeclaration = {
  name: "saveNote",
  description: "Save a fact, preference, or important note about the user to long-term memory.",
  parameters: {
    type: Type.OBJECT,
    properties: { note: { type: Type.STRING, description: "The content to remember." } },
    required: ["note"]
  },
};

const setReminderTool: FunctionDeclaration = {
  name: "setReminder",
  description: "Set a reminder for a specific task or message at a specific time.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      message: { type: Type.STRING, description: "The reminder message." },
      time: { type: Type.STRING, description: "When to remind (e.g., 'at 5pm', 'in 10 minutes')." }
    },
    required: ["message", "time"]
  },
};

const addEventTool: FunctionDeclaration = {
  name: "addEvent",
  description: "Add an important date like a birthday, anniversary, or meeting to the calendar.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "What is the event? (e.g. 'My Birthday')" },
      date: { type: Type.STRING, description: "Date of event (e.g. '15th August')" },
      type: { type: Type.STRING, enum: ['birthday', 'meeting', 'anniversary', 'other'] }
    },
    required: ["title", "date", "type"]
  }
};

const addRoutineTool: FunctionDeclaration = {
  name: "addRoutine",
  description: "Add a daily recurring activity or medicine schedule.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      time: { type: Type.STRING, description: "Time of day (e.g. '8:00 AM')" },
      activity: { type: Type.STRING, description: "What to do? (e.g. 'Take Blood Pressure Medicine')" }
    },
    required: ["time", "activity"]
  }
};

export class GeminiService {
  private ai: GoogleGenAI | null = null;
  private sessionPromise: Promise<any> | null = null;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private inputSource: MediaStreamAudioSourceNode | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private outputNode: GainNode | null = null;
  
  private nextStartTime = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private callbacks: GeminiServiceCallbacks;

  private currentUser: UserProfile | null = null;
  private isIntentionalDisconnect = false;
  private heartbeatInterval: any = null;
  private watchdogInterval: any = null;
  private lastMessageTimestamp = 0;

  // Added for "Speak First" feature
  private silenceTimeout: any = null;
  private hasUserSpoken = false;

  constructor(callbacks: GeminiServiceCallbacks) {
    this.callbacks = callbacks;
  }

  public async connect(user: UserProfile) {
    this.currentUser = user;
    this.isIntentionalDisconnect = false;
    this.hasUserSpoken = false; 
    if (this.silenceTimeout) clearTimeout(this.silenceTimeout);

    this.callbacks.onStateChange(ConnectionState.CONNECTING);

    try {
      this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      // Low latency mode for faster response
      if (!this.inputAudioContext || this.inputAudioContext.state === 'closed') {
        this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ 
            sampleRate: 16000, 
            latencyHint: 'interactive' 
        });
      }
      if (!this.outputAudioContext || this.outputAudioContext.state === 'closed') {
        this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ 
            sampleRate: 24000,
            latencyHint: 'interactive'
        });
      }

      // Important: Resume context immediately on user gesture click
      await this.inputAudioContext.resume();
      await this.outputAudioContext.resume();

      this.outputNode = this.outputAudioContext.createGain();
      this.outputNode.connect(this.outputAudioContext.destination);

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 16000
        } 
      });

      const systemInstruction = GET_RIYA_INSTRUCTION(user);
      const functionDeclarations = [timeTool, setMoodTool, saveNoteTool, setReminderTool, addEventTool, addRoutineTool];

      this.sessionPromise = this.ai.live.connect({
        model: MODEL_NAME,
        callbacks: {
          onopen: () => this.handleOpen(stream),
          onmessage: (msg) => {
            this.lastMessageTimestamp = Date.now();
            this.handleMessage(msg);
          },
          onclose: () => this.handleClose(),
          onerror: (err) => this.handleError(err),
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE_NAME } },
          },
          systemInstruction: systemInstruction,
          tools: [{ functionDeclarations }, googleSearchTool],
          thinkingConfig: { thinkingBudget: THINKING_BUDGET },
          safetySettings: [
             { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
             { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
             { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
             { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
          ],
        },
      });

      this.watchdogInterval = setInterval(async () => {
        if (this.isIntentionalDisconnect) return;
        if (this.inputAudioContext?.state === 'suspended') await this.inputAudioContext.resume();
        if (this.outputAudioContext?.state === 'suspended') await this.outputAudioContext.resume();
        if (Date.now() - this.lastMessageTimestamp > 25000) this.sendHeartbeat();
      }, 5000);

      this.heartbeatInterval = setInterval(() => this.sendHeartbeat(), 10000);

    } catch (err: any) {
      console.error("Connection Error:", err);
      this.callbacks.onError("Link failed. Check mic.");
      this.callbacks.onStateChange(ConnectionState.ERROR);
    }
  }

  private sendHeartbeat() {
    this.sessionPromise?.then(session => {
        if (!this.isIntentionalDisconnect) {
            const silentFrame = new Int16Array(100).fill(0);
            session.sendRealtimeInput({ media: { data: this.encode(new Uint8Array(silentFrame.buffer)), mimeType: 'audio/pcm;rate=16000' } });
        }
    }).catch(() => {});
  }

  // Helper: Force the model to speak by simulating a user text input
  private sendTextTrigger(text: string) {
    console.log("Sending Text Trigger:", text);
    this.sessionPromise?.then(session => {
        session.sendRealtimeInput({
            content: [{ role: 'user', parts: [{ text: text }] }]
        });
    }).catch(e => console.error("Trigger failed", e));
  }

  public async disconnect() {
    this.isIntentionalDisconnect = true;
    if (this.silenceTimeout) clearTimeout(this.silenceTimeout);
    if (this.watchdogInterval) clearInterval(this.watchdogInterval);
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.inputSource) this.inputSource.mediaStream.getTracks().forEach(t => t.stop());
    if (this.inputAudioContext) await this.inputAudioContext.close();
    if (this.outputAudioContext) await this.outputAudioContext.close();
    this.sources.forEach(s => { try { s.stop(); } catch(e) {} });
    this.sources.clear();
    this.sessionPromise = null;
    this.ai = null;
    this.callbacks.onStateChange(ConnectionState.DISCONNECTED);
    this.nextStartTime = 0;
  }

  private handleOpen = async (stream: MediaStream) => {
    this.callbacks.onStateChange(ConnectionState.CONNECTED);
    
    // Double check audio context state to ensure auto-play works
    if (this.outputAudioContext?.state === 'suspended') {
        await this.outputAudioContext.resume();
    }

    // --- FEATURE: SPEAK FIRST ---
    // Wait 1s for connection stability, then send hidden command
    setTimeout(() => {
        if (!this.isIntentionalDisconnect) {
            this.sendTextTrigger("User has joined. Immediately say 'As-salamu alaykum' warmly, then say a very sweet, short romantic welcome message in Bangla. Do not wait for user input.");
        }
    }, 1000);

    // --- FEATURE: SILENCE DETECTION ---
    // If user doesn't speak for 15s, tease them
    this.silenceTimeout = setTimeout(() => {
        if (!this.hasUserSpoken && !this.isIntentionalDisconnect) {
            this.sendTextTrigger("I haven't said anything back. Tease me in Bangla saying 'Ki holo, kotha bolcho na je? Lojja paccho?' or something romantic.");
        }
    }, 15000);

    if (!this.inputAudioContext) return;
    this.inputSource = this.inputAudioContext.createMediaStreamSource(stream);
    this.scriptProcessor = this.inputAudioContext.createScriptProcessor(512, 1, 1);
    
    this.scriptProcessor.onaudioprocess = (e) => {
      if (this.isIntentionalDisconnect) return;
      
      const inputData = e.inputBuffer.getChannelData(0);
      let sum = 0;
      for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
      const rms = Math.sqrt(sum / inputData.length);
      
      this.callbacks.onAudioData(rms * 5); 
      
      // Detect if user is speaking to cancel silence timer
      // Threshold 0.03 prevents background noise from cancelling it
      if (rms > 0.03) {
          this.hasUserSpoken = true;
          if (this.silenceTimeout) {
              clearTimeout(this.silenceTimeout);
              this.silenceTimeout = null;
          }
      }

      // Increased noise gate threshold from 0.001 to 0.004 to cut off background noise faster
      // This helps the model detect "Silence" earlier and respond quicker.
      if (rms > 0.004) { 
        const pcmBlob = this.createBlob(inputData);
        this.sessionPromise?.then((session) => {
          try { session.sendRealtimeInput({ media: pcmBlob }); } catch (err) {}
        });
      }
    };
    
    this.inputSource.connect(this.scriptProcessor);
    this.scriptProcessor.connect(this.inputAudioContext.destination);
  };

  private handleMessage = async (message: LiveServerMessage) => {
    if (message.serverContent?.interrupted) {
      this.sources.forEach(s => { try { s.stop(); } catch(e){} });
      this.sources.clear();
      this.nextStartTime = 0;
      return; 
    }
    if (message.toolCall) {
      this.handleToolCall(message.toolCall);
      return;
    }
    const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    if (base64Audio) this.playAudio(base64Audio);
  };

  private handleToolCall = (toolCall: any) => {
     const functionResponses = toolCall.functionCalls.map((fc: any) => {
        let result = { result: "Success" };
        const user = this.currentUser;
        if (!user) return { id: fc.id, name: fc.name, response: { error: "User not loaded" } };
        
        const memory = user.memory || { notes: [], events: [], routines: [], emotions: [], reminders: [] };

        if (fc.name === 'getCurrentTime') {
          result = { result: `Current time is ${new Date().toLocaleTimeString()}` };
        } else if (fc.name === 'setMood') {
          this.callbacks.onMoodChange(fc.args.mood as Mood);
          result = { result: "Mood updated" };
        } else if (fc.name === 'saveNote') {
          memory.notes.push(fc.args.note);
          this.callbacks.onToolAction(`Saved to Notebook`, 'memory');
        } else if (fc.name === 'setReminder') {
          const newReminder = { id: `rem_${Date.now()}`, message: fc.args.message, time: fc.args.time, timestamp: Date.now(), isCompleted: false };
          memory.reminders.push(newReminder);
          this.callbacks.onToolAction(`Reminder set: ${fc.args.message}`, 'reminder');
        } else if (fc.name === 'addEvent') {
          const newEvent = { id: `ev_${Date.now()}`, title: fc.args.title, date: fc.args.date, type: fc.args.type };
          memory.events.push(newEvent);
          this.callbacks.onToolAction(`Event added: ${fc.args.title}`, 'event');
        } else if (fc.name === 'addRoutine') {
          const newRoutine = { id: `rot_${Date.now()}`, time: fc.args.time, activity: fc.args.activity };
          memory.routines.push(newRoutine);
          this.callbacks.onToolAction(`Routine added: ${fc.args.activity}`, 'routine');
        }

        const updatedUser = { ...user, memory };
        DB.updateUser(updatedUser);
        this.currentUser = updatedUser;
        this.callbacks.onUserUpdate(updatedUser);

        return { id: fc.id, name: fc.name, response: result };
      });
      this.sessionPromise?.then(session => session.sendToolResponse({ functionResponses }));
  }

  private playAudio = async (base64Audio: string) => {
      try {
        if (!this.outputAudioContext || !this.outputNode || this.isIntentionalDisconnect) return;
        
        // Ensure context is running before decoding
        if (this.outputAudioContext.state === 'suspended') await this.outputAudioContext.resume();
        
        const audioBuffer = await this.decodeAudioData(this.decode(base64Audio), this.outputAudioContext, 24000, 1);
        const now = this.outputAudioContext.currentTime;
        
        // Ensure seamless playback
        if (this.nextStartTime < now) this.nextStartTime = now;
        
        const source = this.outputAudioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.outputNode);
        source.onended = () => this.sources.delete(source);
        source.start(this.nextStartTime);
        this.nextStartTime += audioBuffer.duration;
        this.sources.add(source);
      } catch (e) {
          console.error("Audio Playback Error", e);
      }
  }

  private handleClose = () => {
    if (!this.isIntentionalDisconnect && this.currentUser) {
      this.callbacks.onStateChange(ConnectionState.CONNECTING);
      setTimeout(() => { if (this.currentUser && !this.isIntentionalDisconnect) this.connect(this.currentUser); }, 1000);
    } else {
      this.callbacks.onStateChange(ConnectionState.DISCONNECTED);
    }
  };

  private handleError = (e: any) => { console.error(e); };

  private createBlob(data: Float32Array) {
    const l = data.length; const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) { const s = Math.max(-1, Math.min(1, data[i])); int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF; }
    return { data: this.encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
  }
  private encode(bytes: Uint8Array) { let binary = ''; for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]); return btoa(binary); }
  private decode(base64: string) { const binaryString = atob(base64); const bytes = new Uint8Array(binaryString.length); for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i); return bytes; }
  private async decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number) {
    const dataInt16 = new Int16Array(data.buffer); const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    for (let c = 0; c < numChannels; c++) { const cd = buffer.getChannelData(c); for (let i = 0; i < frameCount; i++) cd[i] = dataInt16[i * numChannels + c] / 32768.0; }
    return buffer;
  }
}
