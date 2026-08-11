const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const STATIC_PATH = path.join(__dirname, "opportunities.json");

function loadStatic() {
  try {
    return JSON.parse(fs.readFileSync(STATIC_PATH, "utf8"));
  } catch {
    return [];
  }
}

function cleanText(v="") {
  return String(v).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function mapLearnItem(item, index) {
  const type = item.type === "learningPath" ? "course" :
               item.type === "cert" ? "training" :
               item.type === "appliedSkill" ? "training" :
               item.type === "course" ? "course" : "course";

  const typeName = type === "course" ? "كورس" : "تدريب";
  const levels = Array.isArray(item.levels) ? item.levels : [];
  const level = levels[0] || "all";
  const levelName = level === "beginner" ? "مبتدئ" :
                    level === "advanced" ? "متقدم" :
                    level === "intermediate" ? "متوسط" : "مناسب للجميع";

  const subjects = Array.isArray(item.subjects) ? item.subjects : [];
  const roles = Array.isArray(item.roles) ? item.roles : [];
  const hay = [...subjects, ...roles, ...(item.products || [])].join(" ").toLowerCase();

  let field = "تقنية وبرمجة", emoji = "💻";
  if (/ai|machine|artificial|intelligence|ml|data science/.test(hay)) { field="ذكاء اصطناعي"; emoji="🤖"; }
  else if (/security|cyber/.test(hay)) { field="أمن سيبراني"; emoji="🔐"; }
  else if (/data|analytics|statistics/.test(hay)) { field="إحصاء وبيانات"; emoji="📊"; }
  else if (/business|management/.test(hay)) { field="أعمال وريادة"; emoji="💼"; }
  else if (/finance|financial/.test(hay)) { field="اقتصاد وتمويل"; emoji="📈"; }
  else if (/design|ux|ui/.test(hay)) { field="تصميم وفنون"; emoji="🎨"; }
  else if (/education|teacher/.test(hay)) { field="تعليم وتربية"; emoji="👩‍🏫"; }

  return {
    id: 1000000 + index,
    title: item.title || "Microsoft Learn Opportunity",
    provider: "Microsoft Learn",
    type, typeName, field, emoji,
    level, levelName,
    language: item.locale || "English",
    location: "Online",
    deadline: "متاح حسب المصدر الرسمي",
    description: cleanText(item.summary || "فرصة تعليمية منشورة في كتالوج Microsoft Learn الرسمي."),
    tag: "مباشر من المصدر",
    sourceUrl: item.url || "https://learn.microsoft.com/training/",
    live: true,
    lastModified: item.last_modified || null
  };
}

async function fetchMicrosoftLearn() {
  const url = "https://learn.microsoft.com/api/catalog/?type=modules,learningPaths,appliedSkills,certifications,courses";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(url, {
      headers: { "Accept": "application/json", "User-Agent": "Foras-Team3-MVP/1.0" },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Microsoft Learn API ${response.status}`);
    const data = await response.json();
    const arrays = ["modules","learningPaths","appliedSkills","certifications","courses"];
    const items = [];
    for (const key of arrays) {
      for (const item of (data[key] || [])) items.push(item);
    }
    return items.map(mapLearnItem);
  } finally {
    clearTimeout(timer);
  }
}

function officialHubEntries() {
  return [
    {
      id: 2000001,title:"Erasmus+ — فرص الطلاب والتدريب والتبادل",provider:"Erasmus+",
      type:"exchange",typeName:"تبادل طلابي",field:"مهارات مهنية",emoji:"🌍",level:"all",levelName:"مناسب للجميع",
      language:"English",location:"أوروبا",deadline:"راجع المصدر الرسمي",
      description:"بوابة رسمية لاستكشاف فرص الدراسة والتدريب والتبادل وبرامج Erasmus+ للأفراد.",
      tag:"مصدر رسمي",sourceUrl:"https://erasmus-plus.ec.europa.eu/opportunities/individuals",live:true
    },
    {
      id:2000002,title:"European Youth Portal — فرص التطوع والتدريب والشباب",provider:"European Youth Portal",
      type:"volunteer",typeName:"تطوع",field:"علوم اجتماعية",emoji:"🤝",level:"all",levelName:"مناسب للجميع",
      language:"English",location:"دولي",deadline:"راجع المصدر الرسمي",
      description:"بوابة الاتحاد الأوروبي لمعلومات وفرص الشباب، ومنها التطوع والتدريب والتبادل والدراسة.",
      tag:"مصدر رسمي",sourceUrl:"https://youth.europa.eu/search_en",live:true
    }
  ];
}

let cache = { opportunities: [], updatedAt: null };

async function sync() {
  const staticItems = loadStatic();
  let live = [];
  try { live = await fetchMicrosoftLearn(); }
  catch (e) { console.error("Microsoft Learn sync failed:", e.message); }
  const hubs = officialHubEntries();
  cache = {
    opportunities: [...live, ...hubs, ...staticItems],
    liveCount: live.length + hubs.length,
    updatedAt: new Date().toISOString()
  };
  return cache;
}

app.get("/api/health", (req,res) => {
  res.json({ok:true,service:"Foras Team 3",updatedAt:cache.updatedAt,liveCount:cache.liveCount||0});
});

app.get("/api/opportunities", async (req,res) => {
  if (!cache.opportunities.length) await sync();
  res.json(cache);
});

app.post("/api/sync", async (req,res) => {
  const result = await sync();
  res.json({ok:true, ...result, count:result.opportunities.length});
});

app.get("*", (req,res) => {
  res.sendFile(path.join(__dirname,"index.html"));
});

sync().catch(console.error).finally(() => {
  app.listen(PORT, () => console.log(`Foras Team 3 running on port ${PORT}`));
});
