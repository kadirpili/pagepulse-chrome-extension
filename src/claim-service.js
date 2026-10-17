/**
 * Claim Data Service.
 * Manages claim schema validation, seeded realistic test datasets,
 * deterministic pseudo-random fallback generation for arbitrary IDs, and cached claim retrieval.
 */

export const VALID_VERDICTS = Object.freeze(['misinformation', 'verified', 'unknown']);

/**
 * Validates a raw claim candidate object against the required schema.
 * Throws a descriptive Error if the object fails validation.
 *
 * @param {unknown} raw - The raw claim candidate object.
 * @returns {Object} The validated and normalized Claim object.
 */
export function validateClaim(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Claim must be a non-null object');
  }

  // 1. Timestamp validation
  if (
    typeof raw.timestamp !== 'number' ||
    isNaN(raw.timestamp) ||
    !isFinite(raw.timestamp) ||
    raw.timestamp < 0
  ) {
    throw new Error('Claim timestamp must be a non-negative finite number');
  }

  // 2. Sentence validation
  if (typeof raw.sentence !== 'string' || raw.sentence.trim().length === 0) {
    throw new Error('Claim sentence must be a non-empty string');
  }

  // 3. Verdict validation
  if (!raw.verdict || !VALID_VERDICTS.includes(raw.verdict)) {
    throw new Error(`Claim verdict must be one of: ${VALID_VERDICTS.join(', ')}`);
  }

  // 4. Explanation validation
  if (typeof raw.explanation !== 'string') {
    throw new Error('Claim explanation must be a string');
  }

  // 5. Sources validation
  if (!Array.isArray(raw.sources)) {
    throw new Error('Claim sources must be an array of strings');
  }
  for (const src of raw.sources) {
    if (typeof src !== 'string') {
      throw new Error('Each source in claim sources must be a string URL');
    }
  }

  // 6. Optional duration validation
  let duration = 4.5;
  if (
    typeof raw.duration === 'number' &&
    !isNaN(raw.duration) &&
    isFinite(raw.duration) &&
    raw.duration > 0
  ) {
    duration = raw.duration;
  }

  return {
    timestamp: Number(raw.timestamp),
    sentence: String(raw.sentence).trim(),
    verdict: raw.verdict,
    explanation: String(raw.explanation).trim(),
    sources: raw.sources.map((s) => String(s).trim()).filter(Boolean),
    duration: duration
  };
}

/**
 * Seeded mock datasets for prominent demonstration and test video IDs.
 */
