// ============================================================================
//   Yedidim — cable advisor
//   Decides "strong cables / regular cables" per car+year from Israel's MoT data.
// ============================================================================

// ---- Rule knobs (keep in sync with README) ---------------------------------
const CC_STRONG = 1950;                       // engine >= this => strong
const COMMERCIAL_TYPES = new Set(["M", "N"]); // sug_degem M/N = commercial
const COMMERCIAL_BODIES = new Set([
  "מסחרי", "מסחרית", "טנדר", "משאית", "אוטובוס", "מיניבוס",
  "מיניוואן מסחרי", "ואן", "ואן מסחרי", "טרקטור", "נגרר"
]);
// Diesel engines with specific power >= this many HP per litre count as turbo.
// NA diesels sit ~30-45 HP/L; turbo-diesels 55+. 48 catches most modern TDI/DCi.
const TURBO_DIESEL_HP_PER_L = 48;
// Fallback when HP is missing: diesel passenger cars sold in Israel from 2000+
// are overwhelmingly turbo-diesel.
const TURBO_DIESEL_FALLBACK_YEAR = 2000;

// ---- Brand map Hebrew -> English (for bilingual fuzzy search) --------------
const BRAND_EN = {
  "טויוטה": "Toyota",
  "מזדה": "Mazda", "מאזדה": "Mazda",
  "פולקסווגן": "Volkswagen",
  "הונדה": "Honda",
  "ניסאן": "Nissan", "ניסן": "Nissan",
  "סוזוקי": "Suzuki",
  "סובארו": "Subaru",
  "מיצובישי": "Mitsubishi",
  "יונדאי": "Hyundai",
  "קיה": "Kia",
  "דייהו": "Daewoo",
  "פורד": "Ford",
  "שברולט": "Chevrolet",
  "סיטרואן": "Citroen",
  "פיג'ו": "Peugeot", "פיגו": "Peugeot", "פז'ו": "Peugeot",
  "רנו": "Renault",
  "דאצ'יה": "Dacia", "דאציה": "Dacia", "דצ'יה": "Dacia",
  "פיאט": "Fiat",
  "אלפא רומאו": "Alfa Romeo", "אלפא": "Alfa Romeo",
  "אופל": "Opel",
  "סקודה": "Skoda",
  "סיאט": "Seat",
  "מרצדס": "Mercedes-Benz", "מרסדס": "Mercedes-Benz",
  "ב.מ.וו": "BMW", "במוו": "BMW",
  "אאודי": "Audi", "אודי": "Audi",
  "וולוו": "Volvo",
  "ג'יפ": "Jeep", "גיפ": "Jeep",
  "דודג'": "Dodge", "דודג": "Dodge",
  "קרייזלר": "Chrysler",
  "לקסוס": "Lexus",
  "אינפיניטי": "Infiniti",
  "אקורה": "Acura",
  "מיני": "Mini",
  "סמארט": "Smart",
  "פורשה": "Porsche",
  "לנד רובר": "Land Rover", "לנדרובר": "Land Rover",
  "ג'אגואר": "Jaguar", "גאגואר": "Jaguar",
  "איסוזו": "Isuzu",
  "דייהטסו": "Daihatsu",
  "ססאנגיונג": "SsangYong", "סאנגיונג": "SsangYong",
  "צ'רי": "Chery", "צרי": "Chery",
  "ג'ילי": "Geely", "גילי": "Geely",
  "גרייט וול": "Great Wall",
  "האבל": "Haval", "חאוול": "Haval", "חוואל": "Haval",
  "ב.י.די": "BYD", "בי.די": "BYD",
  "אם ג'י": "MG", "אם ג": "MG", "אם.ג'י": "MG",
  "דונגפנג": "Dongfeng",
  "פאו": "FAW",
  "טסלה": "Tesla",
  "פולסטאר": "Polestar",
  "זיקר": "Zeekr",
  "ליאוטו": "Leapmotor",
  "אקס פנג": "Xpeng",
  "ני.או": "Nio",
  "אוניק": "Omoda",
  "ג'אק": "JAC",
  "צ'אנג יאנג": "Changan", "צ'אנגן": "Changan",
  "סירס": "Seres",
  "לינק אנד קו": "Lynk & Co",
  "הונגצ'י": "Hongqi",
  "אטו": "Aito",
  "אי קאר": "iCar",
  "טאטא": "Tata",
  "מהינדרה": "Mahindra"
};

