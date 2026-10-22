# Phase 1 Audit — JINI News Intelligence / WordPress Draft Publisher
**Date:** 10/21/2026 | **Target:** beritaindonesia.news

## 1. Komponen yang Ditemukan

### WordPress Integration
- **server/tools/WordPressPublisherTool.mjs** — kelas lengkap WordPressPublisherTool (extends ToolContract)
  - Operasi: 	est, list_posts, list_categories, list_tags, upload_media, create_post
  - Autentikasi Basic (WORDPRESS_USERNAME + WORDPRESS_APP_PASSWORD), timeout 30s, retry 2x
  - Endpoint routing: POST /api/wordpress/test | /posts | /media dan GET /api/wordpress/{posts,categories,tags} di server/local_router/LocalRouterServer.mjs (lines 4104–4197)
  - .env sudah punya placeholder: WORDPRESS_URL=https://beritaindonesia.news, username & app password dummy
- **server/tools/ToolContract.mjs** — dasar Tools

### Document/Knowledge Retrieval (untuk Phase 3&4)
- **server/document/DocumentPipelineAdapter.mjs**, **DocumentEvidence.mjs**, **ClaimEvidenceVerifier.mjs**, **QwenEvidenceReasoner.mjs**, **NineRouterDocumentReader.mjs**
- **server/grounding/CapabilityRegistry.mjs**, **ResponseGroundingGuard.mjs**
- **server/knowledge/DomainKnowledgeGraph.mjs**, **DomainOntologyAdapters.mjs**

### Tavily (external search)
- TAVILY_API_KEY ada di .env → 	ool_search via WebSearchTool/MultiLayerSearchTool digunakan external mode

## 2. Jelas: JINI Saat Ini HANYA Menggunakan Snippet External Search
- WordPress integration **hanya "publish/archive"** (WordPressPublisherTool) → belum ada **ingestion** ke knowledge base.
- Tidak ada komponen yang membaca wp-json/wp/v2/posts untuk indexing, dan tidak ada content/passage caching.
- JADI: **belum ada RAG internal** — all answers would use external search only (Tavily) → Phase 2 belum terlaksana.

## 3. Reusable Components (tidak perlu dibuat duplikat)
- WordPressPublisherTool → dicopus, dipakai langsung untuk save as draft (Phase 5).
- DocIntel-related readers & QwenEvidenceReasoner → bisa dipakai di indexing/retrieval phase 3&4.
- ResponseGroundingGuard → langsung dipakai untuk verifikasi no-invented-citation.
- TAVILY → external mode, already configured.

## 4. Kekurangan Kritis
1. **No WordPress REST ingestion pipeline** → belum nyambung ke wp-json/wp/v2/posts.
2. **No persistent article index** (SQLite/JSON/Vector) → Phase 3 belum ada.
3. **No retrieval layer** → Phase 4 belum ada.

## 5. Rekomendasi Awal
1. **Phase 5 fokus dulu**: create_post → status draft (enrek minimum).
2. Setelah draft terbukti, baru bangun ingestion + index + retrieval.
3. Print wordpress.publish dari JINI dengan status=draft.

## 6. Risiko
- WordPres tidak dapat diakses (offline/none) → uji pakai operation=test & list_posts.
- App password tidak valid → endpoint akan me-return error jelas.