export const SEEDED_CLAIMS = {
  // Rick Astley - Never Gonna Give You Up (Standard Demo ID)
  dQw4w9WgXcQ: [
    {
      timestamp: 12.0,
      sentence: 'This song was completely improvised in a single take without prior rehearsal.',
      verdict: 'misinformation',
      explanation:
        'The track was meticulously written, arranged, and produced by Stock Aitken Waterman over several weeks at PWL Studios in London.',
      sources: [
        'https://www.factcheck.org/2021/music-history-pwl',
        'https://en.wikipedia.org/wiki/Never_Gonna_Give_You_Up'
      ],
      duration: 4.5
    },
    {
      timestamp: 42.5,
      sentence: 'Never Gonna Give You Up reached number one in 25 countries upon its release in 1987.',
      verdict: 'verified',
      explanation:
        'Official international music record charts confirm the single topped charts in 25 countries worldwide including the UK, US, and Australia.',
      sources: ['https://www.billboard.com/charts/hot-100/1988-03-12'],
      duration: 5.0
    },
    {
      timestamp: 88.0,
      sentence: 'The music video was shot on a multi-million dollar film soundstage in Hollywood.',
      verdict: 'misinformation',
      explanation:
        'The video was directed by Simon West on a shoestring budget of under £3,000 near London Battersea District.',
      sources: ['https://apnews.com/article/fact-check-astley-video-production'],
      duration: 4.5
    },
    {
      timestamp: 135.0,
      sentence: 'Rick Astley originally declined to record the vocal track until persuaded by Pete Waterman.',
      verdict: 'unknown',
      explanation:
        'Historical accounts from studio engineers and producers differ on whether Astley was initially hesitant or eager to record.',
      sources: ['https://www.reuters.com/fact-check/pwl-studios-retrospective'],
      duration: 4.0
    }
  ],

  // Me at the zoo (First YouTube Video)
  jNQXAC9IVRw: [
    {
      timestamp: 3.0,
      sentence: 'Elephants have the longest trunks of any terrestrial mammal on Earth.',
      verdict: 'verified',
      explanation:
        'Biological taxonomies confirm that proboscideans possess the largest and longest muscular proboscis among all land mammals.',
      sources: ['https://nationalzoo.si.edu/animals/asian-elephant'],
      duration: 4.0
    },
    {
      timestamp: 9.5,
      sentence: 'The San Diego Zoo currently houses over two million individual elephants.',
      verdict: 'misinformation',
      explanation:
        'The total worldwide population of wild and captive elephants is under 500,000. The San Diego Zoo hosts a small herd of fewer than a dozen.',
      sources: ['https://sandiegozoowildlifealliance.org/animals/elephant'],
      duration: 4.5
    },
    {
      timestamp: 15.0,
      sentence: 'Elephants communicate over long distances using low-frequency infrasound.',
      verdict: 'verified',
      explanation:
        'Bioacoustic field studies demonstrate elephants emit infrasonic rumbles between 14-24 Hz that travel several kilometers.',
      sources: ['https://www.scientificamerican.com/article/how-elephants-communicate/'],
      duration: 4.0
    }
  ],

  // Dedicated Misinformation Demo ID
  'demo-misinfo-1': [
    {
      timestamp: 5.0,
      sentence: 'Drinking distilled seawater can cure viral respiratory infections within 24 hours.',
      verdict: 'misinformation',
      explanation:
        'World Health Organization and medical authorities explicitly warn that drinking saline seawater induces severe dehydration and exhibits zero antiviral properties.',
      sources: [
        'https://www.who.int/emergencies/diseases/novel-coronavirus-2019/advice-for-public/myth-busters',
        'https://www.cdc.gov/healthywater/drinking/travel/desalination.html'
      ],
      duration: 5.0
    },
    {
      timestamp: 22.0,
      sentence: 'Hand hygiene with regular soap and water significantly reduces viral pathogen transmission.',
      verdict: 'verified',
      explanation:
        'Peer-reviewed epidemiological investigations show soap molecules disrupt viral lipid bilayer membranes and detach pathogens from skin.',
      sources: ['https://www.cdc.gov/handwashing/why-handwashing.html'],
      duration: 4.5
    },
    {
      timestamp: 48.0,
      sentence: 'Certain rare herbs found only in high-altitude mountain caves provide complete lifelong immunity.',
      verdict: 'unknown',
      explanation:
        'While isolated phytochemical compounds are studied for immunomodulation, there is insufficient clinical evidence to substantiate claims of complete lifelong immunity.',
      sources: ['https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7158392/'],
      duration: 5.0
    }
  ],

  // YouTube IFrame API Official Demo ID
  'M7lc1UVf-VE': [
    {
      timestamp: 10.0,
      sentence: 'JavaScript was invented in 1995 in ten days by Brendan Eich at Netscape.',
      verdict: 'verified',
      explanation:
        'Documented computing history confirms Mocha (subsequently renamed LiveScript and JavaScript) was created by Brendan Eich in May 1995.',
      sources: ['https://www.w3.org/community/webed/wiki/A_Short_History_of_JavaScript'],
      duration: 4.5
    },
    {
      timestamp: 35.0,
      sentence: 'HTML is a Turing-complete functional programming language.',
      verdict: 'misinformation',
      explanation:
        'HTML (HyperText Markup Language) is a declarative markup specification for document structuring, not a Turing-complete programming language.',
      sources: ['https://developer.mozilla.org/en-US/docs/Learn/HTML/Introduction_to_HTML'],
      duration: 4.5
    }
  ],

  // AI-generated fake doctor investigation (三立新聞台 - 新聞深一度)
  RPntCzNp1QU: [
    {
      timestamp: 8.0,
      sentence: '「五年的成功率可以達到 70% 到 80%」— 網路流傳 AI 假醫師影片宣稱特定偏方或非正規植牙技術有極高成功率。',
      verdict: 'misinformation',
      explanation:
        '衛福部與醫界專科醫師嚴正駁斥：正規醫學臨床必須經由實體診斷與嚴謹評估，網傳影片係不肖集團利用 AI 數字人捏造虛假數據，誘騙民眾購買劣質產品或進行未核准療程。',
      sources: [
        'https://tfc-taiwan.org.tw/articles/report-ai-fake-doctor',
        'https://www.mohw.gov.tw/cp-16-75482-1.html'
      ],
      duration: 6.0
    },
    {
      timestamp: 32.0,
      sentence: '「軟骨磨損越嚴重，只要吃這種配方就能完全再生骨骼關節」— AI 影片宣稱骨質與軟骨可單靠不明口服配方完全逆轉。',
      verdict: 'misinformation',
      explanation:
        '骨科專科醫學會指出，重度退化性關節炎軟骨磨損屬不可逆結構退化，任何宣稱單靠特定保健品「完全長回軟骨」皆為誇大不實假訊息。',
      sources: [
        'https://www.setn.com/News.aspx?NewsID=1418902',
        'https://mygopen.com/2024/ai-cartilage-cure.html'
      ],
      duration: 6.5
    },
    {
      timestamp: 75.0,
      sentence: '「影片中的名醫經查證為盜用正牌醫師肖像，或透過 Deepfake 生成之虛擬人物。」',
      verdict: 'verified',
      explanation:
        '事實查核中心及各大醫學中心（包括台大、北榮）多次發布聲明，證實網路多起宣稱名醫代言之養生影片係遭到深偽變臉或完全冒名。',
      sources: [
        'https://tfc-taiwan.org.tw/topic/deepfake-health-scams',
        'https://www.cna.com.tw/news/ahel/202403150218.aspx'
      ],
      duration: 5.5
    },
    {
      timestamp: 125.0,
      sentence: '「網路社群演算法是否全面具備自動過濾 AI 假醫療影片之機制？」',
      verdict: 'unknown',
      explanation:
        '各大社群平台目前主要結合數位浮水印政策與人工檢舉審查，但在面對生成式 AI 每日海量變種影片時，全自動即時攔截防線之涵蓋率仍未達完全覆蓋。',
      sources: [
        'https://www.statnews.com/2024/02/ai-generated-medical-misinformation-platforms/',
        'https://www.who.int/news/item/18-01-2024-ethics-and-governance-of-artificial-intelligence-for-health'
      ],
      duration: 6.0
    },
    {
      timestamp: 170.0,
      sentence: '「民眾接收健康醫療訊息時，應至衛福部醫事查詢系統或各大教學醫院官網求證。」',
      verdict: 'verified',
      explanation:
        '衛福部醫事機構及醫事人員查詢系統可即時查詢合法執業資格，為防範假醫師與幽靈診所最權威之官方查驗管道。',
      sources: [
        'https://ma.mohw.gov.tw/masearch/',
        'https://www.cda.org.tw/'
      ],
      duration: 5.0
    }
  ],

  // 我們真的需要核能嗎？：楊斯棓 at TEDxTaipei 2013
  // 我們真的需要核能嗎？：楊斯棓 at TEDxTaipei 2013
  '7wFWgopJP5Q': [
    {
      timestamp: 45.0,
      sentence: '「澳洲擁有全世界最豐富的鈾礦儲量，但澳洲國內卻堅持一座核能發電廠都沒有蓋。」',
      verdict: 'verified',
      explanation:
        '世界核能協會（WNA）與澳洲地球科學局數據證實：澳洲擁有全球約三分之一可採鈾礦資源，為主要出口國，但自1998年通過《輻射保護與核安全法》後立法禁止國內核能發電。',
      sources: [
        'https://world-nuclear.org/information-library/country-profiles/countries-a-f/australia.aspx',
        'https://www.ga.gov.au/scientific-topics/minerals/mineral-resources/uranium'
      ],
      duration: 6.0
    },
    {
      timestamp: 320.0,
      sentence: '「法國電力公司長年因核電廠龐大興建成本與維護負債累累，法國民眾民調已壓倒性反對核電。」',
      verdict: 'misinformation',
      explanation:
        '法國電力公社（EDF）雖面臨財務與反應爐維修成本壓力，但法國主流獨立民調（如 IFOP、Odoxa）常態顯示約 60% 至 75% 法國公民支持維持核能發電以保障國家低碳能源自主與電價穩定。',
      sources: [
        'https://www.world-nuclear-news.org/Articles/Poll-reveals-strong-support-for-nuclear-in-France',
        'https://www.iaea.org/bulletin/frances-nuclear-energy-future'
      ],
      duration: 7.0
    },
    {
      timestamp: 540.0,
      sentence: '「高階核廢料至今在全球尚無任何一座已投入運轉之永久深地質最終處置場。」',
      verdict: 'verified',
      explanation:
        '在 2013-2023 年間，全球高階核廢料多以乾式貯存或水池冷卻暫存。芬蘭翁卡洛（Onkalo）永久深地質處置庫於 2024 年後才逐步取得運轉執照，為全球第一座具體即將營運之高階最終處置場。',
      sources: [
        'https://www.posiva.fi/en/index/finaldisposal/onkalo.html',
        'https://www.iaea.org/newscenter/news/finlands-deep-geological-repository'
      ],
      duration: 6.0
    },
    {
      timestamp: 574.0,
      sentence: '「世界上只有台灣把核電廠蓋在距離首都人口密集核心區三十公里範圍內。」(09:34–09:39)',
      verdict: 'misinformation',
      explanation:
        '瑞士米勒貝格核電廠（Mühleberg Nuclear Power Plant）距離首都伯恩（Bern）市中心僅約 14 公里，自 1972 年運轉至 2019 年底（此演講發表時仍在正式商轉中）。此外加拿大皮克靈核電廠距多倫多市中心約 30 公里，台灣並非全球唯一首都圈核電案例。',
      sources: [
        'https://www.bkw.ch/fileadmin/user_upload/03_Energie/03_05_Energieproduktion/Stilllegung_Kernkraftwerk_Muehleberg/Teilbericht_2_-_Umweltvertraeglichkeitsbericht_v1.0.pdf',
        'https://pris.iaea.org/pris/countrystatistics/countryoverview.aspx?sysType=PRIS'
      ],
      duration: 7.0
    },
    {
      timestamp: 750.0,
      sentence: '「台灣未來的電力供應能否完全依賴再生能源並在無核狀態下維持零缺電零跳電？」',
      verdict: 'unknown',
      explanation:
        '能源經濟學界與電力工程專家對台灣綠能建置進度、電網儲能容量、備轉容量率及天然氣接卸韌性看法分歧，屬具高度政策思辨與未定論之系統性論證。',
      sources: [
        'https://www.moea.gov.tw/MNS/populace/news/News.aspx',
        'https://www.irena.org/Publications/2023/Renewable-Power-Generation-Costs'
      ],
      duration: 6.5
    }
  ],

  // 三星堆文明突然消亡的謎底，與全球青銅文明的神秘集體消失 (文昭思緒飛揚)
  TGUeqcBXy_A: [
    {
      timestamp: 55.0,
      sentence: '「三星堆古蜀國文明在商周之際完全滅絕，所有居民與文化無影無蹤地蒸發消失。」',
      verdict: 'misinformation',
      explanation:
        '現代田野考古證實：四川省文物考古研究院於成都市區發掘的金沙遺址與十二橋文化，在青銅器鑄造、玉器形制及黃金面具工藝上皆與三星堆呈現明確繼承關係，古蜀國重心係因河流改道或環境變遷遷徙至金沙，並非神秘蒸發。',
      sources: [
        'http://www.jinshasitemuseum.com/research/discovery',
        'https://www.kaogu.cn/cn/kaoguxinwen/2021/0320/71120.html'
      ],
      duration: 6.5
    },
    {
      timestamp: 160.0,
      sentence: '「約在西元前 1200 年前後，東地中海與近東地區多個青銅文明經歷了劇烈的青銅時代晚期崩潰（Late Bronze Age Collapse）。」',
      verdict: 'verified',
      explanation:
        '歷史學與古環境學界普遍公認：邁錫尼文明、西臺帝國、黎凡特諸城邦及埃及新王國在西元前 1200 年前後遭受乾旱、地震風暴、海上民族入侵及貿易網絡斷裂等多重危機衝擊，史稱「晚期青銅時代崩潰」。',
      sources: [
        'https://www.worldhistory.org/Bronze_Age_Collapse/',
        'https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0071004'
      ],
      duration: 6.0
    },
    {
      timestamp: 330.0,
      sentence: '「三星堆與美索不達米亞及地中海青銅文明的衰落是由同一次全球性超自然災異引發。」',
      verdict: 'unknown',
      explanation:
        '古氣候學雖偵測到約西元前4.2千年（4.2 ka event）及西元前3.2千年廣泛乾旱期，但三星堆祭祀坑填埋年代跨度自商晚期至西周早期（約前1200-前1000年），古蜀國與地中海相隔數千公里，其衰落因果關聯屬未有確切考古定論之假說。',
      sources: [
        'https://www.science.org/doi/10.1126/science.1186457',
        'https://www.nature.com/articles/nature12431'
      ],
      duration: 7.0
    },
    {
      timestamp: 520.0,
      sentence: '「三星堆出土的青銅縱目面具與青銅神樹證明古蜀人屬於地外文明或外星混血族群。」',
      verdict: 'misinformation',
      explanation:
        '考古發掘人骨古 DNA 測定與分子人類學研究表明，古蜀人群遺傳背景與黃河中上游古中原人群高度同源；縱目誇張造型係《華陽國志》記載古蜀始祖「蠶叢縱目」的神格化圖騰崇拜與祭祀禮器象徵，無外星人干預證據。',
      sources: [
        'https://www.cell.com/molecular-plant/fulltext/S1674-2052(20)30449-7',
        'https://tfc-taiwan.org.tw/articles/sanxingdui-alien-myths'
      ],
      duration: 6.5
    },
    {
      timestamp: 638.0,
      sentence: '「銅礦石單獨冶煉出來就是黃銅，而青銅是用黃銅加上大約十分之一的錫混合製成的。」(10:38–10:50)',
      verdict: 'misinformation',
      explanation:
        '冶金化學與材料科學基礎事實：天然純銅礦石冶煉得到的是純銅（紅銅）。黃銅（Brass）是銅與「鋅（Zinc）」的合金；而青銅（Bronze）是銅與「錫（Tin）」的合金。純銅、黃銅與青銅為完全不同的金屬材料，青銅絕非由黃銅加錫混合製成。',
      sources: [
        'https://periodic-table.rsc.org/element/29/copper',
        'https://www.copper.org/resources/properties/atomic_structure.html'
      ],
      duration: 7.0
    },
    {
      timestamp: 700.0,
      sentence: '「三星堆遺址發掘出大量海貝與象牙，證明古蜀王國具備跨區域遠程貿易與文化交流網絡。」',
      verdict: 'verified',
      explanation:
        '四川三星堆一至八號祭祀坑累計出土數千枚齒貝（印度洋貨貝）及數百根亞洲象牙，同位素分析證實古蜀國透過南方絲綢之路與南亞次大陸及中原商王朝保持活躍物資流通。',
      sources: [
        'https://www.kaogu.cn/cn/kaoguxinwen/2021/0910/72880.html',
        'https://en.unesco.org/silkroad/content/sanxingdui-site'
      ],
      duration: 6.0
    }
  ],

  // 《聖經》大洪水記載遺漏的起因補上了；實錘證據有了 (文昭思緒飛揚)
  BSI8oxcQFfw: [
    {
      timestamp: 45.0,
      sentence: '「全世界各大洲主要古代文明（美索不達米亞、美洲印第安、古印度及華夏）的神話文獻中均有毀滅性大洪水記憶。」',
      verdict: 'verified',
      explanation:
        '比較神話學與民俗學研究（如詹姆斯·弗雷澤《舊約中的民俗》）證實：包括蘇美爾《吉爾伽美什史詩》、印度《百道梵書》摩奴救世、馬雅《波波爾·烏》及中國大禹治水等數百個神話均記錄了遠古洪水浩劫。',
      sources: [
        'https://www.britannica.com/topic/flood-myth',
        'https://www.oxfordbibliographies.com/view/document/obo-9780195396577/obo-9780195396577-0130.xml'
      ],
      duration: 6.5
    },
    {
      timestamp: 150.0,
      sentence: '「《聖經·創世記》遺漏了大洪水起因，直到近現代死海古卷《以諾書》才補全巨人與墮落天使的完整因果。」',
      verdict: 'unknown',
      explanation:
        '《創世記》第六章已提及「偉人（Nephilim）」與人道德敗壞；次經《以諾書》（1 Enoch）確在衣索比亞正統教會及昆蘭死海古卷中擴充守望者天使與巨人情節，但主流猶太教拉比與天主教/基督新教視其為偽經（Apocrypha/Pseudepigrapha），非正典遺漏。',
      sources: [
        'https://www.deadseascrolls.org.il/featured-scrolls/the-enoch-scrolls',
        'https://bibleinterp.arizona.edu/articles/enoch-and-genesis'
      ],
      duration: 7.0
    },
    {
      timestamp: 310.0,
      sentence: '「地質學界已經找到完全覆蓋地球所有大陸與高山的單一全球性大洪水實錘地質證據。」',
      verdict: 'misinformation',
      explanation:
        '地質學、沈積學及冰川學界透過全球岩層與南極/格陵蘭數十萬年冰芯鑽探證實：地質歷史上不存在同一時間點淹沒全球最高海拔的單一全球性大洪水；洪水傳說源自末次冰期結束後（約1.4萬-8000年前）各大陸海平面急升與黑海/波斯灣等區域性巨大海侵事件。',
      sources: [
        'https://www.geosociety.org/gsatoday/archive/22/6/article/i1052-5173-22-6-4.htm',
        'https://www.talkorigins.org/faqs/fl-geology.html'
      ],
      duration: 7.5
    },
    {
      timestamp: 626.0,
      sentence: '「格陵蘭海華沙彗星撞擊觸發了新仙女木時期全球浩劫，成為形成美國斯卡布蘭（Channeled Scablands）特大洪水的實錘起因。」(10:26–10:48)',
      verdict: 'misinformation',
      explanation:
        '地質年代學明確否定此因果關係：美國地質調查局（USGS）與第四紀地質學研究確認，斯卡布蘭洪泛地貌係由米蘇拉冰川湖（Glacial Lake Missoula）冰壩潰決引起，發生在距今約 19,000 至 15,000 年前；而新仙女木撞擊假說年代為約 12,900 年前，且海華沙隕石坑定年為 5800 萬年前，年代完全錯置無法契合。',
      sources: [
        'https://www.usgs.gov/publications/megafloods-and-clovis-cache-wenatchee-washington',
        'https://www.science.org/doi/10.1126/sciadv.abm2434'
      ],
      duration: 7.5
    },
    {
      timestamp: 690.0,
      sentence: '「黑海大洪水假說（Black Sea deluge hypothesis）認為地中海海水在約西元前5600年衝破博斯普魯斯海峽灌入黑海淡水湖。」',
      verdict: 'verified',
      explanation:
        '哥倫比亞大學海洋地質學家威廉·萊恩（William Ryan）與瓦爾特·皮特曼（Walter Pitman）於 1997 年提出並由海洋沈積物與貝類碳14定年佐證，黑海在末次冰消期後經歷巨大突發性海水注入，為古代大洪水記憶的有力區域地質候選事件。',
      sources: [
        'https://www.sciencedirect.com/science/article/pii/S002532270300098X',
        'https://www.smithsonianmag.com/science-nature/evidence-for-a-flood-102813110/'
      ],
      duration: 6.5
    }
  ]
};

