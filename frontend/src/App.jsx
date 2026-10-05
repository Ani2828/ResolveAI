import { useEffect, useRef, useState } from "react";



const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";



const initialMessages = [];




const RESOLVEAI_THEMES = {
light:{base100:'#ffffff',base200:'#f5f7fb',base300:'#e5e7eb',content:'#172033',primary:'#5b50e6',primaryContent:'#ffffff',secondary:'#7c3aed',accent:'#0891b2',neutral:'#1f2937',neutralContent:'#ffffff'},
dark:{base100:'#111821',base200:'#090d13',base300:'#25303d',content:'#f7f8fa',primary:'#6d5dfc',primaryContent:'#ffffff',secondary:'#9b6dff',accent:'#22c1dc',neutral:'#26313e',neutralContent:'#ffffff'},
cupcake:{base100:'#fffafc',base200:'#f8eff5',base300:'#eadde6',content:'#3f3340',primary:'#d86b9a',primaryContent:'#ffffff',secondary:'#9b7bb4',accent:'#65c3c8',neutral:'#4b3c48',neutralContent:'#ffffff'},
corporate:{base100:'#ffffff',base200:'#eef3f8',base300:'#d6e0e9',content:'#172536',primary:'#2563eb',primaryContent:'#ffffff',secondary:'#475569',accent:'#0f766e',neutral:'#334155',neutralContent:'#ffffff'},
retro:{base100:'#fff8ea',base200:'#f5ead7',base300:'#e5d0ae',content:'#3d2c1e',primary:'#c26b2e',primaryContent:'#ffffff',secondary:'#7c5a3c',accent:'#b78b38',neutral:'#493728',neutralContent:'#ffffff'},
forest:{base100:'#12241d',base200:'#0d1915',base300:'#274337',content:'#eef8f1',primary:'#43a96f',primaryContent:'#07140d',secondary:'#6aa887',accent:'#5bbfd0',neutral:'#1d3429',neutralContent:'#ffffff'},
aqua:{base100:'#ffffff',base200:'#e9f7f9',base300:'#cce9ed',content:'#17363c',primary:'#1595a5',primaryContent:'#ffffff',secondary:'#477b8b',accent:'#22a7c0',neutral:'#29434a',neutralContent:'#ffffff'},
pastel:{base100:'#fffaff',base200:'#f8f3fb',base300:'#eadcf2',content:'#3d3445',primary:'#a56ac6',primaryContent:'#ffffff',secondary:'#7c8bd6',accent:'#6bb8a8',neutral:'#51465a',neutralContent:'#ffffff'},
coffee:{base100:'#2d211a',base200:'#211914',base300:'#49352a',content:'#fff4e8',primary:'#c88952',primaryContent:'#211914',secondary:'#9b6a48',accent:'#d6a15e',neutral:'#3a2a20',neutralContent:'#ffffff'},
night:{base100:'#0b1020',base200:'#050814',base300:'#1b2440',content:'#f0f4ff',primary:'#7c83ff',primaryContent:'#ffffff',secondary:'#9a7cff',accent:'#55b6d9',neutral:'#11182b',neutralContent:'#ffffff'},
nord:{base100:'#f4f7f9',base200:'#e9eef2',base300:'#d2dde5',content:'#263544',primary:'#5e81ac',primaryContent:'#ffffff',secondary:'#81a1c1',accent:'#88c0d0',neutral:'#3b4a59',neutralContent:'#ffffff'},
sunset:{base100:'#fffaf7',base200:'#fff0e9',base300:'#f4d5ca',content:'#472b28',primary:'#e76f51',primaryContent:'#ffffff',secondary:'#c85a7d',accent:'#e9a23b',neutral:'#5a3832',neutralContent:'#ffffff'}
};
function applyResolveAITheme(theme, wallpaper='') {
  const name=RESOLVEAI_THEMES[theme] ? theme : 'light'; const c=RESOLVEAI_THEMES[name]; const r=document.documentElement;
  r.setAttribute('data-theme',name); r.dataset.resolveaiTheme=name;
  const vars={'--color-base-100':c.base100,'--color-base-200':c.base200,'--color-base-300':c.base300,'--color-base-content':c.content,'--color-primary':c.primary,'--color-primary-content':c.primaryContent,'--color-secondary':c.secondary,'--color-secondary-content':c.primaryContent,'--color-accent':c.accent,'--color-accent-content':c.primaryContent,'--color-neutral':c.neutral,'--color-neutral-content':c.neutralContent};
  Object.entries(vars).forEach(([k,v])=>r.style.setProperty(k,v));
  document.body.style.backgroundColor=c.base200; document.body.style.color=c.content;
  document.body.style.backgroundImage=wallpaper ? `url("${wallpaper}")` : ''; document.body.style.backgroundSize=wallpaper?'cover':''; document.body.style.backgroundPosition=wallpaper?'center':''; document.body.style.backgroundAttachment=wallpaper?'fixed':''; document.body.style.backgroundRepeat=wallpaper?'no-repeat':'';
}

