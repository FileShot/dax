import { useEffect, useState, useRef, useCallback } from 'react';
import {
  Mic, MicOff, Volume2, VolumeX, Settings as SettingsIcon,
  Play, Square, Loader2, RefreshCw, Puzzle, FolderOpen,
  Power, PowerOff, AlertCircle, Check, Trash2,
} from 'lucide-react';

// ─── Voice Controls ─────────────────────────────────────────

function VoiceSection() {
  const [config, setConfig] = useState(null);
  const [recording, setRecording] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [processing, setProcessing] = useState(false);
  const [ttsText, setTtsText] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recognitionRef = useRef(null);

  useEffect(() => {
    window.dax?.voice?.getConfig?.().then(setConfig).catch(console.error);
  }, []);

  const startRecording = useCallback(async () => {
    const sttBackend = config?.sttBackend || 'webSpeech';

    if (sttBackend === 'webSpeech') {
      // Use Web Speech API (runs in browser)
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setTranscription('Error: Web Speech API not available');
        return;
      }
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = config?.settings?.language || 'en-US';

      let finalText = '';
      recognition.onresult = (event) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalText += event.results[i][0].transcript + ' ';
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        setTranscription(finalText + interim);
      };

      recognition.onerror = (e) => {
        setTranscription(`Error: ${e.error}`);
        setRecording(false);
      };

      recognition.onend = () => setRecording(false);
      recognitionRef.current = recognition;
      recognition.start();
      setRecording(true);
      setTranscription('');
    } else {
      // Record audio for backend processing
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        chunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        mediaRecorder.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          setProcessing(true);
          try {
            const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
            const arrayBuffer = await blob.arrayBuffer();
            const base64 = btoa(
              new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
            );
            const result = await window.dax.voice.transcribe(base64);
            setTranscription(result.text || '');
          } catch (err) {
            setTranscription(`Error: ${err.message}`);
          } finally {
            setProcessing(false);
          }
        };

        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.start();
        setRecording(true);
        setTranscription('');
      } catch (err) {
        setTranscription(`Mic error: ${err.message}`);
      }
    }
  }, [config]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    setRecording(false);
  }, []);

  const speak = useCallback(async () => {
    if (!ttsText.trim()) return;
    setSpeaking(true);
    try {
      const ttsBackend = config?.ttsBackend || 'webSpeech';
      if (ttsBackend === 'webSpeech') {
        const utterance = new SpeechSynthesisUtterance(ttsText);
        utterance.onend = () => setSpeaking(false);
        utterance.onerror = () => setSpeaking(false);
        speechSynthesis.speak(utterance);
        return; // don't setSpeaking(false) here — onend does it
      }

      const result = await window.dax.voice.synthesize(ttsText);
      if (result.useWebSpeech) {
        const utterance = new SpeechSynthesisUtterance(result.text);
        utterance.onend = () => setSpeaking(false);
        speechSynthesis.speak(utterance);
        return;
      }
      if (result.audio) {
        const bytes = Uint8Array.from(atob(result.audio), (c) => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended = () => { URL.revokeObjectURL(url); setSpeaking(false); };
        audio.play();
        return;
      }
    } catch (err) {
      console.error('TTS error:', err);
    }
    setSpeaking(false);
  }, [ttsText, config]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-dax-text-bright">Voice Controls</h2>
        <button onClick={() => setShowSettings(!showSettings)} className="btn-secondary btn-sm">
          <SettingsIcon size={12} />
          Settings
        </button>
      </div>

      {showSettings && <VoiceSettings config={config} onUpdate={setConfig} />}

      {/* STT */}
      <div className="agent-card p-4 mb-3">
        <div className="flex items-center gap-2 mb-3">
          <Mic size={14} className="text-dax-accent" />
          <span className="text-xs font-medium text-dax-text-bright">Speech to Text</span>
          <span className="text-[10px] text-dax-text-dim">({config?.sttBackend || 'webSpeech'})</span>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={recording ? stopRecording : startRecording}
            disabled={processing}
            className={`${recording ? 'btn-danger' : 'btn-primary'} btn-sm`}
          >
            {processing ? (
              <><Loader2 size={12} className="animate-spin" /> Processing...</>
            ) : recording ? (
              <><Square size={12} /> Stop Recording</>
            ) : (
              <><Mic size={12} /> Start Recording</>
            )}
          </button>
          {recording && (
            <span className="text-[10px] text-red-400 animate-pulse">● Recording...</span>
          )}
        </div>

        {transcription && (
          <div className="bg-dax-sidebar rounded p-3 text-xs text-dax-text break-words">
            {transcription}
          </div>
        )}
      </div>

      {/* TTS */}
      <div className="agent-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Volume2 size={14} className="text-dax-accent" />
          <span className="text-xs font-medium text-dax-text-bright">Text to Speech</span>
          <span className="text-[10px] text-dax-text-dim">({config?.ttsBackend || 'webSpeech'})</span>
        </div>

        <textarea
          value={ttsText}
          onChange={(e) => setTtsText(e.target.value)}
          placeholder="Enter text to speak..."
          className="input text-xs mb-2 resize-none h-16"
        />

        <button onClick={speak} disabled={speaking || !ttsText.trim()} className="btn-primary btn-sm">
          {speaking ? (
            <><Loader2 size={12} className="animate-spin" /> Speaking...</>
          ) : (
            <><Play size={12} /> Speak</>
          )}
        </button>
      </div>
    </div>
  );
}

