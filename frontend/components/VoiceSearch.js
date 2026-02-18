"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { aiSearch } from "@/lib/api";
import { mapListingToProperty } from "@/lib/propertyUtils";
import PropertyCard from "@/components/PropertyCard";
import { useSaved } from "@/context/SavedContext";
import Loading from "@/components/Loading";

export default function VoiceSearch({ onClose, className = "" }) {
  const [inputValue, setInputValue] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [followUp, setFollowUp] = useState("");
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [voiceError, setVoiceError] = useState(null);
  const recognitionRef = useRef(null);
  const searchTriggeredRef = useRef(false);
  const lastTranscriptRef = useRef("");
  const userWantsListeningRef = useRef(false);
  const { savedIds, toggleSave } = useSaved();

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
        setTimeout(() => runSearch(transcript), 300);
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
        setTimeout(() => runSearch(transcript), 200);
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

  async function runSearch(query) {
    const q = (query || inputValue || "").trim();
    if (!q) return;
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const data = await aiSearch(q);
      setResult(data);
    } catch (e) {
      setError(e?.message || "Search failed.");
    } finally {
      setLoading(false);
      searchTriggeredRef.current = false;
    }
  }

  function toggleListening() {
    if (!voiceSupported) return;
    setVoiceError(null);
    searchTriggeredRef.current = false;
    lastTranscriptRef.current = "";
    if (isListening) {
      userWantsListeningRef.current = false;
      try { recognitionRef.current?.stop(); } catch (_) {}
      return;
    }
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
    } catch (_) {
      userWantsListeningRef.current = false;
      recognitionRef.current = null;
      setVoiceError("Could not start microphone.");
    }
  }

  function handleFollowUpSubmit() {
    const q = (followUp || "").trim();
    if (!q) return;
    setFollowUp("");
    setInputValue(q);
    runSearch(q);
  }

  const listings = (result?.intent === "search" && result?.listings) ? result.listings : [];
  const count = result?.intent === "search" ? (result?.count ?? listings.length) : 0;
  const properties = listings.map(mapListingToProperty);

  return (
    <div className={`voice-search ${className}`}>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runSearch(inputValue)}
          placeholder="Say or type: homes under 1M in Mississauga, average price, closing costs..."
          className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          disabled={loading}
        />
        {voiceSupported && (
          <button
            type="button"
            onClick={toggleListening}
            disabled={loading}
            className={`p-3 rounded-full transition-colors ${isListening ? "bg-red-500 text-white animate-pulse" : "bg-gray-200 hover:bg-gray-300 text-gray-700"}`}
            title={isListening ? "Stop listening" : "Start voice search"}
            aria-label={isListening ? "Stop listening" : "Start voice search"}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z" />
            </svg>
          </button>
        )}
        <button
          type="button"
          onClick={() => runSearch(inputValue)}
          disabled={loading || !inputValue.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Search
        </button>
        {typeof onClose === "function" && (
          <button type="button" onClick={onClose} className="p-2 text-gray-500 hover:text-gray-700 rounded" aria-label="Close">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        )}
      </div>

      {(voiceError || error) && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-800 text-sm">
          {voiceError || error}
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-8">
          <Loading />
        </div>
      )}

      {!loading && result && (
        <>
          {result.intent === "search" && (
            <div className="mt-4">
              <p className="text-gray-600 mb-3">
                Found {count} listing{count !== 1 ? "s" : ""}.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {properties.map((property) => (
                  <PropertyCard
                    key={property.id}
                    property={property}
                    isSaved={savedIds.includes(property.id)}
                    onToggleSave={() => toggleSave(property.id)}
                    href={`/listings/${property.id}`}
                  />
                ))}
              </div>
              {properties.length === 0 && (
                <p className="text-gray-500 py-4">No listings match. Try different criteria or ask a market question.</p>
              )}
            </div>
          )}

          {(result.intent === "market_info" || result.intent === "real_estate_question") && result.answer && (
            <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 shadow-sm">
              <p className="text-slate-800 whitespace-pre-wrap">{result.answer}</p>
            </div>
          )}

          {result.intent === "clarification_needed" && result.question && (
            <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200">
              <p className="text-amber-900 font-medium mb-2">{result.question}</p>
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={followUp}
                  onChange={(e) => setFollowUp(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleFollowUpSubmit()}
                  placeholder="Type your answer or more details..."
                  className="flex-1 min-w-[180px] px-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                />
                <button
                  type="button"
                  onClick={handleFollowUpSubmit}
                  disabled={!followUp.trim()}
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
                >
                  Send
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {!loading && !result && !error && (
        <p className="text-gray-500 text-sm mt-2">
          Try: &quot;Homes under 1 million in Mississauga&quot;, &quot;What is the average price in Toronto?&quot;, or &quot;Explain closing costs in Ontario&quot;.
        </p>
      )}
    </div>
  );
}
