
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
      date: { type: Type.STRING, date: "Date of event (e.g. '15th August')" },
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
  private lastMessageTimestamp = 0;

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

      // Using 'interactive' latency hint for ultra-low latency response
      this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ 
        sampleRate: 16000,
        latencyHint: 'interactive'
      });
      this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ 
        sampleRate: 24000,
        latencyHint: 'interactive'
      });

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

    } catch (err: any) {
      console.error("Connection Error:", err);
      this.callbacks.onError("Link failed.");
      this.callbacks.onStateChange(ConnectionState.ERROR);
    }
  }

  private sendTextTrigger(text: string) {
    this.sessionPromise?.then(session => {
        session.sendRealtimeInput({
            content: [{ role: 'user', parts: [{ text: text }] }]
        });
    }).catch(e => console.error("Trigger failed", e));
  }

  public async disconnect() {
    this.isIntentionalDisconnect = true;
    if (this.silenceTimeout) clearTimeout(this.silenceTimeout);
    if (this.inputSource) this.inputSource.mediaStream.getTracks().forEach(t => t.stop());
    if (this.inputAudioContext) await this.inputAudioContext.close();
    if (this.outputAudioContext) await this.outputAudioContext.close();
    this.sources.forEach(s => { try { s.stop(); } catch(e) {} });
    this.sources.clear();
    this.sessionPromise = null;
    this.callbacks.onStateChange(ConnectionState.DISCONNECTED);
    this.nextStartTime = 0;
  }

  private handleOpen = async (stream: MediaStream) => {
    this.callbacks.onStateChange(ConnectionState.CONNECTED);
    
    if (this.outputAudioContext?.state === 'suspended') await this.outputAudioContext.resume();

    // 1. RIYA SPEAKS FIRST (ASAP)
    // Smallest possible delay to ensure session is wired up
    setTimeout(() => {
        if (!this.isIntentionalDisconnect) {
            this.sendTextTrigger("CALL START. Immediately say: 'Assalamu Alaikum… hi jaan 🥰 Ami Riya… finally tumi esecho. Ami ekhane sudhu tomar jonnoi achi. Kemon acho bolo na… ami tomar kotha shunte chai ❤️'");
        }
    }, 250);

    // 2. SILENCE TEASE (Reduced time to 10s for better engagement)
    this.silenceTimeout = setTimeout(() => {
        if (!this.hasUserSpoken && !this.isIntentionalDisconnect) {
            this.sendTextTrigger("User is silent. Tease them gently: 'Hello... jaan? Ami ekhono ekhanei achi... tumi chole gele নাকি? 🥹'");
        }
    }, 10000);

    if (!this.inputAudioContext) return;
    this.inputSource = this.inputAudioContext.createMediaStreamSource(stream);
    // Tiny buffer (256) for the absolute lowest possible latency
    this.scriptProcessor = this.inputAudioContext.createScriptProcessor(256, 1, 1);
    
    this.scriptProcessor.onaudioprocess = (e) => {
      if (this.isIntentionalDisconnect) return;
      
      const inputData = e.inputBuffer.getChannelData(0);
      let sum = 0;
      for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
      const rms = Math.sqrt(sum / inputData.length);
      
      this.callbacks.onAudioData(rms * 5); 
      
      // Strict Voice Activity Detection (VAD)
      if (rms > 0.04) {
          this.hasUserSpoken = true;
          if (this.silenceTimeout) {
              clearTimeout(this.silenceTimeout);
              this.silenceTimeout = null;
          }
      }

      // Stream audio if it's voice (prevents background hum from delaying response)
      if (rms > 0.005) { 
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
        if (this.outputAudioContext.state === 'suspended') await this.outputAudioContext.resume();
        
        const audioBuffer = await this.decodeAudioData(this.decode(base64Audio), this.outputAudioContext, 24000, 1);
        const now = this.outputAudioContext.currentTime;
        
        // Tightest possible scheduling for real-time feel
        if (this.nextStartTime < now) this.nextStartTime = now + 0.02; 
        
        const source = this.outputAudioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.outputNode);
        source.onended = () => this.sources.delete(source);
        source.start(this.nextStartTime);
        this.nextStartTime += audioBuffer.duration;
        this.sources.add(source);
      } catch (e) {
          console.error("Playback Error", e);
      }
  }

  private handleClose = () => {
    if (!this.isIntentionalDisconnect && this.currentUser) {
      this.callbacks.onStateChange(ConnectionState.CONNECTING);
      // Faster reconnect (1s)
      setTimeout(() => { if (this.currentUser && !this.isIntentionalDisconnect) this.connect(this.currentUser); }, 1000);
    } else {
      this.callbacks.onStateChange(ConnectionState.DISCONNECTED);
    }
  };

  private handleError = (e: any) => { console.error("Gemini Error:", e); };

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
