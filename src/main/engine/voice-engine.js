// ─── Voice Engine ───────────────────────────────────────────
// Handles STT (speech-to-text) and TTS (text-to-speech)
// Supports multiple backends: Web Speech API, OpenAI Whisper, local whisper.cpp

const { spawn } = require('child_process');
const https = require('https');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');

let _log = (...args) => console.log('[Voice]', ...args);

function setLogger(fn) { _log = fn; }

// ─── STT Backends ───────────────────────────────────────────

/**
 * Transcribe audio using OpenAI-compatible Whisper API
 * Works with OpenAI, local whisper servers, or any compatible endpoint
 */
async function transcribeOpenAI(audioBuffer, options = {}) {
  const {
    apiUrl = 'https://api.openai.com/v1/audio/transcriptions',
    apiKey = '',
    model = 'whisper-1',
    language = 'en',
  } = options;

  if (!apiKey && apiUrl.includes('openai.com')) {
    throw new Error('OpenAI API key required for Whisper transcription');
  }

  const boundary = '----DaxVoice' + Date.now();
  const parts = [];

  // model field
  parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\n${model}\r\n`);
  // language field
  parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\n${language}\r\n`);
  // file field
  parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.wav"\r\nContent-Type: audio/wav\r\n\r\n`);

  const header = Buffer.from(parts.join(''));
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([header, audioBuffer, footer]);

  const url = new URL(apiUrl);
  const isHttps = url.protocol === 'https:';
  const transport = isHttps ? https : http;

  return new Promise((resolve, reject) => {
    const req = transport.request({
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
        ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (res.statusCode !== 200) {
            reject(new Error(result.error?.message || `HTTP ${res.statusCode}`));
          } else {
            resolve({ text: result.text, duration: result.duration });
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${data.substring(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * Transcribe audio using local whisper.cpp binary
 * Requires whisper.cpp to be installed and model downloaded
 */
async function transcribeLocal(audioBuffer, options = {}) {
  const {
    binaryPath = 'whisper',
    modelPath = '',
    language = 'en',
  } = options;

  if (!modelPath) {
    throw new Error('Local Whisper model path required');
  }

  // Write audio to temp file
  const tmpDir = os.tmpdir();
  const tmpFile = path.join(tmpDir, `dax-voice-${Date.now()}.wav`);
  const outFile = path.join(tmpDir, `dax-voice-${Date.now()}.txt`);

  try {
    fs.writeFileSync(tmpFile, audioBuffer);

    return new Promise((resolve, reject) => {
      const args = [
        '-m', modelPath,
        '-f', tmpFile,
        '-l', language,
        '--output-txt',
        '-of', outFile.replace('.txt', ''),
        '--no-timestamps',
      ];

      _log('info', 'VOICE', 'Running whisper.cpp', { binary: binaryPath, model: modelPath });

      const proc = spawn(binaryPath, args, { timeout: 30000 });
      let stderr = '';

      proc.stderr.on('data', (d) => stderr += d.toString());

      proc.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`whisper.cpp exited with code ${code}: ${stderr}`));
          return;
        }
        try {
          const text = fs.readFileSync(outFile, 'utf-8').trim();
          resolve({ text });
        } catch (e) {
          reject(new Error(`Failed to read whisper output: ${e.message}`));
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`Failed to run whisper.cpp: ${err.message}`));
      });
    });
  } finally {
    // Cleanup temp files
    try { fs.unlinkSync(tmpFile); } catch (_e) { /* ignore */ }
    try { fs.unlinkSync(outFile); } catch (_e) { /* ignore */ }
  }
}

// ─── TTS Backend ────────────────────────────────────────────

/**
 * Generate speech using OpenAI-compatible TTS API
 */
async function synthesizeOpenAI(text, options = {}) {
  const {
    apiUrl = 'https://api.openai.com/v1/audio/speech',
    apiKey = '',
    model = 'tts-1',
    voice = 'alloy',
    speed = 1.0,
  } = options;

  if (!apiKey && apiUrl.includes('openai.com')) {
    throw new Error('OpenAI API key required for TTS');
  }

  const body = JSON.stringify({ model, input: text, voice, speed });
  const url = new URL(apiUrl);
  const isHttps = url.protocol === 'https:';
  const transport = isHttps ? https : http;

  return new Promise((resolve, reject) => {
    const req = transport.request({
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
      },
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        if (res.statusCode !== 200) {
          const text = Buffer.concat(chunks).toString();
          try {
            const err = JSON.parse(text);
            reject(new Error(err.error?.message || `TTS HTTP ${res.statusCode}`));
          } catch (_e) {
            reject(new Error(`TTS HTTP ${res.statusCode}`));
          }
        } else {
          resolve(Buffer.concat(chunks));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * Generate speech using local Piper TTS
 * Requires piper binary and voice model
 */
async function synthesizeLocal(text, options = {}) {
  const {
    binaryPath = 'piper',
    modelPath = '',
    speaker = 0,
    outputFormat = 'wav',
  } = options;

  if (!modelPath) {
    throw new Error('Local Piper TTS model path required');
  }

  return new Promise((resolve, reject) => {
    const args = [
      '--model', modelPath,
      '--output-raw',
      '--speaker', String(speaker),
    ];

    const proc = spawn(binaryPath, args, { timeout: 15000 });
    const chunks = [];

    proc.stdout.on('data', (chunk) => chunks.push(chunk));

    let stderr = '';
    proc.stderr.on('data', (d) => stderr += d.toString());

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Piper TTS exited with code ${code}: ${stderr}`));
        return;
      }
      resolve(Buffer.concat(chunks));
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to run Piper TTS: ${err.message}`));
    });

    // Write text to stdin
    proc.stdin.write(text);
    proc.stdin.end();
  });
}

// ─── Voice Engine Manager ───────────────────────────────────

class VoiceEngine {
  constructor() {
    this._sttBackend = 'webSpeech'; // 'webSpeech' | 'openai' | 'local'
    this._ttsBackend = 'webSpeech'; // 'webSpeech' | 'openai' | 'local'
    this._settings = {};
    this._notifications = true;
  }

  configure(settings) {
    this._settings = { ...this._settings, ...settings };
    if (settings.sttBackend) this._sttBackend = settings.sttBackend;
    if (settings.ttsBackend) this._ttsBackend = settings.ttsBackend;
    if (settings.notifications !== undefined) this._notifications = settings.notifications;
    _log('info', 'VOICE', 'Voice engine configured', {
      stt: this._sttBackend,
      tts: this._ttsBackend,
      notifications: this._notifications,
    });
  }

  getConfig() {
    return {
      sttBackend: this._sttBackend,
      ttsBackend: this._ttsBackend,
      notifications: this._notifications,
      settings: this._settings,
    };
  }

  /**
   * Transcribe audio buffer to text
   * @param {Buffer} audioBuffer - WAV audio data
   * @returns {Promise<{text: string}>}
   */
  async transcribe(audioBuffer) {
    _log('info', 'VOICE', `Transcribing with ${this._sttBackend}`, { bytes: audioBuffer.length });

    switch (this._sttBackend) {
      case 'openai':
        return transcribeOpenAI(audioBuffer, {
          apiUrl: this._settings.sttApiUrl || 'https://api.openai.com/v1/audio/transcriptions',
          apiKey: this._settings.sttApiKey || this._settings.openaiKey,
          model: this._settings.sttModel || 'whisper-1',
          language: this._settings.language || 'en',
        });

      case 'local':
        return transcribeLocal(audioBuffer, {
          binaryPath: this._settings.whisperBinary || 'whisper',
          modelPath: this._settings.whisperModel || '',
          language: this._settings.language || 'en',
        });

      case 'webSpeech':
        // Web Speech API runs in the renderer — return signal to use it
        return { text: null, useWebSpeech: true };

      default:
        throw new Error(`Unknown STT backend: ${this._sttBackend}`);
    }
  }

  /**
   * Synthesize text to audio
   * @param {string} text - Text to speak
   * @returns {Promise<Buffer|{useWebSpeech: true}>}
   */
  async synthesize(text) {
    _log('info', 'VOICE', `Synthesizing with ${this._ttsBackend}`, { chars: text.length });

    switch (this._ttsBackend) {
      case 'openai':
        return synthesizeOpenAI(text, {
          apiUrl: this._settings.ttsApiUrl || 'https://api.openai.com/v1/audio/speech',
          apiKey: this._settings.ttsApiKey || this._settings.openaiKey,
          model: this._settings.ttsModel || 'tts-1',
          voice: this._settings.ttsVoice || 'alloy',
          speed: this._settings.ttsSpeed || 1.0,
        });

      case 'local':
        return synthesizeLocal(text, {
          binaryPath: this._settings.piperBinary || 'piper',
          modelPath: this._settings.piperModel || '',
        });

      case 'webSpeech':
        return { useWebSpeech: true, text };

      default:
        throw new Error(`Unknown TTS backend: ${this._ttsBackend}`);
    }
  }
}

const voiceEngine = new VoiceEngine();

module.exports = {
  voiceEngine,
  setLogger,
  transcribeOpenAI,
  transcribeLocal,
  synthesizeOpenAI,
  synthesizeLocal,
};