function VoiceSettings({ config, onUpdate }) {
  const [sttBackend, setSttBackend] = useState(config?.sttBackend || 'webSpeech');
  const [ttsBackend, setTtsBackend] = useState(config?.ttsBackend || 'webSpeech');
  const [openaiKey, setOpenaiKey] = useState(config?.settings?.openaiKey || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const settings = { sttBackend, ttsBackend, openaiKey };
      await window.dax.voice.configure(settings);
      const updated = await window.dax.voice.getConfig();
      onUpdate(updated);
    } catch (err) {
      console.error('Voice settings save error:', err);
    }
    setSaving(false);
  };

  return (
    <div className="agent-card p-4 mb-3 space-y-3">
      <div>
        <label className="block text-[11px] text-dax-text-dim mb-1">STT Backend</label>
        <select value={sttBackend} onChange={(e) => setSttBackend(e.target.value)} className="input text-xs">
          <option value="webSpeech">Web Speech API (free, no setup)</option>
          <option value="openai">OpenAI Whisper API</option>
          <option value="local">Local whisper.cpp</option>
        </select>
      </div>
      <div>
        <label className="block text-[11px] text-dax-text-dim mb-1">TTS Backend</label>
        <select value={ttsBackend} onChange={(e) => setTtsBackend(e.target.value)} className="input text-xs">
          <option value="webSpeech">Web Speech API (free, no setup)</option>
          <option value="openai">OpenAI TTS API</option>
          <option value="local">Local Piper TTS</option>
        </select>
      </div>
      {(sttBackend === 'openai' || ttsBackend === 'openai') && (
        <div>
          <label className="block text-[11px] text-dax-text-dim mb-1">OpenAI API Key</label>
          <input
            type="password"
            value={openaiKey}
            onChange={(e) => setOpenaiKey(e.target.value)}
            placeholder="sk-..."
            className="input text-xs"
          />
        </div>
      )}
      <button onClick={save} disabled={saving} className="btn-primary btn-sm">
        {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
        Save Settings
      </button>
    </div>
  );
}

// ─── Plugin Management ──────────────────────────────────────

