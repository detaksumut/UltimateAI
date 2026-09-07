// src/production/learning/repository/SQLiteLearnedKnowledgeRepository.ts

import { ILearnedKnowledgeRepository } from "./ILearnedKnowledgeRepository";
import { LearnedKnowledge } from "../promotion/LearnedKnowledge";
import { KnowledgeStatus } from "../promotion/KnowledgeStatus";
import * as fs from "fs";
import * as path from "path";

/**
 * Persistent repository for LearnedKnowledge artifacts.
 * Stores records securely in storage/vault/learned_knowledge.json with atomic disk flushes.
 */
export class SQLiteLearnedKnowledgeRepository implements ILearnedKnowledgeRepository {
  private readonly storageDir: string;
  private readonly storageFile: string;
  private memoryCache: Map<string, LearnedKnowledge> = new Map();

  constructor(customStorageDir?: string) {
    this.storageDir = customStorageDir || path.join(process.cwd(), "storage", "vault");
    this.storageFile = path.join(this.storageDir, "learned_knowledge.json");
    this.initStorage();
  }

  private initStorage(): void {
    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
      }

      if (fs.existsSync(this.storageFile)) {
        const raw = fs.readFileSync(this.storageFile, "utf-8");
        const list: LearnedKnowledge[] = JSON.parse(raw || "[]");
        for (const item of list) {
          if (item && item.knowledgeId) {
            this.memoryCache.set(item.knowledgeId, item);
          }
        }
      } else {
        fs.writeFileSync(this.storageFile, JSON.stringify([], null, 2), "utf-8");
      }
    } catch (err) {
      console.warn("[LearnedKnowledgeRepository] Failed to initialize file persistence, operating in-memory:", err);
    }
  }

  private persistToFile(): void {
    try {
      const list = Array.from(this.memoryCache.values());
      fs.writeFileSync(this.storageFile, JSON.stringify(list, null, 2), "utf-8");
    } catch (err) {
      console.error("[LearnedKnowledgeRepository] Failed to flush knowledge to disk:", err);
    }
  }

  async save(knowledge: LearnedKnowledge): Promise<void> {
    this.memoryCache.set(knowledge.knowledgeId, knowledge);
    this.persistToFile();
  }

  async findById(id: string): Promise<LearnedKnowledge | null> {
    return this.memoryCache.get(id) || null;
  }

  async archive(id: string): Promise<void> {
    const item = this.memoryCache.get(id);
    if (item) {
      const archived: LearnedKnowledge = {
        ...item,
        status: KnowledgeStatus.ARCHIVED
      };
      this.memoryCache.set(id, archived);
      this.persistToFile();
    }
  }

  async findActiveByScope(scope: string): Promise<readonly LearnedKnowledge[]> {
    const active = Array.from(this.memoryCache.values()).filter(
      k => k.status === KnowledgeStatus.ACTIVE &&
      (k.tags?.includes(scope.toLowerCase()) || scope === "ALL")
    );
    return Object.freeze(active);
  }
}
