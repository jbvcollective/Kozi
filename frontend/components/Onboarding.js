"use client";

import { useState, useRef, useEffect } from "react";
import Loading from "./Loading";

export default function Onboarding({ onSearch, isProcessing = false }) {
  const [inputValue, setInputValue] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [voiceError, setVoiceError] = useState(null);
  const recognitionRef = useRef(null);
  const onSearchRef = useRef(onSearch);
  const searchTriggeredRef = useRef(false);
  const lastTranscriptRef = useRef("");
  const userWantsListeningRef = useRef(false);

  onSearchRef.current = onSearch;

  function createRecognition() {
    if (typeof window === "undefined") return null;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;
    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-CA";
    rec.maxAlternatives = 1;
    rec.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0]?.transcript ?? "")
        .join("")
        .trim();
      lastTranscriptRef.current = transcript;
      setInputValue(transcript);
      const isFinal = event.results[event.results.length - 1]?.isFinal;
      if (isFinal && transcript && !searchTriggeredRef.current) {
        searchTriggeredRef.current = true;
        userWantsListeningRef.current = false;
        setIsListening(false);
        try { recognitionRef.current?.stop(); } catch (_) {}
        setTimeout(() => onSearchRef.current(transcript), 300);
      }
    };
    rec.onend = () => {
      if (userWantsListeningRef.current && recognitionRef.current && !searchTriggeredRef.current) {
        setTimeout(() => {
          if (userWantsListeningRef.current && recognitionRef.current) {
            try {
              recognitionRef.current.start();
            } catch (_) {
              userWantsListeningRef.current = false;
              setIsListening(false);
            }
          }
        }, 150);
        return;
      }
      setIsListening(false);
      const transcript = lastTranscriptRef.current.trim();
      if (transcript && !searchTriggeredRef.current) {
        searchTriggeredRef.current = true;
        setTimeout(() => onSearchRef.current(transcript), 200);
      }
    };
    rec.onerror = (event) => {
      userWantsListeningRef.current = false;
      setIsListening(false);
      if (event.error === "not-allowed" || event.error === "permission-denied") {
        setVoiceError("Microphone access denied. Use the search box to type.");
      } else if (event.error === "no-speech") {
        setVoiceError("No speech heard. Try again and speak clearly.");
      } else if (event.error === "network") {
        setVoiceError("Voice search needs internet. Try typing.");
      } else {
        setVoiceError("Voice didn't work. Try typing your search.");
      }
      recognitionRef.current = null;
    };
    return rec;
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.isSecureContext) {
      setVoiceSupported(false);
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceSupported(false);
      return;
    }
    setVoiceSupported(true);
    recognitionRef.current = createRecognition();
    return () => {
      try { recognitionRef.current?.abort?.(); } catch (_) {}
      recognitionRef.current = null;
    };
  }, []);

  const toggleListening = () => {
    if (!voiceSupported) return;
    setVoiceError(null);
    searchTriggeredRef.current = false;
    lastTranscriptRef.current = "";
    if (isListening) {
      userWantsListeningRef.current = false;
      try { recognitionRef.current?.stop(); } catch (_) {}
      setIsListening(false);
    } else {
      if (!recognitionRef.current) {
        recognitionRef.current = createRecognition();
        if (!recognitionRef.current) {
          setVoiceError("Voice not supported in this browser.");
          return;
        }
      }
      userWantsListeningRef.current = true;
      setInputValue("");
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        userWantsListeningRef.current = false;
        recognitionRef.current = null;
        setVoiceError("Could not start microphone. Try again or type your search.");
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && inputValue.trim()) {
      onSearch(inputValue);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full max-w-full flex-col items-center justify-center overflow-x-hidden overflow-y-auto px-4 sm:px-6 md:px-8 lg:px-12 min-w-0 box-border">
      {/* Premium minimal background + subtle gradient drift */}
      <div className="absolute inset-0 bg-background" />
      <div
        className="absolute inset-0 opacity-[0.04] animate-gradient-drift"
        style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 35%, #0f172a 70%, #1e293b 100%)",
          backgroundSize: "200% 200%",
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, #1a1a1a 1px, transparent 0)`,
          backgroundSize: "32px 32px",
        }}
      />

      {/* Floating real-estate vignettes – on mobile moved toward edges so they don't cover the center text */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[4%] top-[8%] sm:left-[8%] sm:top-[12%] animate-float" style={{ animationDelay: "0s" }}>
          <div className="w-28 sm:w-36 rounded-2xl border border-border bg-surface-elevated/95 p-3 transition-transform duration-500" style={{ boxShadow: "var(--shadow-elevated)", transform: "rotate(-6deg)" }}>
            <div className="aspect-[4/3] rounded-xl bg-gradient-to-br from-surface to-border/30" />
            <div className="mt-2 h-2 w-3/4 rounded-full bg-border/40" />
            <div className="mt-1 h-2 w-1/2 rounded-full bg-border/30" />
          </div>
        </div>
        <div className="absolute right-[4%] top-[8%] sm:right-[10%] sm:top-[15%] animate-float-slow" style={{ animationDelay: "1s" }}>
          <div className="rounded-2xl border border-border bg-surface-elevated/95 p-3 sm:p-4 transition-transform duration-500" style={{ boxShadow: "var(--shadow-elevated)", transform: "rotate(4deg)" }}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-10 sm:w-10 text-muted/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.852-.719-1.157-2.006-.654-3.124a6 6 0 011.123-7.767 6 6 0 017.767 1.123c1.111.503 2.405.198 3.124.654a6 6 0 015.912 7.029M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
        <div className="absolute right-[2%] top-[62%] sm:right-[6%] sm:top-[45%] animate-float" style={{ animationDelay: "2s" }}>
          <div className="rounded-2xl border border-border bg-surface-elevated/95 p-3 sm:p-4 transition-transform duration-500" style={{ boxShadow: "var(--shadow-elevated)", transform: "rotate(-3deg)" }}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 sm:h-12 sm:w-12 text-muted/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
            </svg>
          </div>
        </div>
        <div className="absolute bottom-[22%] left-[2%] sm:bottom-[18%] sm:left-[12%] animate-float-slow" style={{ animationDelay: "0.5s" }}>
          <div className="rounded-2xl border border-border bg-surface-elevated/95 p-3 sm:p-4 transition-transform duration-500" style={{ boxShadow: "var(--shadow-elevated)", transform: "rotate(5deg)" }}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-10 sm:w-10 text-muted/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
          </div>
        </div>
        <div className="absolute bottom-[28%] right-[2%] sm:bottom-[14%] sm:right-[14%] animate-float" style={{ animationDelay: "1.5s" }}>
          <div className="w-24 sm:w-32 rounded-2xl border border-border bg-surface-elevated/95 p-3 transition-transform duration-500" style={{ boxShadow: "var(--shadow-elevated)", transform: "rotate(8deg)" }}>
            <div className="aspect-[4/3] rounded-xl bg-gradient-to-br from-primary/10 to-primary/5" />
            <div className="mt-2 h-2 w-2/3 rounded-full bg-primary/10" />
          </div>
        </div>
        <div className="absolute left-[2%] top-[24%] sm:left-[5%] sm:top-[42%] animate-float-slow" style={{ animationDelay: "2.5s" }}>
          <div className="rounded-2xl border border-border bg-surface-elevated/95 p-3 sm:p-4 transition-transform duration-500" style={{ boxShadow: "var(--shadow-elevated)", transform: "rotate(2deg)" }}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-9 w-9 sm:h-11 sm:w-11 text-muted/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
            </svg>
          </div>
        </div>
      </div>

      {/* Siri-style pulse rings when listening */}
      {isListening && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="absolute h-[500px] w-[500px] animate-ping rounded-full bg-black/5" />
          <div className="absolute h-[400px] w-[400px] animate-ping rounded-full bg-black/5 [animation-delay:75ms]" />
          <div className="absolute h-[300px] w-[300px] animate-ping rounded-full bg-black/5 [animation-delay:150ms]" />
        </div>
      )}

      {isProcessing && (
        <div className="glass-morphism animate-fade-in absolute inset-0 z-50 flex flex-col items-center justify-center">
          <Loading size="lg" message="Finding your next home..." variant="center" />
        </div>
      )}

      <div
        className={`z-10 flex w-full max-w-full min-w-0 max-w-4xl flex-col items-center space-y-10 sm:space-y-16 text-center transition-all duration-700 ${
          isListening ? "scale-105" : ""
        }`}
      >
        <div className="flex flex-col items-center gap-3 sm:gap-4 w-full min-w-0 text-center">
          <div className="flex flex-row flex-wrap items-center justify-center gap-x-3 gap-y-1 sm:gap-x-4">
            <h1 className="animate-slide-up animation-delay-0 text-4xl sm:text-5xl md:text-6xl font-black leading-none tracking-tighter text-foreground">
              Kozi
            </h1>
            <p className="animate-slide-up animation-delay-75 text-xs sm:text-sm font-semibold uppercase tracking-[0.2em] text-primary/80">
              Your home search, simplified.
            </p>
          </div>
          <p className="animate-slide-up animation-delay-150 text-base sm:text-lg md:text-xl font-medium tracking-tight text-muted max-w-2xl">
            {isListening ? "I'm listening..." : "Find your next home."}{" "}
            <span className="font-black text-foreground">
              {isListening ? "Tell us what you're looking for." : "Search homes across Canada. Just start typing."}
            </span>
          </p>
        </div>

        <div className="relative w-full max-w-3xl min-w-0 animate-slide-up animation-delay-300">
          <div className="absolute -inset-2 sm:-inset-4 rounded-2xl sm:rounded-[2rem] bg-primary/5 opacity-40 animate-soft-glow" aria-hidden />
          <div
            className={`relative flex items-center gap-2 sm:gap-4 rounded-2xl sm:rounded-3xl border-2 bg-surface-elevated px-4 py-4 sm:px-6 sm:py-6 md:px-10 md:py-8 transition-premium min-w-0 ${
              isListening ? "border-primary ring-4 ring-primary/10" : "border-border focus-within:border-primary focus-within:[box-shadow:var(--shadow-focus)]"
            }`}
            style={{ boxShadow: "var(--shadow-elevated)" }}
          >
            <input
              type="text"
              placeholder={
                isListening ? "Listening..." : "e.g. Condo in Toronto under $800K"
              }
              className="min-w-0 flex-1 bg-transparent text-base sm:text-xl md:text-2xl font-bold text-foreground outline-none placeholder:text-muted md:text-3xl"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                if (voiceError) setVoiceError(null);
              }}
              onKeyDown={handleKeyDown}
              autoFocus
              aria-label="Search properties"
            />
            <div className="flex items-center shrink-0 space-x-2 sm:space-x-4">
              <button
                type="button"
                onClick={toggleListening}
                disabled={!voiceSupported}
                className={`rounded-full p-3 sm:p-4 transition-premium hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                  isListening
                    ? "bg-primary text-white"
                    : "text-muted hover:bg-surface hover:text-foreground"
                }`}
                title={voiceSupported ? "Speak your search (Siri-style)" : "Voice search not supported in this browser"}
                aria-label={isListening ? "Stop listening" : "Voice search"}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 sm:h-8 sm:w-8"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden
                >
                  <path
                    fillRule="evenodd"
                    d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 005.93 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => inputValue.trim() && onSearch(inputValue)}
                className="btn-primary group rounded-xl p-4 sm:p-6 hover:scale-105"
                aria-label="Search"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 sm:h-8 sm:w-8 transition-transform duration-300 group-hover:translate-x-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M14 5l7 7m0 0l-7 7m7-7H3"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