/**
 * 32-bit FNV-1a string hashing function.
 *
 * @param {string} str
 * @returns {number} 32-bit unsigned integer hash.
 */
function fnv1a(str) {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Mulberry32 32-bit pseudo-random number generator.
 * Highly uniform, deterministic, and fast.
 *
 * @param {number} seed - Unsigned 32-bit integer.
 * @returns {() => number} Returns float in [0, 1).
 */
function createMulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic sentence topic templates for fallback generation.
 */
const FALLBACK_TOPICS = [
  {
    verdict: 'misinformation',
    sentences: [
      'Global atmospheric carbon dioxide has no measurable greenhouse heat-trapping effect.',
      'Sunlight exposure to closed eyelids converts melanin directly into vitamin B12.',
      'Charging smartphones to 100% permanently damages lithium batteries within one week.',
      'The Great Wall of China is clearly visible from low Earth orbit with the unaided naked eye.',
      'Microwave ovens alter food molecular chemistry into radioactive carcinogens.'
    ],
    explanations: [
      'Spectroscopic physics measurements consistently demonstrate CO2 absorbs and re-emits infrared radiation.',
      'Vitamin B12 is synthesized exclusively by bacteria; photoreceptors have no biochemical pathway to synthesize B-vitamins.',
      'Modern smartphones utilize battery management circuits that throttle voltage and prevent overcharging.',
      'NASA astronaut observations and satellite imagery confirm the Great Wall is indistinguishable from surrounding terrain without optical magnification.',
      'Microwaves utilize non-ionizing radiation that causes thermal excitation of water molecules without ionizing atomic nuclei.'
    ],
    sources: [
      ['https://climate.nasa.gov/evidence/', 'https://www.ipcc.ch/report/ar6/wg1/'],
      ['https://ods.od.nih.gov/factsheets/VitaminB12-HealthProfessional/'],
      ['https://batteryuniversity.com/article/bu-808-how-to-prolong-lithium-based-batteries'],
      ['https://www.nasa.gov/vision/space/workinginspace/great_wall.html'],
      ['https://www.fda.gov/radiation-emitting-products/resources-you-radiation-emitting-products/microwave-ovens']
    ]
  },
  {
    verdict: 'verified',
    sentences: [
      'The speed of light in a vacuum is approximately 299,792 kilometers per second.',
      'Water reaches its maximum density in liquid state at approximately 3.98 degrees Celsius.',
      'Photosynthesis in green plants converts water and carbon dioxide into glucose and oxygen.',
      'The human genome contains roughly three billion base pairs of DNA.',
      'Saturn has a lower average density than liquid water.'
    ],
    explanations: [
      'Standard SI international metrology defines c = 299,792,458 m/s exactly.',
      'Thermal expansion and hydrogen-bonding lattice structure account for the density peak of liquid water at 4°C.',
      'Biochemical analysis of chloroplast chlorophyll reactions validates the standard photosynthetic equation.',
      'The Human Genome Project confirmed the diploid human genome spans approximately 3.1 billion base pairs.',
      'Astrophysical density models show Saturn mean density is ~0.687 g/cm³, lower than water at 1.0 g/cm³.'
    ],
    sources: [
      ['https://physics.nist.gov/cgi-bin/cuu/Value?c'],
      ['https://water.usgs.gov/edu/density.html'],
      ['https://www.khanacademy.org/science/biology/photosynthesis-in-plants'],
      ['https://www.genome.gov/human-genome-project'],
      ['https://nssdc.gsfc.nasa.gov/planetary/factsheet/saturnfact.html']
    ]
  },
  {
    verdict: 'unknown',
    sentences: [
      'Dark matter consists predominantly of primordial black holes formed during the Big Bang.',
      'The Phaistos Disc represents an ancient astronomical calendar rather than a written script.',
      'Certain deep-sea hydrothermal organisms possess a biological lifespan exceeding ten millennia.'
    ],
    explanations: [
      'While primordial black holes remain an active candidate for dark matter, observational microlensing constraints leave the hypothesis unconfirmed.',
      'The script and pictograms on the Minoan Phaistos Disc remain undeciphered and subject to debate among epigraphers.',
      'Radiometric dating of deep benthic colonies suggests extreme longevity, but continuous generational cellular replacement is difficult to quantify.'
    ],
    sources: [
      ['https://arxiv.org/abs/2002.12778'],
      ['https://en.wikipedia.org/wiki/Phaistos_Disc'],
      ['https://www.nature.com/articles/s41598-020-61868-3']
    ]
  }
];

/**
 * Deterministic Chinese sentence topic templates for Chinese video fallbacks.
 */
export const FALLBACK_TOPICS_ZH = [
  {
    verdict: 'misinformation',
    sentences: [
      '「大氣中的二氧化碳增加對全球氣溫沒有任何可測量的溫室保溫效應。」',
      '「閉眼曬太陽可以直接將黑色素轉化為人體必需的維生素B12。」',
      '「智慧型手機只要充電到100%就會在一週內造成鋰電池永久損壞。」',
      '「中國萬里長城是太空中唯一可以用肉眼清晰辨識的人類建築結構。」',
      '「微波爐加熱會破壞食物分子化學結構，使其產生游離輻射致癌物。」'
    ],
    explanations: [
      '紅外線光譜物理觀測一致證實：二氧化碳分子結構具強烈吸收與再放射長波輻射之溫室特性。',
      '維生素B12僅能由特定細菌合成，人體視網膜與黑色素細胞不具備合成B群維生素的生化代謝途徑。',
      '現代行動裝置內建電源管理IC晶片（PMIC），充飽後會自動切斷大電流並轉為涓流保護，不致快速損壞。',
      'NASA太空人觀測與近地軌道高解析度衛星影像確認：在無光學放大設備下，長城寬度不足以與周遭地貌區隔。',
      '微波爐使用的是非游離輻射（Non-ionizing radiation），僅加速水分子熱運動摩擦生熱，絕不產生核致游離輻射或放射性物質。'
    ],
    sources: [
      ['https://climate.nasa.gov/evidence/', 'https://tfc-taiwan.org.tw/'],
      ['https://ods.od.nih.gov/factsheets/VitaminB12-HealthProfessional/'],
      ['https://batteryuniversity.com/article/bu-808-how-to-prolong-lithium-based-batteries'],
      ['https://www.nasa.gov/vision/space/workinginspace/great_wall.html'],
      ['https://www.fda.gov/radiation-emitting-products/resources-you-radiation-emitting-products/microwave-ovens']
    ]
  },
  {
    verdict: 'verified',
    sentences: [
      '「光在真空中傳播的速度約為每秒 299,792 公里。」',
      '「水在常壓約攝氏 3.98 度時達到液態密度的最大峰值。」',
      '「綠色植物透過光合作用將水與二氧化碳轉化為葡萄糖並釋放氧氣。」',
      '「人類基因組定序包含約三十億個 DNA 鹼基對編碼。」',
      '「土星的平均物理密度低於液態水，為太陽系密度最低的行星。」'
    ],
    explanations: [
      '國際度量衡委員會（BIPM）與國際標準單位制精確定義真空中光速 c = 299,792,458 m/s。',
      '水分子氫鍵締合網絡與熱膨脹相互抗衡，使液態水在 4°C 呈現密度最高之特殊物理性質。',
      '植物葉綠體中的光反應與卡爾文循環生化途徑為地球碳循環與大氣氧氣補給之基礎機制。',
      '國際人類基因組計劃（HGP）測定人類單倍體基因組約含 3.05×10^9 鹼基對。',
      '行星物理學質量與體積測定證實土星平均密度僅約 0.687 g/cm³，小於水之 1.0 g/cm³。'
    ],
    sources: [
      ['https://www.bipm.org/en/measurement-units/'],
      ['https://pubchem.ncbi.nlm.nih.gov/compound/Water'],
      ['https://www.nature.com/scitable/topicpage/photosynthetic-cells-14025371/'],
      ['https://www.genome.gov/human-genome-project'],
      ['https://nssdc.gsfc.nasa.gov/planetary/factsheet/saturnfact.html']
    ]
  },
  {
    verdict: 'unknown',
    sentences: [
      '「宇宙暗物質的主要構成成分為大爆炸初期形成的原初黑洞（Primordial Black Holes）。」',
      '「克里特島出土的費斯托斯圓盤（Phaistos Disc）記載的是遠古天文曆法而非拼音文字。」',
      '「深海熱泉特定微生物菌落具有超過一萬年以上的極限生物壽命。」'
    ],
    explanations: [
      '原初黑洞為現代天體物理學暗物質候選理論之一，但重力微透鏡觀測限制仍無法證實其佔暗物質主導地位。',
      '米諾斯文明費斯托斯圓盤符號至今未獲古文字學界完全解讀，屬銘文學界懸而未決之爭論。',
      '放射性定年雖顯示深海沉積層古菌生存極緩慢，但細胞世代交替週期與個體壽命界定仍具學術爭議。'
    ],
    sources: [
      ['https://arxiv.org/abs/2002.12778'],
      ['https://en.wikipedia.org/wiki/Phaistos_Disc'],
      ['https://www.nature.com/articles/s41598-020-61868-3']
    ]
  }
];

/**
 * Checks whether text or language hints indicate Chinese language.
 *
 * @param {string} [text]
 * @returns {boolean}
 */
export function isChineseLanguage(text) {
  if (!text || typeof text !== 'string') return false;
  return /[\u4e00-\u9fa5\u3400-\u4dbf]/.test(text);
}

/**
 * Generates a reproducible, deterministic list of 3-6 realistic claims
 * for an arbitrary video ID using Mulberry32 PRNG.
 *
 * @param {string} videoId - YouTube video ID.
 * @param {Object} [options] - Options such as isChinese.
 * @returns {Array<Object>} Array of validated Claim objects.
 */
export function generateDeterministicClaims(videoId, options = {}) {
  const safeId = typeof videoId === 'string' && videoId.trim() ? videoId.trim() : 'default-id';
  const seed = fnv1a(safeId);
  const rnd = createMulberry32(seed);

  const topics = options.isChinese ? FALLBACK_TOPICS_ZH : FALLBACK_TOPICS;

  // Number of claims: 3 to 6
  const count = 3 + Math.floor(rnd() * 4);
  const claims = [];

  let currentTimestamp = 8 + Math.floor(rnd() * 10); // Start between 8s and 17s

  // Ensure balanced verdicts: always at least one misinformation and one verified
  const verdictSequence = ['misinformation', 'verified', 'unknown'];

  for (let i = 0; i < count; i++) {
    // Pick topic category
    const categoryIndex = i < verdictSequence.length ? i : Math.floor(rnd() * topics.length);
    const category = topics[categoryIndex % topics.length];

    const itemIndex = Math.floor(rnd() * category.sentences.length);
    const sentence = category.sentences[itemIndex];
    const explanation = category.explanations[itemIndex];
    const sources = category.sources[itemIndex] || ['https://factcheck.org/'];

    const duration = 4.0 + Math.round(rnd() * 20) / 10; // 4.0 to 6.0 seconds

    const rawClaim = {
      timestamp: Math.round(currentTimestamp * 10) / 10,
      sentence,
      verdict: category.verdict,
      explanation,
      sources,
      duration
    };

    claims.push(validateClaim(rawClaim));

    // Space out next claim timestamp: +20 to +45 seconds
    currentTimestamp += 20 + Math.floor(rnd() * 25);
  }

  // Sort chronologically ascending
  claims.sort((a, b) => a.timestamp - b.timestamp);
  return claims;
}

export const DEFAULT_PROD_ENDPOINT = 'https://d3tuhog92nak7r.cloudfront.net/factcheck';
export const DEFAULT_AUTH_BEARER = '91b24cc09314aca901d8153cdacd741a730345f394ed61aa20b02ae92ea9b9fb';

// In-memory cache for retrieved claims
const claimsCache = new Map();
// In-flight active network/fetch promises for deduplication
const inFlightRequests = new Map();

/**
 * Resets the in-memory claims cache and active in-flight requests (useful for testing).
 */
export function clearClaimsCache() {
  claimsCache.clear();
  inFlightRequests.clear();
}

/**
 * Returns the number of currently active in-flight requests (useful for test assertions).
 * @returns {number}
 */
export function getInFlightRequestCount() {
  return inFlightRequests.size;
}

/**
 * Normalizes and validates a single claim item received from the backend API.
 * Supports the output schema:
 *   [
 *     {
 *       "timestamp": 42.5,
 *       "sentence": "Sample excerpt from video speech or transcript",
 *       "score": 0-3,
 *       "sources": ["https://factcheck.org/..."]
 *     }
 *   ]
 *
 * @param {unknown} raw - Candidate claim object from API response.
 * @returns {Object|null} Validated Claim object, or null if invalid.
 */
export function normalizeBackendClaim(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }

  // 1. Timestamp: handle float, int, or numeric string
  let timestamp = raw.timestamp;
  if (typeof timestamp === 'string') {
    timestamp = parseFloat(timestamp);
  }
  if (typeof timestamp !== 'number' || isNaN(timestamp) || !isFinite(timestamp) || timestamp < 0) {
    return null;
  }

  // 2. Sentence: extract and trim
  const rawSentence = raw.sentence || raw.claim || raw.text;
  if (typeof rawSentence !== 'string' || rawSentence.trim().length === 0) {
    return null;
  }
  const sentence = rawSentence.trim();

  // 3. Verdict & Score (0-3 scale):
  // 3: Severe Misinformation
  // 2: Misleading / Questionable
  // 1: Unverified / Context needed
  // 0: Verified / Accurate
  let verdict = 'unknown';
  let score = typeof raw.score === 'number' && !isNaN(raw.score) ? raw.score : undefined;

  const rawVerdict = String(raw.verdict || raw.status || '').toLowerCase().trim();
  if (
    rawVerdict === 'misinformation' ||
    rawVerdict === 'false' ||
    rawVerdict === 'misleading' ||
    rawVerdict === 'fake' ||
    rawVerdict === 'debunked'
  ) {
    verdict = 'misinformation';
    if (score === undefined) score = 3;
  } else if (
    rawVerdict === 'verified' ||
    rawVerdict === 'true' ||
    rawVerdict === 'accurate' ||
    rawVerdict === 'correct'
  ) {
    verdict = 'verified';
    if (score === undefined) score = 0;
  } else if (typeof raw.score === 'number') {
    if (raw.score >= 2) {
      verdict = 'misinformation';
    } else if (raw.score === 0) {
      verdict = 'verified';
    } else {
      verdict = 'unknown';
    }
  }

  // 4. Explanation: generate informative context from score if not provided
  let explanation = '';
  if (typeof raw.explanation === 'string' && raw.explanation.trim()) {
    explanation = raw.explanation.trim();
  } else if (typeof raw.reason === 'string' && raw.reason.trim()) {
    explanation = raw.reason.trim();
  } else if (score === 3) {
    explanation = 'Flagged as severe misinformation (Severity score: 3/3). Contradicted by authoritative scientific and fact-checking sources.';
  } else if (score === 2) {
    explanation = 'Flagged as misleading or disputed (Severity score: 2/3). Evidence contradicts key elements of this assertion.';
  } else if (score === 1) {
    explanation = 'Unverified statement (Severity score: 1/3). Requires additional context or evidence to corroborate.';
  } else if (score === 0) {
    explanation = 'Verified statement (Severity score: 0/3). Confirmed accurate by verified reference sources.';
  } else {
    explanation = 'Analyzed by automated fact-checking engine.';
  }

  // 5. Sources: array of valid URL strings
  let sources = [];
  if (Array.isArray(raw.sources)) {
    sources = raw.sources.filter((s) => typeof s === 'string' && /^https?:\/\//i.test(s.trim()));
  } else if (typeof raw.sources === 'string' && /^https?:\/\//i.test(raw.sources.trim())) {
    sources = [raw.sources.trim()];
  } else if (typeof raw.source === 'string' && /^https?:\/\//i.test(raw.source.trim())) {
    sources = [raw.source.trim()];
  }

  // 6. Duration
  let duration = 4.5;
  if (
    typeof raw.duration === 'number' &&
    !isNaN(raw.duration) &&
    isFinite(raw.duration) &&
    raw.duration > 0
  ) {
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
    if (score !== undefined) {
      claim.score = score;
    }
    return claim;
  } catch {
    return null;
  }
}

/**
 * Parses raw JSON payload from the backend API into a validated, chronologically sorted array of Claims.
 * Handles both flat arrays and wrapped envelope responses ({ claims: [] }, { data: [] }, etc.).
 *
 * @param {unknown} json - The parsed JSON body.
 * @returns {Array<Object>} Array of validated claims.
 */
export function parseApiResponse(json) {
  if (!json) return [];

  let rawList = [];
  if (Array.isArray(json)) {
    rawList = json;
  } else if (typeof json === 'object') {
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

  // Chronological sort ascending
  validClaims.sort((a, b) => a.timestamp - b.timestamp);
  return validClaims;
}

/**
 * Fetches real claim data from the production API backend with:
 * - POST JSON body {"videoId": "..."}
 * - Bearer authorization header
 * - Exponential backoff retry strategy for transient errors / timeouts
 * - Immediate abort on non-retryable 4xx client errors (e.g. 404, 400)
 * - Safe JSON parsing and normalization
 *
 * @param {string} videoId - YouTube video ID.
 * @param {string} [endpoint] - Backend API base endpoint URL.
 * @param {Object} [options] - Options: maxRetries, initialDelayMs, backoffMultiplier, timeoutMs, fetchFn, isChinese, authToken, method.
 * @returns {Promise<Array<Object>>} Resolves to validated Claims array.
 */
export async function fetchClaimsFromBackend(videoId, endpoint = DEFAULT_PROD_ENDPOINT, options = {}) {
  const maxRetries = typeof options.maxRetries === 'number' ? options.maxRetries : 2;
  const initialDelayMs = typeof options.initialDelayMs === 'number' ? options.initialDelayMs : 300;
  const backoffMultiplier = typeof options.backoffMultiplier === 'number' ? options.backoffMultiplier : 2;
  const timeoutMs = typeof options.timeoutMs === 'number' ? options.timeoutMs : 7000;
  const fetchFn = options.fetchFn || (typeof fetch !== 'undefined' ? fetch : null);

  if (!fetchFn) {
    throw new Error('fetch is not available in current environment');
  }

  const cleanId = String(videoId).trim();
  const baseEndpoint = endpoint || DEFAULT_PROD_ENDPOINT;
  const token = options.authToken || DEFAULT_AUTH_BEARER;
  const method = options.method || 'POST';

  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let controller = null;
    let timeoutId = null;

    if (typeof AbortController !== 'undefined') {
      controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    }

    try {
      const headers = {
        'Accept': 'application/json',
        'X-Client': 'YouTube-Misinfo-Detector'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token.replace(/^Bearer\s+/i, '')}`;
      }

      let fetchUrl = baseEndpoint;
      const fetchOptions = {
        method,
        headers
      };

      if (method === 'POST') {
        headers['Content-Type'] = 'application/json';
        fetchOptions.body = JSON.stringify({ videoId: cleanId });
      } else {
        const u = new URL(baseEndpoint);
        u.searchParams.set('videoId', cleanId);
        fetchUrl = u.toString();
      }

      if (controller) {
        fetchOptions.signal = controller.signal;
      }

      const res = await fetchFn(fetchUrl, fetchOptions);
      if (timeoutId) clearTimeout(timeoutId);

      // Handle HTTP status
      if (!res.ok) {
        const status = res.status;
        // 4xx errors (except 429 Too Many Requests) are non-retryable client errors
        if (status >= 400 && status < 500 && status !== 429) {
          console.warn(`[YouTube Misinfo Detector] PROD API HTTP ${status} client error for video ${cleanId}. Non-retryable.`);
          return [];
        }
        throw new Error(`HTTP ${status}: ${res.statusText || 'Error'}`);
      }

      const json = await res.json();
      return parseApiResponse(json);
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);
      lastError = err;

      const isTimeout = err.name === 'AbortError' || err.message?.toLowerCase().includes('abort');
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

/**
 * Asynchronously retrieves claims for a given YouTube video ID.
 * Supports TEST mode (mock/seeded data) and PROD mode (real API backend at exampleapi.com).
 * Guarantees that the backend API is called strictly once per video ID with in-flight deduplication.
 *
 * @param {string} videoId - The YouTube video ID.
 * @param {Object} [options] - Optional settings (e.g. mode: 'test'|'prod', apiEndpoint, isChinese, delayMs).
 * @returns {Promise<Array<Object>>} Resolves to an array of validated Claims.
 */
export async function getClaimsForVideo(videoId, options = {}) {
  if (!videoId || typeof videoId !== 'string' || !videoId.trim()) {
    return [];
  }

  const cleanId = videoId.trim();
  const isProd = options.mode === 'prod';
  const endpoint = options.apiEndpoint || DEFAULT_PROD_ENDPOINT;
  const cacheKey = `${cleanId}:${isProd ? 'prod' : 'test'}:${endpoint}:${options.isChinese ? 'zh' : 'en'}`;

  // 1. Check in-memory cache first (singleton cache per video ID)
  if (claimsCache.has(cacheKey)) {
    return JSON.parse(JSON.stringify(claimsCache.get(cacheKey)));
  }

  // 2. Check in-flight promise deduplication
  if (inFlightRequests.has(cacheKey)) {
    const inFlightResult = await inFlightRequests.get(cacheKey);
    return JSON.parse(JSON.stringify(inFlightResult));
  }

  // 3. Initiate single request promise
  const fetchPromise = (async () => {
    if (options.delayMs && options.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    }

    let claims = [];

    if (isProd) {
      try {
        claims = await fetchClaimsFromBackend(cleanId, endpoint, options);
      } catch (err) {
        console.warn(`[YouTube Misinfo Detector] PROD API fetch error for ${cleanId}: ${err.message}`);
        claims = [];
      }
    } else {
      // TEST mode: use seeded datasets and deterministic mock generator
      if (Object.prototype.hasOwnProperty.call(SEEDED_CLAIMS, cleanId)) {
        claims = SEEDED_CLAIMS[cleanId].map((c) => validateClaim(c));
      } else {
        claims = generateDeterministicClaims(cleanId, options);
      }
    }

    // Cache the resolved result (even if empty, prevents hammering backend)
    claimsCache.set(cacheKey, claims);
    return claims;
  })();

  // Track in-flight request to deduplicate concurrent calls
  inFlightRequests.set(cacheKey, fetchPromise);

  try {
    const result = await fetchPromise;
    return JSON.parse(JSON.stringify(result));
  } finally {
    inFlightRequests.delete(cacheKey);
  }
}
