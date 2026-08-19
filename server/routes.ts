import { Router } from "express";
import { db, auth, FieldValue } from "./firebase";
import { z } from "zod";
import { GoogleGenAI } from "@google/genai";

const router = Router();
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Middleware to check authentication
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};

const requireAdmin = async (req: any, res: any, next: any) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  try {
    const userDoc = await db.collection("users").doc(req.user.uid).get();
    if (!userDoc.exists || userDoc.data()?.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};

const requireCreator = async (req: any, res: any, next: any) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  try {
    const userDoc = await db.collection("users").doc(req.user.uid).get();
    if (!userDoc.exists || userDoc.data()?.creatorStatus !== true) {
      return res.status(403).json({ error: "Forbidden - Creator status required" });
    }
    next();
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};

// ==========================================
// MIGRATION
// ==========================================
router.get("/migrate-ids", async (req: any, res) => {
  try {
    async function generateAdminUniqueId(objectType: string, objectReference: string): Promise<string> {
      let uniqueId = '';
      let isUnique = false;
      while (!isUnique) {
        uniqueId = Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
        const idRef = db.collection('global_ids').doc(uniqueId);
        try {
          await db.runTransaction(async (transaction) => {
            const idDoc = await transaction.get(idRef);
            if (!idDoc.exists) {
              transaction.set(idRef, { 
                numericId: uniqueId,
                objectType: objectType,
                objectReference: objectReference,
                status: 'reserved',
                createdAt: new Date().toISOString()
              });
              isUnique = true;
            }
          });
          if (isUnique) {
              await db.collection('audit_logs').add({
                  action: 'ID_RESERVED',
                  numericId: uniqueId,
                  objectType: objectType,
                  objectReference: objectReference,
                  timestamp: new Date().toISOString(),
                  systemAction: true
              });
          }
        } catch (e) {
          console.warn("Collision, retrying...");
        }
      }
      return uniqueId;
    }

    const usersSnap = await db.collection("users").get();
    for (const docSnap of usersSnap.docs) {
      if (!docSnap.data().numericId) {
        const nid = await generateAdminUniqueId("user", docSnap.id);
        await docSnap.ref.update({ numericId: nid });
      }
    }

    const charSnap = await db.collection("characters").get();
    for (const docSnap of charSnap.docs) {
      if (!docSnap.data().numericId) {
        const nid = await generateAdminUniqueId("character", docSnap.id);
        await docSnap.ref.update({ numericId: nid });
      }
    }

    const promptSnap = await db.collection("prompts").get();
    for (const docSnap of promptSnap.docs) {
      if (!docSnap.data().numericId) {
        const nid = await generateAdminUniqueId("prompt", docSnap.id);
        await docSnap.ref.update({ numericId: nid });
      }
    }

    res.json({ success: true, message: "Migration complete" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// AUTH
// ==========================================
router.post("/auth/login/google", requireAuth, async (req: any, res) => {
  try {
    const uid = req.user.uid;
    const userRef = db.collection("users").doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      // First time login
      const newUser = {
        email: req.user.email,
        displayName: req.user.name || "User " + uid.substring(0, 5),
        avatar: req.user.picture || "",
        bio: "",
        socialLinks: {},
        role: "USER",
        creatorStatus: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        deletedAt: null
      };
      await userRef.set(newUser);
      
      await db.collection("activity_logs").add({
        userId: uid,
        action: "Account creation",
        createdAt: FieldValue.serverTimestamp()
      });
      return res.json({ success: true, user: { id: uid, ...newUser } });
    } else {
      await db.collection("activity_logs").add({
        userId: uid,
        action: "Login",
        createdAt: FieldValue.serverTimestamp()
      });
      return res.json({ success: true, user: { id: uid, ...userDoc.data() } });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to login" });
  }
});

router.get("/auth/me", requireAuth, async (req: any, res) => {
  try {
    const userDoc = await db.collection("users").doc(req.user.uid).get();
    if (!userDoc.exists) return res.status(404).json({ error: "User not found" });
    res.json({ success: true, user: { id: userDoc.id, ...userDoc.data() } });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ==========================================
// USER
// ==========================================
router.patch("/users/me", requireAuth, async (req: any, res) => {
  try {
    const schema = z.object({
      displayName: z.string().max(50).optional(),
      bio: z.string().max(600).optional(),
      avatar: z.string().optional(),
      socialLinks: z.record(z.string(), z.string()).optional()
    });
    
    const data = schema.parse(req.body);
    await db.collection("users").doc(req.user.uid).update({
      ...data,
      updatedAt: FieldValue.serverTimestamp()
    });
    
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: "Validation error" });
  }
});

// ==========================================
// CHARACTER
// ==========================================
router.get("/characters", async (req, res) => {
  try {
    const snapshot = await db.collection("characters").where("deletedAt", "==", null).orderBy("createdAt", "desc").limit(20).get();
    const characters = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ success: true, data: characters });
  } catch (err) {
    console.error("Failed to fetch characters", err);
    res.status(500).json({ error: "Failed to fetch characters" });
  }
});

router.post("/characters", requireCreator, async (req: any, res) => {
  try {
    const schema = z.object({
      name: z.string().max(50),
      avatar: z.string(),
      gender: z.string(),
      slogan: z.string().max(700),
      plot: z.string(),
      link: z.string().url().refine(val => val.includes("aistudio.google.com"), { message: "Must be a Google AI Studio link" }),
      tags: z.array(z.string().max(30)).max(6).optional()
    });
    const data = schema.parse(req.body);
    
    const charData = {
      ...data,
      creatorId: req.user.uid,
      viewCount: 0,
      likeCount: 0,
      saveCount: 0,
      isPinned: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      deletedAt: null
    };
    
    const docRef = await db.collection("characters").add(charData);
    
    // Process tags
    if (data.tags) {
       for(const tag of data.tags) {
          // just save them to tags collection if not exists, simplified
          await db.collection("tags").doc(tag.toLowerCase()).set({ name: tag, usageCount: FieldValue.increment(1) }, { merge: true });
       }
    }
    
    // Notify followers
    // ... we can implement this later
    
    res.json({ success: true, data: { id: docRef.id, ...charData } });
  } catch (err: any) {
    res.status(400).json({ error: "Validation error", details: err.errors });
  }
});

// ==========================================
// SEARCH & AI SEARCH
// ==========================================
router.post("/ai-search", async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== "string") return res.status(400).json({ error: "Missing query" });

    const rawQuery = query.trim();

    // Use Gemini to parse the query into structured criteria
    const prompt = `
    You are an intelligent search query parser for "Thế giới nhập vai_AD" - a Google AI Studio Roleplay community platform.
    Analyze the user's natural language search query in Vietnamese or English.
    Extract the search intent into a structured JSON object with the following fields:
    - type: "character" | "prompt" | "creator" | "all" (e.g. if searching for "nữ chính", "nhân vật", "ma cà rồng" -> "character"; if "prompt viết văn", "câu lệnh" -> "prompt"; if "tác giả", "người tạo" -> "creator"; else "all")
    - tags: string[] (relevant thematic genres, tags e.g. ["Học đường", "Hiện đại", "Fantasy", "Anime", "Huyền huyễn", "Kinh dị", "Trinh thám"])
    - gender: "Nam" | "Nữ" | "Khác" | null (only if gender intent is explicitly indicated)
    - keywords: string[] (key semantic nouns, adjectives, or character attributes without filler words)
    - summary: string (a short 1-sentence friendly explanation in Vietnamese of what user is looking for)

    User Query: "${rawQuery}"
    
    Respond ONLY with valid JSON.
    `;

    let criteria: any = null;
    
    if (process.env.GEMINI_API_KEY) {
      const candidateModels = ["gemini-3.7-flash", "gemini-3.1-flash-lite", "gemini-2.5-flash", "gemini-flash-latest"];
      for (const modelName of candidateModels) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              responseMimeType: "application/json"
            }
          });
          if (response?.text) {
            criteria = JSON.parse(response.text);
            break;
          }
        } catch (err: any) {
          // Model might be busy (503) or unavailable, try next candidate
          continue;
        }
      }
    }

    // If Gemini models were unavailable or API key not present, use local semantic analyzer
    if (!criteria || typeof criteria !== "object") {
      const lower = rawQuery.toLowerCase();
      let type: 'character' | 'prompt' | 'creator' | 'all' = 'all';
      let gender: string | null = null;
      const tags: string[] = [];

      if (/(\bprompt\b|\bcâu lệnh\b|\blời nhắc\b|\bviết rp\b|\bwriting\b)/i.test(lower)) {
        type = 'prompt';
      } else if (/(\bcreator\b|\btác giả\b|\bngười tạo\b|\buser\b|\bauthor\b)/i.test(lower)) {
        type = 'creator';
      } else if (/(\bcharacter\b|\bnhân vật\b|\bnữ chính\b|\bnam chính\b|\bphản diện\b|\bbot\b)/i.test(lower)) {
        type = 'character';
      }

      if (/\b(nữ|nữ chính|cô gái|female|girl)\b/i.test(lower)) {
        gender = 'Nữ';
      } else if (/\b(nam|nam chính|chàng trai|male|boy)\b/i.test(lower)) {
        gender = 'Nam';
      }

      // Check common roleplay tags
      const commonTags = ['hiện đại', 'cổ đại', 'học đường', 'fantasy', 'kinh dị', 'trinh thám', 'anime', 'huyền huyễn', 'tổng tài', 'tiên hiệp', 'scifi', 'khoa học viễn tưởng', 'hài hước', 'tình cảm'];
      for (const ct of commonTags) {
        if (lower.includes(ct)) {
          tags.push(ct.charAt(0).toUpperCase() + ct.slice(1));
        }
      }

      // Filter words
      const stopWords = new Set(['tìm', 'kiếm', 'cho', 'tôi', 'những', 'các', 'một', 'nhân', 'vật', 'prompt', 'creator', 'và', 'là', 'về', 'trong', 'với', 'hãy']);
      const words = rawQuery
        .split(/[\s,.;:!?/\\-]+/)
        .filter((w: string) => w.length > 1 && !stopWords.has(w.toLowerCase()));

      criteria = {
        type,
        gender,
        tags,
        keywords: words.length > 0 ? words : [rawQuery],
        summary: `Tìm kiếm nội dung phù hợp với "${rawQuery}"`
      };
    }
    
    res.json({ success: true, parsedCriteria: criteria });
  } catch (err) {
    console.error("AI Search route error:", err);
    res.status(500).json({ error: "AI Search failed" });
  }
});

export default router;
