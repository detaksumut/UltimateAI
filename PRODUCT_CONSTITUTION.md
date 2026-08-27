# PRODUCT CONSTITUTION
**APASIFIC Ecosystem & Product-Driven Architecture**

## I. Core Philosophy

1. **The Ecosystem Paradigm**
   - **APASIFIC** is a world-class Digital Academic Ecosystem. It is the primary product and the ultimate destination of value.
   - **EAEP (Enterprise AI Engineering Platform)** is the underlying Operating System (OS). It is not the product itself; its success is measured by its invisibility and the flawless operation of the products built upon it.
   - The hierarchy is absolute:
     ```text
     EAEP (The OS)
      │
      ├── APASIFIC (The Primary Enterprise Ecosystem)
      ├── Future Product A
      └── Future Product B
     ```

2. **The Pillars of APASIFIC**
   - **Membership** is the single, unified digital identity (Academic Profile, Digital Academic ID, Verification, Member Directory, Lifecycle).
   - **Journal** and **Certification** are the two main pillars of the ecosystem.
   - **Unified Identity:** All modules, features, and future products within the ecosystem MUST utilize the exact same Membership identity.
   - **OS Foundation:** All APASIFIC products run exclusively on top of EAEP.

## II. Product-Driven Architecture (Evolution Rule)

EAEP is no longer evolving for the sake of being a framework. Any changes to the underlying engine must strictly follow the **Product-Driven Architecture** flow.

**The Golden Flow of Evolution:**
1. **Kebutuhan Produk** (The product absolutely requires it to function)
2. **Reference Implementation** (Proof of concept in product space)
3. **Validation** (Proving the reference works seamlessly)
4. **ADR (Architecture Decision Record)** (Formalizing the change)
5. **Perubahan EAEP** (The OS is updated to support the product)

*Bukan sebaliknya. Jika APASIFIC tidak membutuhkannya, EAEP tidak berubah.*

## III. Integration Philosophy (The n8n Stance)

External tools (such as n8n, Temporal, or Native Runtimes) are **Options, not Core Dependencies.**
- They are neither part of EAEP nor part of APASIFIC.
- They exist solely as integration adapters if a specific product requirement demands them.
- **Sovereignty:** If a client chooses not to use n8n, APASIFIC must continue to run flawlessly. Platform sovereignty is paramount.

```text
APASIFIC (Product)
   ↓
EAEP (OS)
   ↓
Compilation Artifact
   ↓
[Adapter] (e.g., n8n Adapter)
   ↓
External Workflow (e.g., n8n)
```

## IV. The APASIFIC Core Focus

Moving forward, 100% of engineering energy is diverted to **APASIFIC Core**:
- **Membership:** Identity, Verification, Directory.
- **Journal:** Double Blind Review, Reviewer Assignment, Editorial Decision, Publication, DOI, Indexing.
- **Professional Certification:** Exam, Interview, Board Decision, Certificate, Renewal.

*The engine has matured when its complexity is hidden, and the value is entirely felt by the users of the product.*