// Hebrew → English mapping for popular foreign model names. Covers phonetic
// edges that pure skeleton matching gets wrong (e.g. TUCSON's silent C,
// CAYENNE's doubled N). Queries are expanded with every known translation.
const HE_TO_EN_MODEL = {
  "טוסון":"tucson","סנטה":"santa","פה":"fe","קאיין":"cayenne",
  "אקסנט":"accent","סונטה":"sonata","אלנטרה":"elantra","קונה":"kona","ונצ":"venue",
  "ריו":"rio","סיד":"ceed","סורנטו":"sorento","ספורטאג":"sportage","ניירו":"niro","פיקנטו":"picanto",
  "קמרי":"camry","יאריס":"yaris","אוריס":"auris","ראב":"rav","פריוס":"prius","הייאס":"hiace","היילקס":"hilux","הייאנדר":"highlander","לנד":"land","קרוזר":"cruiser","אוונסיס":"avensis",
  "סיויק":"civic","אקורד":"accord","גאז":"jazz","פיט":"fit","פיילוט":"pilot","אודיסי":"odyssey",
  "קשקאי":"qashqai","גוק":"juke","גוק":"juke","מיקרה":"micra","לף":"leaf","אלטימה":"altima","מקסימה":"maxima","מוראנו":"murano","נוואראה":"navara","נוואה":"navara","טיידה":"tiida","סנטרה":"sentra","פטרול":"patrol","פתפיינדר":"pathfinder","אקסטרייל":"xtrail","טריידה":"tiida",
  "קלאו":"clio","מגאן":"megane","קפטור":"captur","דאסטר":"duster","קדגאר":"kadjar","סנדרו":"sandero","לוגאן":"logan","קולאוס":"koleos","זואי":"zoe","מסטר":"master","טראפיק":"trafic","קנגו":"kangoo",
  "סוויפט":"swift","ויטארה":"vitara","גימני":"jimny","באלנו":"baleno","אלטו":"alto","סלריו":"celerio","סקרוס":"scross","איגניס":"ignis",
  "לנסר":"lancer","אאוטלנדר":"outlander","ספייס":"space","אקליפס":"eclipse","פאג'רו":"pajero","אסאקס":"asx","אל200":"l200",
  "אסטרה":"astra","קורסה":"corsa","אינסיגניה":"insignia","מוקה":"mokka","מריבה":"meriva","זאפירה":"zafira","אדאם":"adam","קרוסלנד":"crossland","גרנדלנד":"grandland",
  "פיסטה":"fiesta","פיאסטה":"fiesta","מונדיאו":"mondeo","קוגה":"kuga","אדג":"edge","אכספלורר":"explorer","אסקייפ":"escape","אסקורט":"escort","טרנזיט":"transit","קונקט":"connect","קוריאר":"courier","פוקוס":"focus","פיסטה":"fiesta","רנגו":"ranger","גלקסי":"galaxy","מוסטנג":"mustang",
  "פורסטר":"forester","אאוטבק":"outback","אימפרזה":"impreza","לגאסי":"legacy","קרוסטרק":"crosstrek","XV":"xv",
  "קורבט":"corvette","קמארו":"camaro","מליבו":"malibu","קרוז":"cruze","קפטיבה":"captiva","טראקס":"trax","סילברדו":"silverado",
  "אוקטביה":"octavia","פאביה":"fabia","סופרב":"superb","רומסטר":"roomster","קארוק":"karoq","קודיאק":"kodiaq","סקאלה":"scala",
  "גולף":"golf","פאסאט":"passat","פאסט":"passat","פולו":"polo","טיגואן":"tiguan","טוארג":"touareg","גטה":"jetta","טי-רוק":"troc","קאדי":"caddy","אפ":"up","ארטיאון":"arteon","אמארוק":"amarok","טרנספורטר":"transporter","שארן":"sharan",
  "סיאט":"seat","איביזה":"ibiza","לאון":"leon","אטקה":"ateca","ארונה":"arona","אלהמברה":"alhambra","טולדו":"toledo","טראגה":"tarraco",
  "א1":"a1","א3":"a3","א4":"a4","א5":"a5","א6":"a6","א7":"a7","א8":"a8","ש":"s","אר":"r","קיו":"q",
  "סי קלאס":"c","אי קלאס":"e","אס קלאס":"s","GLA":"gla","GLB":"glb","GLC":"glc","GLE":"gle","GLS":"gls","AMG":"amg","קומפרסור":"kompressor","ויטו":"vito","ספרינטר":"sprinter",
  "אם ג":"mg",
  "ברלינגו":"berlingo","פיקאסו":"picasso","קקטוס":"cactus","ג":"c","דיספאץ":"dispatch","גאמפי":"jumpy","גאמפר":"jumper","אורי":"ory",
  "208":"208","308":"308","508":"508","2008":"2008","3008":"3008","5008":"5008","ריפטר":"rifter","ריפאטר":"rifter","פרטנר":"partner","איקספרט":"expert","טראבלר":"traveller","בוקסר":"boxer",
  "500":"500","500L":"500l","500X":"500x","פנדה":"panda","טיפו":"tipo","בראבו":"bravo","פונטו":"punto","דוקאטו":"ducato","דובלו":"doblo",
  "פולסטאר":"polestar","טסלה":"tesla","מודל":"model","זיקר":"zeekr","ליאוטו":"leapmotor","אקספנג":"xpeng","ניאו":"nio","אוניק":"omoda",
  "האבל":"haval","חוואל":"haval","חאוול":"haval","אטלס":"atlas","יוריה":"jolion","ג'ילי":"geely","צ'רי":"chery","גרייט":"great","וול":"wall","ב.י.די":"byd","בי-די":"byd","אטו":"atto","סילי":"seal","דולפין":"dolphin","יואן":"yuan","האן":"han","סונג":"song","טאנג":"tang",
  "סמארט":"smart","פורטו":"fortwo","פורפור":"forfour",
  "קופר":"cooper","קלאבמן":"clubman","קאנטרימן":"countryman","פייסמן":"paceman",
  "מאיצן":"macan","פנאמרה":"panamera","טייקאן":"taycan","בוקסטר":"boxster","קיימן":"cayman",
  "דיסקברי":"discovery","פרילנדר":"freelander","ריינג":"range","רובר":"rover","ברברה":"velar","איווק":"evoque","ספורט":"sport","דיפנדר":"defender",
  "סי אר וי":"crv","hrv":"hrv","בי אר וי":"brv","פאסטבק":"fastback"
};

