import React, { useState, useRef } from 'react';
import {
  MessageCircle,
  Info,
  ShieldCheck,
  Heart,
  ChevronRight,
  Languages,
  Mic,
  MicOff,
} from 'lucide-react';

const SpeechRecognition = typeof window !== 'undefined'
  ? window.SpeechRecognition || window.webkitSpeechRecognition
  : null;

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

const App = () => {
  const [input, setInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

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

    let finalTranscript = input;

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
      setInput(finalTranscript + interim);
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognition.start();
    setIsListening(true);
  };

  const handleAnalyze = async () => {
    if (!input.trim()) return;

    setError('');
    setIsAnalyzing(true);
    setResult(null);

    try {
      const response = await fetch('/api/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-5.4-mini',
          temperature: 0.3,
          max_completion_tokens: 1024,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
              role: 'user',
              content: `Analyze this interaction for hidden cultural meaning. Think step-by-step before responding:\n\n"${input.trim()}"`,
            },
          ],
        }),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => 'Unknown error');
        throw new Error(`API returned ${response.status}: ${detail.slice(0, 200)}`);
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

      const parsed = JSON.parse(jsonMatch[0]);

      setResult({
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
      });
    } catch (err) {
      console.error('Kizuna Analysis Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to analyze. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center p-6 sm:p-12 text-slate-900">
      <header className="w-full max-w-2xl mb-12 text-center">
        <img src="/logo.png" alt="Kizuna AI" className="w-24 h-24 mx-auto mb-4 object-contain" />
        <h1 className="text-3xl font-medium tracking-tight text-[#293E53]">Kizuna: Your Cultural Compass</h1>
        <p className="text-slate-500 text-base mt-2">Defining the UX Layer of Cultural Intelligence</p>
        <p className="text-slate-400 text-sm mt-1">絆AI — 文化的知性のインタラクション・レイヤー</p>
      </header>

      <main className="w-full max-w-2xl space-y-8">
        {result && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-700">
            <section className="bg-white p-8 rounded-3xl shadow-md border border-slate-200">
              <div className="flex items-center gap-2 mb-5">
                <div className="p-2 bg-[#293E53]/10 rounded-xl text-[#293E53]">
                  <MessageCircle size={24} />
                </div>
                <h2 className="text-xl font-bold text-[#293E53]">The Hidden Meaning</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-xl font-semibold text-[#293E53]">&ldquo;{result.translation}&rdquo;</p>
                  <p className="text-sm text-slate-400 italic mt-1">{result.literalMeaning}</p>
                </div>
                <div className="bg-[#293E53]/5 p-5 rounded-2xl border border-[#293E53]/10">
                  <p className="text-slate-700 leading-relaxed">{result.culturalNuance}</p>
                </div>
              </div>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-2 mb-4 text-emerald-600">
                  <ShieldCheck size={20} />
                  <span className="text-xs font-semibold uppercase tracking-widest">AI Confidence</span>
                </div>
                <div className="flex items-end gap-3">
                  <span className="text-4xl font-semibold text-[#293E53]">{result.confidence}%</span>
                  <div className="flex-1 h-3 bg-slate-100 rounded-full mb-2.5 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-1000 ease-out"
                      style={{ width: `${result.confidence}%` }}
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-3 font-medium tracking-tight leading-relaxed">
                  Model: GPT-5.4-mini<br />Chain-of-Thought Analysis
                </p>
              </section>

              <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-2 mb-4 text-[#293E53]">
                  <Info size={20} />
                  <span className="text-xs font-semibold uppercase tracking-widest">Reasoning Path</span>
                </div>
                <p className="text-sm text-slate-600 italic leading-snug">&ldquo;{result.reasoning}&rdquo;</p>
              </section>
            </div>

            <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-2 mb-6 text-rose-500">
                <Heart size={22} />
                <h2 className="text-xl font-medium text-[#293E53]">Recommended Responses</h2>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {result.suggestions.map((item, idx) => (
                  <button
                    key={idx}
                    className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl hover:bg-white hover:shadow-lg hover:border-[#293E53]/20 border border-transparent transition-all group text-left"
                  >
                    <div className="flex-1 pr-4">
                      <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">
                        {item.label}
                      </span>
                      <span className="text-base text-slate-700 font-normal">{item.text}</span>
                    </div>
                    <ChevronRight size={20} className="text-slate-300 group-hover:text-[#293E53] transition-colors" />
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}

        <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 ring-1 ring-slate-100">
          <div className="flex items-center gap-2 mb-4 text-[#293E53]">
            <Languages size={18} />
            <label className="text-sm font-bold uppercase tracking-widest">Input Context</label>
          </div>
          <div className="flex flex-col gap-4">
            <div className="relative">
              <textarea
                className="w-full p-5 pr-14 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#293E53] focus:border-transparent outline-none transition-all text-slate-800 placeholder:text-slate-400 text-lg"
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
                  className={`absolute right-3 bottom-3 p-2 rounded-xl transition-all ${
                    isListening
                      ? 'bg-red-100 text-red-600 mic-pulse'
                      : 'bg-[#293E53]/10 text-[#293E53] hover:bg-[#293E53]/20'
                  }`}
                  title={isListening ? 'Stop listening' : 'Voice input (Japanese)'}
                >
                  {isListening ? <MicOff size={20} /> : <Mic size={20} />}
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
              className="w-full py-4 bg-[#293E53] hover:bg-[#1e2f40] disabled:bg-slate-300 text-white font-bold rounded-2xl shadow-lg shadow-[#293E53]/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
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
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">{error}</p>
            )}
          </div>
        </section>

        <footer className="text-center pt-12 border-t border-slate-200">
          <p className="text-xs text-slate-400 font-medium max-w-md mx-auto leading-relaxed uppercase tracking-tighter">
            April Ma All Rights Reserved
          </p>
        </footer>
      </main>
    </div>
  );
};

export default App;
