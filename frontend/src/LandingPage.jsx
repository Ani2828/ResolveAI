import { useEffect, useRef, useState } from "react";
import "./LandingPage.css";

const quickExamples = [
  ["Missing item", "My food item was missing from my order."],
  ["Late delivery", "My delivery was late."],
  ["Ask for a refund", "I want to request a refund for my order."],
  ["Wrong item", "I received the wrong item."],
];

const steps = [
  ["Tell us what happened", "Speak or type naturally in English, Hindi, Hinglish or Kannada."],
  ["ResolveAI understands", "Your complaint is organized into a clear issue and next step."],
  ["Prepare your request", "Get help explaining the issue. The delivery platform confirms any real outcome."],
];

function ResolveMark() {
  return <svg className="ra-logo" viewBox="0 0 32 32" aria-hidden="true">
    <path d="M6 3h20v22l-3.3-2.4L19.3 25 16 22.6 12.7 25l-3.4-2.4L6 25z" fill="#0F2540" />
    <path d="m11 13.2 3.6 3.6 6.4-6.6" fill="none" stroke="#F2B01E" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}

function SupportSlip() {
  return <div className="ra-slip" aria-label="ResolveAI complaint summary illustration">
    <div className="ra-slip-head"><ResolveMark /><div><strong>RESOLVEAI</strong><span>SUPPORT NOTE</span></div><span className="ra-slip-check">✓</span></div>
    <div className="ra-slip-rule" />
    <span className="ra-slip-kicker">YOUR ISSUE</span>
    <h3>One item was missing.</h3>
    <p>Let's make the next step clear.</p>
    <div className="ra-slip-status"><span /> Request ready to review</div>
    <div className="ra-slip-bottom"><span>Clear words. Better support.</span><span>RA—001</span></div>
  </div>;
}

export default function LandingPage({ name = "", email = "", isGuest = false, onStart, onSignOut }) {
  const [intro, setIntro] = useState(() => {
    try { return sessionStorage.getItem("resolveai_landing_intro_seen") !== "yes"; } catch { return false; }
  });
  const startButton = useRef(null);

  useEffect(() => {
    if (!intro) startButton.current?.focus({ preventScroll: true });
  }, [intro]);

  const finishIntro = () => {
    try { sessionStorage.setItem("resolveai_landing_intro_seen", "yes"); } catch {}
    setIntro(false);
  };
  const firstName = name.trim().split(/\\s+/)[0] || email.split("@")[0];

  return <div className="ra-landing-shell">
    {intro && <button className="ra-intro" type="button" onClick={finishIntro} aria-label="Skip ResolveAI intro">
      <span className="ra-intro-mark"><ResolveMark /></span>
      <span className="ra-intro-word">ResolveAI</span>
      <span className="ra-intro-skip">Skip intro</span>
    </button>}
    <div className="ra-landing" inert={intro ? "" : undefined} aria-hidden={intro ? "true" : undefined}>
      <header className="ra-top">
        <div className="ra-brand"><ResolveMark /><span>ResolveAI</span></div>
        <div className="ra-top-right">
          <span className="ra-hello">{isGuest ? "Guest demo" : firstName ? `Hi, ${firstName}` : "Consumer support, made clearer"}</span>
          {onSignOut && <button type="button" className="ra-link" onClick={onSignOut}>{isGuest ? "Exit guest" : "Sign out"}</button>}
        </div>
      </header>
      <main className="ra-main">
        <section className="ra-hero">
          <div className="ra-hero-copy">
            <span className="ra-eyebrow"><span /> CONSUMER SUPPORT, SIMPLIFIED</span>
            <h1>Order went wrong? <em>Say it your way.</em></h1>
            <p className="ra-lede">Speak or type in English, Hindi, Hinglish or Kannada. ResolveAI works out what happened and gets your refund or replacement request ready.</p>
            <button ref={startButton} type="button" className="ra-btn" onClick={() => onStart?.("")}>Report a problem <span aria-hidden="true">↗</span></button>
            <p className="ra-fine">{isGuest ? "Guest demo: sample guidance only, no real orders are touched." : "ResolveAI prepares the request. Your delivery app decides the refund."}</p>
            <div className="ra-quick">
              <p>Not sure how to begin? Tap one:</p>
              <div className="ra-chips">{quickExamples.map(([label, text]) => <button key={label} type="button" className="ra-chip" onClick={() => onStart?.(text)}>{label}<span aria-hidden="true">↗</span></button>)}</div>
            </div>
          </div>
          <div className="ra-hero-slip"><div className="ra-tag" aria-hidden="true" /><SupportSlip /></div>
        </section>
        <section className="ra-steps" aria-labelledby="ra-how">
          <div className="ra-steps-heading"><span className="ra-eyebrow">A CLEARER WAY FORWARD</span><h2 id="ra-how">How it works</h2><p>From a confusing complaint to a clear next step.</p></div>
          <ol>{steps.map(([title, description], index) => <li key={title}><span className="ra-step-n">{String(index + 1).padStart(2, "0")}</span><h3>{title}</h3><p>{description}</p></li>)}</ol>
        </section>
        <footer className="ra-footer"><div className="ra-brand"><ResolveMark /><span>ResolveAI</span></div><p>Helpful guidance, with clear boundaries.</p><span>Real refunds and replacements are confirmed by the delivery platform.</span></footer>
      </main>
    </div>
  </div>;
}
