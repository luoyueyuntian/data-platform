---
name: audit-website
description: Analyze a website from a supplied URL and write a Markdown report using a seven-layer model: positioning, users, capabilities, processes, data flows, technology clues, and business model. Use when Codex is asked to review a website, summarize what a site does, explain who it serves, map how users complete tasks, infer inputs and outputs, identify likely technical implementation clues, benchmark a competitor, or turn a URL into a professional analysis document.
---

# Audit Website

Use this skill to turn a URL into a professional website audit saved in the workspace. The default output is a Markdown report under `reports/website-audits/<site-slug>/`, plus a crawl artifact that records the pages and signals that were discovered automatically.

## Workflow

### 1. Define scope before browsing

- Treat the target as the public, same-origin website unless the user requests a narrower scope.
- Mirror the user's language in the final report.
- If the user does not specify an output path, write to `reports/website-audits/<site-slug>/<site-slug>.md`.
- If the site requires login, heavy geo/cookie interaction, or only renders correctly after client-side navigation, record that limitation explicitly and separate observed findings from inferred findings.

### 2. Generate the crawl artifacts first

Run the bundled helper before manual analysis:

```bash
node scripts/prepare-site-audit.mjs <url>
```

Useful options:

```bash
node scripts/prepare-site-audit.mjs <url> --out-dir reports/custom-audits
node scripts/prepare-site-audit.mjs <url> --max-pages 30 --max-depth 3
node scripts/prepare-site-audit.mjs <url> --overwrite-report
```

The script:

- normalizes the URL
- fetches `robots.txt` and likely sitemap locations
- crawls the public same-origin HTML pages up to the configured limit
- extracts page titles, headings, navigation labels, buttons, forms, and internal links
- writes a crawl artifact JSON file
- creates a report skeleton if one does not already exist

Read the generated crawl JSON before deciding which pages need manual verification.

### 3. Verify key user journeys in a real browser

- Prefer the Browser plugin for rendered pages and interactive flows.
- If a real browser surface is unavailable, fall back to the available web browsing tools and state that rendered interactions were only partially verified.
- Start with the homepage and the highest-signal pages discovered by the crawl, usually:
  - pricing
  - product or features
  - solutions or use cases
  - signup, demo, or contact flows
  - docs, help, or support
  - customer proof, security, or trust pages
- If the site is JavaScript-heavy and the crawl returns thin content, switch quickly to browser-first analysis instead of pretending the crawl was exhaustive.
- Do not claim complete coverage if parts of the site are hidden behind auth, region gates, or broken navigation. Label those sections as unverified.

### 4. Map the site into the seven-layer model

Build the analysis in this order so the reasoning stays grounded:

1. `定位层`: Determine what the site is for.
   Use the homepage hero, titles, H1s, recurring category labels, and top-level navigation.
2. `用户层`: Determine who the site serves.
   Use industry pages, role language, CTA wording, case studies, pricing posture, and compliance language.
3. `功能层`: Inventory what the site can do.
   Use product pages, feature pages, docs, demo centers, forms, and support pages.
4. `流程层`: Explain how users complete important tasks.
   Trace journeys such as discovery, evaluation, signup, booking a demo, contacting sales, downloading content, or using a self-serve product path.
5. `数据层`: Infer the main inputs and outputs.
   Look for forms, uploads, dashboards, reports, segmentation, recommendations, alerts, exports, or other evidence of what data enters and what artifacts or actions come out.
6. `技术层`: Infer how the site or product is likely implemented.
   Use visible source clues, page structure, script-loaded UI patterns, deployment hints, docs language, SDK references, auth patterns, or platform mentions. If evidence is weak, mark the layer as `Unverified`.
7. `商业层`: Determine how the company likely makes money.
   Use pricing visibility, demo requests, sales CTAs, subscription hints, consulting language, implementation services, partner programs, and content gating.

Do not answer later layers before earlier ones are stable. For example, do not infer the revenue model before the positioning, users, and conversion flow are reasonably clear.

### 5. Write the report with evidence discipline

Load [references/report-rubric.md](references/report-rubric.md) when drafting the final report.

Use these evidence labels inside the report when confidence matters:

- `Observed`: seen directly on the site or in a rendered page
- `Inferred`: strongly suggested by the IA, copy, CTAs, or surrounding pages
- `Unverified`: plausible but not confirmed during the session

Keep the report concise but professional. Focus on decisions a product, design, growth, or strategy stakeholder can act on.

### 6. Add the four explicit synthesis outputs

After the seven layers are complete, always add these four explicit sections. Do not leave them implicit inside other paragraphs.

1. `能力协同`
   Explain how the major capabilities work together. Name the upstream and downstream relationships instead of listing features side by side.
2. `核心闭环`
   Summarize the one or two central loops that make the website or product effective. Keep this concise and causal, for example `acquire -> understand -> act -> measure -> improve`.
3. `增长机制`
   Explain how the site likely acquires, educates, qualifies, converts, and expands users or accounts.
4. `通用能力与核心壁垒`
   Separate what appears table-stakes or broadly available in the market from what appears differentiated, hard to replicate, or strategically defensible.

If the evidence is weak for any of these, still include the section and mark the uncertain parts as `Inferred` or `Unverified`.

### 7. Finish with a decision-ready summary

Before closing the task, make sure the report:

- explains all seven layers clearly
- connects capabilities to users and workflows instead of listing features blindly
- explicitly states capability collaboration, the core loop, the growth mechanism, and the common-vs-moat split
- identifies gaps, friction, risk, or trust issues
- prioritizes recommendations by impact
- calls out scope limits and blind spots

## Output Expectations

The final document should normally include:

1. Executive summary
2. Key page inventory or evidence overview
3. `定位层`: what the site is for
4. `用户层`: who it serves
5. `功能层`: what capabilities it offers
6. `流程层`: how users complete important tasks
7. `数据层`: what inputs and outputs matter
8. `技术层`: what implementation clues are visible or inferable
9. `商业层`: how the site likely monetizes
10. Structural synthesis:
    `能力协同`
    `核心闭环`
    `增长机制`
    `通用能力与核心壁垒`
11. Prioritized recommendations
12. Limitations and confidence notes

Default artifact layout:

```text
reports/
  website-audits/
    <site-slug>/
      <site-slug>.md
      <site-slug>.crawl.json
```

If the user names a different output path or document format, honor that request.
