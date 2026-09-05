import React, { useState, useRef, useEffect } from 'react';
import {
  MessageCircle,
  Info,
  ShieldCheck,
  Heart,
  ChevronRight,
  Languages,
  RotateCcw,
  Flag,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';

const SpeechRecognition = typeof window !== 'undefined'
  ? window.SpeechRecognition || window.webkitSpeechRecognition
  : null;

function SolidIcon({ src, size = 20, className = '' }) {
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: 'currentColor',
        WebkitMaskImage: `url(${src})`,
        WebkitMaskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        WebkitMaskSize: 'contain',
        maskImage: `url(${src})`,
        maskRepeat: 'no-repeat',
        maskPosition: 'center',
        maskSize: 'contain',
      }}
    />
  );
}

const SYSTEM_PROMPT = `You are Kizuna AI, a cross-cultural communication analyst specializing in high-context societies (Japan, Korea, China, etc.).

## Your Analysis Method (Chain-of-Thought)
When the user provides a phrase or interaction, you MUST reason step-by-step internally:
1. **Identify the Language & Culture**: Detect the source culture and language.
2. **Literal Translation**: What does the phrase literally say in English?
3. **Social Hierarchy Analysis**: Consider the power dynamic (e.g., manager → subordinate, client → vendor) and how it shapes meaning.
4. **Hidden Intent Detection**: In high-context cultures, what is the speaker *actually* communicating? Identify the gap between literal words and true intent.
5. **Confidence Assessment**: Rate your confidence (1-100) based on how well-documented this pattern is in sociolinguistic research.
6. **Actionable Advice**: Provide exactly two strategic suggestions—one for pushing forward, one for accepting gracefully.

## Response Format
Return ONLY valid JSON matching this exact schema. No markdown, no explanation outside the JSON:
{
  "translation": "What the speaker actually means in plain English. Do NOT repeat the original input.",
  "literalMeaning": "What the words literally mean",
  "culturalNuance": "2-3 sentences explaining the hidden meaning in cultural context",
  "confidence": 85,
  "reasoning": "1-2 sentences explaining your reasoning path and what data supports your interpretation",
  "suggestions": [
    { "label": "If you want to push forward", "text": "Specific actionable advice" },
    { "label": "If you want to accept gracefully", "text": "Specific actionable advice" }
  ]
}`;

const FOLLOWUP_PROMPT = `You are Kizuna AI continuing a cultural-intelligence conversation. The user is asking a follow-up about a prior analysis.

Answer helpfully with cultural nuance. Return ONLY valid JSON:
{
  "reply": "Clear conversational answer in 2-5 sentences",
  "confidence": 80,
  "reasoning": "1-2 sentences on why this follow-up answer is reliable",
  "suggestions": [
    { "label": "Optional next step label", "text": "Optional concrete suggestion" }
  ]
}
Include 0-2 suggestions. No markdown outside JSON.`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithBackoff(url, options, { retries = 3, baseDelayMs = 500 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok || (response.status < 500 && response.status !== 429) || attempt === retries) {
        return response;
      }
      lastError = new Error(`Transient API error ${response.status}`);
    } catch (err) {
      lastError = err;
      if (attempt === retries) break;
    }
    await sleep(baseDelayMs * 2 ** attempt);
  }
  throw lastError instanceof Error ? lastError : new Error('Request failed after retries.');
}

async function callKizunaApi(messages) {
  const response = await fetchWithBackoff('/api/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o',
      temperature: 0.3,
      max_tokens: 1024,
      messages,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => 'Unknown error');
    let message = detail.slice(0, 240);
    try {
      const parsedError = JSON.parse(detail);
      message =
        parsedError?.error?.message ||
        parsedError?.error ||
        parsedError?.message ||
        message;
    } catch {
      // keep raw text
    }
    if (typeof message === 'object') message = JSON.stringify(message);
    throw new Error(String(message));
  }

  const payload = await response.json();
  const rawContent = payload?.choices?.[0]?.message?.content;
  if (!rawContent) {
    throw new Error('The model returned an empty response. Please try again.');
  }

  const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not parse structured response from the model.');
  }

  return JSON.parse(jsonMatch[0]);
}