function App() {
  const [showSettings, setShowSettings] = useState(false);


  const callbackAuthResult = new URLSearchParams(window.location.search).get("swiggy");

  const [messages, setMessages] = useState(initialMessages);

  const [input, setInput] = useState("");

  const [listening, setListening] = useState(false);

  const [transcribing, setTranscribing] = useState(false);

  const [loading, setLoading] = useState(false);

  const [analysis, setAnalysis] = useState(null);

  const [showDetails, setShowDetails] = useState(false);

  const [selectedHelp, setSelectedHelp] = useState(null);
  
  const [resolutionResult, setResolutionResult] = useState(null);

  const [voiceError, setVoiceError] = useState("");
  const [sidebarPanel, setSidebarPanel] = useState(null);
  const [problemHistory, setProblemHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem("resolveai_problem_history") || "[]"); }
    catch { return []; }
  });
  const [userProfile, setUserProfile] = useState(() => {
    try { return JSON.parse(localStorage.getItem("resolveai_profile") || '{"name":"","email":"","phone":""}'); }
    catch { return { name: "", email: "", phone: "" }; }
  });


  // ResolveAI automatically follows the language detected by the AI.
  // No language selector is needed.
  const [uiLanguage, setUiLanguage] = useState("en");

  const LANGUAGE_MAP = {
    english: "en",
    en: "en",
    hindi: "hi",
    hi: "hi",
    hinglish: "hinglish",
    kannada: "kn",
    kn: "kn",
  };

  function normalizeUiLanguage(value) {
    const key = String(value || "").trim().toLowerCase();
    if (key.includes("hinglish")) return "hinglish";
    if (key.includes("kannada")) return "kn";
    if (key.includes("hindi")) return "hi";
    if (key.includes("english")) return "en";
    return LANGUAGE_MAP[key] || "en";
  }

  const UI_TRANSLATIONS = {
    hi: {
      "Your personal helper": "आपका निजी सहायक",
      "Ready to help": "मदद के लिए तैयार",
      "How can I help you?": "मैं आपकी कैसे मदद करूँ?",
      "Tell me what happened": "बताइए क्या हुआ",
      "You can speak naturally or type your problem.": "आप सामान्य तरीके से बोल सकते हैं या अपनी समस्या लिख सकते हैं।",
      "Current problem": "वर्तमान समस्या",
      "Your app": "आपका ऐप",
      "Based on what you told me": "आपने जो बताया उसके आधार पर",
      "Order": "ऑर्डर",
      "Swiggy connected": "Swiggy कनेक्ट है",
      "Authorization required": "अनुमति आवश्यक है",
      "We'll verify it when connected": "कनेक्ट होने पर हम इसे सत्यापित करेंगे",
      "What went wrong": "क्या समस्या हुई",
      "What you need": "आपको क्या चाहिए",
      "Based on your request": "आपकी रिक्वेस्ट के आधार पर",
      "I understand you": "मैं आपको समझता हूँ",
      "Speak normally. You don't need to choose a language.": "सामान्य रूप से बोलें। भाषा चुनने की जरूरत नहीं है।",
      "You can type naturally in your own language.": "आप अपनी भाषा में स्वाभाविक रूप से लिख सकते हैं।",
      "Tap and speak": "बोलने के लिए टैप करें",
      "Understanding your voice...": "आपकी आवाज़ समझी जा रही है...",
      "I'm listening...": "मैं सुन रहा हूँ...",
      "Speak naturally. No need to choose a language.": "स्वाभाविक रूप से बोलें। भाषा चुनने की जरूरत नहीं है।",
      "Your recording is being converted to text.": "आपकी रिकॉर्डिंग को टेक्स्ट में बदला जा रहा है।",
      "Or type your problem": "या अपनी समस्या लिखें",
      "Type here in your own words...": "अपने शब्दों में यहाँ लिखें...",
      "Clear": "साफ करें",
      "Send": "भेजें",
      "Checking...": "जाँच रहा हूँ...",
      "Order verification": "ऑर्डर सत्यापन",
      "Connect and authorize with Swiggy to retrieve your real food orders.": "अपने असली ऑर्डर देखने के लिए Swiggy को कनेक्ट और अधिकृत करें।",
      "Connecting...": "कनेक्ट हो रहा है...",
      "Connect Swiggy": "Swiggy कनेक्ट करें",
      "Choose a saved Swiggy address": "सेव किया हुआ Swiggy पता चुनें",
      "Loading saved addresses...": "सेव किए हुए पते लोड हो रहे हैं...",
      "Select an address": "पता चुनें",
      "No saved addresses found": "कोई सेव किया हुआ पता नहीं मिला",
      "Load real orders": "असली ऑर्डर लोड करें",
      "Loading...": "लोड हो रहा है...",
      "Disconnect": "डिस्कनेक्ट करें",
      "Finding the order related to your complaint...": "आपकी शिकायत से संबंधित ऑर्डर खोज रहा हूँ...",
      "Order found and verified from your real Swiggy order history.": "आपके असली Swiggy ऑर्डर इतिहास से ऑर्डर मिला और सत्यापित हुआ।",
      "Getting your order information": "आपके ऑर्डर की जानकारी मिल रही है",
      "I'm checking the verified order with Swiggy...": "मैं Swiggy के सत्यापित ऑर्डर की जाँच कर रहा हूँ...",
      "Order not available": "ऑर्डर उपलब्ध नहीं है",
      "I couldn't find a verified Swiggy order for this complaint.": "मुझे इस शिकायत के लिए सत्यापित Swiggy ऑर्डर नहीं मिला।",
      "Order information retrieved": "ऑर्डर की जानकारी मिल गई",
      "Verified directly from your Swiggy order.": "आपके Swiggy ऑर्डर से सीधे सत्यापित किया गया।",
      "Couldn't retrieve order information": "ऑर्डर की जानकारी नहीं मिल सकी",
      "Swiggy did not return the order details.": "Swiggy ने ऑर्डर की जानकारी नहीं दी।",
      "Checking refund options": "रिफंड विकल्प जाँच रहा हूँ",
      "Refund options checked": "रिफंड विकल्प जाँच लिए गए",
      "Couldn't check the order": "ऑर्डर की जाँच नहीं हो सकी",
      "Missing item request prepared": "मिसिंग आइटम रिक्वेस्ट तैयार है",
      "Resolution selected": "समाधान चुना गया",
      "I'll determine the appropriate resolution.": "मैं उचित समाधान तय करूँगा।",
      "Working": "काम कर रहा हूँ",
      "Listening": "सुन रहा हूँ",
      "Ready": "तैयार",
      "You": "आप",
      "ResolveAI": "ResolveAI",
      "Mujhe abhi complaint process karne mein problem aa rahi hai.": "मुझे अभी आपकी शिकायत प्रोसेस करने में समस्या आ रही है।",
      "I could not understand the recording. Please speak again.": "मैं रिकॉर्डिंग समझ नहीं पाया। कृपया फिर बोलें।",
      "No audio was recorded. Please try again.": "कोई ऑडियो रिकॉर्ड नहीं हुआ। कृपया फिर कोशिश करें।",
    },
    hinglish: {
      "Your personal helper": "Aapka personal helper",
      "Ready to help": "Help ke liye ready",
      "How can I help you?": "Main aapki kaise help karun?",
      "Tell me what happened": "Batayein kya hua",
      "You can speak naturally or type your problem.": "Aap normally bol sakte hain ya apni problem type kar sakte hain.",
      "Current problem": "Current problem",
      "Your app": "Aapka app",
      "Based on what you told me": "Aapne jo bataya uske basis par",
      "Order": "Order",
      "Swiggy connected": "Swiggy connected hai",
      "Authorization required": "Authorization required",
      "We'll verify it when connected": "Connect hone par hum verify karenge",
      "What went wrong": "Kya problem hui",
      "What you need": "Aapko kya chahiye",
      "Based on your request": "Aapki request ke basis par",
      "I understand you": "Main aapko samajh raha hoon",
      "Speak normally. You don't need to choose a language.": "Normally boliye. Language choose karne ki zarurat nahi hai.",
      "You can type naturally in your own language.": "Aap apni language mein naturally type kar sakte hain.",
      "Tap and speak": "Bolne ke liye tap karein",
      "Understanding your voice...": "Aapki voice samjhi ja rahi hai...",
      "I'm listening...": "Main sun raha hoon...",
      "Speak naturally. No need to choose a language.": "Naturally boliye. Language choose karne ki zarurat nahi hai.",
      "Your recording is being converted to text.": "Aapki recording ko text mein convert kiya ja raha hai.",
      "Or type your problem": "Ya apni problem type karein",
      "Type here in your own words...": "Apne words mein yahan type karein...",
      "Clear": "Clear",
      "Send": "Send",
      "Checking...": "Checking...",
      "Order verification": "Order verification",
      "Connect and authorize with Swiggy to retrieve your real food orders.": "Apne real orders dekhne ke liye Swiggy connect aur authorize karein.",
      "Connecting...": "Connecting...",
      "Connect Swiggy": "Connect Swiggy",
      "Choose a saved Swiggy address": "Saved Swiggy address choose karein",
      "Loading saved addresses...": "Saved addresses load ho rahe hain...",
      "Select an address": "Address select karein",
      "No saved addresses found": "Koi saved address nahi mila",
      "Load real orders": "Real orders load karein",
      "Loading...": "Loading...",
      "Disconnect": "Disconnect",
      "Finding the order related to your complaint...": "Aapki complaint se related order dhoondh raha hoon...",
      "Order found and verified from your real Swiggy order history.": "Aapke real Swiggy order history se order mila aur verify hua.",
      "Getting your order information": "Aapke order ki information mil rahi hai",
      "I'm checking the verified order with Swiggy...": "Main Swiggy ke verified order ko check kar raha hoon...",
      "Order not available": "Order available nahi hai",
      "I couldn't find a verified Swiggy order for this complaint.": "Is complaint ke liye verified Swiggy order nahi mila.",
      "Order information retrieved": "Order information mil gayi",
      "Verified directly from your Swiggy order.": "Aapke Swiggy order se directly verified.",
      "Couldn't retrieve order information": "Order information nahi mil saki",
      "Swiggy did not return the order details.": "Swiggy ne order details return nahi ki.",
      "Checking refund options": "Refund options check kar raha hoon",
      "Refund options checked": "Refund options check ho gaye",
      "Couldn't check the order": "Order check nahi ho saka",
      "Missing item request prepared": "Missing item request ready hai",
      "Resolution selected": "Resolution select ho gaya",
      "I'll determine the appropriate resolution.": "Main appropriate resolution decide karunga.",
      "Working": "Working",
      "Listening": "Listening",
      "Ready": "Ready",
      "You": "Aap",
      "Mujhe abhi complaint process karne mein problem aa rahi hai.": "Mujhe abhi aapki complaint process karne mein problem aa rahi hai.",
      "I could not understand the recording. Please speak again.": "Main recording samajh nahi paya. Dobara boliye.",
      "No audio was recorded. Please try again.": "Koi audio record nahi hua. Dobara try karein.",
    },
    kn: {
      "Your personal helper": "ನಿಮ್ಮ ವೈಯಕ್ತಿಕ ಸಹಾಯಕ",
      "Ready to help": "ಸಹಾಯ ಮಾಡಲು ಸಿದ್ಧ",
      "How can I help you?": "ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?",
      "Tell me what happened": "ಏನಾಯಿತು ಎಂದು ಹೇಳಿ",
      "Current problem": "ಪ್ರಸ್ತುತ ಸಮಸ್ಯೆ",
      "Your app": "ನಿಮ್ಮ ಆಪ್",
      "Based on what you told me": "ನೀವು ಹೇಳಿದ ಮಾಹಿತಿಯ ಆಧಾರದ ಮೇಲೆ",
      "Order": "ಆರ್ಡರ್",
      "Swiggy connected": "Swiggy ಸಂಪರ್ಕಗೊಂಡಿದೆ",
      "Authorization required": "ಅನುಮತಿ ಅಗತ್ಯವಿದೆ",
      "What went wrong": "ಏನು ತಪ್ಪಾಯಿತು",
      "What you need": "ನಿಮಗೆ ಏನು ಬೇಕು",
      "Based on your request": "ನಿಮ್ಮ ವಿನಂತಿಯ ಆಧಾರದ ಮೇಲೆ",
      "I understand you": "ನಾನು ನಿಮ್ಮನ್ನು ಅರ್ಥಮಾಡಿಕೊಂಡಿದ್ದೇನೆ",
      "Speak normally. You don't need to choose a language.": "ಸಹಜವಾಗಿ ಮಾತನಾಡಿ. ಭಾಷೆ ಆಯ್ಕೆ ಮಾಡುವ ಅಗತ್ಯವಿಲ್ಲ.",
      "Tap and speak": "ಮಾತನಾಡಲು ಟ್ಯಾಪ್ ಮಾಡಿ",
      "Understanding your voice...": "ನಿಮ್ಮ ಧ್ವನಿಯನ್ನು ಅರ್ಥಮಾಡಿಕೊಳ್ಳಲಾಗುತ್ತಿದೆ...",
      "I'm listening...": "ನಾನು ಕೇಳುತ್ತಿದ್ದೇನೆ...",
      "Or type your problem": "ಅಥವಾ ನಿಮ್ಮ ಸಮಸ್ಯೆಯನ್ನು ಟೈಪ್ ಮಾಡಿ",
      "Clear": "ಅಳಿಸಿ",
      "Send": "ಕಳುಹಿಸಿ",
      "Checking...": "ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ...",
      "Order verification": "ಆರ್ಡರ್ ಪರಿಶೀಲನೆ",
      "Connecting...": "ಸಂಪರ್ಕಿಸಲಾಗುತ್ತಿದೆ...",
      "Connect Swiggy": "Swiggy ಸಂಪರ್ಕಿಸಿ",
      "Select an address": "ವಿಳಾಸ ಆಯ್ಕೆಮಾಡಿ",
      "No saved addresses found": "ಉಳಿಸಿದ ವಿಳಾಸಗಳು ಕಂಡುಬಂದಿಲ್ಲ",
      "Load real orders": "ನಿಜವಾದ ಆರ್ಡರ್‌ಗಳನ್ನು ಲೋಡ್ ಮಾಡಿ",
      "Loading...": "ಲೋಡ್ ಆಗುತ್ತಿದೆ...",
      "Disconnect": "ಸಂಪರ್ಕ ಕಡಿತಗೊಳಿಸಿ",
      "Finding the order related to your complaint...": "ನಿಮ್ಮ ದೂರಿಗೆ ಸಂಬಂಧಿಸಿದ ಆರ್ಡರ್ ಹುಡುಕಲಾಗುತ್ತಿದೆ...",
      "Order found and verified from your real Swiggy order history.": "ನಿಮ್ಮ ನಿಜವಾದ Swiggy ಆರ್ಡರ್ ಇತಿಹಾಸದಿಂದ ಆರ್ಡರ್ ಕಂಡು ಪರಿಶೀಲಿಸಲಾಗಿದೆ.",
      "Getting your order information": "ನಿಮ್ಮ ಆರ್ಡರ್ ಮಾಹಿತಿ ಪಡೆಯಲಾಗುತ್ತಿದೆ",
      "Order not available": "ಆರ್ಡರ್ ಲಭ್ಯವಿಲ್ಲ",
      "Order information retrieved": "ಆರ್ಡರ್ ಮಾಹಿತಿ ದೊರಕಿದೆ",
      "Couldn't retrieve order information": "ಆರ್ಡರ್ ಮಾಹಿತಿ ಪಡೆಯಲಾಗಲಿಲ್ಲ",
      "Checking refund options": "ರಿಫಂಡ್ ಆಯ್ಕೆಗಳನ್ನು ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ",
      "Refund options checked": "ರಿಫಂಡ್ ಆಯ್ಕೆಗಳನ್ನು ಪರಿಶೀಲಿಸಲಾಗಿದೆ",
      "Couldn't check the order": "ಆರ್ಡರ್ ಪರಿಶೀಲಿಸಲಾಗಲಿಲ್ಲ",
      "Missing item request prepared": "ಕಾಣೆಯಾದ ಐಟಂ ವಿನಂತಿ ಸಿದ್ಧವಾಗಿದೆ",
      "Resolution selected": "ಪರಿಹಾರ ಆಯ್ಕೆಮಾಡಲಾಗಿದೆ",
      "I'll determine the appropriate resolution.": "ಸೂಕ್ತ ಪರಿಹಾರವನ್ನು ನಿರ್ಧರಿಸುತ್ತೇನೆ.",
      "Working": "ಕೆಲಸ ಮಾಡುತ್ತಿದೆ",
      "Listening": "ಕೇಳುತ್ತಿದ್ದೇನೆ",
      "Ready": "ಸಿದ್ಧ",
      "You": "ನೀವು",
      "Mujhe abhi complaint process karne mein problem aa rahi hai.": "ನಿಮ್ಮ ದೂರನ್ನು ಪ್ರಕ್ರಿಯೆಗೊಳಿಸಲು ಈಗ ಸಮಸ್ಯೆ ಎದುರಾಗಿದೆ.",
      "I could not understand the recording. Please speak again.": "ರೆಕಾರ್ಡಿಂಗ್ ಅರ್ಥವಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಮಾತನಾಡಿ.",
      "No audio was recorded. Please try again.": "ಯಾವುದೇ ಆಡಿಯೋ ದಾಖಲಾಗಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
    }
  };

  // Translate visible static UI text after React renders it. This keeps the
  // existing working Swiggy/voice UI intact while making the interface follow
  // the language detected by /api/analyze.
  useEffect(() => {
    document.documentElement.lang =
      uiLanguage === "hi" ? "hi" :
      uiLanguage === "kn" ? "kn" : "en";

    const dictionary = UI_TRANSLATIONS[uiLanguage];
    if (!dictionary) return;

    const translate = () => {
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT
      );
      const nodes = [];
      let node;
      while ((node = walker.nextNode())) {
        if (node.parentElement?.closest("script,style")) continue;
        nodes.push(node);
      }

      nodes.forEach((textNode) => {
        const original = textNode.nodeValue || "";
        const trimmed = original.trim();
        if (!trimmed) return;

        let translated = dictionary[trimmed];
        if (!translated) {
          for (const [from, to] of Object.entries(dictionary)) {
            if (trimmed.includes(from)) {
              translated = trimmed.split(from).join(to);
              break;
            }
          }
        }
        if (translated && translated !== trimmed) {
          const leading = original.match(/^\\s*/)?.[0] || "";
          const trailing = original.match(/\\s*$/)?.[0] || "";
          textNode.nodeValue = `${leading}${translated}${trailing}`;
        }
      });

      document.querySelectorAll("input[placeholder], textarea[placeholder]").forEach((el) => {
        const value = el.getAttribute("placeholder");
        if (value && dictionary[value]) el.setAttribute("placeholder", dictionary[value]);
      });
    };

    const observer = new MutationObserver(() => {
      observer.disconnect();
      translate();
      observer.observe(document.body, { childList: true, subtree: true });
    });

    translate();
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [uiLanguage]);

  const [swiggyConnected, setSwiggyConnected] = useState(callbackAuthResult === "connected");

  const [swiggyAddresses, setSwiggyAddresses] = useState([]);

  const [swiggyAddressId, setSwiggyAddressId] = useState("");

  const [swiggyOrders, setSwiggyOrders] = useState([]);

  const [swiggyOrdersLoaded, setSwiggyOrdersLoaded] = useState(false);

  const [selectedSwiggyOrderId, setSelectedSwiggyOrderId] = useState("");

  const [selectedSwiggyOrderDetails, setSelectedSwiggyOrderDetails] = useState(null);

  const [swiggyLoading, setSwiggyLoading] = useState(false);

  const [matchedSwiggyOrder, setMatchedSwiggyOrder] = useState(null);

  const [orderMatchStatus, setOrderMatchStatus] = useState("idle");

  // idle | searching | found | multiple | not_found | error*



  const [orderConfirmed, setOrderConfirmed] = useState(false);

  const [swiggyError, setSwiggyError] = useState(

    callbackAuthResult && callbackAuthResult !== "connected"

      ? "Swiggy authorization is required. Please try connecting again."

      : ""

  );



  const mediaRecorderRef = useRef(null);

  const micStreamRef = useRef(null);

  const audioChunksRef = useRef([]);



  async function readSwiggyError(response) {

    try {

      const body = await response.json();

      if (typeof body?.detail === "string" && body.detail.trim()) {
        return body.detail.trim();
      }

      if (typeof body?.error === "string" && body.error.trim()) {
        return body.error.trim();
      }

      if (body?.error?.message) {
        return String(body.error.message);
      }

      if (body?.message) {
        return String(body.message);
      }

      return `Request failed (${response.status})`;

    } catch {

      return `Request failed (${response.status})`;

    }

  }



  async function loadSwiggyAddresses() {

    setSwiggyLoading(true);

    setSwiggyError("");

    try {

      const response = await fetch(`${API_BASE}/api/swiggy/addresses`);

      if (!response.ok) throw new Error(await readSwiggyError(response));

      const data = await response.json();

      setSwiggyAddresses(data.addresses || []);

      setSwiggyAddressId("");

      setSwiggyOrders([]);

      setSelectedSwiggyOrderId("");

      setSelectedSwiggyOrderDetails(null);
      setMatchedSwiggyOrder(null);
      setOrderConfirmed(false);
      setOrderMatchStatus("idle");

    } catch (error) {

      setSwiggyError(error.message || "Could not load Swiggy addresses.");

    } finally {

      setSwiggyLoading(false);

    }

  }



  useEffect(() => {

    const authResult = callbackAuthResult;

    if (authResult) {

      window.history.replaceState({}, "", window.location.pathname);

      if (authResult === "connected") {

        // Load the OAuth callback's newly established backend session.*

        // oxlint-disable-next-line react(set-state-in-effect)*

        void loadSwiggyAddresses();

      }

      return;

    }



    fetch(`${API_BASE}/api/swiggy/status`)

      .then((response) => response.json())

      .then((data) => {

        setSwiggyConnected(Boolean(data.connected));

        if (data.connected) void loadSwiggyAddresses();

      })

      .catch(() => {});

  }, [callbackAuthResult]);



  async function connectSwiggy() {

    setSwiggyLoading(true);

    setSwiggyError("");

    try {

      const response = await fetch(`${API_BASE}/api/swiggy/connect`, {

        method: "POST",

      });

      if (!response.ok) throw new Error(await readSwiggyError(response));

      const data = await response.json();

      window.location.assign(data.authorization_url);

    } catch (error) {

      setSwiggyError(error.message || "Could not start Swiggy authorization.");

      setSwiggyLoading(false);

    }

  }



  async function loadSwiggyOrders(addressId = swiggyAddressId, analysisData = analysis) {
    if (!addressId) return;

    setSwiggyLoading(true);
    setSwiggyError("");
    setSelectedSwiggyOrderId("");
    setSelectedSwiggyOrderDetails(null);
    setMatchedSwiggyOrder(null);
    setOrderConfirmed(false);
    setOrderMatchStatus("idle");
    setSwiggyOrdersLoaded(false);

    try {
      const response = await fetch(`${API_BASE}/api/swiggy/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address_id: addressId }),
      });

      if (!response.ok) {
        throw new Error(await readSwiggyError(response));
      }

      const data = await response.json();
      const orders = data.orders || [];

      setSwiggyOrders(orders);
      setSwiggyOrdersLoaded(true);

      if (
        analysisData?.platform?.toLowerCase() === "swiggy" &&
        orders.length > 0
      ) {
        await automaticallyMatchSwiggyOrder(orders, analysisData);
      }
    } catch (error) {
      setSwiggyError(
        error.message || "Could not retrieve Swiggy orders."
      );
      setOrderMatchStatus("error");

      if (error.message?.toLowerCase().includes("authorization")) {
        setSwiggyConnected(false);
      }
    } finally {
      setSwiggyLoading(false);
    }
  }


  function normalizeText(value) {

    if (value === null || value === undefined) {
      return "";
    }

    if (Array.isArray(value)) {
      return value
        .map((item) => normalizeText(item))
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
    }

    if (typeof value === "object") {
      return Object.values(value)
        .map((item) => normalizeText(item))
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
    }

    return String(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  }



  function getOrderItemsText(order) {

    return normalizeText(
      order?.orderedItems ??
      order?.ordered_items ??
      order?.orderItems ??
      order?.order_items ??
      order?.items ??
      ""
    );

  }



  function isCancelledOrder(order) {

    const status = normalizeText(
      order?.orderStatus ??
      order?.order_status ??
      ""
    );

    return (
      status.includes("cancel") ||
      status.includes("cancelled") ||
      status.includes("canceled")
    );

  }



  function findMatchingSwiggyOrders(orders, analysisData) {

    if (!Array.isArray(orders) || !analysisData) {
      return [];
    }

    const orderReference = normalizeText(
      analysisData.order_reference
    );

    const product = normalizeText(
      analysisData.product
    );

    if (orderReference) {

      const exactMatches = orders.filter((order) => {
        return (
          normalizeText(order?.orderId) ===
          orderReference
        );
      });

      if (exactMatches.length > 0) {
        return exactMatches;
      }
    }

    // Automatic matching must never select a cancelled order.
    const activeOrders = orders.filter(
      (order) => !isCancelledOrder(order)
    );

    if (product) {

      const productWords = product
        .split(" ")
        .filter((word) => word.length > 2);

      const productMatches = activeOrders.filter(
        (order) => {

          const items = getOrderItemsText(order);

          if (!items) {
            return false;
          }

          if (items.includes(product)) {
            return true;
          }

          const matchingWords = productWords.filter(
            (word) => items.includes(word)
          );

          return (
            productWords.length > 0 &&
            matchingWords.length >=
              Math.max(
                1,
                Math.ceil(productWords.length * 0.7)
              )
          );

        }
      );

      if (productMatches.length > 0) {
        return productMatches;
      }
    }

    const issue = normalizeText(
      analysisData.issue
    );

    if (
      issue.includes("delivery") ||
      issue.includes("late") ||
      issue.includes("status") ||
      issue.includes("delay")
    ) {
      return activeOrders.slice(0, 1);
    }

    return [];

  }



  async function automaticallyMatchSwiggyOrder(
    orders,
    analysisData
  ) {

    setOrderMatchStatus("searching");
    setMatchedSwiggyOrder(null);
    setOrderConfirmed(false);
    setSelectedSwiggyOrderId("");
    setSelectedSwiggyOrderDetails(null);

    const matches = findMatchingSwiggyOrders(
      orders,
      analysisData
    );

    console.log(
      "ResolveAI Swiggy order matches:",
      matches
    );

    if (matches.length === 0) {
      setOrderMatchStatus("not_found");
      return;
    }

    if (matches.length > 1) {
      setOrderMatchStatus("multiple");
      return;
    }

    const matchedOrder = matches[0];

    const verified = await selectSwiggyOrder(
      matchedOrder
    );

    if (!verified) {
      setOrderMatchStatus("error");
    }

  }



  async function selectSwiggyOrder(order, preserveConfirmation = false) {

    if (!order?.orderId) {
      setSwiggyError(
        "This Swiggy order does not have a valid order ID."
      );
      setOrderMatchStatus("error");
      return false;
    }

    setSelectedSwiggyOrderId(order.orderId);
    setSelectedSwiggyOrderDetails(null);
    if (!preserveConfirmation) {
      setOrderConfirmed(false);
    }
    setSwiggyLoading(true);
    setSwiggyError("");

    try {

      const response = await fetch(
        `${API_BASE}/api/swiggy/order-details`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            order_id: order.orderId,
            order,
          }),
        }
      );

      if (response.ok) {

        const data = await response.json();

        if (data?.order) {

          setSelectedSwiggyOrderDetails({
            ...data.order,
            verificationSource:
              data.verification_source ||
              "order_details",
          });

          setMatchedSwiggyOrder(order);
          setOrderMatchStatus("found");

          return true;
        }

      } else if (
        response.status === 401 ||
        response.status === 419
      ) {

        throw new Error(
          await readSwiggyError(response)
        );

      } else {

        console.warn(
          "Swiggy order-details endpoint returned:",
          response.status
        );

      }

      // The order object came directly from the real
      // get_food_orders response. It is safe to show as a
      // real order-history match, but we do not call it
      // detailed verification.

      const fallbackDetails = {
        orderId: order.orderId,

        restaurantName:
          order.restaurantName ||
          order.restaurant_name ||
          "Swiggy order",

        orderStatus:
          order.orderStatus ||
          order.order_status ||
          "",

        orderedTime:
          order.orderedTime ||
          order.order_time ||
          "",

        orderTotal:
          order.orderTotal ??
          order.order_total ??
          null,

        items: Array.isArray(order.orderedItems)
          ? order.orderedItems.map((item) => ({
              name:
                item?.name ||
                item?.itemName ||
                item?.item_name ||
                item?.title ||
                "Item",
              quantity:
                item?.quantity ??
                item?.qty ??
                null,
              total:
                item?.total ??
                item?.finalPrice ??
                item?.final_price ??
                null,
            }))
          : [],

        verificationSource:
          "order_history",
      };

      setSelectedSwiggyOrderDetails(
        fallbackDetails
      );

      setMatchedSwiggyOrder(order);
      setOrderMatchStatus("found");

      return null;

    } catch (error) {

      console.error(
        "ResolveAI Swiggy order verification error:",
        error
      );

      setSelectedSwiggyOrderDetails(null);

      const message =
        error?.message ||
        "Could not verify this order with Swiggy.";

      setSwiggyError(message);
      setOrderMatchStatus("error");

      if (
        message
          .toLowerCase()
          .includes("authorization")
      ) {
        setSwiggyConnected(false);
      }

      return false;

    } finally {

      setSwiggyLoading(false);

    }

  }



  async function disconnectSwiggy() {

    setSwiggyLoading(true);

    try {

      await fetch(`${API_BASE}/api/swiggy/disconnect`, { method: "POST" });

      setSwiggyConnected(false);

      setSwiggyAddresses([]);

      setSwiggyAddressId("");

      setSwiggyOrders([]);

      setSwiggyOrdersLoaded(false);

      setSelectedSwiggyOrderId("");

      setSelectedSwiggyOrderDetails(null);
      setMatchedSwiggyOrder(null);
      setOrderConfirmed(false);
      setOrderMatchStatus("idle");

      setSwiggyError("");

    } catch {

      setSwiggyError("Could not disconnect Swiggy right now.");

    } finally {

      setSwiggyLoading(false);

    }

  }



  function openSettingsPage() {
    setShowSettings(true);
  }

  function closeSidebarPanel() {
    setSidebarPanel(null);
  }

  function openProblemHistory(type) {
    try {
      const stored = JSON.parse(localStorage.getItem("resolveai_problem_history") || "[]");
      setProblemHistory(Array.isArray(stored) ? stored : []);
    } catch {
      setProblemHistory([]);
    }
    setSidebarPanel(type);
    const drawer = document.getElementById("resolveai-drawer");
    if (drawer) drawer.checked = false;
  }

  function saveProblemToHistory(record) {
    const next = [
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, ...record },
      ...problemHistory,
    ].slice(0, 30);
    setProblemHistory(next);
    localStorage.setItem("resolveai_problem_history", JSON.stringify(next));
  }

  useEffect(() => {
    const syncPreferences = () => {
      try {
        setUserProfile(JSON.parse(localStorage.getItem("resolveai_profile") || '{"name":"","email":"","phone":""}'));
        applyResolveAITheme(localStorage.getItem("resolveai_theme") || "light", localStorage.getItem("resolveai_wallpaper") || "");
      } catch {}
    };
    syncPreferences();
    window.addEventListener("storage", syncPreferences);
    window.addEventListener("resolveai-theme-change", syncPreferences);
    return () => { window.removeEventListener("storage", syncPreferences); window.removeEventListener("resolveai-theme-change", syncPreferences); };
  }, []);

  useEffect(() => {
    if (resolutionResult?.type !== "success" || !problemHistory.length) return;
    if (problemHistory[0]?.status === "solved") return;
    const updated = problemHistory.map((item, index) =>
      index === 0 ? { ...item, status: "solved" } : item
    );
    setProblemHistory(updated);
    localStorage.setItem("resolveai_problem_history", JSON.stringify(updated));
  }, [resolutionResult]);

  useEffect(() => {

    return () => {

      if (mediaRecorderRef.current) {

        try {

          if (mediaRecorderRef.current.state !== "inactive") {

            mediaRecorderRef.current.stop();

          }

        } catch {

          // Recorder may already be stopped.*

        }

      }



      if (micStreamRef.current) {

        micStreamRef.current.getTracks().forEach((track) => track.stop());

      }

    };

  }, []);



  async function sendMessage() {

    const text = input.trim();

    if (
      !text ||
      loading ||
      listening ||
      transcribing
    ) {
      return;
    }

    const now =
      new Date().toLocaleTimeString(
        [],
        {
          hour: "2-digit",
          minute: "2-digit",
        }
      );

    setMessages((current) => [
      ...current,
      {
        role: "user",
        text,
        time: now,
      },
    ]);

    setInput("");
    setLoading(true);
    setSelectedHelp(null);
    setSwiggyError("");

    try {

      const response = await fetch(
        `${API_BASE}/api/analyze`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: text,

            conversation:
              messages
                .slice(-8)
                .map((entry) => ({
                  role:
                    entry.role === "agent"
                      ? "assistant"
                      : "user",
                  content: entry.text,
                })),

            requested_action:
              selectedHelp,
          }),
        }
      );

      if (!response.ok) {

        const message =
          await readSwiggyError(response);

        throw new Error(
          `AI service returned ${response.status}: ${message}`
        );

      }

      const data =
        await response.json();
      const detectedUiLanguage = normalizeUiLanguage(data?.language);
      setUiLanguage(detectedUiLanguage);
      localStorage.setItem("resolveai_ui_language", detectedUiLanguage);
      localStorage.setItem("resolveai_ui_language", detectedUiLanguage);


      console.log(
        "ResolveAI AI response:",
        data
      );

      if (!data?.success) {

        throw new Error(
          data?.details ||
          data?.error ||
          "AI analysis failed."
        );

      }

      const detectedPlatform =
        normalizeText(data.platform);

      // If the model could not identify the platform but
      // Swiggy is the connected real data source, allow the
      // order matcher to search that source. This is a routing
      // fallback, not a claim that the model detected Swiggy.

      const routingAnalysis =
        detectedPlatform === "unknown" &&
        swiggyConnected
          ? {
              ...data,
              platform: "swiggy",
              platform_inferred_from_connection: true,
            }
          : data;

      setAnalysis(routingAnalysis);
      saveProblemToHistory({
        text,
        language: data?.language || detectedUiLanguage,
        platform: routingAnalysis?.platform || "unknown",
        issue: routingAnalysis?.issue || "unknown",
        action: routingAnalysis?.requested_action || "unknown",
        status: "in_progress",
        createdAt: new Date().toISOString(),
      });

      setSelectedSwiggyOrderId("");
      setSelectedSwiggyOrderDetails(null);
      setMatchedSwiggyOrder(null);
      setOrderConfirmed(false);
      setOrderMatchStatus("idle");

      if (
        routingAnalysis.platform?.toLowerCase() ===
          "swiggy" &&
        swiggyConnected
      ) {

        let addressId =
          swiggyAddressId;

        if (
          !addressId &&
          swiggyAddresses.length === 1
        ) {
          addressId =
            swiggyAddresses[0].id;

          setSwiggyAddressId(
            addressId
          );
        }

        if (addressId) {

          await loadSwiggyOrders(
            addressId,
            routingAnalysis
          );

        } else {

          setOrderMatchStatus(
            "not_found"
          );

        }
      }

      const localizedReply =
        typeof data.reply === "string"
          ? data.reply.trim()
          : "";

      const clarificationQuestion =
        typeof data.clarification_question ===
          "string"
          ? data.clarification_question.trim()
          : "";

      const needsClarification =
        Array.isArray(
          data.missing_fields
        ) &&
        data.missing_fields.length > 0;

      const fallbackReply = {
        en: "I understand. I'm understanding your complaint.",
        hi: "समझ गया। मैं आपकी शिकायत समझ रहा हूँ।",
        hinglish: "Samajh gaya. Main aapki complaint samajh raha hoon.",
        kn: "ಅರ್ಥವಾಯಿತು. ನಿಮ್ಮ ದೂರನ್ನು ನಾನು ಅರ್ಥಮಾಡಿಕೊಳ್ಳುತ್ತಿದ್ದೇನೆ.",
      }[detectedUiLanguage] || "I understand. I'm understanding your complaint.";

      let reply =
        (
          needsClarification &&
          clarificationQuestion
        ) ||
        localizedReply ||
        fallbackReply;

      if (
        !needsClarification &&
        !localizedReply &&
        routingAnalysis.platform &&
        routingAnalysis.platform !==
          "unknown"
      ) {
        reply +=
          detectedUiLanguage === "hi"
            ? ` ${formatPlatform(routingAnalysis.platform)} के बारे में बता रहे हैं।`
            : detectedUiLanguage === "kn"
              ? ` ${formatPlatform(routingAnalysis.platform)} ಬಗ್ಗೆ ಹೇಳುತ್ತಿದ್ದೀರಿ.`
              : detectedUiLanguage === "hinglish"
                ? ` Aap ${formatPlatform(routingAnalysis.platform)} ke baare mein bata rahe hain.`
                : ` You are talking about ${formatPlatform(routingAnalysis.platform)}.`;
      }

      if (
        !needsClarification &&
        !localizedReply
      ) {

        switch (data.issue) {

          case "missing_item":
            reply +=
              detectedUiLanguage === "hi" ? " आपने बताया कि ऑर्डर में एक आइटम गायब था।" : detectedUiLanguage === "kn" ? " ಆರ್ಡರ್‌ನಲ್ಲಿ ಒಂದು ಐಟಂ ಕಾಣೆಯಾಗಿದೆ ಎಂದು ನೀವು ಹೇಳಿದ್ದೀರಿ." : " Aapne bataya ki order mein ek item missing tha."; 
            break;

          case "wrong_item":
            reply +=
              detectedUiLanguage === "hi" ? " आपने बताया कि आपको गलत आइटम मिला।" : detectedUiLanguage === "kn" ? " ನಿಮಗೆ ತಪ್ಪಾದ ಐಟಂ ಸಿಕ್ಕಿದೆ ಎಂದು ನೀವು ಹೇಳಿದ್ದೀರಿ." : " Aapne bataya ki aapko wrong item mila."; 
            break;

          case "damaged_item":
            reply +=
              detectedUiLanguage === "hi" ? " आपने बताया कि आइटम खराब था।" : detectedUiLanguage === "kn" ? " ಐಟಂ ಹಾನಿಗೊಂಡಿದೆ ಎಂದು ನೀವು ಹೇಳಿದ್ದೀರಿ." : " Aapne bataya ki item damaged tha."; 
            break;

          case "late_delivery":
            reply +=
              detectedUiLanguage === "hi" ? " आपने बताया कि डिलीवरी देर से हुई।" : detectedUiLanguage === "kn" ? " ಡೆಲಿವರಿ ತಡವಾಗಿದೆ ಎಂದು ನೀವು ಹೇಳಿದ್ದೀರಿ." : " Aapne bataya ki delivery late hui."; 
            break;

          case "cancelled_order":
            reply +=
              " Aapne cancelled order ke baare mein bataya.";
            break;

          case "payment_problem":
            reply +=
              " Aapne payment ke saath problem batayi.";
            break;

          case "refund_problem":
            reply +=
              " Aapne refund ke saath problem batayi.";
            break;

          case "delivery_problem":
            reply +=
              " Aapne delivery ke saath problem batayi.";
            break;

          case "account_problem":
            reply +=
              " Aapne account ke saath problem batayi.";
            break;

          default:
            break;
        }
      }

      if (
        !needsClarification &&
        !localizedReply &&
        data.product
      ) {
        reply +=
          ` Aapne "${data.product}" ka zikr kiya.`;
      }

      if (
        !needsClarification &&
        !localizedReply
      ) {

        switch (
          data.requested_action
        ) {

          case "refund":
            reply +=
              detectedUiLanguage === "hi" ? " आप रिफंड चाहते हैं।" : detectedUiLanguage === "kn" ? " ನಿಮಗೆ ರಿಫಂಡ್ ಬೇಕು." : " Aap refund chahte hain."; 
            break;

          case "replacement":
            reply +=
              detectedUiLanguage === "hi" ? " आप रिप्लेसमेंट चाहते हैं।" : detectedUiLanguage === "kn" ? " ನಿಮಗೆ ಬದಲಾವಣೆ ಬೇಕು." : " Aap replacement chahte hain."; 
            break;

          case "reorder":
            reply +=
              detectedUiLanguage === "hi" ? " आप आइटम दोबारा मंगवाना चाहते हैं।" : detectedUiLanguage === "kn" ? " ನೀವು ಐಟಂ ಅನ್ನು ಮತ್ತೆ ಆರ್ಡರ್ ಮಾಡಲು ಬಯಸುತ್ತೀರಿ." : " Aap item dobara mangwana chahte hain."; 
            break;

          case "cancellation":
            reply +=
              detectedUiLanguage === "hi" ? " आप कैंसलेशन चाहते हैं।" : detectedUiLanguage === "kn" ? " ನಿಮಗೆ ರದ್ದತಿ ಬೇಕು." : " Aap cancellation chahte hain."; 
            break;

          case "status_check":
            reply +=
              detectedUiLanguage === "hi" ? " आप ऑर्डर का स्टेटस जानना चाहते हैं।" : detectedUiLanguage === "kn" ? " ನೀವು ಆರ್ಡರ್ ಸ್ಥಿತಿಯನ್ನು ತಿಳಿದುಕೊಳ್ಳಲು ಬಯಸುತ್ತೀರಿ." : " Aap order ka status jaana chahte hain."; 
            break;

          case "information":
            reply +=
              detectedUiLanguage === "hi" ? " आप इसके बारे में जानकारी चाहते हैं।" : detectedUiLanguage === "kn" ? " ನಿಮಗೆ ಇದರ ಬಗ್ಗೆ ಮಾಹಿತಿ ಬೇಕು." : " Aap iske baare mein information chahte hain."; 
            break;

          default:
            break;
        }
      }

      if (
        !needsClarification &&
        !localizedReply
      ) {
        reply +=
          detectedUiLanguage === "hi" ? " मैं अब अगला कदम जाँचूँगा।" : detectedUiLanguage === "kn" ? " ನಾನು ಈಗ ಮುಂದಿನ ಹಂತವನ್ನು ಪರಿಶೀಲಿಸುತ್ತೇನೆ." : " Main ab next step check karunga."; 
      }

      setMessages((current) => [
        ...current,
        {
          role: "agent",
          text: reply,
          time: now,
        },
      ]);

    } catch (error) {

      console.error(
        "ResolveAI API error:",
        error
      );

      const errorMessage =
        error?.message ||
        "The ResolveAI backend could not process the request.";

      setMessages((current) => [
        ...current,
        {
          role: "agent",
          text:
            `Mujhe abhi complaint process karne mein problem aa rahi hai. ${errorMessage}`,
          time: now,
        },
      ]);

    } finally {

      setLoading(false);

    }

  }



  function getSupportedRecorderMimeType() {

    const types = [

      "audio/webm;codecs=opus",

      "audio/webm",

      "audio/mp4",

      "audio/ogg;codecs=opus",

    ];



    return types.find((type) => MediaRecorder.isTypeSupported(type)) || "";

  }



  async function transcribeAudio(audioBlob, mimeType) {

    try {

      setTranscribing(true);

      setVoiceError("");



      const formData = new FormData();

      const extension = mimeType.includes("mp4")

        ? "m4a"

        : mimeType.includes("ogg")

          ? "ogg"

          : "webm";



      formData.append(

        "file",

        audioBlob,

        `resolveai-voice.${extension}`

      );



      console.log("ResolveAI: uploading audio for transcription...");



      const response = await fetch(`${API_BASE}/api/transcribe`, {

        method: "POST",

        body: formData,

      });



      const data = await response.json();



      console.log("ResolveAI transcription response:", data);



      if (!response.ok || !data.success) {

        throw new Error(

          data.details ||

            data.error ||

            `Transcription failed (${response.status})`

        );

      }



      const transcript = (data.text || "").trim();



      if (!transcript) {

        throw new Error(

          "I could not understand the recording. Please speak again."

        );

      }



      // A voice recording is a replacement for the current draft.*

      // The complaint is sent only after the user presses Send.*

      setInput(transcript);

    } catch (error) {

      console.error("ResolveAI transcription error:", error);

      setVoiceError(

        error.message ||

          "Voice transcription failed. Please try again."

      );

    } finally {

      setTranscribing(false);

    }

  }



  async function startRecording() {

    if (loading || transcribing || listening) {

      return;

    }



    setVoiceError("");



    if (!navigator.mediaDevices?.getUserMedia) {

      setVoiceError(

        "Your browser does not support microphone recording."

      );

      return;

    }



    if (!window.MediaRecorder) {

      setVoiceError(

        "Your browser does not support audio recording."

      );

      return;

    }



    try {

      const stream = await navigator.mediaDevices.getUserMedia({

        audio: {

          echoCancellation: true,

          noiseSuppression: true,

          autoGainControl: true,

        },

      });



      micStreamRef.current = stream;

      audioChunksRef.current = [];



      const mimeType = getSupportedRecorderMimeType();



      const recorder = mimeType

        ? new MediaRecorder(stream, { mimeType })

        : new MediaRecorder(stream);



      recorder.ondataavailable = (event) => {

        if (event.data && event.data.size > 0) {

          audioChunksRef.current.push(event.data);

        }

      };



      recorder.onerror = (event) => {

        console.error("MediaRecorder error:", event);

        setVoiceError(

          "There was a problem recording your voice."

        );

      };



      recorder.onstop = async () => {

        const actualMimeType =

          recorder.mimeType || mimeType || "audio/webm";



        const audioBlob = new Blob(audioChunksRef.current, {

          type: actualMimeType,

        });



        audioChunksRef.current = [];



        if (micStreamRef.current) {

          micStreamRef.current

            .getTracks()

            .forEach((track) => track.stop());

          micStreamRef.current = null;

        }



        if (audioBlob.size === 0) {

          setVoiceError(

            "No audio was recorded. Please try again."

          );

          return;

        }



        await transcribeAudio(audioBlob, actualMimeType);

      };



      mediaRecorderRef.current = recorder;

      recorder.start();



      setListening(true);



      console.log(

        "ResolveAI: recording started",

        actualMimeTypeForLog(recorder, mimeType)

      );

    } catch (error) {

      console.error("ResolveAI microphone error:", error);



      if (error?.name === "NotAllowedError") {

        setVoiceError(

          "Microphone permission was denied. Allow microphone access for this site and try again."

        );

      } else if (error?.name === "NotFoundError") {

        setVoiceError(

          "No microphone was found. Connect or enable a microphone and try again."

        );

      } else if (error?.name === "NotReadableError") {

        setVoiceError(

          "The microphone is being used by another application."

        );

      } else {

        setVoiceError(

          "ResolveAI could not access the microphone. Please check your browser permissions."

        );

      }



      if (micStreamRef.current) {

        micStreamRef.current

          .getTracks()

          .forEach((track) => track.stop());

        micStreamRef.current = null;

      }

    }

  }



  function actualMimeTypeForLog(recorder, fallback) {

    return recorder?.mimeType || fallback || "browser default";

  }



  function stopRecording() {

    const recorder = mediaRecorderRef.current;



    if (!recorder) {

      setListening(false);

      return;

    }



    try {

      if (recorder.state !== "inactive") {

        recorder.stop();

      }

    } catch (error) {

      console.error("ResolveAI stop recording error:", error);

    }



    mediaRecorderRef.current = null;

    setListening(false);



    console.log("ResolveAI: recording stopped");

  }



  function toggleVoice() {

    if (transcribing) {

      return;

    }



    if (listening) {

      stopRecording();

    } else {

      startRecording();

    }

  }



  function formatPlatform(platform) {

    const names = {

      swiggy: "Swiggy",

      zomato: "Zomato",

      amazon: "Amazon",

      flipkart: "Flipkart",

      myntra: "Myntra",

      meesho: "Meesho",

    };



    return names[platform] || platform;

  }



  function formatIssue(issue) {

    if (!issue) {

      return "Unknown";

    }



    return issue

      .replaceAll("_", " ")

      .replace(/\b\w/g, (letter) => letter.toUpperCase());

  }



  function formatAction(action) {

    const actions = {

      refund: "Refund",

      replacement: "Missing item request",

      reorder: "Reorder",

      cancellation: "Cancellation",

      status_check: "Status check",

      information: "Information",

      unknown: "Not sure yet",

    };



    return actions[action] || "Not sure yet";

  }
  function speakSupportRequest(type) {
    const order =
      matchedSwiggyOrder ||
      selectedSwiggyOrderDetails ||
      selectedSwiggyOrder;

    const restaurant =
      order?.restaurantName ||
      order?.restaurant_name ||
      selectedSwiggyOrderDetails?.restaurantName ||
      "the restaurant";

    const orderId =
      order?.orderId ||
      selectedSwiggyOrderDetails?.orderId ||
      "";

    const product =
      analysis?.product ||
      "the missing item";

    const text =
      type === "refund"
        ? `Hello. I need help with a refund for my Swiggy order from ${restaurant}. ` +
          `${orderId ? `My order ID is ${orderId}. ` : ""}` +
          `I would like to request a refund for the issue with ${product}. ` +
          `Please check my original order and help me with the appropriate resolution.`
        : `Hello. I need help with a missing item from my Swiggy order from ${restaurant}. ` +
          `${orderId ? `My order ID is ${orderId}. ` : ""}` +
          `The missing item is ${product}. ` +
          `I am requesting that the missing item be resolved from the original order ` +
          `without placing a new paid order.`;

    if (!("speechSynthesis" in window)) {
      setVoiceError("Voice playback is not supported in this browser.");
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang =
      uiLanguage === "hi" ? "hi-IN" :
      uiLanguage === "kn" ? "kn-IN" : "en-IN";
    utterance.rate = 0.9;
    utterance.pitch = 1;

    window.speechSynthesis.speak(utterance);

    setMessages((current) => [
      ...current,
      {
        role: "agent",
        text:
          type === "refund"
            ? `🎙️ Refund request prepared: ${text}`
            : `🎙️ Missing-item request prepared: ${text}`,
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    ]);
  }

  function prepareSwiggySupportRequest(type) {
    const order =
      matchedSwiggyOrder ||
      selectedSwiggyOrderDetails ||
      selectedSwiggyOrder;

    const restaurant =
      order?.restaurantName ||
      order?.restaurant_name ||
      "the restaurant";

    const orderId =
      order?.orderId ||
      selectedSwiggyOrderDetails?.orderId ||
      "";

    const product =
      analysis?.product ||
      "the missing item";

    const requestText =
      type === "refund"
        ? `I need help with a refund for my verified Swiggy order from ${restaurant}. ` +
          `${orderId ? `My order ID is ${orderId}. ` : ""}` +
          `The issue is with ${product}. Please check the original order and provide the appropriate resolution.`
        : `I need help with a missing ${product} from my verified Swiggy order from ${restaurant}. ` +
          `${orderId ? `My order ID is ${orderId}. ` : ""}` +
          `Please resolve the missing item from the original order without placing a new paid order.`;

    setMessages((current) => [
      ...current,
      {
        role: "agent",
        text:
          `📱 Swiggy support request prepared:\n\n${requestText}`,
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    ]);

    window.open(
      "https://www.swiggy.com/swiggy_customer_care",
      "_blank",
      "noopener,noreferrer"
    );
  }

  async function handleHelpSelection(value) {
  setSelectedHelp(value);

  // --------------------------------------------------
  // INFORMATION: perform the real Swiggy lookup
  // --------------------------------------------------
  if (value === "information") {
    setResolutionResult({
      type: "loading",
      title: "Getting your order information",
      message: "I'm checking the verified order with Swiggy...",
      icon: "🔎",
    });

    const order = matchedSwiggyOrder;

    if (!order) {
      setResolutionResult({
        type: "error",
        title: "Order not available",
        message: "I couldn't find a verified Swiggy order for this complaint.",
        icon: "⚠️",
      });
      return;
    }
    
    const verified = await selectSwiggyOrder(order, true);
    
    if (verified) {
      setResolutionResult({
        type: "success",
        title: "Order information retrieved",
        message: "Verified directly from your Swiggy order.",
        icon: "ℹ️",
      });
    } else {
      setResolutionResult({
        type: "error",
        title: "Couldn't retrieve order information",
        message: "Swiggy did not return the order details.",
        icon: "⚠️",
      });
    }

    return;
  }
  
  if (value === "refund") {
  setResolutionResult({
    type: "loading",
    title: "Checking refund options",
    message: "I'm checking your verified order with Swiggy...",
    icon: "💰",
  });

  if (!matchedSwiggyOrder) {
    setResolutionResult({
      type: "error",
      title: "Order not available",
      message: "I couldn't find a verified Swiggy order for this complaint.",
      icon: "⚠️",
    });
    return;
  }

  const verified = await selectSwiggyOrder(matchedSwiggyOrder, true);

  if (verified) {
    setResolutionResult({
      type: "success",
      title: "Refund options checked",
      message:
        "Your order is verified. Swiggy's connected Food service does not currently provide a direct refund action.",
      icon: "💰",
    });
  } else {
    setResolutionResult({
      type: "error",
      title: "Couldn't check the order",
      message: "Swiggy did not return the verified order details.",
      icon: "⚠️",
    });
  }

  return;
}
  // --------------------------------------------------
  // Other actions for now
  // --------------------------------------------------
  const product = analysis?.product || "this order";

  const results = {
    refund: {
      type: "info",
      title: "Checking refund options",
      message: "I'm checking the verified order and available Swiggy resolution options.",
      icon: "💰",
    },

    replacement: {
      type: "info",
      title: "Missing item request prepared",
      message:
    `Your ${product} is missing from the original order. ` +
    `ResolveAI will not create a new paid order. ` +
    `The request is to have the missing item delivered ` +
    `from the original order without additional cost.`,
      icon: "📦",
    },

    unknown: {
      type: "info",
      title: "Resolution selected",
      message: "I'll determine the appropriate resolution.",
      icon: "🤔",
    },
  };

  setResolutionResult(results[value]);
}



  const appName =

    analysis?.platform && analysis.platform !== "unknown"

      ? formatPlatform(analysis.platform)

      : "We'll find it";



  const issueName =

    analysis?.issue && analysis.issue !== "unknown"

      ? formatIssue(analysis.issue)

      : "We'll understand";



  const actionName = selectedHelp

    ? formatAction(selectedHelp)

    : analysis?.requested_action &&

        analysis.requested_action !== "unknown"

      ? formatAction(analysis.requested_action)

      : "We'll ask you";



  const selectedSwiggyOrder = swiggyOrders.find(

    (order) => order.orderId === selectedSwiggyOrderId

  );



  const statusText = loading

    ? "I'm checking"

    : transcribing

      ? "I'm understanding your voice"

      : listening

        ? "I'm listening"

        : "Ready to help";



  return (
    <>
    
    <div className="resolveai-app min-h-screen bg-base-200/80 text-base-content">

      <div className="drawer lg:drawer-open">

        <input

          id="resolveai-drawer"

          type="checkbox"

          className="drawer-toggle"

        />



        <div className="drawer-content flex min-h-screen min-w-0 flex-col">

          <header className="navbar sticky top-0 z-30 h-16 min-h-16 border-b border-base-300 bg-base-100/90 px-3 sm:px-5">

            <div className="navbar-start min-w-0 gap-2">

              <label

                htmlFor="resolveai-drawer"

                className="btn btn-ghost btn-square lg:hidden"

              >

                ☰

              </label>



              <div className="flex min-w-0 items-center gap-2">

                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-content">

                  <span className="font-black">R</span>

                </div>



                <div className="min-w-0">

                  <div className="truncate font-black leading-none">

                    ResolveAI

                  </div>

                  <div className="mt-1 hidden truncate text-[10px] uppercase tracking-widest text-base-content/50 sm:block">

                    Your personal helper

                  </div>

                </div>

              </div>

            </div>



            <div className="navbar-center hidden sm:flex">

              <div className="badge badge-outline gap-2 px-3 py-3">

                <span

                  className={`h-2 w-2 rounded-full ${

                    listening

                      ? "bg-error animate-pulse"

                      : loading || transcribing

                        ? "bg-warning animate-pulse"

                        : "bg-success"

                  }`}

                />

                {statusText}

              </div>

            </div>



            <div className="navbar-end">

              <div className="avatar avatar-placeholder">

                <div className="w-9 rounded-full bg-primary text-primary-content">

                  <span className="text-xs font-bold">{(userProfile.name || "RA").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span>

                </div>

              </div>

            </div>

          </header>



          <main className="flex-1 min-w-0 overflow-x-hidden px-3 py-4 sm:p-5 md:p-6">

            <div className="mx-auto w-full min-w-0 max-w-[1500px]">

              <div className="mb-5">

                <div className="breadcrumbs hidden text-sm sm:block">

                  <ul>

                    <li>ResolveAI</li>

                    <li>Current problem</li>

                  </ul>

                </div>



                <div className="mt-1 flex items-start justify-between gap-3">

                  <div className="min-w-0">

                    <h1 className="text-2xl font-black tracking-tight sm:text-3xl">

                      How can I help you?

                    </h1>

                    <p className="mt-1 max-w-2xl text-sm leading-5 text-base-content/60">

                      Tell me what happened. You can speak naturally or type

                      your problem.

                    </p>

                  </div>



                  <div className="badge badge-info gap-1 sm:hidden">

                    <span className="h-1.5 w-1.5 rounded-full bg-current" />

                    {loading || transcribing

                      ? "Working"

                      : listening

                        ? "Listening"

                        : "Ready"}

                  </div>

                </div>

              </div>



              <div className="mb-5 grid min-w-0 grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">

                <div className="card min-w-0 border border-base-300 bg-base-100/90 shadow-sm">

                  <div className="card-body min-w-0 p-3 sm:p-4">

                    <div className="text-[10px] font-semibold uppercase tracking-wide text-base-content/50 sm:text-xs">

                      Your app

                    </div>

                    <div className="mt-1 truncate text-base font-black sm:text-lg">

                      {appName}

                    </div>

                    <div className="mt-1 hidden text-xs text-base-content/50 sm:block">

                      Based on what you told me

                    </div>

                  </div>

                </div>



                <div className="card min-w-0 border border-base-300 bg-base-100/90 shadow-sm">

                  <div className="card-body min-w-0 p-3 sm:p-4">

                    <div className="text-[10px] font-semibold uppercase tracking-wide text-base-content/50 sm:text-xs">

                      Order

                    </div>

                    <div className="mt-1 truncate text-base font-black sm:text-lg">

                      {selectedSwiggyOrder?.restaurantName ||

                        (swiggyConnected ? "Swiggy connected" : "Authorization required")}

                    </div>

                    <div className="mt-1 hidden text-xs text-base-content/50 sm:block">

                      We'll verify it when connected

                    </div>

                  </div>

                </div>



                <div className="card min-w-0 border border-base-300 bg-base-100/90 shadow-sm">

                  <div className="card-body min-w-0 p-3 sm:p-4">

                    <div className="text-[10px] font-semibold uppercase tracking-wide text-base-content/50 sm:text-xs">

                      What went wrong

                    </div>

                    <div className="mt-1 truncate text-base font-black sm:text-lg">

                      {issueName}

                    </div>

                    <div className="mt-1 hidden text-xs text-base-content/50 sm:block">

                      Based on what you told me

                    </div>

                  </div>

                </div>



                <div className="card min-w-0 border border-base-300 bg-base-100/90 shadow-sm">

                  <div className="card-body min-w-0 p-3 sm:p-4">

                    <div className="text-[10px] font-semibold uppercase tracking-wide text-base-content/50 sm:text-xs">

                      What you need

                    </div>

                    <div className="mt-1 truncate text-base font-black sm:text-lg">

                      {actionName}

                    </div>

                    <div className="mt-1 hidden text-xs text-base-content/50 sm:block">

                      Based on your request

                    </div>

                  </div>

                </div>

              </div>



              <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">

                <section className="card min-w-0 overflow-hidden border border-base-300 bg-base-100/90 shadow-sm">

                  <div className="border-b border-base-300 p-4 sm:p-5">

                    <div className="flex min-w-0 items-start justify-between gap-3">

                      <div className="min-w-0">

                        <div className="flex flex-wrap items-center gap-2">

                          <h2 className="text-lg font-bold sm:text-xl">

                            Tell me what happened

                          </h2>

                          <span className="badge badge-success badge-soft">

                            🌐 I understand you

                          </span>

                        </div>

                        <p className="mt-1 text-xs text-base-content/50 sm:text-sm">

                          Speak normally. You don't need to choose a language.

                        </p>

                      </div>

                    </div>

                  </div>



                  <div className="min-h-[320px] w-full min-w-0 space-y-5 overflow-y-auto overflow-x-hidden p-4 sm:p-5">

                    {messages.length === 0 && !loading && (

                      <div className="rounded-box border border-dashed border-base-300 bg-base-200/80/50 p-6 text-center">

                        <div className="text-3xl">👋</div>

                        <div className="mt-3 font-semibold">

                          Tell me what happened

                        </div>

                        <p className="mt-1 text-sm text-base-content/50">

                          You can type naturally in your own language.

                        </p>

                      </div>

                    )}



                    {messages.map((message, index) => {

                      const isUser = message.role === "user";



                      return (

                        <div

                          key={index}

                          className={`flex w-full ${

                            isUser ? "justify-end" : "justify-start"

                          }`}

                        >

                          <div

                            className={`flex max-w-[85%] flex-col ${

                              isUser ? "items-end" : "items-start"

                            }`}

                          >

                            <div className="mb-1 px-1 text-[11px] text-base-content/50">

                              <span className="font-semibold">

                                {isUser ? "You" : "ResolveAI"}

                              </span>

                              <time className="ml-2">{message.time}</time>

                            </div>



                            <div

                              className={`rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm sm:text-base ${

                                isUser

                                  ? "rounded-br-md bg-primary text-primary-content"

                                  : "rounded-bl-md border border-base-300 bg-base-200/80 text-base-content"

                              }`}

                            >

                              {message.text}

                            </div>

                          </div>

                        </div>

                      );

                    })}



                    {loading && (

                      <div className="flex w-full justify-start">

                        <div className="flex flex-col items-start">

                          <div className="mb-1 px-1 text-[11px] text-base-content/50">

                            <span className="font-semibold">ResolveAI</span>

                          </div>

                          <div className="rounded-2xl rounded-bl-md border border-base-300 bg-base-200/80 px-4 py-3">

                            <span className="loading loading-dots loading-sm" />

                          </div>

                        </div>

                      </div>

                    )}

                  </div>



                  <div className="border-t border-base-300 p-4">

                    <div

                      className={`w-full min-w-0 rounded-box border p-5 text-center transition-colors sm:p-7 ${

                        listening

                          ? "border-error/40 bg-error/5"

                          : transcribing

                            ? "border-warning/40 bg-warning/5"

                            : "border-primary/20 bg-primary/5"

                      }`}

                    >

                      <button

                        type="button"

                        onClick={toggleVoice}

                        disabled={loading || transcribing}

                        aria-label={

                          listening

                            ? "Stop recording"

                            : "Start voice input"

                        }

                        className={`btn btn-circle h-20 w-20 text-2xl shadow-lg sm:h-24 sm:w-24 sm:text-3xl ${

                          listening

                            ? "btn-error animate-pulse"

                            : transcribing

                              ? "btn-warning"

                              : "btn-primary"

                        }`}

                      >

                        {transcribing ? (

                          <span className="loading loading-spinner loading-md" />

                        ) : listening ? (

                          "■"

                        ) : (

                          "🎙️"

                        )}

                      </button>



                      <div className="mt-4 text-lg font-bold">

                        {transcribing

                          ? "Understanding your voice..."

                          : listening

                            ? "I'm listening..."

                            : "Tap and speak"}

                      </div>



                      <p className="mx-auto mt-2 max-w-xs text-sm leading-5 text-base-content/50">

                        {transcribing

                          ? "Your recording is being converted to text."

                          : listening

                            ? "Speak naturally. Tap again when you're finished."

                            : "Speak naturally. No need to choose a language."}

                      </p>



                      {voiceError && (

                        <div className="alert alert-error mt-4 text-left text-sm">

                          <span>{voiceError}</span>

                        </div>

                      )}

                    </div>

                  </div>



                  <div className="border-t border-base-300 p-4 sm:p-5">

                    <div className="mb-3 text-sm font-semibold">

                      Or type your problem

                    </div>



                    <textarea

                      className="textarea min-h-28 w-full min-w-0 resize-none text-base"

                      value={input}

                      onChange={(event) => {

                        setInput(event.target.value);

                        if (voiceError) setVoiceError("");

                      }}

                      placeholder="Type here in your own words..."

                      disabled={loading || listening || transcribing}

                      onKeyDown={(event) => {

                        if (

                          event.key === "Enter" &&

                          !event.shiftKey

                        ) {

                          event.preventDefault();

                          sendMessage();

                        }

                      }}

                    />



                    <div className="mt-3 flex gap-2">

                      <button

                        type="button"

                        className="btn btn-ghost min-h-12 flex-1 sm:flex-none"

                        onClick={() => setInput("")}

                        disabled={

                          loading || listening || transcribing

                        }

                      >

                        Clear

                      </button>



                      <button

                        type="button"

                        className="btn btn-primary min-h-12 flex-1 px-8 sm:flex-none"

                        onClick={sendMessage}

                        disabled={

                          loading ||

                          listening ||

                          transcribing ||

                          !input.trim()

                        }

                      >

                        {loading ? "Checking..." : "Send"}

                      </button>

                    </div>

                  </div>

                </section>



                <aside className="min-w-0 space-y-4">

                  <div className="card min-w-0 border border-base-300 bg-base-100/90 shadow-sm">

                    <div className="card-body min-w-0 p-4 sm:p-5">

                      <div className="flex min-w-0 items-center justify-between gap-2">

                        <h3 className="min-w-0 font-bold">

                          Order verification

                        </h3>



                        {swiggyConnected ? (

                          <span className="badge badge-outline shrink-0">

                            Swiggy connected

                          </span>

                        ) : (

                          <span className="badge badge-ghost shrink-0">

                            Authorization required

                          </span>

                        )}

                      </div>



                      {!swiggyConnected ? (

                        <div className="mt-3 rounded-box border border-warning/20 bg-warning/10 p-4">

                          <p className="text-sm leading-5">

                            Connect and authorize with Swiggy to retrieve your real food orders.

                          </p>

                          <button

                            type="button"

                            className="btn btn-primary mt-3 w-full"

                            onClick={connectSwiggy}

                            disabled={swiggyLoading}

                          >

                            {swiggyLoading ? "Connecting..." : "Connect Swiggy"}

                          </button>

                        </div>

                      ) : (

                        <div className="mt-3 space-y-3">

                          <label className="form-control w-full">

                            <span className="label-text mb-1 text-sm font-semibold">

                              Choose a saved Swiggy address

                            </span>

                            <select

                              className="select select-bordered w-full"

                              value={swiggyAddressId}

                              onChange={(event) => {
                                const addressId = event.target.value;

                                setSwiggyAddressId(addressId);
                                setSwiggyOrders([]);
                                setSwiggyOrdersLoaded(false);
                                setSelectedSwiggyOrderId("");
                                setSelectedSwiggyOrderDetails(null);
                                setMatchedSwiggyOrder(null);
                                setOrderConfirmed(false);
                                setOrderMatchStatus("idle");

                                if (addressId && analysis) {
                                  void loadSwiggyOrders(addressId, analysis);
                                }
                              }}

                              disabled={swiggyLoading || !swiggyAddresses.length}

                            >

                              <option value="">

                                {swiggyLoading && !swiggyAddresses.length

                                  ? "Loading saved addresses..."

                                  : swiggyAddresses.length

                                    ? "Select an address"

                                    : "No saved addresses found"}

                              </option>

                              {swiggyAddresses.map((address) => (

                                <option key={address.id} value={address.id}>

                                  {address.addressTag

                                    ? `${address.addressTag} · `

                                    : ""}

                                  {address.addressLine}

                                </option>

                              ))}

                            </select>

                          </label>



                          <div className="flex gap-2">

                            <button

                              type="button"

                              className="btn btn-primary flex-1"

                              onClick={() => loadSwiggyOrders()}

                              disabled={!swiggyAddressId || swiggyLoading}

                            >

                              {swiggyLoading ? "Loading..." : "Load real orders"}

                            </button>

                            <button

                              type="button"

                              className="btn btn-ghost"

                              onClick={disconnectSwiggy}

                              disabled={swiggyLoading}

                            >

                              Disconnect

                            </button>

                          </div>



                          {swiggyAddresses.length === 0 && !swiggyLoading && (

                            <p className="text-xs text-base-content/60">

                              No saved address was returned by Swiggy. Add one in Swiggy, then reconnect.

                            </p>

                          )}



                          {orderMatchStatus === "searching" && (
                            <div className="rounded-box border border-primary/20 bg-primary/5 p-3 text-sm">
                              <span className="loading loading-spinner loading-xs mr-2" />
                              Finding the order related to your complaint...
                            </div>
                          )}

                          {orderMatchStatus === "found" &&
                            matchedSwiggyOrder &&
                            selectedSwiggyOrderDetails && (
                              <div className="rounded-box border border-success/20 bg-success/5 p-3 text-sm">
                                <strong>I found a matching order on Swiggy.</strong>
                                <p className="mt-1 text-base-content/60">
                                  {selectedSwiggyOrderDetails.restaurantName ||
                                    matchedSwiggyOrder.restaurantName ||
                                    "Swiggy order"}
                                </p>
                              </div>
                            )}

                          {orderMatchStatus === "multiple" && (
                            <div className="rounded-box border border-warning/20 bg-warning/10 p-3 text-sm">
                              <strong>I found more than one possible order.</strong>
                              <p className="mt-1 text-base-content/60">
                                Please choose the correct order below.
                              </p>
                            </div>
                          )}

                          {orderMatchStatus === "not_found" && (
                            <div className="rounded-box border border-warning/20 bg-warning/10 p-3 text-sm">
                              <strong>I couldn't confidently match an order.</strong>
                              <p className="mt-1 text-base-content/60">
                                Choose the correct order below and I'll verify it with Swiggy.
                              </p>
                            </div>
                          )}

                          {swiggyOrders.length > 0 && (

                            <div className="space-y-2">

                              <div className="text-sm font-bold">

                                Choose the order for this complaint

                              </div>

                              {swiggyOrders.map((order) => (

                                <button

                                  key={order.orderId}

                                  type="button"

                                  className={`w-full rounded-box border p-3 text-left ${

                                    selectedSwiggyOrderId === order.orderId

                                      ? "border-primary bg-primary/5"

                                      : "border-base-300 bg-base-100/90"

                                  }`}

                                  onClick={() => {
                                    setMatchedSwiggyOrder(order);
                                    setOrderConfirmed(false);
                                    void selectSwiggyOrder(order);
                                  }}

                                >

                                  <span className="block font-semibold">

                                    {order.restaurantName || "Swiggy order"}

                                  </span>

                                  <span className="mt-1 block text-xs text-base-content/60">

                                    {getOrderItemsText(order) || "Items not provided"}

                                  </span>

                                  <span className="mt-1 block text-xs text-base-content/60">

                                    {order.orderedTime || ""}

                                    {order.orderStatus ? ` · ${order.orderStatus}` : ""}

                                    {order.orderTotal ? ` · ₹${order.orderTotal}` : ""}

                                  </span>

                                  <span className="mt-1 block text-[11px] text-base-content/50">

                                    Order ID: {order.orderId}

                                  </span>

                                </button>

                              ))}

                            </div>

                          )}



                          {swiggyOrdersLoaded && swiggyOrders.length === 0 && !swiggyLoading && (

                            <p className="text-xs text-base-content/60">

                              Swiggy returned no food orders for this address.

                            </p>

                          )}



                          {!swiggyOrdersLoaded && swiggyOrders.length === 0 && swiggyAddressId && !swiggyLoading && (

                            <p className="text-xs text-base-content/60">

                              Select an address to load real Swiggy orders and match this complaint.

                            </p>

                          )}



                          {selectedSwiggyOrder && !selectedSwiggyOrderDetails && swiggyLoading && (

                            <p className="text-xs text-base-content/60">

                              Checking the matching Swiggy order...

                            </p>

                          )}



                          {selectedSwiggyOrderDetails && (

                            <div className="rounded-box border border-success/30 bg-success/10 p-3 text-xs leading-5">

                              <strong>
                                {orderConfirmed
                                  ? "Order confirmed and linked to this complaint"
                                  : selectedSwiggyOrderDetails.verificationSource === "order_history"
                                    ? "Matching order found in your Swiggy order history"
                                    : "Order verified with Swiggy"}
                              </strong>

                              <p className="mt-1">

                                ResolveAI analyzed: {analysis?.issue ? formatIssue(analysis.issue) : "complaint details"}

                                {analysis?.product ? ` · ${analysis.product}` : ""}

                              </p>

                              <p className="mt-1 font-semibold">

                                {selectedSwiggyOrderDetails.restaurantName || selectedSwiggyOrder?.restaurantName}

                                {selectedSwiggyOrderDetails.orderStatus

                                  ? ` · ${selectedSwiggyOrderDetails.orderStatus}`

                                  : ""}

                              </p>

                              {selectedSwiggyOrderDetails.items?.map((item, index) => (

                                <p key={`${item.name}-${index}`} className="mt-1 text-base-content/70">

                                  {item.name}{item.quantity ? ` · Qty ${item.quantity}` : ""}

                                </p>

                              ))}

                              <p className="mt-1 text-base-content/60">

                                {selectedSwiggyOrderDetails.verificationSource === "order_history"
                                   ? "This order came from your real Swiggy order history. ✓ Order verified from your real Swiggy order history."
                                   : "Detailed order information was fetched from Swiggy. No refund or support action has been requested or confirmed."}

                              </p>

                              {!orderConfirmed && (
                                <div className="mt-3 rounded-box border border-primary/20 bg-primary/5 p-3">
                                  <p className="font-semibold text-base-content">
                                    Is this the order you are talking about?
                                  </p>
                                  <p className="mt-1 text-base-content/60">
                                    Confirm it before ResolveAI continues.
                                  </p>

                                  <div className="mt-3 flex gap-2">
                                    <button
                                      type="button"
                                      className="btn btn-primary btn-sm flex-1"
                                      onClick={() => setOrderConfirmed(true)}
                                    >
                                      ✓ Yes, this is my order
                                    </button>

                                    <button
                                      type="button"
                                      className="btn btn-ghost btn-sm"
                                      onClick={() => {
                                        setMatchedSwiggyOrder(null);
                                        setSelectedSwiggyOrderId("");
                                        setSelectedSwiggyOrderDetails(null);
                                        setOrderConfirmed(false);
                                        setOrderMatchStatus("multiple");
                                      }}
                                    >
                                      Choose another
                                    </button>
                                  </div>
                                </div>
                              )}

                              {orderConfirmed && (
                                <p className="mt-3 font-semibold text-success">
                                  ✓ You confirmed this order.
                                </p>
                              )}

                            </div>

                          )}

                        </div>

                      )}



                      {swiggyError && (

                        <div className="mt-3 rounded-box border border-error/20 bg-error/10 p-3 text-xs leading-5">

                          <strong>Swiggy connection needs attention</strong>

                          <p className="mt-1">{swiggyError}</p>

                          {!swiggyConnected && (

                            <button

                              type="button"

                              className="btn btn-sm btn-outline mt-2"

                              onClick={connectSwiggy}

                              disabled={swiggyLoading}

                            >

                              Try Connect Swiggy again

                            </button>

                          )}

                        </div>

                      )}

                    </div>

                  </div>



                  {analysis && !analysis.missing_fields?.length && (

                    <div className="card min-w-0 border border-base-300 bg-base-100/90 shadow-sm">

                      <div className="card-body min-w-0 p-4 sm:p-5">

                        <h3 className="text-lg font-bold">

                          How can I help?

                        </h3>

                        <p className="mt-1 text-sm text-base-content/50">

                          Choose what you would like me to do.

                        </p>



                        <div className="mt-4 grid gap-2">

                          {[

                            ["refund", "💰 Get my money back"],

                            ["replacement", "📦 Request the missing item"],

                            ["information", "ℹ️ I need information"],

                            ["unknown", "🤔 I'm not sure"],

                          ].map(([value, label]) => (

                            <button

                              key={value}

                              type="button"

                              className={`btn min-h-14 w-full justify-start text-base ${

                                selectedHelp === value

                                  ? "btn-primary"

                                  : "btn-outline"

                              }`}

                              onClick={() => handleHelpSelection(value)}

                            >

                              {label}

                            </button>

                          ))}

                        </div>

                      </div>

                    </div>

                  )}

                  {resolutionResult && (
  <div
    className={`card min-w-0 shadow-sm ${
      resolutionResult.type === "success"
        ? "border border-success/30 bg-success/10"
        : resolutionResult.type === "error"
          ? "border border-error/30 bg-error/10"
          : "border border-primary/30 bg-primary/10"
    }`}
  >
    <div className="card-body p-4 sm:p-5">

      <div className="flex items-start gap-3">

        <div className="text-2xl">
          {resolutionResult.icon}
        </div>

        <div className="min-w-0 flex-1">

          <h3
            className={`text-lg font-bold ${
              resolutionResult.type === "success"
                ? "text-success"
                : resolutionResult.type === "error"
                  ? "text-error"
                  : "text-primary"
            }`}
          >
            {resolutionResult.title}
          </h3>

          <p className="mt-1 text-sm">
            {resolutionResult.message}
          </p>

          {resolutionResult.type === "loading" && (
            <div className="mt-4 flex items-center gap-2 text-sm text-base-content/60">
              <span className="loading loading-spinner loading-sm" />
              Fetching real order details...
            </div>
          )}

          {resolutionResult.type === "success" &&
            selectedSwiggyOrderDetails && (
              <div className="mt-4 rounded-box border border-success/20 bg-base-100/90 p-4">

                <div className="font-bold">
                  {selectedSwiggyOrderDetails.restaurantName ||
                    "Swiggy order"}
                </div>

                <div className="mt-2 space-y-1 text-sm text-base-content/70">

                  <div>
                    <strong>Status:</strong>{" "}
                    {selectedSwiggyOrderDetails.orderStatus || "Not provided"}
                  </div>

                  <div>
                    <strong>Total:</strong>{" "}
                    {selectedSwiggyOrderDetails.orderTotal
                      ? `₹${selectedSwiggyOrderDetails.orderTotal}`
                      : "Not provided"}
                  </div>

                  <div>
                    <strong>Ordered:</strong>{" "}
                    {selectedSwiggyOrderDetails.orderedTime ||
                      "Not provided"}
                  </div>

                </div>

                {selectedSwiggyOrderDetails.items?.length > 0 && (
                  <div className="mt-3 border-t border-base-300 pt-3">

                    <div className="font-semibold">
                      Items
                    </div>

                    <div className="mt-2 space-y-1 text-sm">
                      {selectedSwiggyOrderDetails.items.map(
                        (item, index) => (
                          <div
                            key={`${item.name}-${index}`}
                            className="flex justify-between gap-3"
                          >
                            <span>
                              {item.name || "Item"}
                              {item.quantity
                                ? ` × ${item.quantity}`
                                : ""}
                            </span>

                            {item.total != null && (
                              <span>
                                ₹{item.total}
                              </span>
                            )}
                          </div>
                        )
                      )}
                    </div>

                  </div>
                )}

              </div>
            )}

            {resolutionResult.type !== "loading" &&
  orderConfirmed &&
  selectedHelp === "replacement" && (
    <div className="mt-4 space-y-3">

      <div className="rounded-box border border-warning/30 bg-warning/10 p-3">
        <div className="font-bold">
          📦 Missing-item escalation
        </div>

        <p className="mt-1 text-sm leading-5">
          Request the missing{" "}
          <strong>
            {analysis?.product || "item"}
          </strong>{" "}
          from the original order without any
          additional charge.
        </p>
      </div>

      <button
        type="button"
        className="btn btn-primary w-full"
        onClick={() => speakSupportRequest("replacement")}
      >
        🎙️ Speak escalation request
      </button>

      <button
        type="button"
        className="btn btn-outline w-full"
        onClick={() => prepareSwiggySupportRequest("replacement")}
      >
        📱 Prepare Swiggy support request
      </button>

    </div>
  )}

  {resolutionResult.type !== "loading" &&
  orderConfirmed &&
  selectedHelp === "refund" && (
    <div className="mt-4 space-y-3">

      <div className="rounded-box border border-warning/30 bg-warning/10 p-3">

        <div className="font-bold">
          💰 Refund escalation
        </div>

        <p className="mt-1 text-sm leading-5">
          Your original order is verified.
          ResolveAI can prepare the refund request,
          but it will not claim that the refund has
          been processed unless Swiggy confirms it.
        </p>

      </div>

      <button
        type="button"
        className="btn btn-primary w-full"
        onClick={() => speakSupportRequest("refund")}
      >
        🎙️ Speak refund request
      </button>

      <button
        type="button"
        className="btn btn-outline w-full"
        onClick={() => prepareSwiggySupportRequest("refund")}
      >
        📱 Prepare Swiggy support request
      </button>

    </div>
  )}

        </div>
      </div>

    </div>
  </div>
)}
                  


                  <div className="card min-w-0 border border-base-300 bg-base-100/90 shadow-sm">

                    <div className="card-body p-3 sm:p-4">

                      <button

                        type="button"

                        className="btn btn-ghost min-h-12 w-full justify-between"

                        onClick={() =>

                          setShowDetails((current) => !current)

                        }

                      >

                        <span>

                          {showDetails ? "Hide details" : "See details"}

                        </span>

                        <span>{showDetails ? "▲" : "▼"}</span>

                      </button>



                      {showDetails && (

                        <div className="mt-2 space-y-3">

                          <div className="divider my-0" />



                          <div className="text-sm font-semibold">

                            What ResolveAI did

                          </div>



                          <div className="text-xs">

                            ✓ Received your complaint

                          </div>



                          <div className="text-xs">

                            ✓ Sent it to the ResolveAI backend

                          </div>



                          {analysis?.language && (

                            <div className="text-xs">

                              ✓ Detected language: {analysis.language}

                            </div>

                          )}



                          {analysis?.platform &&

                            analysis.platform !== "unknown" && (

                              <div className="text-xs">

                                ✓ Identified platform:{" "}

                                {formatPlatform(analysis.platform)}

                              </div>

                            )}



                          {analysis?.issue &&

                            analysis.issue !== "unknown" && (

                              <div className="text-xs">

                                ✓ Identified problem:{" "}

                                {formatIssue(analysis.issue)}

                              </div>

                            )}



                          {analysis?.product && (

                            <div className="text-xs">

                              ✓ Identified product: {analysis.product}

                            </div>

                          )}



                          {analysis?.requested_action &&

                            analysis.requested_action !== "unknown" && (

                              <div className="text-xs">

                                ✓ Identified requested action:{" "}

                                {formatAction(analysis.requested_action)}

                              </div>

                            )}



                          {analysis?.confidence !== undefined && (

                            <div className="text-xs">

                              ✓ Understanding confidence:{" "}

                              {Math.round(

                                analysis.confidence * 100

                              )}

                              %

                            </div>

                          )}



                          <div className="rounded-box bg-base-200/80 p-3 text-xs leading-5">

                            <strong>Trust & safety</strong>

                            <p className="mt-1 text-base-content/50">

                              ResolveAI will only say that an action is complete

                              when the connected platform actually confirms it.

                            </p>

                          </div>

                        </div>

                      )}

                    </div>

                  </div>

                </aside>

              </div>

            </div>

            {sidebarPanel && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-base-300 bg-base-100/90 shadow-2xl">
                  <div className="sticky top-0 flex items-center justify-between border-b border-base-300 bg-base-100/90 p-4">
                    <div>
                      <h2 className="text-xl font-black">{sidebarPanel === "past" ? "Past problems" : "Solved problems"}</h2>
                      <p className="text-xs text-base-content/50">
                        {sidebarPanel === "past" ? "Your recent ResolveAI complaint history" : "Problems completed with ResolveAI"}
                      </p>
                    </div>
                    <button type="button" className="btn btn-sm btn-circle btn-ghost" onClick={closeSidebarPanel}>✕</button>
                  </div>
                  <div className="p-4">
                    {(sidebarPanel === "past" ? problemHistory : problemHistory.filter((item) => item.status === "solved")).length === 0 ? (
                      <div className="rounded-box bg-base-200/80 p-8 text-center">
                        <div className="text-3xl">📭</div>
                        <p className="mt-2 font-bold">{sidebarPanel === "past" ? "No past problems yet" : "No solved problems yet"}</p>
                        <p className="mt-1 text-sm text-base-content/50">Your complaints will appear here after you use ResolveAI.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {(sidebarPanel === "past" ? problemHistory : problemHistory.filter((item) => item.status === "solved")).map((item) => (
                          <div key={item.id} className="rounded-box border border-base-300 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <p className="font-semibold">{item.text}</p>
                              <span className={`badge ${item.status === "solved" ? "badge-success" : "badge-warning"}`}>
                                {item.status === "solved" ? "Solved" : "In progress"}
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs text-base-content/60">
                              <span className="badge badge-ghost">{item.platform || "Unknown app"}</span>
                              <span className="badge badge-ghost">{item.issue || "Unknown issue"}</span>
                              <span className="badge badge-ghost">{item.action || "Unknown action"}</span>
                              <span>{item.createdAt ? new Date(item.createdAt).toLocaleString() : ""}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {showSettings && (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
    <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-base-300 bg-base-100 shadow-2xl">

      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-base-300 bg-base-100 p-5">
        <div>
          <h2 className="text-xl font-black">
            ⚙️ Settings
          </h2>

          <p className="text-sm text-base-content/50">
            Personalize your ResolveAI
          </p>
        </div>

        <button
          type="button"
          className="btn btn-sm btn-circle btn-ghost"
          onClick={() => setShowSettings(false)}
        >
          ✕
        </button>
      </div>

      {/* Settings content */}
      <div className="space-y-6 p-5">

        {/* Profile */}
        <section>
          <h3 className="mb-3 text-lg font-bold">
            👤 Profile
          </h3>

          <div className="grid gap-3 sm:grid-cols-3">

            <div className="rounded-2xl bg-base-200 p-4">
              <div className="text-xs text-base-content/50">
                Name
              </div>

              <div className="font-semibold">
                {userProfile.name || "Not added"}
              </div>
            </div>

            <div className="rounded-2xl bg-base-200 p-4">
              <div className="text-xs text-base-content/50">
                Email
              </div>

              <div className="break-all font-semibold">
                {userProfile.email || "Not added"}
              </div>
            </div>

            <div className="rounded-2xl bg-base-200 p-4">
              <div className="text-xs text-base-content/50">
                Phone
              </div>

              <div className="font-semibold">
                {userProfile.phone || "Not added"}
              </div>
            </div>

          </div>
        </section>

        {/* Themes */}
        <section>
          <h3 className="mb-3 text-lg font-bold">
            🎨 Appearance
          </h3>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">

            {[
              ["light", "☀️ Light"],
              ["dark", "🌙 Dark"],
              ["cupcake", "🧁 Soft"],
              ["forest", "🌿 Forest"],
              ["sunset", "🌅 Sunset"],
            ].map(([theme, label]) => (

              <button
                key={theme}
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  localStorage.setItem(
                    "resolveai_theme",
                    theme
                  );

                  applyResolveAITheme(
                    theme,
                    localStorage.getItem(
                      "resolveai_wallpaper"
                    ) || ""
                  );

                  window.dispatchEvent(
                    new Event("resolveai-theme-change")
                  );
                }}
              >
                {label}
              </button>

            ))}

          </div>
        </section>

        {/* Wallpaper */}
        <section>

          <h3 className="mb-3 text-lg font-bold">
            🖼️ Custom wallpaper
          </h3>

          <div className="flex flex-wrap gap-2">

            <label className="btn btn-primary">
              Choose wallpaper

              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(event) => {

                  const file =
                    event.target.files?.[0];

                  if (!file) return;

                  const reader =
                    new FileReader();

                  reader.onload = () => {

                    const wallpaper =
                      String(reader.result || "");

                    localStorage.setItem(
                      "resolveai_wallpaper",
                      wallpaper
                    );

                    applyResolveAITheme(
                      localStorage.getItem(
                        "resolveai_theme"
                      ) || "light",
                      wallpaper
                    );

                    window.dispatchEvent(
                      new Event("resolveai-theme-change")
                    );
                  };

                  reader.readAsDataURL(file);

                }}
              />
            </label>

            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {

                localStorage.removeItem(
                  "resolveai_wallpaper"
                );

                applyResolveAITheme(
                  localStorage.getItem(
                    "resolveai_theme"
                  ) || "light",
                  ""
                );

                window.dispatchEvent(
                  new Event("resolveai-theme-change")
                );

              }}
            >
              Remove wallpaper
            </button>

          </div>

        </section>

        {/* Language */}
        <section>

          <h3 className="mb-3 text-lg font-bold">
            🌐 Language
          </h3>

          <div className="rounded-2xl bg-base-200 p-4">

            <div className="font-semibold">
              Automatic
            </div>

            <div className="text-sm text-base-content/50">
              ResolveAI automatically follows the language
              you speak or type.
            </div>

          </div>

        </section>

      </div>

    </div>
  </div>
            )}

          </main>

        </div>



        <div className="drawer-side z-40">

          <label

            htmlFor="resolveai-drawer"

            className="drawer-overlay"

          />



          <aside className="flex min-h-full w-72 flex-col border-r border-base-300 bg-base-100/90">

            <div className="flex h-16 items-center gap-3 border-b border-base-300 px-5">

              <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-content">

                <span className="font-black">R</span>

              </div>



              <div>

                <div className="font-black">ResolveAI</div>

                <div className="text-[10px] uppercase tracking-widest text-base-content/50">

                  Your personal helper

                </div>

              </div>

            </div>



            <ul className="menu flex-1 p-3">

              <li className="menu-title">

                <span>My Help</span>

              </li>



              <li>
                <button
                  type="button"
                  className={`min-h-12 ${sidebarPanel === null ? "menu-active" : ""}`}
                  onClick={() => {
                    closeSidebarPanel();
                    window.scrollTo({ top: 0, behavior: "smooth" });
                    const drawer = document.getElementById("resolveai-drawer");
                    if (drawer) drawer.checked = false;
                  }}
                >
                  💬 Current problem
                </button>
              </li>

              <li>
                <button type="button" className="min-h-12" onClick={() => openProblemHistory("past")}>
                  🕘 Past problems
                  <span className="badge badge-sm">{problemHistory.length}</span>
                </button>
              </li>

              <li>
                <button type="button" className="min-h-12" onClick={() => openProblemHistory("solved")}>
                  ✓ Solved problems
                  <span className="badge badge-sm">{problemHistory.filter((item) => item.status === "solved").length}</span>
                </button>
              </li>



              <li className="menu-title mt-5">

                <span>My apps</span>

              </li>



              <li>

                <button

                  type="button"

                  className="min-h-12"

                  onClick={swiggyConnected ? disconnectSwiggy : connectSwiggy}

                  disabled={swiggyLoading}

                >

                  🔗 Swiggy

                  <span className={`badge badge-xs ${swiggyConnected ? "badge-success" : "badge-warning"}`}>

                    {swiggyConnected ? "Connected" : "Connect"}

                  </span>

                </button>

              </li>



              <li className="menu-title mt-5">

                <span>More</span>

              </li>



              <li>
                <button type="button" className="min-h-12" onClick={openSettingsPage}>
                  ⚙️ Settings
                </button>
              </li>

            </ul>



            <div className="border-t border-base-300 p-4">

              <div className="rounded-box bg-base-200/80 p-3">

                <div className="text-sm font-semibold">Need help?</div>

                <p className="mt-1 text-xs leading-5 text-base-content/50">

                  Just speak to me. You don't need to know how the app works.

                </p>

              </div>

            </div>

          </aside>

        </div>

      </div>

    </div>
  </>
  );

}



export default App;
