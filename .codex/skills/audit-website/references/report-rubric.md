# Website Audit Rubric

Use this reference when converting the crawl artifact and browser observations into the final report.

## Writing standard

- Write in the user's language unless they ask for another one.
- Prefer evidence-backed statements over generic advice.
- Distinguish clearly between `Observed`, `Inferred`, and `Unverified` findings when certainty matters.
- Cite concrete pages, navigation labels, forms, CTA copy, or flows whenever possible.
- Do not claim the site has "all features" unless they were actually accessible during the audit.

## Recommended report structure

### 1. Executive summary

- Explain what the site appears to do in 3-6 sentences.
- State the likely ICP, business motion, and maturity level.
- Mention the biggest strengths and the largest risks.

### 2. Evidence overview

- Include the most important pages or artifacts reviewed.
- Mention the crawl size, key verified paths, and any major coverage gaps.

### 3. Layer 1: Positioning (`定位层`)

Answer:

- What is the site for?
- What problem does it claim to solve?
- Is it a product site, service site, content site, marketplace, community, or mixed model?
- Is the positioning clear, differentiated, and credible?

Evidence to use:

- homepage hero
- title and H1
- top navigation
- repeated product/category labels
- recurring proof points

### 4. Layer 2: Users (`用户层`)

Answer:

- Who is the primary audience?
- Are there clear secondary audiences?
- What signals show the buyer, user, admin, or operator roles?
- Does the language fit SMB, mid-market, enterprise, consumers, or a niche professional segment?

Evidence to use:

- industry pages
- role language
- CTA wording
- case studies
- compliance and deployment language

### 5. Layer 3: Capabilities (`功能层`)

Break the feature set into buckets instead of listing pages blindly:

- Core product capabilities
- Acquisition and conversion capabilities
- Support, trust, and retention capabilities
- Content and education capabilities

For each bucket, separate:

- Confirmed features
- Likely but unverified features

### 6. Layer 4: Processes (`流程层`)

Summarize the most important observed paths:

- homepage to product understanding
- homepage to pricing or CTA
- homepage to signup, demo, or contact
- navigation to docs, help, or proof

Call out broken, missing, or confusing transitions.

### 7. Layer 5: Data (`数据层`)

Answer:

- What are the main inputs?
- What are the main outputs?
- What entities, records, or content objects appear central?
- Is the data flow self-serve, operator-driven, system-driven, or mixed?

Examples of evidence:

- forms
- uploads
- dashboards
- reports
- recommendations
- alerts
- segments
- exports
- content generation

### 8. Layer 6: Technology (`技术层`)

Answer:

- What technical implementation clues are visible?
- Is there evidence of a SPA, static site, SSR app, CMS, embedded forms, analytics SDKs, auth flows, APIs, or documentation-driven product delivery?
- Are there deployment, security, compliance, or integration clues?

Guidance:

- Keep this layer evidence-backed.
- If you only have weak hints, say `Unverified` instead of overstating.
- Distinguish between website implementation clues and product implementation clues.

### 9. Layer 7: Business (`商业层`)

Answer:

- How does the company likely make money?
- Is the motion self-serve, sales-led, partner-led, ads-driven, subscription, transaction, services, or mixed?
- What signals indicate monetization, expansion, retention, or qualification strategy?

Evidence to use:

- pricing visibility
- trial or demo structure
- content gating
- consultation CTAs
- services language
- implementation offers
- partner or reseller pages

### 10. Structural synthesis

This section is mandatory. It converts the seven layers into decision-ready statements.

#### 10.1 Capability collaboration (`能力协同`)

Answer:

- How do the major capabilities work together?
- Which capabilities are foundational, enabling, or downstream?
- Which parts appear to be acquisition-facing, analysis-facing, execution-facing, or governance-facing?

Good output shape:

- `A enables B`
- `B produces inputs for C`
- `C closes the loop back into A`

#### 10.2 Core loop (`核心闭环`)

Answer:

- What is the central loop that makes this website or product work?
- Is there a user loop, operator loop, data loop, or revenue loop?

Guidance:

- Prefer one-line causal loops first.
- Then explain briefly why that loop matters.

#### 10.3 Growth mechanism (`增长机制`)

Answer:

- How does the site likely attract attention?
- How does it educate and qualify visitors?
- How does it convert them?
- How does it retain, expand, or deepen account value?

Possible components:

- SEO or content
- demos
- free tools
- case studies
- sales contact
- onboarding
- expansion into adjacent modules

#### 10.4 Common abilities vs core moat (`通用能力与核心壁垒`)

Answer:

- Which capabilities look table-stakes or common in the category?
- Which capabilities look hard to replicate, deeply integrated, operationally difficult, compliance-heavy, data-network-based, or trust-based?

Guidance:

- Be careful not to call every feature a moat.
- Reserve `核心壁垒` for capabilities that appear differentiated and defensible.

### 11. Cross-layer professional analysis

After the seven layers, add a short synthesis that evaluates the site as a system instead of isolated sections.

Assess the site across these dimensions:

- Product clarity: Is the offer understandable quickly?
- Information architecture: Can users find the right pages and flows?
- UX and interaction quality: Are CTAs, forms, navigation, and page hierarchy usable?
- Content quality: Is the copy specific, credible, and matched to the audience?
- Conversion design: Are there clear next steps, proof, and low-friction funnels?
- Trust signals: Security, compliance, case studies, testimonials, logos, team, contactability
- SEO basics: Titles, descriptions, headings, crawlable structure, content targeting
- Accessibility and inclusiveness: Semantic structure, alt signals, form clarity, contrast clues when visible
- Performance clues: Obvious loading issues, oversized pages, intrusive popups, heavy script dependence

### 12. Recommendations

Prioritize recommendations using a simple impact lens:

- High impact: directly affects comprehension, trust, or conversion
- Medium impact: improves discoverability or reduces friction
- Low impact: polish, consistency, or incremental gains

Each recommendation should say:

- what to change
- why it matters
- which user or metric it affects

### 13. Limitations

List anything that limited confidence, such as:

- login walls
- broken rendering
- blocked scripts
- partial crawl coverage
- geo or cookie gating
- missing pricing or product detail