function parseAnalysis(parsed) {
  return {
    type: 'analysis',
    translation: parsed.translation || 'No translation provided.',
    literalMeaning: parsed.literalMeaning || 'No literal meaning provided.',
    culturalNuance: parsed.culturalNuance || 'No cultural nuance provided.',
    confidence: Number.isFinite(parsed.confidence)
      ? Math.min(100, Math.max(1, Math.round(parsed.confidence)))
      : 50,
    reasoning: parsed.reasoning || 'No reasoning path provided.',
    suggestions:
      Array.isArray(parsed.suggestions) && parsed.suggestions.length >= 2
        ? parsed.suggestions.slice(0, 2).map((s, i) => ({
            label: s?.label || `Suggestion ${i + 1}`,
            text: s?.text || 'No suggestion text provided.',
          }))
        : [
            { label: 'Push Forward', text: 'Ask a clarifying follow-up question.' },
            { label: 'Accept Gracefully', text: 'Acknowledge and pivot strategically.' },
          ],
  };
}

function parseFollowUp(parsed) {
  const suggestions = Array.isArray(parsed.suggestions)
    ? parsed.suggestions
        .filter((s) => s?.text)
        .slice(0, 2)
        .map((s, i) => ({
          label: s?.label || `Suggestion ${i + 1}`,
          text: s.text,
        }))
    : [];

  return {
    type: 'followup',
    reply: parsed.reply || 'No follow-up response provided.',
    confidence: Number.isFinite(parsed.confidence)
      ? Math.min(100, Math.max(1, Math.round(parsed.confidence)))
      : 50,
    reasoning: parsed.reasoning || 'No reasoning path provided.',
    suggestions,
  };
}

const buildIssueUrl = ({ confidence, analysis }) => {
  const title = 'Report: inaccurate Kizuna answer';
  const lines = [
    '## What was wrong?',
    '(Please describe the issue with this answer.)',
    '',
    '## Answer details',
    `- Confidence: ${confidence ?? 'n/a'}%`,
    '- Model: GPT-4o',
  ];

  if (analysis?.type === 'analysis') {
    lines.push(
      `- Translation: ${analysis.translation || ''}`,
      `- Literal meaning: ${analysis.literalMeaning || ''}`,
      `- Cultural nuance: ${analysis.culturalNuance || ''}`,
      `- Reasoning: ${analysis.reasoning || ''}`,
    );
  } else if (analysis?.type === 'followup') {
    lines.push(
      `- Reply: ${analysis.reply || ''}`,
      `- Reasoning: ${analysis.reasoning || ''}`,
    );
  }

  const params = new URLSearchParams({
    title,
    body: lines.join('\n'),
  });

  return `https://github.com/aprilmt/kizuna-ai-app/issues/new?${params.toString()}`;
};

