(() => {
  // src/youtube-url.js
  var YOUTUBE_VIDEO_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;
  var KNOWN_YOUTUBE_HOSTS = /* @__PURE__ */ new Set([
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "music.youtube.com",
    "gaming.youtube.com",
    "youtu.be",
    "www.youtu.be"
  ]);
  function parseYouTubeVideoId(urlOrStr) {
    if (!urlOrStr || typeof urlOrStr !== "string") {
      return null;
    }
    const trimmed = urlOrStr.trim();
    if (!trimmed) {
      return null;
    }
    if (YOUTUBE_VIDEO_ID_REGEX.test(trimmed)) {
      return trimmed;
    }
    try {
      const parsed = new URL(trimmed, "https://www.youtube.com");
      const hostname = parsed.hostname.toLowerCase();
      const isYouTubeDomain = KNOWN_YOUTUBE_HOSTS.has(hostname) || hostname.endsWith(".youtube.com") || hostname.endsWith(".youtu.be");
      if (hostname === "youtu.be" || hostname.endsWith(".youtu.be")) {
        const candidate = parsed.pathname.slice(1).split("/")[0];
        if (YOUTUBE_VIDEO_ID_REGEX.test(candidate)) {
          return candidate;
        }
        return null;
      }
      if (!isYouTubeDomain) {
        return null;
      }
      if (parsed.pathname === "/watch" || parsed.pathname === "/watch_popup") {
        const v = parsed.searchParams.get("v");
        if (v && YOUTUBE_VIDEO_ID_REGEX.test(v)) {
          return v;
        }
        return null;
      }
      const segments = parsed.pathname.split("/").filter(Boolean);
      if (segments.length >= 2) {
        const prefix = segments[0].toLowerCase();
        if (["embed", "shorts", "live", "v"].includes(prefix)) {
          const candidate = segments[1];
          if (YOUTUBE_VIDEO_ID_REGEX.test(candidate)) {
            return candidate;
          }
        }
      }
      return null;
    } catch {
      const match = trimmed.match(
        /(?:v=|\/embed\/|\/shorts\/|\/live\/|\/v\/|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[?&#/]|$)/
      );
      if (match && YOUTUBE_VIDEO_ID_REGEX.test(match[1])) {
        return match[1];
      }
    }
    return null;
  }
  function isYouTubeWatchUrl(urlOrStr) {
    if (!urlOrStr || typeof urlOrStr !== "string") {
      return false;
    }
    const trimmed = urlOrStr.trim();
    const videoId = parseYouTubeVideoId(trimmed);
    if (!videoId) {
      return false;
    }
    try {
      const parsed = new URL(trimmed, "https://www.youtube.com");
      const hostname = parsed.hostname.toLowerCase();
      const isYouTubeDomain = KNOWN_YOUTUBE_HOSTS.has(hostname) || hostname.endsWith(".youtube.com") || hostname.endsWith(".youtu.be");
      if (!isYouTubeDomain) {
        return false;
      }
      return parsed.pathname === "/watch" || parsed.pathname === "/watch_popup" || hostname === "youtu.be" || hostname.endsWith(".youtu.be") || parsed.pathname.startsWith("/shorts/");
    } catch {
      return false;
    }
  }
  function formatTimestamp(seconds) {
    if (typeof seconds !== "number" || isNaN(seconds) || !Number.isFinite(seconds) || seconds < 0) {
      return "00:00";
    }
    const totalSeconds = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor(totalSeconds % 3600 / 60);
    const secs = totalSeconds % 60;
    const pad = (n) => String(n).padStart(2, "0");
    if (hours > 0) {
      return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
    }
    return `${pad(minutes)}:${pad(secs)}`;
  }

  // src/claim-service.js
  var VALID_VERDICTS = Object.freeze(["misinformation", "verified", "unknown"]);
  function validateClaim(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error("Claim must be a non-null object");
    }
    if (typeof raw.timestamp !== "number" || isNaN(raw.timestamp) || !isFinite(raw.timestamp) || raw.timestamp < 0) {
      throw new Error("Claim timestamp must be a non-negative finite number");
    }
    if (typeof raw.sentence !== "string" || raw.sentence.trim().length === 0) {
      throw new Error("Claim sentence must be a non-empty string");
    }
    if (!raw.verdict || !VALID_VERDICTS.includes(raw.verdict)) {
      throw new Error(`Claim verdict must be one of: ${VALID_VERDICTS.join(", ")}`);
    }
    if (typeof raw.explanation !== "string") {
      throw new Error("Claim explanation must be a string");
    }
    if (!Array.isArray(raw.sources)) {
      throw new Error("Claim sources must be an array of strings");
    }
    for (const src of raw.sources) {
      if (typeof src !== "string") {
        throw new Error("Each source in claim sources must be a string URL");
      }
    }
    let duration = 4.5;
    if (typeof raw.duration === "number" && !isNaN(raw.duration) && isFinite(raw.duration) && raw.duration > 0) {
      duration = raw.duration;
    }
    return {
      timestamp: Number(raw.timestamp),
      sentence: String(raw.sentence).trim(),
      verdict: raw.verdict,
      explanation: String(raw.explanation).trim(),
      sources: raw.sources.map((s) => String(s).trim()).filter(Boolean),
      duration
    };
  }
  var SEEDED_CLAIMS = {
    // Rick Astley - Never Gonna Give You Up (Standard Demo ID)
    dQw4w9WgXcQ: [
      {
        timestamp: 12,
        sentence: "This song was completely improvised in a single take without prior rehearsal.",
        verdict: "misinformation",
        explanation: "The track was meticulously written, arranged, and produced by Stock Aitken Waterman over several weeks at PWL Studios in London.",
        sources: [
          "https://www.factcheck.org/2021/music-history-pwl",
          "https://en.wikipedia.org/wiki/Never_Gonna_Give_You_Up"
        ],
        duration: 4.5
      },
      {
        timestamp: 42.5,
        sentence: "Never Gonna Give You Up reached number one in 25 countries upon its release in 1987.",
        verdict: "verified",
        explanation: "Official international music record charts confirm the single topped charts in 25 countries worldwide including the UK, US, and Australia.",
        sources: ["https://www.billboard.com/charts/hot-100/1988-03-12"],
        duration: 5
      },
      {
        timestamp: 88,
        sentence: "The music video was shot on a multi-million dollar film soundstage in Hollywood.",
        verdict: "misinformation",
        explanation: "The video was directed by Simon West on a shoestring budget of under \xA33,000 near London Battersea District.",
        sources: ["https://apnews.com/article/fact-check-astley-video-production"],
        duration: 4.5
      },
      {
        timestamp: 135,
        sentence: "Rick Astley originally declined to record the vocal track until persuaded by Pete Waterman.",
        verdict: "unknown",
        explanation: "Historical accounts from studio engineers and producers differ on whether Astley was initially hesitant or eager to record.",
        sources: ["https://www.reuters.com/fact-check/pwl-studios-retrospective"],
        duration: 4
      }
    ],
    // Me at the zoo (First YouTube Video)
    jNQXAC9IVRw: [
      {
        timestamp: 3,
        sentence: "Elephants have the longest trunks of any terrestrial mammal on Earth.",
        verdict: "verified",
        explanation: "Biological taxonomies confirm that proboscideans possess the largest and longest muscular proboscis among all land mammals.",
        sources: ["https://nationalzoo.si.edu/animals/asian-elephant"],
        duration: 4
      },
      {
        timestamp: 9.5,
        sentence: "The San Diego Zoo currently houses over two million individual elephants.",
        verdict: "misinformation",
        explanation: "The total worldwide population of wild and captive elephants is under 500,000. The San Diego Zoo hosts a small herd of fewer than a dozen.",
        sources: ["https://sandiegozoowildlifealliance.org/animals/elephant"],
        duration: 4.5
      },
      {
        timestamp: 15,
        sentence: "Elephants communicate over long distances using low-frequency infrasound.",
        verdict: "verified",
        explanation: "Bioacoustic field studies demonstrate elephants emit infrasonic rumbles between 14-24 Hz that travel several kilometers.",
        sources: ["https://www.scientificamerican.com/article/how-elephants-communicate/"],
        duration: 4
      }
    ],
    // Dedicated Misinformation Demo ID
    "demo-misinfo-1": [
      {
        timestamp: 5,
        sentence: "Drinking distilled seawater can cure viral respiratory infections within 24 hours.",
        verdict: "misinformation",
        explanation: "World Health Organization and medical authorities explicitly warn that drinking saline seawater induces severe dehydration and exhibits zero antiviral properties.",
        sources: [
          "https://www.who.int/emergencies/diseases/novel-coronavirus-2019/advice-for-public/myth-busters",
          "https://www.cdc.gov/healthywater/drinking/travel/desalination.html"
        ],
        duration: 5
      },
      {
        timestamp: 22,
        sentence: "Hand hygiene with regular soap and water significantly reduces viral pathogen transmission.",
        verdict: "verified",
        explanation: "Peer-reviewed epidemiological investigations show soap molecules disrupt viral lipid bilayer membranes and detach pathogens from skin.",
        sources: ["https://www.cdc.gov/handwashing/why-handwashing.html"],
        duration: 4.5
      },
      {
        timestamp: 48,
        sentence: "Certain rare herbs found only in high-altitude mountain caves provide complete lifelong immunity.",
        verdict: "unknown",
        explanation: "While isolated phytochemical compounds are studied for immunomodulation, there is insufficient clinical evidence to substantiate claims of complete lifelong immunity.",
        sources: ["https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7158392/"],
        duration: 5
      }
    ],
    // YouTube IFrame API Official Demo ID
    "M7lc1UVf-VE": [
      {
        timestamp: 10,
        sentence: "JavaScript was invented in 1995 in ten days by Brendan Eich at Netscape.",
        verdict: "verified",
        explanation: "Documented computing history confirms Mocha (subsequently renamed LiveScript and JavaScript) was created by Brendan Eich in May 1995.",
        sources: ["https://www.w3.org/community/webed/wiki/A_Short_History_of_JavaScript"],
        duration: 4.5
      },
      {
        timestamp: 35,
        sentence: "HTML is a Turing-complete functional programming language.",
        verdict: "misinformation",
        explanation: "HTML (HyperText Markup Language) is a declarative markup specification for document structuring, not a Turing-complete programming language.",
        sources: ["https://developer.mozilla.org/en-US/docs/Learn/HTML/Introduction_to_HTML"],
        duration: 4.5
      }
    ],
    // AI-generated fake doctor investigation (三立新聞台 - 新聞深一度)
    RPntCzNp1QU: [
      {
        timestamp: 8,
        sentence: "\u300C\u4E94\u5E74\u7684\u6210\u529F\u7387\u53EF\u4EE5\u9054\u5230 70% \u5230 80%\u300D\u2014 \u7DB2\u8DEF\u6D41\u50B3 AI \u5047\u91AB\u5E2B\u5F71\u7247\u5BA3\u7A31\u7279\u5B9A\u504F\u65B9\u6216\u975E\u6B63\u898F\u690D\u7259\u6280\u8853\u6709\u6975\u9AD8\u6210\u529F\u7387\u3002",
        verdict: "misinformation",
        explanation: "\u885B\u798F\u90E8\u8207\u91AB\u754C\u5C08\u79D1\u91AB\u5E2B\u56B4\u6B63\u99C1\u65A5\uFF1A\u6B63\u898F\u91AB\u5B78\u81E8\u5E8A\u5FC5\u9808\u7D93\u7531\u5BE6\u9AD4\u8A3A\u65B7\u8207\u56B4\u8B39\u8A55\u4F30\uFF0C\u7DB2\u50B3\u5F71\u7247\u4FC2\u4E0D\u8096\u96C6\u5718\u5229\u7528 AI \u6578\u5B57\u4EBA\u634F\u9020\u865B\u5047\u6578\u64DA\uFF0C\u8A98\u9A19\u6C11\u773E\u8CFC\u8CB7\u52A3\u8CEA\u7522\u54C1\u6216\u9032\u884C\u672A\u6838\u51C6\u7642\u7A0B\u3002",
        sources: [
          "https://tfc-taiwan.org.tw/articles/report-ai-fake-doctor",
          "https://www.mohw.gov.tw/cp-16-75482-1.html"
        ],
        duration: 6
      },
      {
        timestamp: 32,
        sentence: "\u300C\u8EDF\u9AA8\u78E8\u640D\u8D8A\u56B4\u91CD\uFF0C\u53EA\u8981\u5403\u9019\u7A2E\u914D\u65B9\u5C31\u80FD\u5B8C\u5168\u518D\u751F\u9AA8\u9ABC\u95DC\u7BC0\u300D\u2014 AI \u5F71\u7247\u5BA3\u7A31\u9AA8\u8CEA\u8207\u8EDF\u9AA8\u53EF\u55AE\u9760\u4E0D\u660E\u53E3\u670D\u914D\u65B9\u5B8C\u5168\u9006\u8F49\u3002",
        verdict: "misinformation",
        explanation: "\u9AA8\u79D1\u5C08\u79D1\u91AB\u5B78\u6703\u6307\u51FA\uFF0C\u91CD\u5EA6\u9000\u5316\u6027\u95DC\u7BC0\u708E\u8EDF\u9AA8\u78E8\u640D\u5C6C\u4E0D\u53EF\u9006\u7D50\u69CB\u9000\u5316\uFF0C\u4EFB\u4F55\u5BA3\u7A31\u55AE\u9760\u7279\u5B9A\u4FDD\u5065\u54C1\u300C\u5B8C\u5168\u9577\u56DE\u8EDF\u9AA8\u300D\u7686\u70BA\u8A87\u5927\u4E0D\u5BE6\u5047\u8A0A\u606F\u3002",
        sources: [
          "https://www.setn.com/News.aspx?NewsID=1418902",
          "https://mygopen.com/2024/ai-cartilage-cure.html"
        ],
        duration: 6.5
      },
      {
        timestamp: 75,
        sentence: "\u300C\u5F71\u7247\u4E2D\u7684\u540D\u91AB\u7D93\u67E5\u8B49\u70BA\u76DC\u7528\u6B63\u724C\u91AB\u5E2B\u8096\u50CF\uFF0C\u6216\u900F\u904E Deepfake \u751F\u6210\u4E4B\u865B\u64EC\u4EBA\u7269\u3002\u300D",
        verdict: "verified",
        explanation: "\u4E8B\u5BE6\u67E5\u6838\u4E2D\u5FC3\u53CA\u5404\u5927\u91AB\u5B78\u4E2D\u5FC3\uFF08\u5305\u62EC\u53F0\u5927\u3001\u5317\u69AE\uFF09\u591A\u6B21\u767C\u5E03\u8072\u660E\uFF0C\u8B49\u5BE6\u7DB2\u8DEF\u591A\u8D77\u5BA3\u7A31\u540D\u91AB\u4EE3\u8A00\u4E4B\u990A\u751F\u5F71\u7247\u4FC2\u906D\u5230\u6DF1\u507D\u8B8A\u81C9\u6216\u5B8C\u5168\u5192\u540D\u3002",
        sources: [
          "https://tfc-taiwan.org.tw/topic/deepfake-health-scams",
          "https://www.cna.com.tw/news/ahel/202403150218.aspx"
        ],
        duration: 5.5
      },
      {
        timestamp: 125,
        sentence: "\u300C\u7DB2\u8DEF\u793E\u7FA4\u6F14\u7B97\u6CD5\u662F\u5426\u5168\u9762\u5177\u5099\u81EA\u52D5\u904E\u6FFE AI \u5047\u91AB\u7642\u5F71\u7247\u4E4B\u6A5F\u5236\uFF1F\u300D",
        verdict: "unknown",
        explanation: "\u5404\u5927\u793E\u7FA4\u5E73\u53F0\u76EE\u524D\u4E3B\u8981\u7D50\u5408\u6578\u4F4D\u6D6E\u6C34\u5370\u653F\u7B56\u8207\u4EBA\u5DE5\u6AA2\u8209\u5BE9\u67E5\uFF0C\u4F46\u5728\u9762\u5C0D\u751F\u6210\u5F0F AI \u6BCF\u65E5\u6D77\u91CF\u8B8A\u7A2E\u5F71\u7247\u6642\uFF0C\u5168\u81EA\u52D5\u5373\u6642\u6514\u622A\u9632\u7DDA\u4E4B\u6DB5\u84CB\u7387\u4ECD\u672A\u9054\u5B8C\u5168\u8986\u84CB\u3002",
        sources: [
          "https://www.statnews.com/2024/02/ai-generated-medical-misinformation-platforms/",
          "https://www.who.int/news/item/18-01-2024-ethics-and-governance-of-artificial-intelligence-for-health"
        ],
        duration: 6
      },
      {
        timestamp: 170,
        sentence: "\u300C\u6C11\u773E\u63A5\u6536\u5065\u5EB7\u91AB\u7642\u8A0A\u606F\u6642\uFF0C\u61C9\u81F3\u885B\u798F\u90E8\u91AB\u4E8B\u67E5\u8A62\u7CFB\u7D71\u6216\u5404\u5927\u6559\u5B78\u91AB\u9662\u5B98\u7DB2\u6C42\u8B49\u3002\u300D",
        verdict: "verified",
        explanation: "\u885B\u798F\u90E8\u91AB\u4E8B\u6A5F\u69CB\u53CA\u91AB\u4E8B\u4EBA\u54E1\u67E5\u8A62\u7CFB\u7D71\u53EF\u5373\u6642\u67E5\u8A62\u5408\u6CD5\u57F7\u696D\u8CC7\u683C\uFF0C\u70BA\u9632\u7BC4\u5047\u91AB\u5E2B\u8207\u5E7D\u9748\u8A3A\u6240\u6700\u6B0A\u5A01\u4E4B\u5B98\u65B9\u67E5\u9A57\u7BA1\u9053\u3002",
        sources: [
          "https://ma.mohw.gov.tw/masearch/",
          "https://www.cda.org.tw/"
        ],
        duration: 5
      }
    ],
    // 我們真的需要核能嗎？：楊斯棓 at TEDxTaipei 2013
    // 我們真的需要核能嗎？：楊斯棓 at TEDxTaipei 2013
    "7wFWgopJP5Q": [
      {
        timestamp: 45,
        sentence: "\u300C\u6FB3\u6D32\u64C1\u6709\u5168\u4E16\u754C\u6700\u8C50\u5BCC\u7684\u923E\u7926\u5132\u91CF\uFF0C\u4F46\u6FB3\u6D32\u570B\u5167\u537B\u5805\u6301\u4E00\u5EA7\u6838\u80FD\u767C\u96FB\u5EE0\u90FD\u6C92\u6709\u84CB\u3002\u300D",
        verdict: "verified",
        explanation: "\u4E16\u754C\u6838\u80FD\u5354\u6703\uFF08WNA\uFF09\u8207\u6FB3\u6D32\u5730\u7403\u79D1\u5B78\u5C40\u6578\u64DA\u8B49\u5BE6\uFF1A\u6FB3\u6D32\u64C1\u6709\u5168\u7403\u7D04\u4E09\u5206\u4E4B\u4E00\u53EF\u63A1\u923E\u7926\u8CC7\u6E90\uFF0C\u70BA\u4E3B\u8981\u51FA\u53E3\u570B\uFF0C\u4F46\u81EA1998\u5E74\u901A\u904E\u300A\u8F3B\u5C04\u4FDD\u8B77\u8207\u6838\u5B89\u5168\u6CD5\u300B\u5F8C\u7ACB\u6CD5\u7981\u6B62\u570B\u5167\u6838\u80FD\u767C\u96FB\u3002",
        sources: [
          "https://world-nuclear.org/information-library/country-profiles/countries-a-f/australia.aspx",
          "https://www.ga.gov.au/scientific-topics/minerals/mineral-resources/uranium"
        ],
        duration: 6
      },
      {
        timestamp: 320,
        sentence: "\u300C\u6CD5\u570B\u96FB\u529B\u516C\u53F8\u9577\u5E74\u56E0\u6838\u96FB\u5EE0\u9F90\u5927\u8208\u5EFA\u6210\u672C\u8207\u7DAD\u8B77\u8CA0\u50B5\u7D2F\u7D2F\uFF0C\u6CD5\u570B\u6C11\u773E\u6C11\u8ABF\u5DF2\u58D3\u5012\u6027\u53CD\u5C0D\u6838\u96FB\u3002\u300D",
        verdict: "misinformation",
        explanation: "\u6CD5\u570B\u96FB\u529B\u516C\u793E\uFF08EDF\uFF09\u96D6\u9762\u81E8\u8CA1\u52D9\u8207\u53CD\u61C9\u7210\u7DAD\u4FEE\u6210\u672C\u58D3\u529B\uFF0C\u4F46\u6CD5\u570B\u4E3B\u6D41\u7368\u7ACB\u6C11\u8ABF\uFF08\u5982 IFOP\u3001Odoxa\uFF09\u5E38\u614B\u986F\u793A\u7D04 60% \u81F3 75% \u6CD5\u570B\u516C\u6C11\u652F\u6301\u7DAD\u6301\u6838\u80FD\u767C\u96FB\u4EE5\u4FDD\u969C\u570B\u5BB6\u4F4E\u78B3\u80FD\u6E90\u81EA\u4E3B\u8207\u96FB\u50F9\u7A69\u5B9A\u3002",
        sources: [
          "https://www.world-nuclear-news.org/Articles/Poll-reveals-strong-support-for-nuclear-in-France",
          "https://www.iaea.org/bulletin/frances-nuclear-energy-future"
        ],
        duration: 7
      },
      {
        timestamp: 540,
        sentence: "\u300C\u9AD8\u968E\u6838\u5EE2\u6599\u81F3\u4ECA\u5728\u5168\u7403\u5C1A\u7121\u4EFB\u4F55\u4E00\u5EA7\u5DF2\u6295\u5165\u904B\u8F49\u4E4B\u6C38\u4E45\u6DF1\u5730\u8CEA\u6700\u7D42\u8655\u7F6E\u5834\u3002\u300D",
        verdict: "verified",
        explanation: "\u5728 2013-2023 \u5E74\u9593\uFF0C\u5168\u7403\u9AD8\u968E\u6838\u5EE2\u6599\u591A\u4EE5\u4E7E\u5F0F\u8CAF\u5B58\u6216\u6C34\u6C60\u51B7\u537B\u66AB\u5B58\u3002\u82AC\u862D\u7FC1\u5361\u6D1B\uFF08Onkalo\uFF09\u6C38\u4E45\u6DF1\u5730\u8CEA\u8655\u7F6E\u5EAB\u65BC 2024 \u5E74\u5F8C\u624D\u9010\u6B65\u53D6\u5F97\u904B\u8F49\u57F7\u7167\uFF0C\u70BA\u5168\u7403\u7B2C\u4E00\u5EA7\u5177\u9AD4\u5373\u5C07\u71DF\u904B\u4E4B\u9AD8\u968E\u6700\u7D42\u8655\u7F6E\u5834\u3002",
        sources: [
          "https://www.posiva.fi/en/index/finaldisposal/onkalo.html",
          "https://www.iaea.org/newscenter/news/finlands-deep-geological-repository"
        ],
        duration: 6
      },
      {
        timestamp: 574,
        sentence: "\u300C\u4E16\u754C\u4E0A\u53EA\u6709\u53F0\u7063\u628A\u6838\u96FB\u5EE0\u84CB\u5728\u8DDD\u96E2\u9996\u90FD\u4EBA\u53E3\u5BC6\u96C6\u6838\u5FC3\u5340\u4E09\u5341\u516C\u91CC\u7BC4\u570D\u5167\u3002\u300D(09:34\u201309:39)",
        verdict: "misinformation",
        explanation: "\u745E\u58EB\u7C73\u52D2\u8C9D\u683C\u6838\u96FB\u5EE0\uFF08M\xFChleberg Nuclear Power Plant\uFF09\u8DDD\u96E2\u9996\u90FD\u4F2F\u6069\uFF08Bern\uFF09\u5E02\u4E2D\u5FC3\u50C5\u7D04 14 \u516C\u91CC\uFF0C\u81EA 1972 \u5E74\u904B\u8F49\u81F3 2019 \u5E74\u5E95\uFF08\u6B64\u6F14\u8B1B\u767C\u8868\u6642\u4ECD\u5728\u6B63\u5F0F\u5546\u8F49\u4E2D\uFF09\u3002\u6B64\u5916\u52A0\u62FF\u5927\u76AE\u514B\u9748\u6838\u96FB\u5EE0\u8DDD\u591A\u502B\u591A\u5E02\u4E2D\u5FC3\u7D04 30 \u516C\u91CC\uFF0C\u53F0\u7063\u4E26\u975E\u5168\u7403\u552F\u4E00\u9996\u90FD\u5708\u6838\u96FB\u6848\u4F8B\u3002",
        sources: [
          "https://www.bkw.ch/fileadmin/user_upload/03_Energie/03_05_Energieproduktion/Stilllegung_Kernkraftwerk_Muehleberg/Teilbericht_2_-_Umweltvertraeglichkeitsbericht_v1.0.pdf",
          "https://pris.iaea.org/pris/countrystatistics/countryoverview.aspx?sysType=PRIS"
        ],
        duration: 7
      },
      {
        timestamp: 750,
        sentence: "\u300C\u53F0\u7063\u672A\u4F86\u7684\u96FB\u529B\u4F9B\u61C9\u80FD\u5426\u5B8C\u5168\u4F9D\u8CF4\u518D\u751F\u80FD\u6E90\u4E26\u5728\u7121\u6838\u72C0\u614B\u4E0B\u7DAD\u6301\u96F6\u7F3A\u96FB\u96F6\u8DF3\u96FB\uFF1F\u300D",
        verdict: "unknown",
        explanation: "\u80FD\u6E90\u7D93\u6FDF\u5B78\u754C\u8207\u96FB\u529B\u5DE5\u7A0B\u5C08\u5BB6\u5C0D\u53F0\u7063\u7DA0\u80FD\u5EFA\u7F6E\u9032\u5EA6\u3001\u96FB\u7DB2\u5132\u80FD\u5BB9\u91CF\u3001\u5099\u8F49\u5BB9\u91CF\u7387\u53CA\u5929\u7136\u6C23\u63A5\u5378\u97CC\u6027\u770B\u6CD5\u5206\u6B67\uFF0C\u5C6C\u5177\u9AD8\u5EA6\u653F\u7B56\u601D\u8FA8\u8207\u672A\u5B9A\u8AD6\u4E4B\u7CFB\u7D71\u6027\u8AD6\u8B49\u3002",
        sources: [
          "https://www.moea.gov.tw/MNS/populace/news/News.aspx",
          "https://www.irena.org/Publications/2023/Renewable-Power-Generation-Costs"
        ],
        duration: 6.5
      }
    ],
    // 三星堆文明突然消亡的謎底，與全球青銅文明的神秘集體消失 (文昭思緒飛揚)
    TGUeqcBXy_A: [
      {
        timestamp: 55,
        sentence: "\u300C\u4E09\u661F\u5806\u53E4\u8700\u570B\u6587\u660E\u5728\u5546\u5468\u4E4B\u969B\u5B8C\u5168\u6EC5\u7D55\uFF0C\u6240\u6709\u5C45\u6C11\u8207\u6587\u5316\u7121\u5F71\u7121\u8E64\u5730\u84B8\u767C\u6D88\u5931\u3002\u300D",
        verdict: "misinformation",
        explanation: "\u73FE\u4EE3\u7530\u91CE\u8003\u53E4\u8B49\u5BE6\uFF1A\u56DB\u5DDD\u7701\u6587\u7269\u8003\u53E4\u7814\u7A76\u9662\u65BC\u6210\u90FD\u5E02\u5340\u767C\u6398\u7684\u91D1\u6C99\u907A\u5740\u8207\u5341\u4E8C\u6A4B\u6587\u5316\uFF0C\u5728\u9752\u9285\u5668\u9444\u9020\u3001\u7389\u5668\u5F62\u5236\u53CA\u9EC3\u91D1\u9762\u5177\u5DE5\u85DD\u4E0A\u7686\u8207\u4E09\u661F\u5806\u5448\u73FE\u660E\u78BA\u7E7C\u627F\u95DC\u4FC2\uFF0C\u53E4\u8700\u570B\u91CD\u5FC3\u4FC2\u56E0\u6CB3\u6D41\u6539\u9053\u6216\u74B0\u5883\u8B8A\u9077\u9077\u5F99\u81F3\u91D1\u6C99\uFF0C\u4E26\u975E\u795E\u79D8\u84B8\u767C\u3002",
        sources: [
          "http://www.jinshasitemuseum.com/research/discovery",
          "https://www.kaogu.cn/cn/kaoguxinwen/2021/0320/71120.html"
        ],
        duration: 6.5
      },
      {
        timestamp: 160,
        sentence: "\u300C\u7D04\u5728\u897F\u5143\u524D 1200 \u5E74\u524D\u5F8C\uFF0C\u6771\u5730\u4E2D\u6D77\u8207\u8FD1\u6771\u5730\u5340\u591A\u500B\u9752\u9285\u6587\u660E\u7D93\u6B77\u4E86\u5287\u70C8\u7684\u9752\u9285\u6642\u4EE3\u665A\u671F\u5D29\u6F70\uFF08Late Bronze Age Collapse\uFF09\u3002\u300D",
        verdict: "verified",
        explanation: "\u6B77\u53F2\u5B78\u8207\u53E4\u74B0\u5883\u5B78\u754C\u666E\u904D\u516C\u8A8D\uFF1A\u9081\u932B\u5C3C\u6587\u660E\u3001\u897F\u81FA\u5E1D\u570B\u3001\u9ECE\u51E1\u7279\u8AF8\u57CE\u90A6\u53CA\u57C3\u53CA\u65B0\u738B\u570B\u5728\u897F\u5143\u524D 1200 \u5E74\u524D\u5F8C\u906D\u53D7\u4E7E\u65F1\u3001\u5730\u9707\u98A8\u66B4\u3001\u6D77\u4E0A\u6C11\u65CF\u5165\u4FB5\u53CA\u8CBF\u6613\u7DB2\u7D61\u65B7\u88C2\u7B49\u591A\u91CD\u5371\u6A5F\u885D\u64CA\uFF0C\u53F2\u7A31\u300C\u665A\u671F\u9752\u9285\u6642\u4EE3\u5D29\u6F70\u300D\u3002",
        sources: [
          "https://www.worldhistory.org/Bronze_Age_Collapse/",
          "https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0071004"
        ],
        duration: 6
      },
      {
        timestamp: 330,
        sentence: "\u300C\u4E09\u661F\u5806\u8207\u7F8E\u7D22\u4E0D\u9054\u7C73\u4E9E\u53CA\u5730\u4E2D\u6D77\u9752\u9285\u6587\u660E\u7684\u8870\u843D\u662F\u7531\u540C\u4E00\u6B21\u5168\u7403\u6027\u8D85\u81EA\u7136\u707D\u7570\u5F15\u767C\u3002\u300D",
        verdict: "unknown",
        explanation: "\u53E4\u6C23\u5019\u5B78\u96D6\u5075\u6E2C\u5230\u7D04\u897F\u5143\u524D4.2\u5343\u5E74\uFF084.2 ka event\uFF09\u53CA\u897F\u5143\u524D3.2\u5343\u5E74\u5EE3\u6CDB\u4E7E\u65F1\u671F\uFF0C\u4F46\u4E09\u661F\u5806\u796D\u7940\u5751\u586B\u57CB\u5E74\u4EE3\u8DE8\u5EA6\u81EA\u5546\u665A\u671F\u81F3\u897F\u5468\u65E9\u671F\uFF08\u7D04\u524D1200-\u524D1000\u5E74\uFF09\uFF0C\u53E4\u8700\u570B\u8207\u5730\u4E2D\u6D77\u76F8\u9694\u6578\u5343\u516C\u91CC\uFF0C\u5176\u8870\u843D\u56E0\u679C\u95DC\u806F\u5C6C\u672A\u6709\u78BA\u5207\u8003\u53E4\u5B9A\u8AD6\u4E4B\u5047\u8AAA\u3002",
        sources: [
          "https://www.science.org/doi/10.1126/science.1186457",
          "https://www.nature.com/articles/nature12431"
        ],
        duration: 7
      },
      {
        timestamp: 520,
        sentence: "\u300C\u4E09\u661F\u5806\u51FA\u571F\u7684\u9752\u9285\u7E31\u76EE\u9762\u5177\u8207\u9752\u9285\u795E\u6A39\u8B49\u660E\u53E4\u8700\u4EBA\u5C6C\u65BC\u5730\u5916\u6587\u660E\u6216\u5916\u661F\u6DF7\u8840\u65CF\u7FA4\u3002\u300D",
        verdict: "misinformation",
        explanation: "\u8003\u53E4\u767C\u6398\u4EBA\u9AA8\u53E4 DNA \u6E2C\u5B9A\u8207\u5206\u5B50\u4EBA\u985E\u5B78\u7814\u7A76\u8868\u660E\uFF0C\u53E4\u8700\u4EBA\u7FA4\u907A\u50B3\u80CC\u666F\u8207\u9EC3\u6CB3\u4E2D\u4E0A\u6E38\u53E4\u4E2D\u539F\u4EBA\u7FA4\u9AD8\u5EA6\u540C\u6E90\uFF1B\u7E31\u76EE\u8A87\u5F35\u9020\u578B\u4FC2\u300A\u83EF\u967D\u570B\u5FD7\u300B\u8A18\u8F09\u53E4\u8700\u59CB\u7956\u300C\u8836\u53E2\u7E31\u76EE\u300D\u7684\u795E\u683C\u5316\u5716\u9A30\u5D07\u62DC\u8207\u796D\u7940\u79AE\u5668\u8C61\u5FB5\uFF0C\u7121\u5916\u661F\u4EBA\u5E72\u9810\u8B49\u64DA\u3002",
        sources: [
          "https://www.cell.com/molecular-plant/fulltext/S1674-2052(20)30449-7",
          "https://tfc-taiwan.org.tw/articles/sanxingdui-alien-myths"
        ],
        duration: 6.5
      },
      {
        timestamp: 638,
        sentence: "\u300C\u9285\u7926\u77F3\u55AE\u7368\u51B6\u7149\u51FA\u4F86\u5C31\u662F\u9EC3\u9285\uFF0C\u800C\u9752\u9285\u662F\u7528\u9EC3\u9285\u52A0\u4E0A\u5927\u7D04\u5341\u5206\u4E4B\u4E00\u7684\u932B\u6DF7\u5408\u88FD\u6210\u7684\u3002\u300D(10:38\u201310:50)",
        verdict: "misinformation",
        explanation: "\u51B6\u91D1\u5316\u5B78\u8207\u6750\u6599\u79D1\u5B78\u57FA\u790E\u4E8B\u5BE6\uFF1A\u5929\u7136\u7D14\u9285\u7926\u77F3\u51B6\u7149\u5F97\u5230\u7684\u662F\u7D14\u9285\uFF08\u7D05\u9285\uFF09\u3002\u9EC3\u9285\uFF08Brass\uFF09\u662F\u9285\u8207\u300C\u92C5\uFF08Zinc\uFF09\u300D\u7684\u5408\u91D1\uFF1B\u800C\u9752\u9285\uFF08Bronze\uFF09\u662F\u9285\u8207\u300C\u932B\uFF08Tin\uFF09\u300D\u7684\u5408\u91D1\u3002\u7D14\u9285\u3001\u9EC3\u9285\u8207\u9752\u9285\u70BA\u5B8C\u5168\u4E0D\u540C\u7684\u91D1\u5C6C\u6750\u6599\uFF0C\u9752\u9285\u7D55\u975E\u7531\u9EC3\u9285\u52A0\u932B\u6DF7\u5408\u88FD\u6210\u3002",
        sources: [
          "https://periodic-table.rsc.org/element/29/copper",
          "https://www.copper.org/resources/properties/atomic_structure.html"
        ],
        duration: 7
      },
      {
        timestamp: 700,
        sentence: "\u300C\u4E09\u661F\u5806\u907A\u5740\u767C\u6398\u51FA\u5927\u91CF\u6D77\u8C9D\u8207\u8C61\u7259\uFF0C\u8B49\u660E\u53E4\u8700\u738B\u570B\u5177\u5099\u8DE8\u5340\u57DF\u9060\u7A0B\u8CBF\u6613\u8207\u6587\u5316\u4EA4\u6D41\u7DB2\u7D61\u3002\u300D",
        verdict: "verified",
        explanation: "\u56DB\u5DDD\u4E09\u661F\u5806\u4E00\u81F3\u516B\u865F\u796D\u7940\u5751\u7D2F\u8A08\u51FA\u571F\u6578\u5343\u679A\u9F52\u8C9D\uFF08\u5370\u5EA6\u6D0B\u8CA8\u8C9D\uFF09\u53CA\u6578\u767E\u6839\u4E9E\u6D32\u8C61\u7259\uFF0C\u540C\u4F4D\u7D20\u5206\u6790\u8B49\u5BE6\u53E4\u8700\u570B\u900F\u904E\u5357\u65B9\u7D72\u7DA2\u4E4B\u8DEF\u8207\u5357\u4E9E\u6B21\u5927\u9678\u53CA\u4E2D\u539F\u5546\u738B\u671D\u4FDD\u6301\u6D3B\u8E8D\u7269\u8CC7\u6D41\u901A\u3002",
        sources: [
          "https://www.kaogu.cn/cn/kaoguxinwen/2021/0910/72880.html",
          "https://en.unesco.org/silkroad/content/sanxingdui-site"
        ],
        duration: 6
      }
    ],
    // 《聖經》大洪水記載遺漏的起因補上了；實錘證據有了 (文昭思緒飛揚)
    BSI8oxcQFfw: [
      {
        timestamp: 45,
        sentence: "\u300C\u5168\u4E16\u754C\u5404\u5927\u6D32\u4E3B\u8981\u53E4\u4EE3\u6587\u660E\uFF08\u7F8E\u7D22\u4E0D\u9054\u7C73\u4E9E\u3001\u7F8E\u6D32\u5370\u7B2C\u5B89\u3001\u53E4\u5370\u5EA6\u53CA\u83EF\u590F\uFF09\u7684\u795E\u8A71\u6587\u737B\u4E2D\u5747\u6709\u6BC0\u6EC5\u6027\u5927\u6D2A\u6C34\u8A18\u61B6\u3002\u300D",
        verdict: "verified",
        explanation: "\u6BD4\u8F03\u795E\u8A71\u5B78\u8207\u6C11\u4FD7\u5B78\u7814\u7A76\uFF08\u5982\u8A79\u59C6\u65AF\xB7\u5F17\u96F7\u6FA4\u300A\u820A\u7D04\u4E2D\u7684\u6C11\u4FD7\u300B\uFF09\u8B49\u5BE6\uFF1A\u5305\u62EC\u8607\u7F8E\u723E\u300A\u5409\u723E\u4F3D\u7F8E\u4EC0\u53F2\u8A69\u300B\u3001\u5370\u5EA6\u300A\u767E\u9053\u68B5\u66F8\u300B\u6469\u5974\u6551\u4E16\u3001\u99AC\u96C5\u300A\u6CE2\u6CE2\u723E\xB7\u70CF\u300B\u53CA\u4E2D\u570B\u5927\u79B9\u6CBB\u6C34\u7B49\u6578\u767E\u500B\u795E\u8A71\u5747\u8A18\u9304\u4E86\u9060\u53E4\u6D2A\u6C34\u6D69\u52AB\u3002",
        sources: [
          "https://www.britannica.com/topic/flood-myth",
          "https://www.oxfordbibliographies.com/view/document/obo-9780195396577/obo-9780195396577-0130.xml"
        ],
        duration: 6.5
      },
      {
        timestamp: 150,
        sentence: "\u300C\u300A\u8056\u7D93\xB7\u5275\u4E16\u8A18\u300B\u907A\u6F0F\u4E86\u5927\u6D2A\u6C34\u8D77\u56E0\uFF0C\u76F4\u5230\u8FD1\u73FE\u4EE3\u6B7B\u6D77\u53E4\u5377\u300A\u4EE5\u8AFE\u66F8\u300B\u624D\u88DC\u5168\u5DE8\u4EBA\u8207\u58AE\u843D\u5929\u4F7F\u7684\u5B8C\u6574\u56E0\u679C\u3002\u300D",
        verdict: "unknown",
        explanation: "\u300A\u5275\u4E16\u8A18\u300B\u7B2C\u516D\u7AE0\u5DF2\u63D0\u53CA\u300C\u5049\u4EBA\uFF08Nephilim\uFF09\u300D\u8207\u4EBA\u9053\u5FB7\u6557\u58DE\uFF1B\u6B21\u7D93\u300A\u4EE5\u8AFE\u66F8\u300B\uFF081 Enoch\uFF09\u78BA\u5728\u8863\u7D22\u6BD4\u4E9E\u6B63\u7D71\u6559\u6703\u53CA\u6606\u862D\u6B7B\u6D77\u53E4\u5377\u4E2D\u64F4\u5145\u5B88\u671B\u8005\u5929\u4F7F\u8207\u5DE8\u4EBA\u60C5\u7BC0\uFF0C\u4F46\u4E3B\u6D41\u7336\u592A\u6559\u62C9\u6BD4\u8207\u5929\u4E3B\u6559/\u57FA\u7763\u65B0\u6559\u8996\u5176\u70BA\u507D\u7D93\uFF08Apocrypha/Pseudepigrapha\uFF09\uFF0C\u975E\u6B63\u5178\u907A\u6F0F\u3002",
        sources: [
          "https://www.deadseascrolls.org.il/featured-scrolls/the-enoch-scrolls",
          "https://bibleinterp.arizona.edu/articles/enoch-and-genesis"
        ],
        duration: 7
      },
      {
        timestamp: 310,
        sentence: "\u300C\u5730\u8CEA\u5B78\u754C\u5DF2\u7D93\u627E\u5230\u5B8C\u5168\u8986\u84CB\u5730\u7403\u6240\u6709\u5927\u9678\u8207\u9AD8\u5C71\u7684\u55AE\u4E00\u5168\u7403\u6027\u5927\u6D2A\u6C34\u5BE6\u9318\u5730\u8CEA\u8B49\u64DA\u3002\u300D",
        verdict: "misinformation",
        explanation: "\u5730\u8CEA\u5B78\u3001\u6C88\u7A4D\u5B78\u53CA\u51B0\u5DDD\u5B78\u754C\u900F\u904E\u5168\u7403\u5CA9\u5C64\u8207\u5357\u6975/\u683C\u9675\u862D\u6578\u5341\u842C\u5E74\u51B0\u82AF\u947D\u63A2\u8B49\u5BE6\uFF1A\u5730\u8CEA\u6B77\u53F2\u4E0A\u4E0D\u5B58\u5728\u540C\u4E00\u6642\u9593\u9EDE\u6DF9\u6C92\u5168\u7403\u6700\u9AD8\u6D77\u62D4\u7684\u55AE\u4E00\u5168\u7403\u6027\u5927\u6D2A\u6C34\uFF1B\u6D2A\u6C34\u50B3\u8AAA\u6E90\u81EA\u672B\u6B21\u51B0\u671F\u7D50\u675F\u5F8C\uFF08\u7D041.4\u842C-8000\u5E74\u524D\uFF09\u5404\u5927\u9678\u6D77\u5E73\u9762\u6025\u5347\u8207\u9ED1\u6D77/\u6CE2\u65AF\u7063\u7B49\u5340\u57DF\u6027\u5DE8\u5927\u6D77\u4FB5\u4E8B\u4EF6\u3002",
        sources: [
          "https://www.geosociety.org/gsatoday/archive/22/6/article/i1052-5173-22-6-4.htm",
          "https://www.talkorigins.org/faqs/fl-geology.html"
        ],
        duration: 7.5
      },
      {
        timestamp: 626,
        sentence: "\u300C\u683C\u9675\u862D\u6D77\u83EF\u6C99\u5F57\u661F\u649E\u64CA\u89F8\u767C\u4E86\u65B0\u4ED9\u5973\u6728\u6642\u671F\u5168\u7403\u6D69\u52AB\uFF0C\u6210\u70BA\u5F62\u6210\u7F8E\u570B\u65AF\u5361\u5E03\u862D\uFF08Channeled Scablands\uFF09\u7279\u5927\u6D2A\u6C34\u7684\u5BE6\u9318\u8D77\u56E0\u3002\u300D(10:26\u201310:48)",
        verdict: "misinformation",
        explanation: "\u5730\u8CEA\u5E74\u4EE3\u5B78\u660E\u78BA\u5426\u5B9A\u6B64\u56E0\u679C\u95DC\u4FC2\uFF1A\u7F8E\u570B\u5730\u8CEA\u8ABF\u67E5\u5C40\uFF08USGS\uFF09\u8207\u7B2C\u56DB\u7D00\u5730\u8CEA\u5B78\u7814\u7A76\u78BA\u8A8D\uFF0C\u65AF\u5361\u5E03\u862D\u6D2A\u6CDB\u5730\u8C8C\u4FC2\u7531\u7C73\u8607\u62C9\u51B0\u5DDD\u6E56\uFF08Glacial Lake Missoula\uFF09\u51B0\u58E9\u6F70\u6C7A\u5F15\u8D77\uFF0C\u767C\u751F\u5728\u8DDD\u4ECA\u7D04 19,000 \u81F3 15,000 \u5E74\u524D\uFF1B\u800C\u65B0\u4ED9\u5973\u6728\u649E\u64CA\u5047\u8AAA\u5E74\u4EE3\u70BA\u7D04 12,900 \u5E74\u524D\uFF0C\u4E14\u6D77\u83EF\u6C99\u9695\u77F3\u5751\u5B9A\u5E74\u70BA 5800 \u842C\u5E74\u524D\uFF0C\u5E74\u4EE3\u5B8C\u5168\u932F\u7F6E\u7121\u6CD5\u5951\u5408\u3002",
        sources: [
          "https://www.usgs.gov/publications/megafloods-and-clovis-cache-wenatchee-washington",
          "https://www.science.org/doi/10.1126/sciadv.abm2434"
        ],
        duration: 7.5
      },
      {
        timestamp: 690,
        sentence: "\u300C\u9ED1\u6D77\u5927\u6D2A\u6C34\u5047\u8AAA\uFF08Black Sea deluge hypothesis\uFF09\u8A8D\u70BA\u5730\u4E2D\u6D77\u6D77\u6C34\u5728\u7D04\u897F\u5143\u524D5600\u5E74\u885D\u7834\u535A\u65AF\u666E\u9B6F\u65AF\u6D77\u5CFD\u704C\u5165\u9ED1\u6D77\u6DE1\u6C34\u6E56\u3002\u300D",
        verdict: "verified",
        explanation: "\u54E5\u502B\u6BD4\u4E9E\u5927\u5B78\u6D77\u6D0B\u5730\u8CEA\u5B78\u5BB6\u5A01\u5EC9\xB7\u840A\u6069\uFF08William Ryan\uFF09\u8207\u74E6\u723E\u7279\xB7\u76AE\u7279\u66FC\uFF08Walter Pitman\uFF09\u65BC 1997 \u5E74\u63D0\u51FA\u4E26\u7531\u6D77\u6D0B\u6C88\u7A4D\u7269\u8207\u8C9D\u985E\u78B314\u5B9A\u5E74\u4F50\u8B49\uFF0C\u9ED1\u6D77\u5728\u672B\u6B21\u51B0\u6D88\u671F\u5F8C\u7D93\u6B77\u5DE8\u5927\u7A81\u767C\u6027\u6D77\u6C34\u6CE8\u5165\uFF0C\u70BA\u53E4\u4EE3\u5927\u6D2A\u6C34\u8A18\u61B6\u7684\u6709\u529B\u5340\u57DF\u5730\u8CEA\u5019\u9078\u4E8B\u4EF6\u3002",
        sources: [
          "https://www.sciencedirect.com/science/article/pii/S002532270300098X",
          "https://www.smithsonianmag.com/science-nature/evidence-for-a-flood-102813110/"
        ],
        duration: 6.5
      }
    ],
    // Climate: The Movie — Updated 4K version (Clintel)
    "zmfRG8-RHEI": [
      {
        timestamp: 860,
        sentence: "The Medieval Warm Period was globally much warmer than the modern era without any fossil fuel emissions.",
        verdict: "misinformation",
        explanation: "PAGES 2k consortium paleoclimate reconstructions demonstrate that the Medieval Climate Anomaly was regionally heterogeneous, whereas current anthropogenic warming is globally synchronous and warmer than any period in the past 2,000 years.",
        sources: [
          "https://www.nature.com/articles/s41586-019-1401-2",
          "https://science.feedback.org/review/climate-the-movie-relies-on-numerous-false-and-misleading-claims-by-known-climate-contrarians/"
        ],
        duration: 6.5,
        score: 3
      },
      {
        timestamp: 1873.8,
        sentence: "Yes I assert, that there is no connection whatsoever, between CO2 and climate change.",
        verdict: "misinformation",
        explanation: "Researchers have directly measured the enhanced greenhouse effect attributable to rising atmospheric CO2 via ground and satellite spectroscopy, empirically confirming its direct physical forcing on Earth's energy balance.",
        sources: [
          "https://www.nature.com/articles/nature14240",
          "https://science.feedback.org/review/climate-the-movie-relies-on-numerous-false-and-misleading-claims-by-known-climate-contrarians/"
        ],
        duration: 7,
        score: 3
      },
      {
        timestamp: 2710,
        sentence: "Surface temperature station networks are corrupted by the urban heat island effect.",
        verdict: "misinformation",
        explanation: "Independent satellite radiometer soundings (UAH, RSS), ocean sea-surface buoy measurements, and isolated rural weather stations all demonstrate consistent multi-decadal warming trends matching urban station networks.",
        sources: [
          "https://journals.ametsoc.org/view/journals/clim/21/24/2008jcli2100.1.xml",
          "https://climatefeedback.org/claimreview/temperature-records-are-not-distorted-by-urban-heat-islands/"
        ],
        duration: 6,
        score: 3
      }
    ],
    // Is Genesis History? — Full Film (Is Genesis History?)
    "UM82qxxskZE": [
      {
        timestamp: 1110,
        sentence: "The Grand Canyon strata were deposited rapidly by a single global flood in a matter of months.",
        verdict: "misinformation",
        explanation: "Sedimentary facies, distinct alternating marine and terrestrial fossil horizons, desert sand dune cross-bedding (Coconino Sandstone), and erosion unconformities demonstrate millions of years of depositional history, not a single rapid cataclysm.",
        sources: [
          "https://www.nps.gov/grca/learn/nature/geologicformations.htm",
          "https://pubs.usgs.gov/bul/1137j/report.pdf"
        ],
        duration: 6.5,
        score: 3
      },
      {
        timestamp: 2895,
        sentence: "Radiometric decay rates were dramatically accelerated during Noah\u2019s Flood.",
        verdict: "misinformation",
        explanation: "Nuclear decay constants are determined by the fundamental weak and strong nuclear forces. An acceleration of radioactive decay by factors of billions would have released immense thermal energy sufficient to boil Earth's oceans and vaporize the crust.",
        sources: [
          "https://ncse.ngo/radiometric-dating-does-work",
          "https://www.talkorigins.org/faqs/dalrymple/radiometric_dating.html"
        ],
        duration: 6.5,
        score: 3
      },
      {
        timestamp: 5027.5,
        sentence: "We believe that the creation is only thousands of years old, say 6000 years, 7000 years, something like that.",
        verdict: "misinformation",
        explanation: "Independent radiometric isochron dating of terrestrial zircon crystals, meteorites, and lunar samples establishes that Earth and the Solar System are approximately 4.54 billion years old (\xB1 1%), with independently dated Australian zircons exceeding 4.4 billion years.",
        sources: [
          "https://pubs.usgs.gov/gip/geotime/age.html",
          "https://www.nationalacademies.org/evolution/age-of-earth"
        ],
        duration: 7,
        score: 3
      }
    ],
    // 830 Miles – World Record – Flat Earth Proof (LoRa) (Taboo Conspiracy)
    "zZGjO1szbFg": [
      {
        timestamp: 25,
        sentence: "In short this is another world record proof of the Flat Earth; this evidence alone ends the globe.",
        verdict: "misinformation",
        explanation: "Long-distance radio transmission relies on established radio wave propagation physics. Geodetic surveying, satellite navigation, circumnavigation, and stellar observation indisputably prove Earth is an oblate spheroid.",
        sources: [
          "https://oceanservice.noaa.gov/facts/earth-round.html",
          "https://www.nasa.gov/audience/forstudents/5-8/features/nasa-knows/what-is-earth-58.html"
        ],
        duration: 6,
        score: 3
      },
      {
        timestamp: 86,
        sentence: "It is important to note that UHF does not even allegedly bend with the curvature of the Earth... this was at a distance of 830 miles.",
        verdict: "misinformation",
        explanation: "Atmospheric refraction and tropospheric ducting across ocean thermal inversions channel UHF/microwave radio signals along atmospheric layers beyond the line-of-sight geometric horizon. Such reception is well-documented propagation physics and does not demonstrate Earth is flat.",
        sources: [
          "https://www.weather.gov/media/crh/radarmet/refraction.pdf",
          "https://en.wikipedia.org/wiki/Tropospheric_propagation#Tropospheric_ducting"
        ],
        duration: 7,
        score: 3
      },
      {
        timestamp: 165,
        sentence: "Assuming an observer height of 20 feet, the signal should have been blocked at 5.5 miles. The only reasonable conclusion: the Earth is flat.",
        verdict: "misinformation",
        explanation: "Geometric horizon calculations ignore standard atmospheric refraction (k-factor ~ 4/3 or higher in marine ducting conditions), which bends electromagnetic ray paths along the geoid and extends transmission ranges hundreds of miles past the optical horizon.",
        sources: [
          "https://www.itu.int/rec/R-REC-P.453/en",
          "https://www.itu.int/rec/R-REC-P.834/en"
        ],
        duration: 6.5,
        score: 3
      }
    ],
    // The Truth about CO2 (PragerU)
    "WDWEjSDYfxc": [
      {
        timestamp: 45,
        sentence: "Carbon dioxide is plant food, so higher atmospheric levels are purely beneficial for all life on Earth.",
        verdict: "misinformation",
        explanation: "While elevated CO2 can stimulate photosynthetic carbon assimilation under controlled laboratory conditions, agronomic field studies demonstrate it lowers the protein, zinc, and iron nutritional content of staple grains while worsening climate-induced drought and heat stress.",
        sources: [
          "https://www.nature.com/articles/nature13179",
          "https://science.feedback.org/review/co2-is-plant-food-claims-ignore-the-broader-consequences-of-climate-change-on-agriculture/"
        ],
        duration: 6.5,
        score: 3
      },
      {
        timestamp: 120,
        sentence: "Photosynthesis uses carbon dioxide, water, and sunlight to produce sugars and oxygen.",
        verdict: "verified",
        explanation: "Biochemical analysis of chloroplast chlorophyll reactions validates the standard oxygenic photosynthetic equation: 6CO2 + 6H2O + light -> C6H12O6 + 6O2.",
        sources: [
          "https://www.khanacademy.org/science/biology/photosynthesis-in-plants"
        ],
        duration: 5,
        score: 0
      },
      {
        timestamp: 173.6,
        sentence: "During the Cambrian explosion, when multi-cellular life first came on the scene, CO2 levels were as much as 10 times higher than they are today.",
        verdict: "misinformation",
        explanation: "Multicellular life did not first appear during the Cambrian explosion (~541 Ma). Diverse multicellular Ediacaran organisms (such as Dickinsonia) flourished tens of millions of years earlier (~575 Ma), and multicellular red algae fossils (Bangiomorpha) date back over 1 billion years.",
        sources: [
          "https://pmc.ncbi.nlm.nih.gov/articles/PMC4760166/",
          "https://www.nature.com/articles/nature12726"
        ],
        duration: 7,
        score: 3
      }
    ],
    // What They Haven’t Told You about Climate Change (PragerU)
    "RkdbSxyXftc": [
      {
        timestamp: 78.4,
        sentence: "Thirty million years ago the earth had no ice on it at all.",
        verdict: "misinformation",
        explanation: "Geological, sedimentological, and oxygen isotope benthic records establish that continental Antarctic glaciation began around 34 million years ago during the Eocene-Oligocene transition, meaning substantial permanent ice sheets were already well-established 30 million years ago.",
        sources: [
          "https://www.nature.com/articles/nature01290",
          "https://www.science.org/doi/10.1126/science.1059412"
        ],
        duration: 6,
        score: 3
      },
      {
        timestamp: 145,
        sentence: "Recent warming is completely within normal natural millennial cyclic variations.",
        verdict: "misinformation",
        explanation: "Comprehensive paleoclimate temperature reconstructions published in Nature demonstrate that the current rate and spatial extent of warming exceed any natural millennial cyclic variation over the past 2,000 years and the entire Holocene.",
        sources: [
          "https://www.nature.com/articles/s41561-019-0400-0",
          "https://www.ipcc.ch/report/ar6/wg1/chapter/chapter-2/"
        ],
        duration: 6,
        score: 3
      },
      {
        timestamp: 210,
        sentence: "Computer models run by climate scientists predict runaway temperature increases that never materialize.",
        verdict: "misinformation",
        explanation: "Evaluations of climate models published between 1970 and 2007 demonstrate that historical models skillfully projected subsequent observed surface temperatures within observational uncertainty once actual greenhouse gas forcings were accounted for.",
        sources: [
          "https://agupubs.onlinelibrary.wiley.com/doi/10.1029/2019GL085378",
          "https://www.giss.nasa.gov/research/briefs/2020_hausfather_01/"
        ],
        duration: 6.5,
        score: 3
      }
    ],
    // Climate Change: What’s So Alarming? (PragerU)
    "3PWtaackIJU": [
      {
        timestamp: 28.8,
        sentence: "Yes, sea levels are rising, but the rise is not accelerating\u2014if anything, two recent papers have shown a small decline in the rate of sea-level increase.",
        verdict: "misinformation",
        explanation: "Satellite altimeter records and global tide gauge reconstructions show that sea-level rise has accelerated significantly from approximately 1.2\u20131.7 mm/year during the 20th century to over 3.4\u20133.7 mm/year since 1993, driven by accelerated melting of Greenland and Antarctic ice sheets and ocean thermal expansion.",
        sources: [
          "https://www.nature.com/articles/nature14093",
          "https://climate.nasa.gov/vital-signs/sea-level/",
          "https://www.pnas.org/doi/10.1073/pnas.1717312115"
        ],
        duration: 7.5,
        score: 3
      },
      {
        timestamp: 105,
        sentence: "Extreme weather events such as hurricanes, floods, and droughts have not shown any measurable increase.",
        verdict: "misinformation",
        explanation: "IPCC Sixth Assessment Report confirms that human-induced climate change is already increasing the frequency and intensity of extreme weather events, including heavy precipitation, heatwaves, and agricultural droughts across most land regions globally.",
        sources: [
          "https://www.ipcc.ch/report/ar6/wg1/chapter/chapter-11/",
          "https://www.nature.com/articles/s41558-021-01092-7"
        ],
        duration: 6.5,
        score: 3
      },
      {
        timestamp: 185,
        sentence: "Thermal expansion causes water volume to increase as ocean temperatures rise.",
        verdict: "verified",
        explanation: "Thermodynamics of seawater confirms that rising temperatures increase ocean volume, with thermal expansion accounting for approximately 35-40% of observed global mean sea-level rise over the satellite era.",
        sources: [
          "https://www.nature.com/articles/s41558-019-0531-8",
          "https://www.climate.gov/news-features/understanding-climate/climate-change-global-sea-level"
        ],
        duration: 5.5,
        score: 0
      }
    ],
    // Can Climate Models Predict Climate Change? (PragerU)
    "qZN2jt2cCU4": [
      {
        timestamp: 78.5,
        sentence: "And I know they don\u2019t work. They haven\u2019t worked in the past. They don\u2019t work now. And it\u2019s hard to imagine when, if ever, they\u2019ll work in the foreseeable future.",
        verdict: "misinformation",
        explanation: "A rigorous peer-reviewed evaluation published by NASA GISS and university researchers analyzed 17 climate models published between 1970 and 2007, finding that 14 of them accurately predicted subsequent observed global surface warming to within expected statistical boundaries.",
        sources: [
          "https://www.giss.nasa.gov/research/briefs/2020_hausfather_01/",
          "https://agupubs.onlinelibrary.wiley.com/doi/10.1029/2019GL085378"
        ],
        duration: 7,
        score: 3
      },
      {
        timestamp: 160,
        sentence: "Climate models cannot model clouds or aerosols with any mathematical validity.",
        verdict: "unknown",
        explanation: "While cloud feedback and aerosol indirect radiative forcing remain active areas of research and the largest sources of parametric spread among models, modern Earth system models accurately reproduce observed global cloud distributions and feedback sign constraints.",
        sources: [
          "https://www.ipcc.ch/report/ar6/wg1/chapter/chapter-7/",
          "https://www.pnas.org/doi/10.1073/pnas.2026290118"
        ],
        duration: 6,
        score: 1
      },
      {
        timestamp: 230,
        sentence: "Solar irradiance variations are the true driver of 20th century global temperature shifts.",
        verdict: "misinformation",
        explanation: "Satellite radiometer measurements since 1978 show total solar irradiance has slightly decreased while global temperatures have rapidly increased. Furthermore, the troposphere is warming while the stratosphere is cooling, a distinct physical fingerprint of greenhouse gas trapping rather than solar warming.",
        sources: [
          "https://climate.nasa.gov/causes/",
          "https://www.pnas.org/doi/10.1073/pnas.2008779117"
        ],
        duration: 6.5,
        score: 3
      }
    ],
    // Does God Exist? 4 New Arguments (PragerU)
    "gIorXcloIac": [
      {
        timestamp: 65,
        sentence: "The Big Bang theory mathematically proves the universe had an absolute beginning ex nihilo from nothing.",
        verdict: "unknown",
        explanation: "While classical general relativity yields a singularity theorem, modern theoretical physics and quantum cosmology explore pre-Big Bang scenarios (such as string inflation, loop quantum gravity bounce, and quantum tunneling) where the Planck epoch is an active boundary rather than a proven absolute nothingness.",
        sources: [
          "https://plato.stanford.edu/entries/cosmology/",
          "https://www.scientificamerican.com/article/what-happened-before-the-big-bang/"
        ],
        duration: 6.5,
        score: 1
      },
      {
        timestamp: 175,
        sentence: "Fine-tuning of the cosmological constant to 1 part in 10^120 proves deliberate physical design.",
        verdict: "unknown",
        explanation: "The cosmological constant discrepancy is an unresolved mystery in theoretical physics. Competing candidate solutions include multiverse anthropic selection, dynamic dark energy scalar fields, and modified quantum gravity formulations.",
        sources: [
          "https://physics.aps.org/articles/v11/131",
          "https://plato.stanford.edu/entries/fine-tuning/"
        ],
        duration: 6,
        score: 1
      },
      {
        timestamp: 240.3,
        sentence: "Even the lowest life forms have brains and central nervous systems.",
        verdict: "misinformation",
        explanation: "Sponges (phylum Porifera), placozoans, and single-celled organisms are living animals and organisms that completely lack brains, neurons, and central nervous systems, providing a direct biological refutation to this claim.",
        sources: [
          "https://ocean.si.edu/ocean-life/invertebrates/sponges",
          "https://www.nature.com/articles/s41586-021-03889-8"
        ],
        duration: 6.5,
        score: 3
      }
    ],
    // Evolution: Bacteria to Beethoven (PragerU)
    "DOIbcOoaxuY": [
      {
        timestamp: 138.7,
        sentence: "DNA stores digital information in a four-character chemical code that directs the assembly of proteins.",
        verdict: "verified",
        explanation: "Molecular biology confirms that DNA sequences of four nucleotide bases (adenine, cytosine, guanine, thymine) encode amino acid codons that direct ribosomal polypeptide synthesis.",
        sources: [
          "https://www.nature.com/scitable/topicpage/dna-is-a-structure-that-encodes-6543806/"
        ],
        duration: 5.5,
        score: 0
      },
      {
        timestamp: 262.9,
        sentence: "For every DNA sequence that generates a relatively short functional protein, there are 10 to the 77th power nonfunctional sequences.",
        verdict: "misinformation",
        explanation: "The 1 in 10^77 figure from Douglas Axe measured mutational sensitivity around one specific beta-lactamase enzyme structure. In contrast, in vitro directed evolution experiments (such as Keefe & Szostak) selected novel functional ATP-binding proteins from an unbiased random sequence library of just 6 \xD7 10^12 candidates, disproving the generalized 1 in 10^77 claim.",
        sources: [
          "https://pubmed.ncbi.nlm.nih.gov/11294879/",
          "https://pubmed.ncbi.nlm.nih.gov/15321723/"
        ],
        duration: 7.5,
        score: 3
      },
      {
        timestamp: 310,
        sentence: "Natural selection cannot produce major innovations or new functional biological information.",
        verdict: "misinformation",
        explanation: "Empirical evolutionary genetics documents numerous mechanisms of novel information generation, including gene duplication followed by neo-functionalization (e.g., antifreeze glycoproteins in Antarctic notothenioid fish and nylon-degrading enzymes in Flavobacterium).",
        sources: [
          "https://www.pnas.org/doi/10.1073/pnas.94.8.3811",
          "https://www.nature.com/articles/nrg958"
        ],
        duration: 6.5,
        score: 3
      }
    ]
  };
  function fnv1a(str) {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }
  function createMulberry32(seed) {
    let s = seed >>> 0;
    return function() {
      s |= 0;
      s = s + 1831565813 | 0;
      let t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  var FALLBACK_TOPICS = [
    {
      verdict: "misinformation",
      sentences: [
        "Global atmospheric carbon dioxide has no measurable greenhouse heat-trapping effect.",
        "Sunlight exposure to closed eyelids converts melanin directly into vitamin B12.",
        "Charging smartphones to 100% permanently damages lithium batteries within one week.",
        "The Great Wall of China is clearly visible from low Earth orbit with the unaided naked eye.",
        "Microwave ovens alter food molecular chemistry into radioactive carcinogens."
      ],
      explanations: [
        "Spectroscopic physics measurements consistently demonstrate CO2 absorbs and re-emits infrared radiation.",
        "Vitamin B12 is synthesized exclusively by bacteria; photoreceptors have no biochemical pathway to synthesize B-vitamins.",
        "Modern smartphones utilize battery management circuits that throttle voltage and prevent overcharging.",
        "NASA astronaut observations and satellite imagery confirm the Great Wall is indistinguishable from surrounding terrain without optical magnification.",
        "Microwaves utilize non-ionizing radiation that causes thermal excitation of water molecules without ionizing atomic nuclei."
      ],
      sources: [
        ["https://climate.nasa.gov/evidence/", "https://www.ipcc.ch/report/ar6/wg1/"],
        ["https://ods.od.nih.gov/factsheets/VitaminB12-HealthProfessional/"],
        ["https://batteryuniversity.com/article/bu-808-how-to-prolong-lithium-based-batteries"],
        ["https://www.nasa.gov/vision/space/workinginspace/great_wall.html"],
        ["https://www.fda.gov/radiation-emitting-products/resources-you-radiation-emitting-products/microwave-ovens"]
      ]
    },
    {
      verdict: "verified",
      sentences: [
        "The speed of light in a vacuum is approximately 299,792 kilometers per second.",
        "Water reaches its maximum density in liquid state at approximately 3.98 degrees Celsius.",
        "Photosynthesis in green plants converts water and carbon dioxide into glucose and oxygen.",
        "The human genome contains roughly three billion base pairs of DNA.",
        "Saturn has a lower average density than liquid water."
      ],
      explanations: [
        "Standard SI international metrology defines c = 299,792,458 m/s exactly.",
        "Thermal expansion and hydrogen-bonding lattice structure account for the density peak of liquid water at 4\xB0C.",
        "Biochemical analysis of chloroplast chlorophyll reactions validates the standard photosynthetic equation.",
        "The Human Genome Project confirmed the diploid human genome spans approximately 3.1 billion base pairs.",
        "Astrophysical density models show Saturn mean density is ~0.687 g/cm\xB3, lower than water at 1.0 g/cm\xB3."
      ],
      sources: [
        ["https://physics.nist.gov/cgi-bin/cuu/Value?c"],
        ["https://water.usgs.gov/edu/density.html"],
        ["https://www.khanacademy.org/science/biology/photosynthesis-in-plants"],
        ["https://www.genome.gov/human-genome-project"],
        ["https://nssdc.gsfc.nasa.gov/planetary/factsheet/saturnfact.html"]
      ]
    },
    {
      verdict: "unknown",
      sentences: [
        "Dark matter consists predominantly of primordial black holes formed during the Big Bang.",
        "The Phaistos Disc represents an ancient astronomical calendar rather than a written script.",
        "Certain deep-sea hydrothermal organisms possess a biological lifespan exceeding ten millennia."
      ],
      explanations: [
        "While primordial black holes remain an active candidate for dark matter, observational microlensing constraints leave the hypothesis unconfirmed.",
        "The script and pictograms on the Minoan Phaistos Disc remain undeciphered and subject to debate among epigraphers.",
        "Radiometric dating of deep benthic colonies suggests extreme longevity, but continuous generational cellular replacement is difficult to quantify."
      ],
      sources: [
        ["https://arxiv.org/abs/2002.12778"],
        ["https://en.wikipedia.org/wiki/Phaistos_Disc"],
        ["https://www.nature.com/articles/s41598-020-61868-3"]
      ]
    }
  ];
  var FALLBACK_TOPICS_ZH = [
    {
      verdict: "misinformation",
      sentences: [
        "\u300C\u5927\u6C23\u4E2D\u7684\u4E8C\u6C27\u5316\u78B3\u589E\u52A0\u5C0D\u5168\u7403\u6C23\u6EAB\u6C92\u6709\u4EFB\u4F55\u53EF\u6E2C\u91CF\u7684\u6EAB\u5BA4\u4FDD\u6EAB\u6548\u61C9\u3002\u300D",
        "\u300C\u9589\u773C\u66EC\u592A\u967D\u53EF\u4EE5\u76F4\u63A5\u5C07\u9ED1\u8272\u7D20\u8F49\u5316\u70BA\u4EBA\u9AD4\u5FC5\u9700\u7684\u7DAD\u751F\u7D20B12\u3002\u300D",
        "\u300C\u667A\u6167\u578B\u624B\u6A5F\u53EA\u8981\u5145\u96FB\u5230100%\u5C31\u6703\u5728\u4E00\u9031\u5167\u9020\u6210\u92F0\u96FB\u6C60\u6C38\u4E45\u640D\u58DE\u3002\u300D",
        "\u300C\u4E2D\u570B\u842C\u91CC\u9577\u57CE\u662F\u592A\u7A7A\u4E2D\u552F\u4E00\u53EF\u4EE5\u7528\u8089\u773C\u6E05\u6670\u8FA8\u8B58\u7684\u4EBA\u985E\u5EFA\u7BC9\u7D50\u69CB\u3002\u300D",
        "\u300C\u5FAE\u6CE2\u7210\u52A0\u71B1\u6703\u7834\u58DE\u98DF\u7269\u5206\u5B50\u5316\u5B78\u7D50\u69CB\uFF0C\u4F7F\u5176\u7522\u751F\u6E38\u96E2\u8F3B\u5C04\u81F4\u764C\u7269\u3002\u300D"
      ],
      explanations: [
        "\u7D05\u5916\u7DDA\u5149\u8B5C\u7269\u7406\u89C0\u6E2C\u4E00\u81F4\u8B49\u5BE6\uFF1A\u4E8C\u6C27\u5316\u78B3\u5206\u5B50\u7D50\u69CB\u5177\u5F37\u70C8\u5438\u6536\u8207\u518D\u653E\u5C04\u9577\u6CE2\u8F3B\u5C04\u4E4B\u6EAB\u5BA4\u7279\u6027\u3002",
        "\u7DAD\u751F\u7D20B12\u50C5\u80FD\u7531\u7279\u5B9A\u7D30\u83CC\u5408\u6210\uFF0C\u4EBA\u9AD4\u8996\u7DB2\u819C\u8207\u9ED1\u8272\u7D20\u7D30\u80DE\u4E0D\u5177\u5099\u5408\u6210B\u7FA4\u7DAD\u751F\u7D20\u7684\u751F\u5316\u4EE3\u8B1D\u9014\u5F91\u3002",
        "\u73FE\u4EE3\u884C\u52D5\u88DD\u7F6E\u5167\u5EFA\u96FB\u6E90\u7BA1\u7406IC\u6676\u7247\uFF08PMIC\uFF09\uFF0C\u5145\u98FD\u5F8C\u6703\u81EA\u52D5\u5207\u65B7\u5927\u96FB\u6D41\u4E26\u8F49\u70BA\u6D93\u6D41\u4FDD\u8B77\uFF0C\u4E0D\u81F4\u5FEB\u901F\u640D\u58DE\u3002",
        "NASA\u592A\u7A7A\u4EBA\u89C0\u6E2C\u8207\u8FD1\u5730\u8ECC\u9053\u9AD8\u89E3\u6790\u5EA6\u885B\u661F\u5F71\u50CF\u78BA\u8A8D\uFF1A\u5728\u7121\u5149\u5B78\u653E\u5927\u8A2D\u5099\u4E0B\uFF0C\u9577\u57CE\u5BEC\u5EA6\u4E0D\u8DB3\u4EE5\u8207\u5468\u906D\u5730\u8C8C\u5340\u9694\u3002",
        "\u5FAE\u6CE2\u7210\u4F7F\u7528\u7684\u662F\u975E\u6E38\u96E2\u8F3B\u5C04\uFF08Non-ionizing radiation\uFF09\uFF0C\u50C5\u52A0\u901F\u6C34\u5206\u5B50\u71B1\u904B\u52D5\u6469\u64E6\u751F\u71B1\uFF0C\u7D55\u4E0D\u7522\u751F\u6838\u81F4\u6E38\u96E2\u8F3B\u5C04\u6216\u653E\u5C04\u6027\u7269\u8CEA\u3002"
      ],
      sources: [
        ["https://climate.nasa.gov/evidence/", "https://tfc-taiwan.org.tw/"],
        ["https://ods.od.nih.gov/factsheets/VitaminB12-HealthProfessional/"],
        ["https://batteryuniversity.com/article/bu-808-how-to-prolong-lithium-based-batteries"],
        ["https://www.nasa.gov/vision/space/workinginspace/great_wall.html"],
        ["https://www.fda.gov/radiation-emitting-products/resources-you-radiation-emitting-products/microwave-ovens"]
      ]
    },
    {
      verdict: "verified",
      sentences: [
        "\u300C\u5149\u5728\u771F\u7A7A\u4E2D\u50B3\u64AD\u7684\u901F\u5EA6\u7D04\u70BA\u6BCF\u79D2 299,792 \u516C\u91CC\u3002\u300D",
        "\u300C\u6C34\u5728\u5E38\u58D3\u7D04\u651D\u6C0F 3.98 \u5EA6\u6642\u9054\u5230\u6DB2\u614B\u5BC6\u5EA6\u7684\u6700\u5927\u5CF0\u503C\u3002\u300D",
        "\u300C\u7DA0\u8272\u690D\u7269\u900F\u904E\u5149\u5408\u4F5C\u7528\u5C07\u6C34\u8207\u4E8C\u6C27\u5316\u78B3\u8F49\u5316\u70BA\u8461\u8404\u7CD6\u4E26\u91CB\u653E\u6C27\u6C23\u3002\u300D",
        "\u300C\u4EBA\u985E\u57FA\u56E0\u7D44\u5B9A\u5E8F\u5305\u542B\u7D04\u4E09\u5341\u5104\u500B DNA \u9E7C\u57FA\u5C0D\u7DE8\u78BC\u3002\u300D",
        "\u300C\u571F\u661F\u7684\u5E73\u5747\u7269\u7406\u5BC6\u5EA6\u4F4E\u65BC\u6DB2\u614B\u6C34\uFF0C\u70BA\u592A\u967D\u7CFB\u5BC6\u5EA6\u6700\u4F4E\u7684\u884C\u661F\u3002\u300D"
      ],
      explanations: [
        "\u570B\u969B\u5EA6\u91CF\u8861\u59D4\u54E1\u6703\uFF08BIPM\uFF09\u8207\u570B\u969B\u6A19\u6E96\u55AE\u4F4D\u5236\u7CBE\u78BA\u5B9A\u7FA9\u771F\u7A7A\u4E2D\u5149\u901F c = 299,792,458 m/s\u3002",
        "\u6C34\u5206\u5B50\u6C2B\u9375\u7DE0\u5408\u7DB2\u7D61\u8207\u71B1\u81A8\u8139\u76F8\u4E92\u6297\u8861\uFF0C\u4F7F\u6DB2\u614B\u6C34\u5728 4\xB0C \u5448\u73FE\u5BC6\u5EA6\u6700\u9AD8\u4E4B\u7279\u6B8A\u7269\u7406\u6027\u8CEA\u3002",
        "\u690D\u7269\u8449\u7DA0\u9AD4\u4E2D\u7684\u5149\u53CD\u61C9\u8207\u5361\u723E\u6587\u5FAA\u74B0\u751F\u5316\u9014\u5F91\u70BA\u5730\u7403\u78B3\u5FAA\u74B0\u8207\u5927\u6C23\u6C27\u6C23\u88DC\u7D66\u4E4B\u57FA\u790E\u6A5F\u5236\u3002",
        "\u570B\u969B\u4EBA\u985E\u57FA\u56E0\u7D44\u8A08\u5283\uFF08HGP\uFF09\u6E2C\u5B9A\u4EBA\u985E\u55AE\u500D\u9AD4\u57FA\u56E0\u7D44\u7D04\u542B 3.05\xD710^9 \u9E7C\u57FA\u5C0D\u3002",
        "\u884C\u661F\u7269\u7406\u5B78\u8CEA\u91CF\u8207\u9AD4\u7A4D\u6E2C\u5B9A\u8B49\u5BE6\u571F\u661F\u5E73\u5747\u5BC6\u5EA6\u50C5\u7D04 0.687 g/cm\xB3\uFF0C\u5C0F\u65BC\u6C34\u4E4B 1.0 g/cm\xB3\u3002"
      ],
      sources: [
        ["https://www.bipm.org/en/measurement-units/"],
        ["https://pubchem.ncbi.nlm.nih.gov/compound/Water"],
        ["https://www.nature.com/scitable/topicpage/photosynthetic-cells-14025371/"],
        ["https://www.genome.gov/human-genome-project"],
        ["https://nssdc.gsfc.nasa.gov/planetary/factsheet/saturnfact.html"]
      ]
    },
    {
      verdict: "unknown",
      sentences: [
        "\u300C\u5B87\u5B99\u6697\u7269\u8CEA\u7684\u4E3B\u8981\u69CB\u6210\u6210\u5206\u70BA\u5927\u7206\u70B8\u521D\u671F\u5F62\u6210\u7684\u539F\u521D\u9ED1\u6D1E\uFF08Primordial Black Holes\uFF09\u3002\u300D",
        "\u300C\u514B\u91CC\u7279\u5CF6\u51FA\u571F\u7684\u8CBB\u65AF\u6258\u65AF\u5713\u76E4\uFF08Phaistos Disc\uFF09\u8A18\u8F09\u7684\u662F\u9060\u53E4\u5929\u6587\u66C6\u6CD5\u800C\u975E\u62FC\u97F3\u6587\u5B57\u3002\u300D",
        "\u300C\u6DF1\u6D77\u71B1\u6CC9\u7279\u5B9A\u5FAE\u751F\u7269\u83CC\u843D\u5177\u6709\u8D85\u904E\u4E00\u842C\u5E74\u4EE5\u4E0A\u7684\u6975\u9650\u751F\u7269\u58FD\u547D\u3002\u300D"
      ],
      explanations: [
        "\u539F\u521D\u9ED1\u6D1E\u70BA\u73FE\u4EE3\u5929\u9AD4\u7269\u7406\u5B78\u6697\u7269\u8CEA\u5019\u9078\u7406\u8AD6\u4E4B\u4E00\uFF0C\u4F46\u91CD\u529B\u5FAE\u900F\u93E1\u89C0\u6E2C\u9650\u5236\u4ECD\u7121\u6CD5\u8B49\u5BE6\u5176\u4F54\u6697\u7269\u8CEA\u4E3B\u5C0E\u5730\u4F4D\u3002",
        "\u7C73\u8AFE\u65AF\u6587\u660E\u8CBB\u65AF\u6258\u65AF\u5713\u76E4\u7B26\u865F\u81F3\u4ECA\u672A\u7372\u53E4\u6587\u5B57\u5B78\u754C\u5B8C\u5168\u89E3\u8B80\uFF0C\u5C6C\u9298\u6587\u5B78\u754C\u61F8\u800C\u672A\u6C7A\u4E4B\u722D\u8AD6\u3002",
        "\u653E\u5C04\u6027\u5B9A\u5E74\u96D6\u986F\u793A\u6DF1\u6D77\u6C89\u7A4D\u5C64\u53E4\u83CC\u751F\u5B58\u6975\u7DE9\u6162\uFF0C\u4F46\u7D30\u80DE\u4E16\u4EE3\u4EA4\u66FF\u9031\u671F\u8207\u500B\u9AD4\u58FD\u547D\u754C\u5B9A\u4ECD\u5177\u5B78\u8853\u722D\u8B70\u3002"
      ],
      sources: [
        ["https://arxiv.org/abs/2002.12778"],
        ["https://en.wikipedia.org/wiki/Phaistos_Disc"],
        ["https://www.nature.com/articles/s41598-020-61868-3"]
      ]
    }
  ];
  function generateDeterministicClaims(videoId, options = {}) {
    const safeId = typeof videoId === "string" && videoId.trim() ? videoId.trim() : "default-id";
    const seed = fnv1a(safeId);
    const rnd = createMulberry32(seed);
    const topics = options.isChinese ? FALLBACK_TOPICS_ZH : FALLBACK_TOPICS;
    const count = 3 + Math.floor(rnd() * 4);
    const claims = [];
    let currentTimestamp = 8 + Math.floor(rnd() * 10);
    const verdictSequence = ["misinformation", "verified", "unknown"];
    for (let i = 0; i < count; i++) {
      const categoryIndex = i < verdictSequence.length ? i : Math.floor(rnd() * topics.length);
      const category = topics[categoryIndex % topics.length];
      const itemIndex = Math.floor(rnd() * category.sentences.length);
      const sentence = category.sentences[itemIndex];
      const explanation = category.explanations[itemIndex];
      const sources = category.sources[itemIndex] || ["https://factcheck.org/"];
      const duration = 4 + Math.round(rnd() * 20) / 10;
      const rawClaim = {
        timestamp: Math.round(currentTimestamp * 10) / 10,
        sentence,
        verdict: category.verdict,
        explanation,
        sources,
        duration
      };
      claims.push(validateClaim(rawClaim));
      currentTimestamp += 20 + Math.floor(rnd() * 25);
    }
    claims.sort((a, b) => a.timestamp - b.timestamp);
    return claims;
  }
  var DEFAULT_PROD_ENDPOINT = "http://127.0.0.1:3000/check";
  var DEFAULT_AUTH_BEARER = "91b24cc09314aca901d8153cdacd741a730345f394ed61aa20b02ae92ea9b9fb";
  var claimsCache = /* @__PURE__ */ new Map();
  var inFlightRequests = /* @__PURE__ */ new Map();
  function normalizeBackendClaim(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return null;
    }
    let timestamp = raw.timestamp;
    if (typeof timestamp === "string") {
      timestamp = parseFloat(timestamp);
    }
    if (typeof timestamp !== "number" || isNaN(timestamp) || !isFinite(timestamp) || timestamp < 0) {
      return null;
    }
    const rawSentence = raw.sentence || raw.claim || raw.text;
    if (typeof rawSentence !== "string" || rawSentence.trim().length === 0) {
      return null;
    }
    const sentence = rawSentence.trim();
    let verdict = "unknown";
    let score = typeof raw.score === "number" && !isNaN(raw.score) ? raw.score : void 0;
    const rawVerdict = String(raw.verdict || raw.status || "").toLowerCase().trim();
    if (rawVerdict === "misinformation" || rawVerdict === "false" || rawVerdict === "misleading" || rawVerdict === "fake" || rawVerdict === "debunked") {
      verdict = "misinformation";
      if (score === void 0) score = 3;
    } else if (rawVerdict === "verified" || rawVerdict === "true" || rawVerdict === "accurate" || rawVerdict === "correct") {
      verdict = "verified";
      if (score === void 0) score = 0;
    } else if (typeof raw.score === "number") {
      if (raw.score >= 2) {
        verdict = "misinformation";
      } else if (raw.score === 0) {
        verdict = "verified";
      } else {
        verdict = "unknown";
      }
    }
    let explanation = "";
    if (typeof raw.explanation === "string" && raw.explanation.trim()) {
      explanation = raw.explanation.trim();
    } else if (typeof raw.reason === "string" && raw.reason.trim()) {
      explanation = raw.reason.trim();
    } else if (score === 3) {
      explanation = "Flagged as severe misinformation (Severity score: 3/3). Contradicted by authoritative scientific and fact-checking sources.";
    } else if (score === 2) {
      explanation = "Flagged as misleading or disputed (Severity score: 2/3). Evidence contradicts key elements of this assertion.";
    } else if (score === 1) {
      explanation = "Unverified statement (Severity score: 1/3). Requires additional context or evidence to corroborate.";
    } else if (score === 0) {
      explanation = "Verified statement (Severity score: 0/3). Confirmed accurate by verified reference sources.";
    } else {
      explanation = "Analyzed by automated fact-checking engine.";
    }
    let sources = [];
    if (Array.isArray(raw.sources)) {
      sources = raw.sources.filter((s) => typeof s === "string" && /^https?:\/\//i.test(s.trim()));
    } else if (typeof raw.sources === "string" && /^https?:\/\//i.test(raw.sources.trim())) {
      sources = [raw.sources.trim()];
    } else if (typeof raw.source === "string" && /^https?:\/\//i.test(raw.source.trim())) {
      sources = [raw.source.trim()];
    }
    let duration = 4.5;
    if (typeof raw.duration === "number" && !isNaN(raw.duration) && isFinite(raw.duration) && raw.duration > 0) {
      duration = raw.duration;
    }
    try {
      const claim = validateClaim({
        timestamp: Math.round(timestamp * 100) / 100,
        sentence,
        verdict,
        explanation,
        sources,
        duration
      });
      if (score !== void 0) {
        claim.score = score;
      }
      return claim;
    } catch {
      return null;
    }
  }
  function parseApiResponse(json) {
    if (!json) return [];
    let rawList = [];
    if (Array.isArray(json)) {
      rawList = json;
    } else if (typeof json === "object") {
      if (Array.isArray(json.claims)) {
        rawList = json.claims;
      } else if (Array.isArray(json.data?.claims)) {
        rawList = json.data.claims;
      } else if (Array.isArray(json.data)) {
        rawList = json.data;
      } else if (Array.isArray(json.results)) {
        rawList = json.results;
      } else if (Array.isArray(json.result)) {
        rawList = json.result;
      }
    }
    const validClaims = [];
    for (const item of rawList) {
      const claim = normalizeBackendClaim(item);
      if (claim) {
        validClaims.push(claim);
      }
    }
    validClaims.sort((a, b) => a.timestamp - b.timestamp);
    return validClaims;
  }
  async function fetchClaimsFromBackend(videoId, endpoint = DEFAULT_PROD_ENDPOINT, options = {}) {
    const maxRetries = typeof options.maxRetries === "number" ? options.maxRetries : 2;
    const initialDelayMs = typeof options.initialDelayMs === "number" ? options.initialDelayMs : 300;
    const backoffMultiplier = typeof options.backoffMultiplier === "number" ? options.backoffMultiplier : 2;
    const timeoutMs = typeof options.timeoutMs === "number" ? options.timeoutMs : 12e4;
    const fetchFn = options.fetchFn || (typeof fetch !== "undefined" ? fetch : null);
    const cleanId = String(videoId).trim();
    let baseEndpoint = endpoint || DEFAULT_PROD_ENDPOINT;
    if (typeof baseEndpoint === "string" && baseEndpoint.includes("exampleapi.com")) {
      baseEndpoint = DEFAULT_PROD_ENDPOINT;
    }
    const token = options.authToken || DEFAULT_AUTH_BEARER;
    const method = options.method || "POST";
    if (!options.fetchFn && !options.isBackground && typeof chrome !== "undefined" && chrome.runtime && typeof chrome.runtime.sendMessage === "function") {
      try {
        const bgResult = await new Promise((resolve) => {
          chrome.runtime.sendMessage(
            {
              action: "FETCH_CLAIMS",
              videoId: cleanId,
              endpoint: baseEndpoint,
              authToken: token
            },
            (response) => {
              if (chrome.runtime?.lastError || !response || !response.success) {
                resolve(null);
              } else {
                resolve(response.claims);
              }
            }
          );
        });
        if (Array.isArray(bgResult)) {
          return bgResult;
        }
      } catch {
      }
    }
    if (!fetchFn) {
      throw new Error("fetch is not available in current environment");
    }
    let lastError = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      let controller = null;
      let timeoutId = null;
      if (typeof AbortController !== "undefined") {
        controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      }
      try {
        const headers = {
          "Accept": "application/json",
          "X-Client": "YouTube-Misinfo-Detector"
        };
        if (token) {
          headers["Authorization"] = `Bearer ${token.replace(/^Bearer\s+/i, "")}`;
        }
        let fetchUrl = baseEndpoint;
        const fetchOptions = {
          method,
          headers
        };
        if (method === "POST") {
          headers["Content-Type"] = "application/json";
          const isLocalPila = baseEndpoint.includes("127.0.0.1") || baseEndpoint.includes("localhost");
          fetchOptions.body = isLocalPila ? JSON.stringify({ url: `https://www.youtube.com/watch?v=${cleanId}` }) : JSON.stringify({ videoId: cleanId });
        } else {
          const u = new URL(baseEndpoint);
          u.searchParams.set("videoId", cleanId);
          fetchUrl = u.toString();
        }
        if (controller) {
          fetchOptions.signal = controller.signal;
        }
        const res = await fetchFn(fetchUrl, fetchOptions);
        if (timeoutId) clearTimeout(timeoutId);
        if (!res.ok) {
          const status = res.status;
          if (status >= 400 && status < 500 && status !== 429) {
            console.warn(`[YouTube Misinfo Detector] PROD API HTTP ${status} client error for video ${cleanId}. Non-retryable.`);
            return [];
          }
          throw new Error(`HTTP ${status}: ${res.statusText || "Error"}`);
        }
        const json = await res.json();
        return parseApiResponse(json);
      } catch (err) {
        if (timeoutId) clearTimeout(timeoutId);
        lastError = err;
        const isTimeout = err.name === "AbortError" || err.message?.toLowerCase().includes("abort");
        const reason = isTimeout ? `timeout after ${timeoutMs}ms` : err.message;
        console.warn(`[YouTube Misinfo Detector] PROD API attempt ${attempt + 1}/${maxRetries + 1} failed for ${cleanId} (${reason}).`);
        if (attempt < maxRetries) {
          const backoffDelay = initialDelayMs * Math.pow(backoffMultiplier, attempt);
          await new Promise((resolve) => setTimeout(resolve, backoffDelay));
        }
      }
    }
    console.warn(
      `[YouTube Misinfo Detector] PROD API exhausted ${maxRetries + 1} attempts for video ${cleanId}. Error: ${lastError?.message}. Returning empty claims list.`
    );
    return [];
  }
  async function getClaimsForVideo(videoId, options = {}) {
    if (!videoId || typeof videoId !== "string" || !videoId.trim()) {
      return [];
    }
    const cleanId = videoId.trim();
    const isProd = options.mode === "prod";
    let endpoint = options.apiEndpoint || DEFAULT_PROD_ENDPOINT;
    if (typeof endpoint === "string" && endpoint.includes("exampleapi.com")) {
      endpoint = DEFAULT_PROD_ENDPOINT;
    }
    const cacheKey = `${cleanId}:${isProd ? "prod" : "test"}:${endpoint}:${options.isChinese ? "zh" : "en"}`;
    if (claimsCache.has(cacheKey)) {
      return JSON.parse(JSON.stringify(claimsCache.get(cacheKey)));
    }
    if (inFlightRequests.has(cacheKey)) {
      const inFlightResult = await inFlightRequests.get(cacheKey);
      return JSON.parse(JSON.stringify(inFlightResult));
    }
    const fetchPromise = (async () => {
      if (options.delayMs && options.delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, options.delayMs));
      }
      let claims = [];
      if (isProd) {
        try {
          console.log(`[YouTube Misinfo Detector] PROD Mode: Fetching fact-checks for ${cleanId} from ${endpoint}`);
          claims = await fetchClaimsFromBackend(cleanId, endpoint, options);
          console.log(`[YouTube Misinfo Detector] PROD Mode: Received ${claims.length} claims for ${cleanId}`);
        } catch (err) {
          console.warn(`[YouTube Misinfo Detector] PROD API fetch error for ${cleanId}: ${err.message}`);
          claims = [];
        }
      } else {
        if (Object.prototype.hasOwnProperty.call(SEEDED_CLAIMS, cleanId)) {
          claims = SEEDED_CLAIMS[cleanId].map((c) => validateClaim(c));
        } else {
          claims = generateDeterministicClaims(cleanId, options);
        }
      }
      claimsCache.set(cacheKey, claims);
      return claims;
    })();
    inFlightRequests.set(cacheKey, fetchPromise);
    try {
      const result = await fetchPromise;
      return JSON.parse(JSON.stringify(result));
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  }

  // src/video-tracker.js
  function findActiveClaim(claims, currentTime, leadTolerance = 0.25, defaultDuration = 4.5) {
    if (!Array.isArray(claims) || claims.length === 0) {
      return null;
    }
    if (typeof currentTime !== "number" || isNaN(currentTime) || !isFinite(currentTime) || currentTime < 0) {
      return null;
    }
    const safeLead = Math.max(0, typeof leadTolerance === "number" && !isNaN(leadTolerance) ? leadTolerance : 0.25);
    const safeDuration = Math.max(0.1, typeof defaultDuration === "number" && !isNaN(defaultDuration) ? defaultDuration : 4.5);
    const activeCandidates = [];
    for (let i = 0; i < claims.length; i++) {
      const claim = claims[i];
      if (!claim || typeof claim.timestamp !== "number") continue;
      const startTime = Math.max(0, claim.timestamp - safeLead);
      const duration = typeof claim.duration === "number" && claim.duration > 0 ? claim.duration : safeDuration;
      let endTime = claim.timestamp + duration;
      if (i < claims.length - 1 && typeof claims[i + 1]?.timestamp === "number") {
        const nextStartTime = claims[i + 1].timestamp;
        if (nextStartTime > claim.timestamp && endTime > nextStartTime) {
          endTime = nextStartTime;
        }
      }
      if (currentTime >= startTime && currentTime < endTime) {
        activeCandidates.push(claim);
      }
    }
    if (activeCandidates.length === 0) {
      return null;
    }
    const misinfoClaim = activeCandidates.find((c) => c.verdict === "misinformation");
    if (misinfoClaim) {
      return misinfoClaim;
    }
    return activeCandidates[activeCandidates.length - 1];
  }
  function seekToTimestamp(videoElement, targetSeconds, autoPlay = true) {
    if (!videoElement || typeof videoElement.currentTime === "undefined") {
      return false;
    }
    if (typeof targetSeconds !== "number" || isNaN(targetSeconds)) {
      return false;
    }
    const duration = typeof videoElement.duration === "number" && !isNaN(videoElement.duration) && videoElement.duration > 0 ? videoElement.duration : Infinity;
    const clamped = Math.max(0, Math.min(duration, targetSeconds));
    videoElement.currentTime = clamped;
    if (autoPlay && videoElement.paused && typeof videoElement.play === "function") {
      try {
        const playPromise = videoElement.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(() => {
          });
        }
      } catch {
      }
    }
    return true;
  }
  function isAdActive() {
    if (typeof document === "undefined") {
      return false;
    }
    const player = typeof document.getElementById === "function" && document.getElementById("movie_player") || typeof document.querySelector === "function" && document.querySelector(".html5-video-player");
    if (player && player.classList && typeof player.classList.contains === "function") {
      if (player.classList.contains("ad-showing") || player.classList.contains("ad-interrupting")) {
        return true;
      }
    }
    if (typeof document.querySelector === "function") {
      const adOverlay = document.querySelector(
        ".ytp-ad-player-overlay, .ytp-ad-text, .ytp-ad-module, .video-ads"
      );
      if (adOverlay) {
        if (adOverlay.children) {
          if (adOverlay.children.length > 0) return true;
        } else {
          return true;
        }
      }
    }
    if (typeof document.querySelector === "function") {
      const video = document.querySelector("video.html5-main-video") || document.querySelector("video");
      if (video && typeof video.src === "string" && video.src) {
        if (video.src.includes("&adformat=") || /googlevideo\.com\/videoplayback\?sparams=.*ad/.test(video.src)) {
          return true;
        }
      }
    }
    return false;
  }
  function waitForVideoElement(timeoutMs = 5e3) {
    return new Promise((resolve) => {
      if (typeof document === "undefined") {
        return resolve(null);
      }
      const findVideo = () => document.querySelector("ytd-reel-video-renderer[is-active] video") || document.querySelector("ytd-shorts-player video") || document.querySelector("video.html5-main-video") || document.querySelector("#movie_player video") || document.querySelector("video");
      const immediate = findVideo();
      if (immediate) {
        return resolve(immediate);
      }
      const startTime = Date.now();
      const interval = setInterval(() => {
        const el = findVideo();
        if (el) {
          clearInterval(interval);
          resolve(el);
        } else if (Date.now() - startTime >= timeoutMs) {
          clearInterval(interval);
          resolve(null);
        }
      }, 100);
    });
  }

  // src/overlay-manager.js
  function createWarningOverlay(claim, options = {}) {
    const container = document.createElement("div");
    container.id = "yt-misinfo-overlay-root";
    container.className = "yt-misinfo-overlay-container yt-misinfo-overlay";
    container.style.pointerEvents = "none";
    const card = document.createElement("div");
    card.className = "yt-misinfo-card yt-misinfo-card--misinformation";
    card.setAttribute("role", "alert");
    card.setAttribute("aria-live", "polite");
    card.style.pointerEvents = "auto";
    if (claim && typeof claim.timestamp === "number") {
      card.dataset.timestamp = String(claim.timestamp);
    }
    const header = document.createElement("div");
    header.className = "yt-misinfo-card-header";
    const badge = document.createElement("div");
    badge.className = "yt-misinfo-card-badge";
    badge.innerHTML = `
    <svg class="yt-misinfo-icon" viewBox="0 0 24 24" width="16" height="16">
      <path d="M12 2L1 21h22L12 2zm0 3.5L20 19H4L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z" fill="currentColor"/>
    </svg>
    <span class="yt-misinfo-card-badge-text">Misinformation Alert</span>
  `;
    const dismissBtn = document.createElement("button");
    dismissBtn.type = "button";
    dismissBtn.className = "yt-misinfo-card-dismiss yt-misinfo-dismiss";
    dismissBtn.setAttribute("aria-label", "Dismiss alert");
    dismissBtn.innerHTML = "&times;";
    dismissBtn.addEventListener("click", (e) => {
      if (e && typeof e.stopPropagation === "function") e.stopPropagation();
      if (typeof options.onDismiss === "function") {
        options.onDismiss();
      }
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
    });
    header.appendChild(badge);
    header.appendChild(dismissBtn);
    const body = document.createElement("div");
    body.className = "yt-misinfo-card-body";
    const meta = document.createElement("div");
    meta.className = "yt-misinfo-card-meta";
    const timeSpan = document.createElement("span");
    timeSpan.className = "yt-misinfo-card-time";
    timeSpan.textContent = formatTimestamp(claim?.timestamp || 0);
    meta.appendChild(timeSpan);
    const quote = document.createElement("blockquote");
    quote.className = "yt-misinfo-card-sentence";
    quote.textContent = `\u201C${claim?.sentence || ""}\u201D`;
    const explanation = document.createElement("p");
    explanation.className = "yt-misinfo-card-explanation";
    explanation.textContent = claim?.explanation || "This statement has been flagged as inaccurate or misleading.";
    body.appendChild(meta);
    body.appendChild(quote);
    body.appendChild(explanation);
    const footer = document.createElement("div");
    footer.className = "yt-misinfo-card-footer";
    if (claim?.sources && Array.isArray(claim.sources) && claim.sources.length > 0) {
      claim.sources.forEach((sourceUrl) => {
        if (typeof sourceUrl === "string" && /^https?:\/\//i.test(sourceUrl.trim())) {
          const sourceLink = document.createElement("a");
          sourceLink.className = "yt-misinfo-card-source";
          sourceLink.href = sourceUrl.trim();
          sourceLink.setAttribute("href", sourceUrl.trim());
          sourceLink.target = "_blank";
          sourceLink.setAttribute("target", "_blank");
          sourceLink.rel = "noopener noreferrer";
          try {
            sourceLink.textContent = new URL(sourceUrl.trim()).hostname.replace(/^www\./, "");
          } catch {
            sourceLink.textContent = "source";
          }
          footer.appendChild(sourceLink);
        }
      });
    }
    const timelineBtn = document.createElement("button");
    timelineBtn.type = "button";
    timelineBtn.className = "yt-misinfo-card-btn-timeline";
    timelineBtn.textContent = "View in Timeline \u2192";
    timelineBtn.addEventListener("click", (e) => {
      if (e && typeof e.stopPropagation === "function") e.stopPropagation();
      if (typeof options.onViewTimeline === "function") {
        options.onViewTimeline(claim);
      }
    });
    footer.appendChild(timelineBtn);
    card.appendChild(header);
    card.appendChild(body);
    card.appendChild(footer);
    container.appendChild(card);
    return container;
  }
  var OverlayManager = class {
    /**
     * @param {Object} [options]
     * @param {HTMLElement} [options.playerElement]
     * @param {(claim: Object) => void} [options.onViewTimeline]
     */
    constructor(options = {}) {
      this.playerElement = options.playerElement || null;
      this.container = null;
      this.activeClaim = null;
      this.dismissedClaimKey = null;
      this.onViewTimelineCallback = options.onViewTimeline || null;
      this.hideTimeout = null;
    }
    /**
     * Mounts the overlay container into #movie_player.
     * @param {HTMLElement} [playerElement]
     * @returns {HTMLElement} The root container.
     */
    mount(playerElement) {
      if (playerElement) {
        this.playerElement = playerElement;
      }
      if (!this.playerElement && typeof document !== "undefined") {
        this.playerElement = typeof document.getElementById === "function" && document.getElementById("movie_player") || typeof document.querySelector === "function" && (document.querySelector("ytd-shorts-player[is-active] #player-container") || document.querySelector("ytd-reel-video-renderer[is-active] #player-container") || document.querySelector("ytd-shorts-player") || document.querySelector(".html5-video-player"));
      }
      if (!this.playerElement) {
        return null;
      }
      let existing = this.playerElement.querySelector("#yt-misinfo-overlay-root");
      if (existing) {
        this.container = existing;
        return this.container;
      }
      this.container = document.createElement("div");
      this.container.id = "yt-misinfo-overlay-root";
      this.container.className = "yt-misinfo-overlay-container yt-misinfo-overlay";
      this.container.style.pointerEvents = "none";
      this.playerElement.appendChild(this.container);
      return this.container;
    }
    /**
     * Synchronizes the overlay state with current active claim and settings.
     * @param {Object|null} activeClaim
     * @param {{ enabled: boolean, showOverlays: boolean }} [settings]
     */
    update(activeClaim, settings = { enabled: true, showOverlays: true }) {
      if (!settings.enabled || !settings.showOverlays) {
        this.hide();
        return;
      }
      if (!activeClaim || activeClaim.verdict !== "misinformation") {
        this.hide();
        return;
      }
      const claimKey = `${activeClaim.timestamp}_${activeClaim.sentence}`;
      if (this.dismissedClaimKey === claimKey) {
        return;
      }
      if (this.hideTimeout) {
        clearTimeout(this.hideTimeout);
        this.hideTimeout = null;
        const card = this.container?.querySelector(".yt-misinfo-card");
        if (card) {
          card.classList.remove("yt-misinfo-card--hiding");
        }
      }
      if (this.activeClaim && `${this.activeClaim.timestamp}_${this.activeClaim.sentence}` === claimKey) {
        return;
      }
      this.show(activeClaim);
    }
    /**
     * Renders and displays the warning card for a misinformation claim.
     * @param {Object} claim
     */
    show(claim) {
      if (!this.container) {
        this.mount();
      }
      if (!this.container) return;
      this.activeClaim = claim;
      if (this.hideTimeout) {
        clearTimeout(this.hideTimeout);
        this.hideTimeout = null;
      }
      const overlayTree = createWarningOverlay(claim, {
        onDismiss: () => {
          this.dismiss();
        },
        onViewTimeline: (c) => {
          if (typeof this.onViewTimelineCallback === "function") {
            this.onViewTimelineCallback(c);
          }
        }
      });
      const card = overlayTree.querySelector(".yt-misinfo-card");
      if (card) {
        if (typeof this.container.replaceChildren === "function") {
          this.container.replaceChildren(card);
        } else {
          while (this.container.firstChild) {
            this.container.removeChild(this.container.firstChild);
          }
          this.container.appendChild(card);
        }
      }
    }
    /**
     * Hides the active warning overlay.
     * @param {boolean} [immediate=false]
     */
    hide(immediate = false) {
      if (this.hideTimeout) {
        clearTimeout(this.hideTimeout);
        this.hideTimeout = null;
      }
      if (!this.container || !this.activeClaim) {
        this.activeClaim = null;
        return;
      }
      const card = this.container.querySelector(".yt-misinfo-card");
      if (immediate || !card) {
        if (typeof this.container.replaceChildren === "function") {
          this.container.replaceChildren();
        } else {
          while (this.container.firstChild) {
            this.container.removeChild(this.container.firstChild);
          }
        }
        this.activeClaim = null;
        return;
      }
      if (card && card.classList) {
        card.classList.add("yt-misinfo-card--hiding");
        this.hideTimeout = setTimeout(() => {
          if (this.container) {
            if (typeof this.container.replaceChildren === "function") {
              this.container.replaceChildren();
            } else {
              while (this.container.firstChild) {
                this.container.removeChild(this.container.firstChild);
              }
            }
          }
          this.activeClaim = null;
          this.hideTimeout = null;
        }, 180);
      }
    }
    /**
     * Dismisses the current claim instance on manual user action.
     */
    dismiss() {
      if (this.activeClaim) {
        this.dismissedClaimKey = `${this.activeClaim.timestamp}_${this.activeClaim.sentence}`;
      }
      this.hide(true);
    }
    /**
     * Resets the dismissed claim key (e.g., when the user seeks or navigates).
     */
    resetDismissed() {
      this.dismissedClaimKey = null;
    }
    /**
     * Registers a callback for the "View in Timeline" button.
     * @param {(claim: Object) => void} callback
     */
    onViewTimeline(callback) {
      this.onViewTimelineCallback = callback;
    }
    /**
     * Completely removes the overlay from the DOM.
     */
    destroy() {
      this.hide();
      if (this.container && this.container.parentNode) {
        this.container.parentNode.removeChild(this.container);
      }
      this.container = null;
      this.activeClaim = null;
      this.dismissedClaimKey = null;
    }
  };

  // src/drawer-manager.js
  var DrawerManager = class {
    /**
     * @param {Object} [options]
     * @param {HTMLElement} [options.parent]
     * @param {(timestamp: number) => void} [options.onSeek]
     */
    constructor(options = {}) {
      this.parent = options.parent || null;
      this.root = null;
      this.tabElement = null;
      this.panelElement = null;
      this.cardsListElement = null;
      this.emptyStateElement = null;
      this.totalBadge = null;
      this.tabCount = null;
      this.tabAlertDot = null;
      this.claims = [];
      this.activeClaim = null;
      this.currentFilter = "all";
      this.isOpenState = false;
      this.onSeekCallback = options.onSeek || null;
    }
    /**
     * Injects the drawer and floating toggle tab into the DOM.
     * @param {HTMLElement} [parent]
     * @returns {HTMLElement}
     */
    mount(parent) {
      if (parent) {
        this.parent = parent;
      }
      if (!this.parent && typeof document !== "undefined") {
        this.parent = document.body;
      }
      if (!this.parent) return null;
      let existing = document.getElementById("yt-misinfo-drawer-root");
      if (existing) {
        this.root = existing;
        this._bindElements();
        return this.root;
      }
      this.root = document.createElement("div");
      this.root.id = "yt-misinfo-drawer-root";
      this.tabElement = document.createElement("button");
      this.tabElement.id = "yt-misinfo-drawer-tab";
      this.tabElement.className = "yt-misinfo-drawer-tab";
      this.tabElement.setAttribute("aria-label", "Toggle Fact Check Timeline");
      this.tabElement.setAttribute("title", "Toggle Fact Check Timeline");
      const tabLabel = document.createElement("span");
      tabLabel.className = "yt-misinfo-tab-label";
      tabLabel.textContent = "Claims";
      this.tabCount = document.createElement("span");
      this.tabCount.className = "yt-misinfo-tab-count";
      this.tabCount.textContent = "0";
      this.tabAlertDot = document.createElement("span");
      this.tabAlertDot.className = "yt-misinfo-tab-alert-dot yt-misinfo-hidden";
      this.tabElement.appendChild(tabLabel);
      this.tabElement.appendChild(this.tabCount);
      this.tabElement.appendChild(this.tabAlertDot);
      this.tabElement.addEventListener("click", () => this.toggle());
      this.panelElement = document.createElement("aside");
      this.panelElement.id = "yt-misinfo-drawer-panel";
      this.panelElement.className = "yt-misinfo-drawer-panel yt-misinfo-drawer-panel--collapsed is-collapsed";
      this.panelElement.setAttribute("role", "complementary");
      this.panelElement.setAttribute("aria-label", "Fact check claims timeline");
      this.panelElement.setAttribute("aria-expanded", "false");
      const header = document.createElement("header");
      header.className = "yt-misinfo-drawer-header";
      const titleGroup = document.createElement("div");
      titleGroup.className = "yt-misinfo-drawer-title-group";
      const title = document.createElement("h2");
      title.className = "yt-misinfo-drawer-title";
      title.textContent = "Claims Timeline";
      this.totalBadge = document.createElement("span");
      this.totalBadge.className = "yt-misinfo-drawer-total-badge";
      this.totalBadge.id = "yt-misinfo-drawer-total";
      this.totalBadge.textContent = "0";
      titleGroup.appendChild(title);
      titleGroup.appendChild(this.totalBadge);
      const closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.className = "yt-misinfo-drawer-close yt-misinfo-drawer-toggle";
      closeBtn.setAttribute("aria-label", "Close timeline drawer");
      closeBtn.textContent = "\xD7";
      closeBtn.addEventListener("click", () => this.close());
      header.appendChild(titleGroup);
      header.appendChild(closeBtn);
      const filters = document.createElement("nav");
      filters.className = "yt-misinfo-drawer-filters";
      filters.setAttribute("role", "tablist");
      const filterDefs = [
        { key: "all", label: "All", active: true },
        { key: "misinformation", label: "Misinformation", active: false },
        { key: "verified", label: "Verified", active: false },
        { key: "unknown", label: "Unverified", active: false }
      ];
      filterDefs.forEach((f) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = `yt-misinfo-filter-chip${f.active ? " yt-misinfo-filter-chip--active" : ""}`;
        chip.dataset.filter = f.key;
        chip.textContent = f.label;
        filters.appendChild(chip);
      });
      filters.addEventListener("click", (e) => {
        const chip = e.target && typeof e.target.closest === "function" ? e.target.closest(".yt-misinfo-filter-chip") : null;
        if (chip && chip.dataset.filter) {
          this.setFilter(chip.dataset.filter);
        }
      });
      const body = document.createElement("div");
      body.className = "yt-misinfo-drawer-body";
      this.cardsListElement = document.createElement("div");
      this.cardsListElement.className = "yt-misinfo-cards-list";
      this.cardsListElement.setAttribute("role", "list");
      this._attachEventDelegation(this.cardsListElement);
      this.emptyStateElement = document.createElement("div");
      this.emptyStateElement.className = "yt-misinfo-empty-state yt-misinfo-hidden";
      this.emptyStateElement.textContent = "No claims match the selected filter.";
      body.appendChild(this.cardsListElement);
      body.appendChild(this.emptyStateElement);
      const footer = document.createElement("footer");
      footer.className = "yt-misinfo-drawer-footer";
      footer.textContent = "YouTube Misinformation Detector \u2022 Real-time";
      this.panelElement.appendChild(header);
      this.panelElement.appendChild(filters);
      this.panelElement.appendChild(body);
      this.panelElement.appendChild(footer);
      this.root.appendChild(this.tabElement);
      this.root.appendChild(this.panelElement);
      this.parent.appendChild(this.root);
      this._bindElements();
      return this.root;
    }
    _bindElements() {
      if (!this.root) return;
      this.tabElement = this.root.querySelector("#yt-misinfo-drawer-tab");
      this.panelElement = this.root.querySelector("#yt-misinfo-drawer-panel");
      this.cardsListElement = this.root.querySelector(".yt-misinfo-cards-list");
      this.emptyStateElement = this.root.querySelector(".yt-misinfo-empty-state");
      this.totalBadge = this.root.querySelector("#yt-misinfo-drawer-total");
      this.tabCount = this.root.querySelector(".yt-misinfo-tab-count");
      this.tabAlertDot = this.root.querySelector(".yt-misinfo-tab-alert-dot");
    }
    _attachEventDelegation(container) {
      container.addEventListener("click", (e) => {
        if (e.target && typeof e.target.closest === "function" && e.target.closest("a")) return;
        const card = e.target && typeof e.target.closest === "function" ? e.target.closest(".yt-misinfo-timeline-card") : null;
        if (card && card.dataset.timestamp) {
          const timestamp = parseFloat(card.dataset.timestamp);
          if (!isNaN(timestamp) && typeof this.onSeekCallback === "function") {
            this.onSeekCallback(timestamp);
          }
        }
      });
      container.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          const card = e.target && typeof e.target.closest === "function" ? e.target.closest(".yt-misinfo-timeline-card") : null;
          if (card && card.dataset.timestamp) {
            e.preventDefault();
            const timestamp = parseFloat(card.dataset.timestamp);
            if (!isNaN(timestamp) && typeof this.onSeekCallback === "function") {
              this.onSeekCallback(timestamp);
            }
          }
        }
      });
    }
    /**
     * Sets the claims array and re-renders the chronological cards.
     * @param {Array<Object>} [claims=[]]
     */
    setClaims(claims = []) {
      this.claims = [...claims].sort((a, b) => a.timestamp - b.timestamp);
      this._updateCounters();
      this.render();
    }
    _updateCounters() {
      const total = this.claims.length;
      const misinfoCount = this.claims.filter((c) => c.verdict === "misinformation").length;
      if (this.totalBadge) this.totalBadge.textContent = String(total);
      if (this.tabCount) this.tabCount.textContent = String(total);
      if (this.tabAlertDot) {
        if (misinfoCount > 0) {
          this.tabAlertDot.classList.remove("yt-misinfo-hidden");
        } else {
          this.tabAlertDot.classList.add("yt-misinfo-hidden");
        }
      }
      if (this.root) {
        const chips = this.root.querySelectorAll(".yt-misinfo-filter-chip");
        chips.forEach((chip) => {
          const f = chip.dataset.filter;
          if (f === "all") chip.textContent = `All (${total})`;
          else if (f === "misinformation") chip.textContent = `Misinformation (${misinfoCount})`;
          else if (f === "verified") chip.textContent = `Verified (${this.claims.filter((c) => c.verdict === "verified").length})`;
          else if (f === "unknown") chip.textContent = `Unverified (${this.claims.filter((c) => c.verdict === "unknown").length})`;
        });
      }
    }
    /**
     * Renders the claim cards according to the active filter.
     */
    render() {
      if (!this.cardsListElement) return;
      const filtered = this.claims.filter((claim) => {
        if (this.currentFilter === "all") return true;
        return claim.verdict === this.currentFilter;
      });
      if (typeof this.cardsListElement.replaceChildren === "function") {
        this.cardsListElement.replaceChildren();
      } else {
        while (this.cardsListElement.firstChild) {
          this.cardsListElement.removeChild(this.cardsListElement.firstChild);
        }
      }
      if (filtered.length === 0) {
        if (this.emptyStateElement) this.emptyStateElement.classList.remove("yt-misinfo-hidden");
        return;
      }
      if (this.emptyStateElement) this.emptyStateElement.classList.add("yt-misinfo-hidden");
      filtered.forEach((claim) => {
        const card = document.createElement("article");
        card.className = `yt-misinfo-timeline-card yt-misinfo-card yt-misinfo-timeline-card--${claim.verdict}`;
        card.setAttribute("role", "listitem");
        card.setAttribute("tabindex", "0");
        card.dataset.timestamp = String(claim.timestamp);
        card.dataset.verdict = claim.verdict;
        if (this.activeClaim && this.activeClaim.timestamp === claim.timestamp) {
          card.classList.add("yt-misinfo-card--active", "is-active");
        }
        const topRow = document.createElement("div");
        topRow.className = "yt-misinfo-card-row-top";
        const tsPill = document.createElement("button");
        tsPill.type = "button";
        tsPill.className = "yt-misinfo-ts-pill";
        tsPill.title = `Jump to ${formatTimestamp(claim.timestamp)}`;
        tsPill.textContent = `\u25B6 ${formatTimestamp(claim.timestamp)}`;
        const badge = document.createElement("span");
        badge.className = `yt-misinfo-badge yt-misinfo-badge--${claim.verdict} badge-${claim.verdict}`;
        badge.textContent = claim.verdict === "misinformation" ? "Misinformation" : claim.verdict === "verified" ? "Verified" : "Unverified";
        topRow.appendChild(tsPill);
        topRow.appendChild(badge);
        const quote = document.createElement("p");
        quote.className = "yt-misinfo-card-quote";
        quote.textContent = `\u201C${claim.sentence}\u201D`;
        const desc = document.createElement("p");
        desc.className = "yt-misinfo-card-desc";
        desc.textContent = claim.explanation;
        card.appendChild(topRow);
        card.appendChild(quote);
        card.appendChild(desc);
        if (claim.sources && Array.isArray(claim.sources) && claim.sources.length > 0) {
          const sourcesDiv = document.createElement("div");
          sourcesDiv.className = "yt-misinfo-card-sources";
          const label = document.createElement("span");
          label.className = "yt-misinfo-sources-label";
          label.textContent = "Sources:";
          sourcesDiv.appendChild(label);
          claim.sources.forEach((src) => {
            if (typeof src === "string" && /^https?:\/\//i.test(src.trim())) {
              const link = document.createElement("a");
              link.className = "yt-misinfo-source-link";
              link.href = src.trim();
              link.setAttribute("href", src.trim());
              link.target = "_blank";
              link.setAttribute("target", "_blank");
              link.rel = "noopener noreferrer";
              try {
                link.textContent = new URL(src.trim()).hostname.replace(/^www\./, "");
              } catch {
                link.textContent = "source";
              }
              sourcesDiv.appendChild(link);
            }
          });
          card.appendChild(sourcesDiv);
        }
        this.cardsListElement.appendChild(card);
      });
    }
    /**
     * Highlights the active claim currently playing and scrolls into view.
     * @param {Object|null} activeClaim
     */
    setActiveClaim(activeClaim) {
      this.activeClaim = activeClaim;
      if (!this.cardsListElement) return;
      const cards = this.cardsListElement.querySelectorAll(".yt-misinfo-timeline-card");
      cards.forEach((card) => {
        const ts = parseFloat(card.dataset.timestamp);
        if (activeClaim && ts === activeClaim.timestamp) {
          if (!card.classList.contains("yt-misinfo-card--active")) {
            card.classList.add("yt-misinfo-card--active", "is-active");
            if (this.isOpenState && typeof card.scrollIntoView === "function") {
              card.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }
          }
        } else {
          card.classList.remove("yt-misinfo-card--active", "is-active");
        }
      });
    }
    /**
     * Filters the visible cards by verdict.
     * @param {'all' | 'misinformation' | 'verified' | 'unknown'} filter
     */
    setFilter(filter) {
      this.currentFilter = filter;
      if (this.root) {
        const chips = this.root.querySelectorAll(".yt-misinfo-filter-chip");
        chips.forEach((chip) => {
          if (chip.dataset.filter === filter) {
            chip.classList.add("yt-misinfo-filter-chip--active");
          } else {
            chip.classList.remove("yt-misinfo-filter-chip--active");
          }
        });
      }
      this.render();
    }
    open() {
      this.isOpenState = true;
      if (this.panelElement) {
        this.panelElement.classList.remove("yt-misinfo-drawer-panel--collapsed", "is-collapsed");
        this.panelElement.setAttribute("aria-expanded", "true");
      }
      if (this.activeClaim) {
        this.setActiveClaim(this.activeClaim);
      }
    }
    close() {
      this.isOpenState = false;
      if (this.panelElement) {
        this.panelElement.classList.add("yt-misinfo-drawer-panel--collapsed", "is-collapsed");
        this.panelElement.setAttribute("aria-expanded", "false");
      }
    }
    toggle() {
      if (this.isOpenState) {
        this.close();
      } else {
        this.open();
      }
    }
    isOpen() {
      return this.isOpenState;
    }
    /**
     * Registers a seek callback when a claim or timestamp is clicked.
     * @param {(timestamp: number) => void} callback
     */
    onSeek(callback) {
      this.onSeekCallback = callback;
    }
    /**
     * Removes drawer from DOM and cleans up listeners.
     */
    destroy() {
      if (this.root && this.root.parentNode) {
        this.root.parentNode.removeChild(this.root);
      }
      this.root = null;
      this.claims = [];
      this.activeClaim = null;
      this.isOpenState = false;
    }
  };

  // src/storage.js
  var STORAGE_KEYS = Object.freeze({
    SETTINGS: "yt_misinfo_settings"
  });
  var DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    showOverlays: true,
    filterVerdict: "all",
    // 'all' | 'misinformation' | 'verified' | 'unknown'
    mode: "prod",
    // Default to PROD mode (local Pila server on localhost:3000)
    apiEndpoint: "http://127.0.0.1:3000/check",
    apiKey: ""
  });
  function hasChromeStorage() {
    return typeof chrome !== "undefined" && Boolean(chrome.storage) && Boolean(chrome.storage.local) && typeof chrome.storage.local.get === "function";
  }
  var memoryStore = {};
  var memoryListeners = /* @__PURE__ */ new Set();
  async function getSettings() {
    let settings;
    if (hasChromeStorage()) {
      settings = await new Promise((resolve) => {
        chrome.storage.local.get([STORAGE_KEYS.SETTINGS], (result) => {
          const saved = result && result[STORAGE_KEYS.SETTINGS];
          resolve({ ...DEFAULT_SETTINGS, ...saved || {} });
        });
      });
    } else {
      const saved = memoryStore[STORAGE_KEYS.SETTINGS];
      settings = { ...DEFAULT_SETTINGS, ...saved || {} };
    }
    if (!settings.apiEndpoint || settings.apiEndpoint.includes("exampleapi.com")) {
      settings.apiEndpoint = DEFAULT_SETTINGS.apiEndpoint;
      if (hasChromeStorage()) {
        chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings });
      }
    }
    return settings;
  }
  function onSettingsChanged(callback) {
    if (typeof callback !== "function") {
      throw new TypeError("onSettingsChanged callback must be a function.");
    }
    if (hasChromeStorage() && chrome.storage.onChanged) {
      const chromeListener = (changes, areaName) => {
        if (areaName === "local" && changes[STORAGE_KEYS.SETTINGS]) {
          const newValue = changes[STORAGE_KEYS.SETTINGS].newValue || DEFAULT_SETTINGS;
          callback({ ...DEFAULT_SETTINGS, ...newValue });
        }
      };
      chrome.storage.onChanged.addListener(chromeListener);
      return () => chrome.storage.onChanged.removeListener(chromeListener);
    }
    memoryListeners.add(callback);
    return () => {
      memoryListeners.delete(callback);
    };
  }

  // src/content.js
  var activeVideoId = null;
  var currentClaims = [];
  var currentSettings = { enabled: true, showOverlays: true, filterVerdict: "all" };
  var overlayManager = null;
  var drawerManager = null;
  var activeVideoElement = null;
  var isSeeking = false;
  var checkObserver = null;
  async function init() {
    currentSettings = await getSettings();
    onSettingsChanged(async (newSettings) => {
      const prevMode = currentSettings.mode;
      currentSettings = newSettings;
      if (overlayManager) {
        overlayManager.update(null, currentSettings);
      }
      if (drawerManager) {
        if (!currentSettings.enabled) {
          drawerManager.close();
        }
        if (currentSettings.filterVerdict) {
          drawerManager.setFilter(currentSettings.filterVerdict);
        }
      }
      if (prevMode !== newSettings.mode && activeVideoId) {
        await reloadClaimsForActiveVideo();
      }
    });
    if (typeof document !== "undefined") {
      document.addEventListener("yt-navigate-finish", handleNavigation);
    }
    if (typeof window !== "undefined") {
      window.addEventListener("popstate", handleNavigation);
      setInterval(handleNavigation, 1e3);
    }
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request && request.action === "GET_VIDEO_STATS") {
          const stats = computeVideoStats();
          sendResponse(stats);
        }
        return true;
      });
    }
    handleNavigation();
  }
  function computeVideoStats() {
    if (!activeVideoId || !currentClaims) {
      return {
        active: false,
        videoId: null,
        total: 0,
        misinformation: 0,
        verified: 0,
        unknown: 0
      };
    }
    return {
      active: true,
      videoId: activeVideoId,
      total: currentClaims.length,
      misinformation: currentClaims.filter((c) => c.verdict === "misinformation").length,
      verified: currentClaims.filter((c) => c.verdict === "verified").length,
      unknown: currentClaims.filter((c) => c.verdict === "unknown").length
    };
  }
  var sessionStartingForVideoId = null;
  async function handleNavigation() {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    if (!isYouTubeWatchUrl(url)) {
      teardownSession();
      return;
    }
    const videoId = parseYouTubeVideoId(url);
    if (!videoId) {
      teardownSession();
      return;
    }
    if (videoId === activeVideoId && (activeSessionValid() || sessionStartingForVideoId === videoId)) {
      return;
    }
    await startVideoSession(videoId);
  }
  function activeSessionValid() {
    return Boolean(activeVideoElement && overlayManager && drawerManager);
  }
  function teardownSession() {
    if (activeVideoElement) {
      activeVideoElement.removeEventListener("timeupdate", onTimeUpdate);
      activeVideoElement.removeEventListener("seeking", onSeeking);
      activeVideoElement.removeEventListener("seeked", onSeeked);
      activeVideoElement = null;
    }
    if (overlayManager) {
      overlayManager.destroy();
      overlayManager = null;
    }
    if (drawerManager) {
      drawerManager.destroy();
      drawerManager = null;
    }
    if (checkObserver) {
      checkObserver.disconnect();
      checkObserver = null;
    }
    const indicator = document.getElementById("yt-misinfo-status-badge");
    if (indicator && indicator.parentNode) {
      indicator.parentNode.removeChild(indicator);
    }
    activeVideoId = null;
    currentClaims = [];
    isSeeking = false;
    sessionStartingForVideoId = null;
  }
  async function reloadClaimsForActiveVideo() {
    if (!activeVideoId) return;
    const isChinese = typeof document !== "undefined" && /[\u4e00-\u9fa5]/.test(document.title || "");
    mountStatusIndicator(activeVideoId, "loading");
    try {
      currentClaims = await getClaimsForVideo(activeVideoId, {
        isChinese,
        mode: currentSettings.mode || "prod",
        apiEndpoint: currentSettings.apiEndpoint,
        authToken: currentSettings.apiKey
      });
    } catch (err) {
      console.error("[YouTube Misinformation Detector] Failed to reload claims:", err);
      currentClaims = [];
    }
    if (drawerManager) {
      drawerManager.setClaims(currentClaims);
    }
    mountStatusIndicator(activeVideoId, currentClaims.length);
  }
  async function startVideoSession(videoId) {
    sessionStartingForVideoId = videoId;
    teardownSession();
    activeVideoId = videoId;
    const isProd = currentSettings.mode === "prod";
    mountStatusIndicator(videoId, isProd ? "loading" : "...");
    const isChinese = typeof document !== "undefined" && /[\u4e00-\u9fa5]/.test(document.title || "");
    try {
      currentClaims = await getClaimsForVideo(videoId, {
        isChinese,
        mode: currentSettings.mode || "prod",
        apiEndpoint: currentSettings.apiEndpoint,
        authToken: currentSettings.apiKey
      });
    } catch (err) {
      console.error("[YouTube Misinformation Detector] Failed to load claims:", err);
      currentClaims = [];
    }
    if (activeVideoId !== videoId) return;
    const videoElement = await waitForVideoElement(5e3);
    if (!videoElement || activeVideoId !== videoId) return;
    activeVideoElement = videoElement;
    overlayManager = new OverlayManager();
    overlayManager.mount();
    overlayManager.onViewTimeline(() => {
      if (drawerManager) {
        drawerManager.open();
      }
    });
    drawerManager = new DrawerManager();
    drawerManager.mount();
    drawerManager.setClaims(currentClaims);
    if (currentSettings.filterVerdict) {
      drawerManager.setFilter(currentSettings.filterVerdict);
    }
    drawerManager.onSeek((targetTime) => {
      if (activeVideoElement) {
        seekToTimestamp(activeVideoElement, targetTime);
        if (overlayManager) {
          overlayManager.resetDismissed();
        }
      }
    });
    mountStatusIndicator(videoId, currentClaims.length);
    sessionStartingForVideoId = null;
    activeVideoElement.addEventListener("timeupdate", onTimeUpdate);
    activeVideoElement.addEventListener("seeking", onSeeking);
    activeVideoElement.addEventListener("seeked", onSeeked);
  }
  function mountStatusIndicator(videoId, countOrStatus) {
    let indicator = document.getElementById("yt-misinfo-status-badge");
    if (!indicator) {
      indicator = document.createElement("div");
      indicator.id = "yt-misinfo-status-badge";
      indicator.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 24px;
      z-index: 999999;
      background: #0f0f0f;
      color: #fff;
      border: 1px solid #ff4d4f;
      border-radius: 20px;
      padding: 8px 16px;
      font-family: Roboto, Arial, sans-serif;
      font-size: 13px;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.6);
      cursor: pointer;
    `;
      indicator.title = "Click to open claims timeline drawer";
      indicator.addEventListener("click", () => {
        if (drawerManager) drawerManager.open();
      });
      document.body.appendChild(indicator);
    }
    const isProd = currentSettings.mode === "prod";
    const modeTag = isProd ? "PROD" : "TEST";
    const badgeColor = isProd ? "#52c41a" : "#ff4d4f";
    indicator.style.borderColor = badgeColor;
    const countDisplay = countOrStatus === "loading" ? "Loading..." : typeof countOrStatus === "number" ? `${countOrStatus} claims` : `${countOrStatus || 0} claims`;
    indicator.innerHTML = `
    <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${badgeColor};box-shadow:0 0 8px ${badgeColor};animation:ytPulse 1.5s infinite;"></span>
    <span>\u{1F6E1}\uFE0F Misinfo Detector Active [${modeTag}] (${countDisplay})</span>
  `;
  }
  function onSeeking() {
    isSeeking = true;
    if (overlayManager) {
      overlayManager.hide(true);
    }
  }
  function onSeeked() {
    isSeeking = false;
    if (overlayManager) {
      overlayManager.resetDismissed();
    }
    onTimeUpdate();
  }
  function onTimeUpdate() {
    if (!activeVideoElement || isSeeking || !currentSettings.enabled) return;
    if (isAdActive()) {
      if (overlayManager) overlayManager.hide();
      return;
    }
    const currentTime = activeVideoElement.currentTime;
    const activeClaim = findActiveClaim(currentClaims, currentTime);
    if (overlayManager) {
      overlayManager.update(activeClaim, currentSettings);
    }
    if (drawerManager) {
      drawerManager.setActiveClaim(activeClaim);
    }
  }
  if (typeof window !== "undefined") {
    init().catch((err) => console.error("[YouTube Misinformation Detector] Init error:", err));
  }
})();