// Normalize dict keys so lookups by a normalized query word (final letters,
// no niqqud, no quotes) still hit.
const HE_TO_EN_MODEL_NORM = {};
for (const k in HE_TO_EN_MODEL) HE_TO_EN_MODEL_NORM[normalizeKey(k)] = HE_TO_EN_MODEL[k];
function normalizeKey(s) {
  const FINAL = { "ם":"מ","ן":"נ","ץ":"צ","ף":"פ","ך":"כ" };
  let o = "";
  for (const ch of s.toLowerCase()) o += FINAL[ch] || ch;
  return o.replace(/['’׳״""\-_.,/\\]/g, "").trim();
}

const NON_PETROL_SKIP = new Set(["חשמל", "חשמלי"]); // pure electric — skip
const FUEL_LABEL = {
  "בנזין": "בנזין",
  "דיזל": "דיזל",
  "גפ\"מ": "גפ״מ",
  "גפמ": "גפ״מ",
  "היבריד": "היברידי",
  "היברידי": "היברידי",
  "היברידי בנזין": "היברידי בנזין",
  "היברידי דיזל": "היברידי דיזל",
  "חשמל/בנזין": "היברידי בנזין",
  "חשמל/דיזל": "היברידי דיזל",
  "פלאג-אין": "פלאג־אין",
  "פלג-אין היברידי": "פלאג־אין"
};

// ============================================================================
//  Text normalisation — Hebrew/English forgiving search
// ============================================================================
const FINAL_LETTERS = { "ם": "מ", "ן": "נ", "ץ": "צ", "ף": "פ", "ך": "כ" };
// Hebrew → Latin naive transliteration (one of several matching passes).
const HE_TO_LAT = {
  "א":"a","ב":"b","ג":"g","ד":"d","ה":"","ו":"o","ז":"z","ח":"h",
  "ט":"t","י":"i","כ":"k","ל":"l","מ":"m","נ":"n","ס":"s","ע":"a",
  "פ":"p","צ":"tz","ק":"k","ר":"r","ש":"sh","ת":"t"
};
function hebrewToLatin(s) {
  let out = "";
  for (const ch of s) out += (ch in HE_TO_LAT) ? HE_TO_LAT[ch] : ch;
  return out;
}

// Consonant skeleton: drops vowels in both scripts so Hebrew foreign-word
// spellings collide with the Latin originals. "אאוטלנדר" → "tlndr", same as
// "outlander" → "tlndr".
// Both Hebrew and Latin consonants fold to the SAME skeleton letter so that
// "קורולה" (krl) and "COROLLA" (krll) line up — "krl" is a substring of "krll".
const HE_CONS = {
  "ב":"b","ג":"g","ד":"d","ז":"z","ח":"h","ט":"t","כ":"k",
  "ל":"l","מ":"m","נ":"n","ס":"s","פ":"p","צ":"ts","ק":"k",
  "ר":"r","ש":"sh","ת":"t"
  // א ה ו י ע intentionally dropped (Hebrew vowel carriers).
};
// Latin → shared skeleton letter. Folds forms that transliterate to the same
// Hebrew letter (פ→p/f; ב→b/v; ק→c/k/q; w→v in many Hebrew spellings).
const LAT_CONS = { "c":"k", "q":"k", "x":"ks", "w":"v", "f":"p", "v":"b" };
function skeleton(s) {
  let out = "", prev = "";
  for (const raw of s) {
    let add = "";
    const ch = raw.toLowerCase();
    if (ch in HE_CONS) add = HE_CONS[ch];
    else if (ch >= "0" && ch <= "9") add = ch;
    else if (ch >= "a" && ch <= "z") {
      if ("aeiouy".includes(ch)) continue;
      add = (LAT_CONS[ch] || ch);
    } else if (ch === " ") {
      if (prev !== " " && out.length) { out += " "; prev = " "; }
      continue;
    } else continue;
    // Collapse consecutive duplicate letters so "passat" (psst) and "pasat"
    // (pst) share the same skeleton "pst", "corolla" (krll) and "קורולה" (krl)
    // likewise.
    if (add.length === 1) {
      if (add !== prev) { out += add; prev = add; }
    } else {
      // Multi-char result (e.g. ש → "sh"); emit as is and mark prev with its
      // last char so that a following identical letter still collapses.
      out += add;
      prev = add[add.length - 1];
    }
  }
  return out.trim();
}

function normalize(s) {
  if (!s) return "";
  s = ("" + s).toLowerCase();
  s = s.normalize("NFKD").replace(/[֑-ׇ̀-ͯ]/g, "");
  let out = "";
  for (const ch of s) {
    if (FINAL_LETTERS[ch]) out += FINAL_LETTERS[ch];
    // Gersh / apostrophe inside Hebrew words (ג' = /dʒ/, ז' = /ʒ/, צ' = /tʃ/)
    // joins the letters it marks, so DROP it rather than splitting the word.
    else if (/['’׳]/.test(ch)) { /* drop */ }
    // Other punctuation separates words.
    else if (/[״""\-_.,/\\]/.test(ch)) out += " ";
    else out += ch;
  }
  return out.replace(/\s+/g, " ").trim();
}

// Damerau-Levenshtein, capped.
function editDistance(a, b, cap = 2) {
  if (a === b) return 0;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > cap) return cap + 1;
  let prev = new Array(lb + 1), cur = new Array(lb + 1);
  for (let j = 0; j <= lb; j++) prev[j] = j;
  for (let i = 1; i <= la; i++) {
    cur[0] = i;
    let rowMin = i;
    for (let j = 1; j <= lb; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > cap) return cap + 1;
    [prev, cur] = [cur, prev];
  }
  return prev[lb];
}

// Cartesian product of arrays-of-strings. [[a,b],[c,d]] → [[a,c],[a,d],[b,c],[b,d]].
function cartesian(arrs) {
  let out = [[]];
  for (const arr of arrs) {
    const next = [];
    for (const prefix of out) for (const v of arr) next.push(prefix.concat([v]));
    out = next;
  }
  return out;
}

// How well does a single query token `qt` match a row (using the row's
// pre-computed same-script tokens and cross-script skeleton). Returns a score,
// 0 if no match at all.
function scoreTokenAgainstRow(qt, row) {
  let best = 0;
  const qtSkel = skeleton(qt);

  if (row.searchText.indexOf(qt) >= 0) {
    best = Math.max(best, 1000 - row.searchText.indexOf(qt));
  }
  for (const rt of row.tokens) {
    if (rt === qt)                best = Math.max(best, 1500);
    else if (rt.startsWith(qt))   best = Math.max(best, 1200);
    else if (rt.indexOf(qt) >= 0) best = Math.max(best, 900);
    else {
      const cap = qt.length <= 3 ? 0 : qt.length <= 5 ? 1 : 2;
      if (cap > 0) {
        const d = editDistance(qt, rt, cap);
        if (d <= cap) best = Math.max(best, 700 - d * 250);
      }
    }
  }
  if (qtSkel.length >= 2 && row.skelTokens) {
    for (const rst of row.skelTokens) {
      if (rst === qtSkel)              best = Math.max(best, 1400);
      else if (rst.startsWith(qtSkel)) best = Math.max(best, 1150);
      else if (qtSkel.startsWith(rst) && rst.length >= 2)
                                       best = Math.max(best, 1050);
      else if (rst.indexOf(qtSkel) >= 0) best = Math.max(best, 850);
    }
    if (best < 400 && row.skeleton.indexOf(qtSkel) >= 0) best = 400;
  } else if (qtSkel.length >= 2 && row.skeleton && row.skeleton.indexOf(qtSkel) >= 0) {
    best = Math.max(best, 600);
  }
  if (best === 0 && looseSubseq(qt, row.searchText)) best = 150;
  return best;
}

// Token match that tolerates one edit for words of length ≥ 4, so a Hebrew
// transliteration like "pasat" (פאסאט) catches "passat" and "mazd" (מאזדה) catches
// "mazda". For shorter tokens like "5" or "mx" we require exact equality.
function tokMatch(a, b) {
  if (a === b) return true;
  if (a.length < 4 || b.length < 4) return false;
  if (Math.abs(a.length - b.length) > 1) return false;
  return editDistance(a, b, 1) <= 1;
}

// True if `qSeq` appears as a contiguous slice inside `tokens` (order matters),
// using fuzzy token equality (one edit per long token).
function hasTokenSeq(tokens, qSeq) {
  if (!qSeq.length) return false;
  outer: for (let i = 0; i <= tokens.length - qSeq.length; i++) {
    for (let j = 0; j < qSeq.length; j++) {
      if (!tokMatch(tokens[i + j], qSeq[j])) continue outer;
    }
    return true;
  }
  return false;
}

function looseSubseq(query, cand) {
  let qi = 0, skips = 0;
  for (let i = 0; i < cand.length && qi < query.length; i++) {
    if (cand[i] === query[qi]) qi++;
    else if (skips < 1) skips++;
  }
  return qi >= query.length - skips;
}

// ============================================================================
//  Rule engine
// ============================================================================
function isTurboDiesel(v, year) {
  if (!/דיזל/.test(v.fuel)) return false;
  if (v.cc > 0 && v.hp > 0) {
    const hpPerLitre = v.hp * 1000 / v.cc;
    return hpPerLitre >= TURBO_DIESEL_HP_PER_L;
  }
  return year >= TURBO_DIESEL_FALLBACK_YEAR;
}

function isCommercial(v) {
  if (COMMERCIAL_TYPES.has(v.sug)) return true;
  for (const kw of COMMERCIAL_BODIES) if (v.body && v.body.indexOf(kw) >= 0) return true;
  return false;
}

function classifyVariant(v, year) {
  const reasons = [];
  let strong = false;

  if (v.cc >= CC_STRONG) { strong = true; reasons.push(`מנוע __CC__${v.cc}__/CC__ סמ״ק`); }
  else if (v.cc > 0)     { reasons.push(`מנוע __CC__${v.cc}__/CC__ סמ״ק`); }

  if (isTurboDiesel(v, year))   { strong = true; reasons.push("טורבו-דיזל"); }
  else if (/דיזל/.test(v.fuel)) { reasons.push("דיזל"); }
  else if (v.fuel)              { reasons.push(FUEL_LABEL[v.fuel] || v.fuel); }

  if (isCommercial(v))          { strong = true; reasons.push("רכב מסחרי"); }

  return { strong, reasons, cc: v.cc, fuel: v.fuel, body: v.body, trim: v.trim };
}

// ============================================================================
//  Data & index
// ============================================================================
let INDEX = [];
let DATA_READY = false;

async function loadData() {
  const resp = await fetch("data/cars.json", { cache: "force-cache" });
  if (!resp.ok) throw new Error("Failed to load cars.json");
  const raw = await resp.json();

  const byKey = new Map();
  for (const row of raw.rows) {
    const variants = (row.variants || []).filter(v => !NON_PETROL_SKIP.has(v.fuel));
    if (!variants.length) continue;

    const brand = row.brand;
    const model = row.model;
    const key = brand + "||" + model;
    let bucket = byKey.get(key);
    if (!bucket) {
      const brandEn = BRAND_EN[brand] || "";
      const searchParts = [brand, brandEn, model].filter(Boolean);
      const baseText = normalize(searchParts.join(" "));
      const latin   = hebrewToLatin(baseText);
      const combined = baseText + " " + latin;
      const modelNorm   = normalize(model);
      const modelSkel   = skeleton(modelNorm);
      const skeletonAll = skeleton(combined);
      bucket = {
        brand, brand_en: brandEn, model,
        modelNorm, modelSkel,
        years: new Map(),
        display: brandEn ? `${brand} · ${brandEn} ${model}` : `${brand} ${model}`,
        searchText: combined,
        skeleton: skeletonAll
      };
      bucket.tokens        = bucket.searchText.split(" ").filter(Boolean);
      bucket.skelTokens    = skeletonAll.split(" ").filter(Boolean);
      byKey.set(key, bucket);
    }
    const existing = bucket.years.get(row.year) || [];
    bucket.years.set(row.year, existing.concat(variants));
    if (!bucket.maxYear || row.year > bucket.maxYear) bucket.maxYear = row.year;
  }
  INDEX = Array.from(byKey.values());
  DATA_READY = true;
  document.getElementById("status").classList.add("hidden");
}

// ============================================================================
//  Search
// ============================================================================
function searchCars(rawQuery, limit = 30) {
  const q = normalize(rawQuery);
  if (!q) return [];
  const qLat = hebrewToLatin(q);
  const qSkel = skeleton(q);
  const qTokens = q.split(" ").filter(Boolean);
  // For each Hebrew query word, carry a list of "synonyms" (itself + known
  // English translation) so "טוסון" is treated as either "טוסון" OR "tucson"
  // when matched against a row. Both qLat and qSkel are also computed from the
  // expanded query for the big-bonus checks later.
  const qSynonyms = qTokens.map(t => {
    const alts = [t];
    // Dict keys may be in either final-letter or non-final-letter form;
    // normalize both the key and the lookup once (lazy-build on first call).
    const en = HE_TO_EN_MODEL[t] || HE_TO_EN_MODEL_NORM[t];
    if (en) alts.push(en);
    return alts;
  });
  // Build an expanded token list for the token-sequence bonuses (preserves order).
  const qTokensExpanded = qSynonyms.flat();
  const results = [];

  for (const row of INDEX) {
    let score = 0;
    let allMatched = true;
    // Model-only text (strip the brand prefix) so a short query like "5" doesn't
    // tie just because every row's brand matched.
    const modelOnly = normalize(row.model);

    for (const syns of qSynonyms) {
      let bestForToken = 0;
      for (const qt of syns) {
        bestForToken = Math.max(bestForToken, scoreTokenAgainstRow(qt, row));
      }
      if (bestForToken === 0) { allMatched = false; break; }
      score += bestForToken;
    }
    if (!allMatched || score === 0) continue;

    // ---- recency bonus ----------------------------------------------------
    // Old legacy records (1996-1999) have cryptic model names copied from the
    // raw degem_nm (e.g. "גולף 0041 5 ה 3 ד") and shouldn't out-rank a modern
    // row like "GOLF 2015-2024" when the user types "גולף".
    const maxYear = row.maxYear || 0;
    if (maxYear >= 2020)      score += 1800;
    else if (maxYear >= 2015) score += 1200;
    else if (maxYear >= 2010) score += 700;
    else if (maxYear >= 2005) score += 300;
    else if (maxYear < 2000)  score -= 3500;

    // ---- compactness & specificity bonuses --------------------------------
    // (a) full query appears as a contiguous token SEQUENCE (any script).
    //     Word-boundary match — so "מאזדה 3" matches "MAZDA 3" but NOT
    //     "מאזדה 323 אל.איקס". Big bonus because this is what users mean.
    const qLatTokens = qLat.split(" ").filter(Boolean);
    let seqBonus = 0;
    if (hasTokenSeq(row.tokens, qTokens))                                seqBonus = 3000;
    if (qLat !== q && hasTokenSeq(row.tokens, qLatTokens))                seqBonus = Math.max(seqBonus, 3000);
    // Also try every synonym combination so "סנטה פה" earns the bonus against
    // "SANTA FE" (whose tokens are ["santa","fe"]).
    for (const combo of cartesian(qSynonyms)) {
      if (combo.length && hasTokenSeq(row.tokens, combo)) { seqBonus = Math.max(seqBonus, 3000); break; }
    }
    score += seqBonus;
    if (qSkel.length >= 3 && row.skeleton.indexOf(qSkel) >= 0) score += 400;

    // (b) prefer rows whose MODEL (not brand) contains each query token —
    //     stops "מאזדה 5" from preferring "MAZDA CX-5" over "MAZDA 5".
    const modelTokens = new Set(modelOnly.split(" ").concat(hebrewToLatin(modelOnly).split(" ")));
    for (const qt of qTokens) {
      if (qt.length >= 1 && modelTokens.has(qt)) score += 700;
    }

    // (c) shorter models win ties — a user typing "mazda 5" wants "MAZDA 5",
    //     not every CX-5 trim variant.
    score += Math.max(0, 400 - row.model.length * 20);

    results.push({ row, score });
  }
  results.sort((a, b) =>
    b.score - a.score ||
    a.row.model.length - b.row.model.length ||
    a.row.display.localeCompare(b.row.display, "he")
  );
  return results.slice(0, limit).map(r => r.row);
}

function groupYears(row) {
  const years = [...row.years.keys()].sort((a, b) => a - b);
  const yearInfo = years.map(y => {
    const classified = row.years.get(y).map(v => classifyVariant(v, y));
    const seen = new Map();
    for (const c of classified) {
      const k = c.strong + "|" + c.cc + "|" + c.fuel + "|" + (c.body || "");
      if (!seen.has(k)) seen.set(k, c);
    }
    const uniq = [...seen.values()].sort((a, b) =>
      (a.strong === b.strong ? a.cc - b.cc : (a.strong ? -1 : 1))
    );
    const fp = uniq.map(c => c.strong + ":" + c.cc + ":" + c.fuel).join(";");
    return { y, uniq, fp };
  });
  const ranges = [];
  for (const it of yearInfo) {
    const last = ranges[ranges.length - 1];
    if (last && last.fp === it.fp && it.y === last.to + 1) last.to = it.y;
    else ranges.push({ from: it.y, to: it.y, fp: it.fp, variants: it.uniq });
  }
  return ranges;
}

// ============================================================================
//  UI
// ============================================================================
const $ = (id) => document.getElementById(id);
const qBox  = $("q");
const sugg  = $("suggest");
const empty = $("empty");
const result = $("result");

let selectedIdx = -1;
let currentHits = [];

qBox.addEventListener("input", onInput);
qBox.addEventListener("keydown", onKey);
document.addEventListener("click", (e) => {
  if (!e.target.closest(".searchbox") && !e.target.closest(".suggest")) sugg.innerHTML = "";
});
// Scrolling the suggestion list on a touch device should dismiss the on-screen
// keyboard so the user can see the list, without clearing what they typed.
sugg.addEventListener("touchmove", () => { if (document.activeElement === qBox) qBox.blur(); }, { passive: true });
sugg.addEventListener("scroll",   () => { if (document.activeElement === qBox) qBox.blur(); }, { passive: true });

function onInput() {
  if (!DATA_READY) return;
  const q = qBox.value;
  if (!q || !q.trim()) { sugg.innerHTML = ""; return; }
  currentHits = searchCars(q);
  selectedIdx = -1;
  renderSuggest(q);
}

function onKey(e) {
  if (!currentHits.length) return;
  if (e.key === "ArrowDown") { selectedIdx = (selectedIdx + 1) % currentHits.length; renderSuggest(qBox.value); e.preventDefault(); }
  else if (e.key === "ArrowUp") { selectedIdx = (selectedIdx - 1 + currentHits.length) % currentHits.length; renderSuggest(qBox.value); e.preventDefault(); }
  else if (e.key === "Enter") { pick(currentHits[selectedIdx >= 0 ? selectedIdx : 0]); e.preventDefault(); }
  else if (e.key === "Escape") { sugg.innerHTML = ""; selectedIdx = -1; }
}

function highlight(text, query) {
  const nq = normalize(query);
  if (!nq) return escapeHtml(text);
  const tokens = nq.split(" ").filter(t => t.length >= 2);
  if (!tokens.length) return escapeHtml(text);
  let html = escapeHtml(text);
  for (const t of tokens) {
    const re = new RegExp("(" + escapeRegex(t) + ")", "gi");
    html = html.replace(re, "<mark>$1</mark>");
  }
  return html;
}
function escapeHtml(s) { return s.replace(/[&<>"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;" }[c])); }
function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function renderSuggest(query) {
  sugg.innerHTML = "";
  currentHits.forEach((row, i) => {
    const li = document.createElement("li");
    li.setAttribute("role", "option");
    if (i === selectedIdx) li.setAttribute("aria-selected", "true");
    const years = [...row.years.keys()];
    const yrsLabel = years.length
      ? `<span dir="ltr">${Math.min(...years)}–${Math.max(...years)}</span>` : "";
    li.innerHTML =
      `<span class="sug-main">${highlight(row.display, query)}</span>` +
      `<span class="sug-years">${yrsLabel}</span>`;
    li.addEventListener("click", () => pick(row));
    sugg.appendChild(li);
  });
}

function pick(row) {
  if (!row) return;
  sugg.innerHTML = "";
  // Keep whatever the user typed in the search box — don't overwrite it with
  // the picked row's name.
  selectedIdx = -1;
  qBox.blur();
  renderResult(row);
}

function renderResult(row) {
  empty.classList.add("hidden");
  result.classList.remove("hidden");
  const ranges = groupYears(row);
  let html = `<h2>${escapeHtml(row.brand)} ${escapeHtml(row.model)}`;
  if (row.brand_en) html += ` <small style="color:var(--muted);font-weight:400">· ${escapeHtml(row.brand_en)}</small>`;
  html += `</h2><div class="sub">המלצת כבלים לפי שנת ייצור</div>`;
  html += `<table class="years"><thead><tr><th>שנים</th><th>מנוע / דלק</th><th>כבלים</th></tr></thead><tbody>`;
  for (const r of ranges) {
    const yearLabel = r.from === r.to
      ? `<span dir="ltr">${r.from}</span>`
      : `<span dir="ltr">${r.from}–${r.to}</span>`;
    for (let i = 0; i < r.variants.length; i++) {
      const v = r.variants[i];
      const ccLabel = v.cc > 0 ? `<span dir="ltr">${v.cc}</span> סמ״ק` : "נפח לא ידוע";
      const fuelLabel = FUEL_LABEL[v.fuel] || v.fuel || "";
      const reasonsHtml = v.reasons && v.reasons.length
        ? `<div class="reason">${escapeHtml(v.reasons.join(" · ")).replace(/__CC__/g, '<span dir="ltr">').replace(/__\/CC__/g, '</span>')}</div>`
        : "";
      const extra = v.body
        ? `<div class="reason">${escapeHtml(v.body)}${v.trim ? " · " + escapeHtml(v.trim) : ""}</div>`
        : (v.trim ? `<div class="reason">${escapeHtml(v.trim)}</div>` : "");
      html += `<tr>` +
        `<td>${i === 0 ? yearLabel : ""}</td>` +
        `<td>${ccLabel}${fuelLabel ? ` · ${escapeHtml(fuelLabel)}` : ""}${extra}</td>` +
        `<td><span class="pill ${v.strong ? "pill-strong" : "pill-regular"}">${v.strong ? "חזקים" : "רגילים"}</span>${reasonsHtml}</td>` +
      `</tr>`;
    }
  }
  html += `</tbody></table>`;
  result.innerHTML = html;
  result.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ============================================================================
//  Tabs
// ============================================================================
document.querySelectorAll(".tab").forEach(t => {
  t.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(x => x.classList.remove("is-active"));
    t.classList.add("is-active");
    const mode = t.dataset.mode;
    $("pane-name").classList.toggle("hidden", mode !== "name");
    $("pane-plate").classList.toggle("hidden", mode !== "plate");
    result.classList.add("hidden");
    empty.classList.remove("hidden");
  });
});

// ============================================================================
//  License plate lookup (data.gov.il, needs internet)
// ============================================================================
$("plate-go").addEventListener("click", plateLookup);
$("plate").addEventListener("keydown", (e) => { if (e.key === "Enter") plateLookup(); });

async function plateLookup() {
  const msg = $("plate-msg");
  msg.className = "plate-msg";
  const num = ($("plate").value || "").replace(/\D+/g, "");
  if (!num) { msg.textContent = "נא להזין מספר רישוי"; msg.classList.add("error"); return; }
  if (!navigator.onLine) { msg.textContent = "חיפוש לפי מספר רכב דורש אינטרנט"; msg.classList.add("error"); return; }
  msg.textContent = "מחפש…";
  try {
    const url = `https://data.gov.il/api/3/action/datastore_search?resource_id=053cea08-09bc-40ec-8f7a-156f0677aff3&q=${encodeURIComponent(num)}&limit=5`;
    const r = await fetch(url);
    const d = await r.json();
    const rec = (d.result && d.result.records || []).find(x => String(x.mispar_rechev) === num);
    if (!rec) { msg.textContent = "לא נמצא רכב עם מספר זה"; msg.classList.add("error"); return; }
    const year = +rec.shnat_yitzur;
    const variant = {
      cc: 0,
      fuel: rec.sug_delek_nm || "",
      hp: 0,
      body: rec.sug_degem === "M" ? "מסחרי" : "",
      sug: rec.sug_degem || "",
      trim: rec.ramat_gimur || ""
    };
    try {
      const filters = JSON.stringify({ tozeret_cd: +rec.tozeret_cd, degem_cd: +rec.degem_cd, shnat_yitzur: year });
      const u2 = `https://data.gov.il/api/3/action/datastore_search?resource_id=142afde2-6228-49f9-8a29-9b6c3a0cbe40&filters=${encodeURIComponent(filters)}&limit=1`;
      const r2 = await fetch(u2);
      const d2 = await r2.json();
      const m = d2.result && d2.result.records && d2.result.records[0];
      if (m) {
        if (m.nefah_manoa) variant.cc = +m.nefah_manoa;
        if (m.koah_sus)    variant.hp = +m.koah_sus;
        if (m.merkav)      variant.body = m.merkav;
        if (m.delek_nm)    variant.fuel = m.delek_nm;
      }
    } catch (_) { /* ignore enrichment errors */ }

    const brand = rec.tozeret_nm || "";
    const model = rec.kinuy_mishari || rec.degem_nm || "";
    const firstBrandWord = brand.split(" ")[0];
    const row = {
      brand,
      brand_en: BRAND_EN[firstBrandWord] || "",
      model,
      display: `${brand} ${model}`,
      years: new Map([[year, [variant]]])
    };
    msg.textContent = `נמצא: ${brand} ${model} · שנה ${year}`;
    renderResult(row);
  } catch (e) {
    msg.textContent = "שגיאה בחיפוש. ייתכן שאין חיבור לאינטרנט.";
    msg.classList.add("error");
  }
}

// ============================================================================
//  Theme toggle
// ============================================================================
const themeBtn = $("theme");
themeBtn.addEventListener("click", () => {
  // Flip from the EFFECTIVE theme (what the user sees), not from the attribute
  // alone: without this, the first click can be a no-op when the attribute is
  // empty but the OS theme already matches what we'd switch to.
  const attr = document.documentElement.getAttribute("data-theme");
  const effective = attr || (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const next = effective === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  try { localStorage.setItem("theme", next); } catch (_) {}
});
try {
  const saved = localStorage.getItem("theme");
  if (saved) document.documentElement.setAttribute("data-theme", saved);
} catch (_) {}

// ============================================================================
//  Service worker
// ============================================================================
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

// ============================================================================
//  Boot
// ============================================================================
loadData().catch(err => {
  $("status").textContent = "שגיאה בטעינת מאגר הרכבים. נסו לרענן.";
  console.error(err);
});