const ConfidenceMeter = ({ confidence, analysis }) => (
  <div className="bg-white/80 border border-slate-200 rounded-[2.5rem] p-5 h-full flex flex-col">
    <div className="flex items-center gap-2 mb-3 text-emerald-600">
      <ShieldCheck size={18} />
      <span className="text-xs font-semibold uppercase tracking-widest">AI Confidence</span>
    </div>
    <div className="flex items-end gap-3">
      <span className="text-3xl font-semibold text-[#293E53]">{confidence}%</span>
      <div className="flex-1 h-3 bg-slate-100 rounded-full mb-2 overflow-hidden">
        <div
          className="h-full bg-emerald-500 rounded-full transition-all duration-1000 ease-out"
          style={{ width: `${confidence}%` }}
        />
      </div>
    </div>
    <p className="text-[10px] text-slate-500 mt-2 font-semibold tracking-tight">
      Model: GPT-4o · Chain-of-Thought
    </p>
    <div className="mt-auto pt-6 flex items-center gap-3">
      <a
        href={buildIssueUrl({ confidence, analysis })}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md border border-[#F69C91] text-[#F69C91] text-[11px] font-normal leading-none tracking-wide hover:bg-[#F69C91]/10 transition-colors"
      >
        <Flag size={12} strokeWidth={1.75} />
        Report issue
      </a>
      <div className="flex items-center gap-2 text-[#293E53]">
        <button
          type="button"
          aria-label="Thumbs up"
          className="p-1 hover:text-emerald-600 transition-colors"
        >
          <ThumbsUp size={16} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          aria-label="Thumbs down"
          className="p-1 hover:text-[#F69C91] transition-colors"
        >
          <ThumbsDown size={16} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  </div>
);

const ReasoningLogic = ({ reasoning }) => (
  <div className="bg-white/80 border border-slate-200 rounded-[2.5rem] p-5">
    <div className="flex items-center gap-2 mb-3 text-[#293E53]">
      <Info size={18} />
      <span className="text-xs font-semibold uppercase tracking-widest">Reasoning Logic</span>
    </div>
    <p className="text-sm text-slate-600 italic leading-snug">&ldquo;{reasoning}&rdquo;</p>
  </div>
);

const App = () => {
  const [input, setInput] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const threadRef = useRef(null);

  useEffect(() => {
    if (!threadRef.current) return;
    threadRef.current.scrollTo({
      top: threadRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, isAnalyzing]);

  const toggleListening = () => {
    if (!SpeechRecognition) return;

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ja-JP';
    recognition.interimResults = true;
    recognition.continuous = true;
    recognitionRef.current = recognition;

    const target = messages.length ? 'followup' : 'input';
    let finalTranscript = target === 'followup' ? followUp : input;

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interim += transcript;
        }
      }
      const next = finalTranscript + interim;
      if (target === 'followup') setFollowUp(next);
      else setInput(next);
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognition.start();
    setIsListening(true);
  };

  const handleAnalyze = async () => {
    if (!input.trim() || isAnalyzing) return;

    const prompt = input.trim();
    setError('');
    setIsAnalyzing(true);
    setMessages([{ id: crypto.randomUUID(), role: 'user', text: prompt }]);
    setInput('');

    try {
      const parsed = await callKizunaApi([
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Analyze this interaction for hidden cultural meaning. Think step-by-step before responding:\n\n"${prompt}"`,
        },
      ]);

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          analysis: parseAnalysis(parsed),
        },
      ]);
    } catch (err) {
      console.error('Kizuna Analysis Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to analyze. Please try again.');
      setInput(prompt);
      setMessages([]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFollowUp = async () => {
    if (!followUp.trim() || isAnalyzing || messages.length === 0) return;

    const question = followUp.trim();
    setError('');
    setIsAnalyzing(true);
    setFollowUp('');
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: 'user', text: question },
    ]);

    try {
      const history = [];
      for (const msg of messages) {
        if (msg.role === 'user') {
          history.push({ role: 'user', content: msg.text });
        } else if (msg.analysis?.type === 'analysis') {
          history.push({
            role: 'assistant',
            content: JSON.stringify({
              translation: msg.analysis.translation,
              literalMeaning: msg.analysis.literalMeaning,
              culturalNuance: msg.analysis.culturalNuance,
              confidence: msg.analysis.confidence,
              reasoning: msg.analysis.reasoning,
              suggestions: msg.analysis.suggestions,
            }),
          });
        } else if (msg.analysis?.type === 'followup') {
          history.push({
            role: 'assistant',
            content: JSON.stringify({
              reply: msg.analysis.reply,
              confidence: msg.analysis.confidence,
              reasoning: msg.analysis.reasoning,
              suggestions: msg.analysis.suggestions,
            }),
          });
        }
      }

      const parsed = await callKizunaApi([
        { role: 'system', content: FOLLOWUP_PROMPT },
        ...history,
        { role: 'user', content: question },
      ]);

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          analysis: parseFollowUp(parsed),
        },
      ]);
    } catch (err) {
      console.error('Kizuna Follow-up Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to answer follow-up. Please try again.');
      setMessages((prev) => prev.slice(0, -1));
      setFollowUp(question);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReset = () => {
    setMessages([]);
    setFollowUp('');
    setInput('');
    setError('');
  };

  const inConversation = messages.length > 0;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center p-6 sm:p-12 text-slate-900">
      <header className="w-full max-w-2xl mb-8 text-center">
        <img src="/logo.png" alt="Kizuna AI" className="w-20 h-20 mx-auto mb-3 object-contain" />
        <h1 className="text-3xl font-medium tracking-tight text-[#293E53]">Kizuna: Your Cultural Compass</h1>
        <p className="text-slate-500 text-base mt-2">Defining the UX Layer of Cultural Intelligence</p>
        <p className="text-slate-400 text-sm mt-1">絆AI — 文化的知性のインタラクション・レイヤー</p>
      </header>

      <main className="w-full max-w-2xl space-y-6">
        {inConversation ? (
          <section className="bg-white rounded-[2.5rem] shadow-md border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-700">
            <div className="flex items-center justify-between px-6 sm:px-8 py-5 border-b border-slate-100">
              <div className="flex items-center gap-2 text-[#293E53]">
                <MessageCircle size={20} />
                <h2 className="text-lg font-bold text-slate-950">Conversation</h2>
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-[#293E53] transition-colors"
              >
                <RotateCcw size={16} />
                New chat
              </button>
            </div>

            <div ref={threadRef} className="max-h-[62vh] overflow-y-auto px-6 sm:px-8 py-6 space-y-5">
              {messages.map((msg) =>
                msg.role === 'user' ? (
                  <div key={msg.id} className="flex justify-end">
                    <div className="max-w-[85%] bg-[#293E53] text-white px-5 py-4 rounded-[2.5rem] rounded-br-xl shadow-sm">
                      <p className="text-[10px] uppercase tracking-widest text-white/60 mb-1 font-semibold">
                        Your prompt
                      </p>
                      <p className="text-base leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                    </div>
                  </div>
                ) : (
                  <div key={msg.id} className="flex justify-start">
                    <div className="max-w-[95%] w-full bg-slate-50 border border-slate-200 px-5 py-5 rounded-[2.5rem] rounded-bl-xl space-y-4">
                      {msg.analysis?.type === 'analysis' ? (
                        <>
                          <div className="flex items-center gap-2 text-[#293E53]">
                            <div className="p-2 bg-[#293E53]/10 rounded-xl">
                              <MessageCircle size={18} />
                            </div>
                            <h3 className="text-base font-bold text-slate-950">The Hidden Meaning</h3>
                          </div>
                          <div>
                            <p className="text-xl font-semibold text-[#293E53]">
                              &ldquo;{msg.analysis.translation}&rdquo;
                            </p>
                            <p className="text-sm text-slate-400 italic mt-1">
                              {msg.analysis.literalMeaning}
                            </p>
                          </div>
                          <div className="bg-white p-4 rounded-2xl border border-[#293E53]/10">
                            <p className="text-slate-700 leading-relaxed">
                              {msg.analysis.culturalNuance}
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 text-[#293E53]">
                            <div className="p-2 bg-[#293E53]/10 rounded-xl">
                              <MessageCircle size={18} />
                            </div>
                            <h3 className="text-base font-bold text-slate-950">Kizuna</h3>
                          </div>
                          <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                            {msg.analysis?.reply}
                          </p>
                        </>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <ConfidenceMeter
                          confidence={msg.analysis?.confidence ?? 50}
                          analysis={msg.analysis}
                        />
                        <ReasoningLogic reasoning={msg.analysis?.reasoning ?? ''} />
                      </div>

                      {msg.analysis?.suggestions?.length > 0 && (
                        <div className="space-y-3 pt-1">
                          <div className="flex items-center gap-2 text-rose-500">
                            <Heart size={18} />
                            <span className="text-sm font-medium text-[#293E53]">
                              Recommended Responses
                            </span>
                          </div>
                          {msg.analysis.suggestions.map((item, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setFollowUp(item.text)}
                              className="w-full flex items-center justify-between p-4 bg-white rounded-2xl hover:shadow-md hover:border-[#293E53]/20 border border-transparent transition-all group text-left"
                            >
                              <div className="flex-1 pr-3">
                                <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">
                                  {item.label}
                                </span>
                                <span className="text-sm text-slate-700">{item.text}</span>
                              </div>
                              <ChevronRight
                                size={18}
                                className="text-slate-300 group-hover:text-[#293E53] transition-colors"
                              />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ),
              )}

              {isAnalyzing && (
                <div className="flex justify-start">
                  <div className="bg-slate-50 border border-slate-200 px-5 py-4 rounded-[2.5rem] rounded-bl-xl inline-flex items-center gap-3 text-slate-500">
                    <div className="w-4 h-4 border-2 border-slate-300 border-t-[#293E53] rounded-full animate-spin" />
                    <span className="text-sm">Thinking through cultural nuance...</span>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 px-6 sm:px-8 py-5 bg-slate-50/80">
              <div className="flex items-center gap-2 mb-3 text-[#293E53]">
                <Languages size={16} />
                <label className="text-xs font-bold uppercase tracking-widest">
                  Ask a follow-up question
                </label>
              </div>
              <div className="relative">
                <textarea
                  className="w-full p-4 pr-28 bg-white border border-slate-200 rounded-[2.5rem] focus:ring-2 focus:ring-[#293E53] focus:border-transparent outline-none transition-all text-slate-800 placeholder:text-slate-400 text-base resize-none"
                  rows="2"
                  placeholder="e.g., How should I reply in a meeting? What if they are my client?"
                  value={followUp}
                  onChange={(e) => setFollowUp(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !isAnalyzing && followUp.trim()) {
                      e.preventDefault();
                      handleFollowUp();
                    }
                  }}
                />
                <div className="absolute right-3 bottom-3 flex items-center gap-2">
                  {SpeechRecognition && (
                    <button
                      type="button"
                      onClick={toggleListening}
                      className={`p-1.5 transition-colors ${
                        isListening
                          ? 'text-red-500 mic-pulse'
                          : 'text-[#293E53] hover:text-[#1e2f40]'
                      }`}
                      title={isListening ? 'Stop listening' : 'Voice input (Japanese)'}
                    >
                      <SolidIcon
                        src={
                          isListening
                            ? '/icons/microphone-slash-solid.svg'
                            : '/icons/microphone-solid.svg'
                        }
                        size={18}
                      />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleFollowUp}
                    disabled={isAnalyzing || !followUp.trim()}
                    aria-label="Send follow-up"
                    className="p-1.5 text-[#293E53] hover:text-[#1e2f40] disabled:text-slate-300 transition-colors active:scale-[0.98]"
                  >
                    <SolidIcon src="/icons/paper-plane-solid.svg" size={18} />
                  </button>
                </div>
              </div>
              {error && (
                <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">
                  {error}
                </p>
              )}
            </div>
          </section>
        ) : (
          <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200 ring-1 ring-slate-100">
            <div className="flex items-center gap-2 mb-4 text-[#293E53]">
              <Languages size={18} />
              <label className="text-sm font-bold uppercase tracking-widest">Start a conversation</label>
            </div>
            <div className="flex flex-col gap-4">
              <div className="relative">
                <textarea
                  className="w-full p-5 pr-14 bg-slate-50 border border-slate-200 rounded-[2.5rem] focus:ring-2 focus:ring-[#293E53] focus:border-transparent outline-none transition-all text-slate-800 placeholder:text-slate-400 text-lg"
                  rows="3"
                  placeholder="e.g., My manager said 'わかりました、検討します。' What does it really mean?"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !isAnalyzing && input.trim()) {
                      e.preventDefault();
                      handleAnalyze();
                    }
                  }}
                />
                {SpeechRecognition && (
                  <button
                    type="button"
                    onClick={toggleListening}
                    className={`absolute right-3 bottom-3 p-1.5 transition-colors ${
                      isListening
                        ? 'text-red-500 mic-pulse'
                        : 'text-[#293E53] hover:text-[#1e2f40]'
                    }`}
                    title={isListening ? 'Stop listening' : 'Voice input (Japanese)'}
                  >
                    <SolidIcon
                      src={
                        isListening
                          ? '/icons/microphone-slash-solid.svg'
                          : '/icons/microphone-solid.svg'
                      }
                      size={18}
                    />
                  </button>
                )}
                {isListening && (
                  <span className="absolute right-14 bottom-4 text-xs text-red-500 font-medium animate-pulse">
                    Listening...
                  </span>
                )}
              </div>
              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing || !input.trim()}
                className="w-full py-4 bg-[#293E53] hover:bg-[#1e2f40] disabled:bg-slate-300 text-white font-bold rounded-[2.5rem] shadow-lg shadow-[#293E53]/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
              >
                {isAnalyzing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Analyzing Cultural Nuance...</span>
                  </>
                ) : (
                  'Decode Interaction · 解読する'
                )}
              </button>
              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">
                  {error}
                </p>
              )}
            </div>
          </section>
        )}

        <footer className="text-center pt-8 border-t border-slate-200">
          <p className="text-xs text-slate-400 font-light max-w-md mx-auto leading-relaxed uppercase tracking-tighter">
            April Ma All Rights Reserved
          </p>
        </footer>
      </main>
    </div>
  );
};

export default App;
