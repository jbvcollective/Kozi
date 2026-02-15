"use client";

import { useState, useRef, useEffect } from "react";
import Loading from "./Loading";

export default function Onboarding({ onSearch, isProcessing = false }) {
  const [inputValue, setInputValue] = useState("");
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition =
      typeof window !== "undefined" &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = "en-CA";

      recognitionRef.current.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map((result) => result[0])
          .map((result) => result.transcript)
          .join("");
        setInputValue(transcript);
        if (event.results[0].isFinal) {
          setIsListening(false);
          setTimeout(() => onSearch(transcript), 600);
        }
      };

      recognitionRef.current.onend = () => setIsListening(false);
      recognitionRef.current.onerror = () => setIsListening(false);
    }
  }, [onSearch]);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      setIsListening(true);
      setInputValue("");
      recognitionRef.current?.start();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && inputValue.trim()) {
      onSearch(inputValue);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden px-8 md:px-12">
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

      {/* Floating real-estate vignettes – gentle float animation, staggered */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[8%] top-[12%] animate-float" style={{ animationDelay: "0s" }}>
          <div className="w-36 rounded-2xl bg-white/90 p-3 shadow-xl shadow-black/5 transition-transform duration-500 hover:scale-105" style={{ transform: "rotate(-6deg)" }}>
            <div className="aspect-[4/3] rounded-xl bg-gradient-to-br from-slate-100 to-slate-200" />
            <div className="mt-2 h-2 w-3/4 rounded bg-slate-100" />
            <div className="mt-1 h-2 w-1/2 rounded bg-slate-50" />
          </div>
        </div>
        <div className="absolute right-[10%] top-[15%] animate-float-slow" style={{ animationDelay: "1s" }}>
          <div className="rounded-2xl bg-white/90 p-4 shadow-xl shadow-black/5 transition-transform duration-500 hover:scale-105" style={{ transform: "rotate(4deg)" }}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.852-.719-1.157-2.006-.654-3.124a6 6 0 011.123-7.767 6 6 0 017.767 1.123c1.111.503 2.405.198 3.124.654a6 6 0 015.912 7.029M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
        <div className="absolute right-[6%] top-[45%] animate-float" style={{ animationDelay: "2s" }}>
          <div className="rounded-2xl bg-white/90 p-4 shadow-xl shadow-black/5 transition-transform duration-500 hover:scale-105" style={{ transform: "rotate(-3deg)" }}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
            </svg>
          </div>
        </div>
        <div className="absolute bottom-[18%] left-[12%] animate-float-slow" style={{ animationDelay: "0.5s" }}>
          <div className="rounded-2xl bg-white/90 p-4 shadow-xl shadow-black/5 transition-transform duration-500 hover:scale-105" style={{ transform: "rotate(5deg)" }}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
          </div>
        </div>
        <div className="absolute bottom-[14%] right-[14%] animate-float" style={{ animationDelay: "1.5s" }}>
          <div className="w-32 rounded-2xl bg-white/90 p-3 shadow-xl shadow-black/5 transition-transform duration-500 hover:scale-105" style={{ transform: "rotate(8deg)" }}>
            <div className="aspect-[4/3] rounded-xl bg-gradient-to-br from-amber-100 to-orange-100" />
            <div className="mt-2 h-2 w-2/3 rounded bg-amber-50" />
          </div>
        </div>
        <div className="absolute left-[5%] top-[42%] animate-float-slow" style={{ animationDelay: "2.5s" }}>
          <div className="rounded-2xl bg-white/90 p-4 shadow-xl shadow-black/5 transition-transform duration-500 hover:scale-105" style={{ transform: "rotate(2deg)" }}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-11 w-11 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
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
        className={`z-10 flex w-full max-w-4xl flex-col items-center space-y-16 text-center transition-all duration-700 ${
          isListening ? "scale-105" : ""
        }`}
      >
        <div className="space-y-6">
          <h1 className="animate-slide-up animation-delay-0 text-8xl font-black leading-none tracking-tighter text-foreground md:text-[12rem]">
            LUMINA
          </h1>
          <p className="animate-slide-up animation-delay-150 mx-auto max-w-2xl text-2xl font-medium tracking-tight text-muted md:text-3xl">
            {isListening ? "I'm listening..." : "Find your next home."}{" "}
            <br className="hidden md:block" />
            <span className="font-black text-foreground">
              {isListening ? "Tell us what you're looking for." : "Search homes across Canada. Just start typing."}
            </span>
          </p>
        </div>

        <div className="relative w-full max-w-3xl animate-slide-up animation-delay-300">
          <div className="absolute -inset-4 rounded-[2rem] bg-primary/5 opacity-40 animate-soft-glow" aria-hidden />
          <div
            className={`relative flex items-center rounded-3xl border-2 bg-surface-elevated px-10 py-8 transition-premium ${
              isListening ? "border-primary ring-4 ring-primary/10" : "border-border focus-within:border-primary focus-within:[box-shadow:var(--shadow-focus)]"
            }`}
            style={{ boxShadow: "var(--shadow-elevated)" }}
          >
            <input
              type="text"
              placeholder={
                isListening ? "Listening..." : "e.g. Condo in Toronto under $800K, or family home in Vancouver"
              }
              className="flex-grow bg-transparent text-2xl font-bold text-foreground outline-none placeholder:text-muted md:text-3xl"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              aria-label="Search properties"
            />
            <div className="flex items-center space-x-4">
              <button
                type="button"
                onClick={toggleListening}
                className={`rounded-full p-4 transition-premium hover:scale-105 active:scale-95 ${
                  isListening
                    ? "bg-primary text-white"
                    : "text-muted hover:bg-surface hover:text-foreground"
                }`}
                title="Speak your search"
                aria-label={isListening ? "Stop listening" : "Voice search"}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-8 w-8"
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
                className="btn-primary group rounded-xl p-6 hover:scale-105"
                aria-label="Search"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-8 w-8 transition-transform duration-300 group-hover:translate-x-1"
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
          <p className="mt-4 text-sm font-bold uppercase tracking-widest text-muted">
            Search listings across Canada
          </p>
        </div>

        <div
          className={`flex flex-wrap justify-center gap-4 pt-8 transition-opacity duration-500 ${
            isListening ? "opacity-0" : "opacity-100"
          }`}
        >
          {[
            "Toronto Condos",
            "Vancouver West",
            "Montreal Downtown",
            "Calgary Family Homes",
            "Ottawa Under $600K",
          ].map((tag, i) => (
            <button
              key={tag}
              type="button"
              onClick={() => onSearch(tag)}
              className="animate-slide-up rounded-xl border-2 border-border bg-surface-elevated px-8 py-3 text-lg font-bold text-muted transition-premium hover:scale-[1.02] hover:border-primary hover:text-foreground"
              style={{ boxShadow: "var(--shadow-card)", animationDelay: `${450 + i * 80}ms` }}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