function PluginsSection() {
  const [plugins, setPlugins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pluginsDir, setPluginsDir] = useState('');

  const refresh = async () => {
    setLoading(true);
    try {
      const [list, dir] = await Promise.all([
        window.dax.plugins.list(),
        window.dax.plugins.dir(),
      ]);
      setPlugins(list || []);
      setPluginsDir(dir || '');
    } catch (err) {
      console.error('[Plugins] Fetch error:', err);
    }
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const togglePlugin = async (pluginId, loaded) => {
    try {
      if (loaded) {
        await window.dax.plugins.unload(pluginId);
      } else {
        await window.dax.plugins.load(pluginId);
      }
      refresh();
    } catch (err) {
      console.error(`Plugin toggle error:`, err);
    }
  };

  const openPluginsDir = async () => {
    try {
      await window.dax.openExternal(pluginsDir);
    } catch (err) {
      console.error('Open plugins dir error:', err);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-dax-text-bright">Plugins</h2>
        <div className="flex gap-2">
          <button onClick={openPluginsDir} className="btn-secondary btn-sm">
            <FolderOpen size={12} />
            Plugins Folder
          </button>
          <button onClick={refresh} className="btn-secondary btn-sm">
            <RefreshCw size={12} />
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={20} className="animate-spin text-dax-text-dim" />
        </div>
      ) : plugins.length === 0 ? (
        <div className="agent-card p-8 text-center">
          <Puzzle size={32} className="text-dax-text-dim mx-auto mb-2 opacity-30" />
          <p className="text-sm text-dax-text-dim">No plugins installed</p>
          <p className="text-xs text-dax-text-dim mt-1 opacity-60">
            Drop plugin folders into <code className="text-[10px]">{pluginsDir}</code>
          </p>
          <p className="text-[10px] text-dax-text-dim mt-3 opacity-40">
            Each plugin needs a <code>plugin.json</code> manifest and a main script
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {plugins.map((plugin) => (
            <div key={plugin.id} className="agent-card p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${plugin.loaded ? 'bg-dax-success' : 'bg-dax-text-dim'}`} />
                  <div>
                    <div className="text-sm text-dax-text-bright">{plugin.name}</div>
                    <div className="text-[10px] text-dax-text-dim">
                      v{plugin.version}
                      {plugin.author && ` · ${plugin.author}`}
                      {plugin.tools.length > 0 && ` · ${plugin.tools.length} tools`}
                      {plugin.hooks.length > 0 && ` · ${plugin.hooks.length} hooks`}
                    </div>
                    {plugin.description && (
                      <div className="text-[10px] text-dax-text-dim mt-0.5">{plugin.description}</div>
                    )}
                    {plugin.error && (
                      <div className="text-[10px] text-dax-error mt-0.5 flex items-center gap-1">
                        <AlertCircle size={10} />
                        {plugin.error}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => togglePlugin(plugin.id, plugin.loaded)}
                  className={`p-1.5 rounded transition-fast ${
                    plugin.loaded
                      ? 'text-dax-success hover:text-dax-error'
                      : 'text-dax-text-dim hover:text-dax-success'
                  }`}
                  title={plugin.loaded ? 'Unload' : 'Load'}
                >
                  {plugin.loaded ? <Power size={14} /> : <PowerOff size={14} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Plugin SDK docs */}
      <div className="mt-6 agent-card p-4">
        <h3 className="text-xs font-medium text-dax-text-bright mb-2">Creating a Plugin</h3>
        <pre className="text-[10px] text-dax-text-dim font-mono bg-dax-sidebar rounded p-3 overflow-x-auto">{`// plugin.json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "Does cool things",
  "author": "You",
  "main": "index.js"
}

// index.js
module.exports = {
  activate(dax) {
    dax.registerTool({
      name: 'my_tool',
      description: 'Does something',
      parameters: { type: 'object', properties: {} },
      execute: async (params) => {
        return { result: 'done' };
      }
    });

    dax.registerHook('onAgentRunComplete', (data) => {
      dax.log.info('Agent finished!', data);
    });
  },
  deactivate() { }
};`}</pre>
      </div>
    </div>
  );
}

// ─── Main View ──────────────────────────────────────────────

export default function VoicePluginsView() {
  const [tab, setTab] = useState('voice');

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-dax-text-bright">Voice & Plugins</h1>
          <p className="text-sm text-dax-text-dim mt-1">
            Voice input/output and plugin management
          </p>
        </div>
      </div>

      <div className="flex gap-1 mb-6 bg-dax-sidebar rounded-lg p-1 w-fit">
        {[
          { id: 'voice', label: 'Voice', icon: Mic },
          { id: 'plugins', label: 'Plugins', icon: Puzzle },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-fast ${
              tab === id
                ? 'bg-dax-accent text-white'
                : 'text-dax-text-dim hover:text-dax-text'
            }`}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'voice' && <VoiceSection />}
      {tab === 'plugins' && <PluginsSection />}
    </div>
  );
}
