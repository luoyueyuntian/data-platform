#!/usr/bin/env node

import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_OUT_DIR = 'reports/website-audits';
const DEFAULT_MAX_PAGES = 20;
const DEFAULT_MAX_DEPTH = 2;
const DEFAULT_TIMEOUT_MS = 15000;
const SKIPPED_EXTENSIONS =
  /\.(?:pdf|jpg|jpeg|png|gif|svg|webp|ico|zip|gz|rar|7z|xml|txt|json|rss|atom|css|js|map|mp4|mp3|woff2?|ttf|eot)$/i;

function printHelp() {
  console.log(`Usage:
  node scripts/prepare-site-audit.mjs <url> [options]

Options:
  --out-dir <dir>         Output directory root (default: ${DEFAULT_OUT_DIR})
  --max-pages <n>         Maximum HTML pages to crawl (default: ${DEFAULT_MAX_PAGES})
  --max-depth <n>         Maximum same-origin link depth from the start page (default: ${DEFAULT_MAX_DEPTH})
  --timeout-ms <n>        Per-request timeout in milliseconds (default: ${DEFAULT_TIMEOUT_MS})
  --overwrite-report      Overwrite an existing Markdown report
  --help                  Show this help message
`);
}

function parseArgs(argv) {
  const args = [...argv];
  if (args.length === 0 || args.includes('--help')) {
    printHelp();
    process.exit(args.includes('--help') ? 0 : 1);
  }

  const options = {
    outDir: DEFAULT_OUT_DIR,
    maxPages: DEFAULT_MAX_PAGES,
    maxDepth: DEFAULT_MAX_DEPTH,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    overwriteReport: false,
  };

  const url = args.shift();

  while (args.length > 0) {
    const token = args.shift();

    switch (token) {
      case '--out-dir':
        options.outDir = args.shift() ?? options.outDir;
        break;
      case '--max-pages':
        options.maxPages = Number.parseInt(args.shift() ?? '', 10) || DEFAULT_MAX_PAGES;
        break;
      case '--max-depth':
        options.maxDepth = Number.parseInt(args.shift() ?? '', 10) || DEFAULT_MAX_DEPTH;
        break;
      case '--timeout-ms':
        options.timeoutMs = Number.parseInt(args.shift() ?? '', 10) || DEFAULT_TIMEOUT_MS;
        break;
      case '--overwrite-report':
        options.overwriteReport = true;
        break;
      default:
        throw new Error(`Unknown option: ${token}`);
    }
  }

  return { url, options };
}

function normalizeUrl(rawUrl) {
  const withProtocol = /^[a-z]+:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  const url = new URL(withProtocol);
  url.hash = '';
  if (!url.pathname) {
    url.pathname = '/';
  }
  return canonicalizeUrl(url);
}

function canonicalizeUrl(input) {
  const url = new URL(input);
  url.hash = '';

  for (const key of [...url.searchParams.keys()]) {
    if (key.startsWith('utm_') || ['fbclid', 'gclid'].includes(key)) {
      url.searchParams.delete(key);
    }
  }

  if (url.pathname !== '/' && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.replace(/\/+$/, '');
  }

  return url.toString();
}

function slugify(value) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'site'
  );
}

function buildSiteSlug(url) {
  const host = slugify(url.hostname);
  const pathname = url.pathname === '/' ? '' : `-${slugify(url.pathname)}`;
  return `${host}${pathname}`.replace(/-+$/, '');
}

function decodeEntities(text) {
  const entityMap = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
  };

  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (_, code) => entityMap[code.toLowerCase()] ?? `&${code};`);
}

function collapseWhitespace(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function stripHtml(html) {
  return collapseWhitespace(
    decodeEntities(
      html
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
        .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
        .replace(/<[^>]+>/g, ' '),
    ),
  );
}

function extractFirstMatch(html, pattern) {
  const match = pattern.exec(html);
  return match ? collapseWhitespace(decodeEntities(match[1])) : '';
}

function extractRepeatedText(html, pattern, limit = 8) {
  const values = [];

  for (const match of html.matchAll(pattern)) {
    const text = collapseWhitespace(decodeEntities(stripHtml(match[1])));
    if (text && !values.includes(text)) {
      values.push(text);
    }
    if (values.length >= limit) {
      break;
    }
  }

  return values;
}

function extractMetaContent(html, names) {
  const tags = [...html.matchAll(/<meta\b[^>]*>/gi)];

  for (const tagMatch of tags) {
    const tag = tagMatch[0];
    const nameMatch = tag.match(/\b(?:name|property)=["']([^"']+)["']/i);
    const contentMatch = tag.match(/\bcontent=["']([^"']*)["']/i);

    if (!nameMatch || !contentMatch) {
      continue;
    }

    const name = nameMatch[1].toLowerCase();
    if (names.includes(name)) {
      return collapseWhitespace(decodeEntities(contentMatch[1]));
    }
  }

  return '';
}

function normalizeCandidateUrl(rawHref, baseUrl) {
  try {
    if (!rawHref || rawHref.startsWith('#')) {
      return null;
    }

    const trimmed = rawHref.trim();
    if (/^(javascript:|mailto:|tel:)/i.test(trimmed)) {
      return null;
    }

    const nextUrl = new URL(trimmed, baseUrl);
    return canonicalizeUrl(nextUrl);
  } catch {
    return null;
  }
}

function isSameOrigin(candidate, origin) {
  try {
    return new URL(candidate).origin === origin;
  } catch {
    return false;
  }
}

function shouldSkipUrl(candidate) {
  const url = new URL(candidate);
  return SKIPPED_EXTENSIONS.test(url.pathname);
}

function summarizePageSignals(page) {
  const signals = [];

  if (page.h1) {
    signals.push(`H1: ${page.h1}`);
  }
  if (page.buttons.length > 0) {
    signals.push(`CTAs: ${page.buttons.slice(0, 3).join(', ')}`);
  }
  if (page.formCount > 0) {
    signals.push(`Forms: ${page.formCount}`);
  }
  if (page.navItems.length > 0) {
    signals.push(`Nav: ${page.navItems.slice(0, 4).join(', ')}`);
  }

  return signals.join(' | ') || 'General content page';
}

function extractLinks(html, pageUrl, origin) {
  const links = [];

  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const normalized = normalizeCandidateUrl(match[1], pageUrl);
    if (!normalized || !isSameOrigin(normalized, origin) || shouldSkipUrl(normalized)) {
      continue;
    }

    const text = collapseWhitespace(stripHtml(match[2]));
    links.push({
      url: normalized,
      text,
    });
  }

  return links;
}

function extractPageData(html, pageUrl, origin, status) {
  const url = new URL(pageUrl);
  const title = extractFirstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const metaDescription = extractMetaContent(html, ['description', 'og:description', 'twitter:description']);
  const h1 = extractFirstMatch(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const h2s = extractRepeatedText(html, /<h2[^>]*>([\s\S]*?)<\/h2>/gi, 6);
  const navItems = [...html.matchAll(/<nav\b[^>]*>([\s\S]*?)<\/nav>/gi)]
    .slice(0, 3)
    .flatMap((match) => extractRepeatedText(match[1], /<a\b[^>]*>([\s\S]*?)<\/a>/gi, 8))
    .filter((value, index, list) => list.indexOf(value) === index)
    .slice(0, 8);
  const buttons = [
    ...extractRepeatedText(html, /<button\b[^>]*>([\s\S]*?)<\/button>/gi, 8),
    ...[...html.matchAll(/<input\b[^>]*type=["'](?:submit|button)["'][^>]*value=["']([^"']+)["'][^>]*>/gi)]
      .map((match) => collapseWhitespace(decodeEntities(match[1])))
      .filter(Boolean),
  ].filter((value, index, list) => list.indexOf(value) === index);
  const formCount = [...html.matchAll(/<form\b/gi)].length;
  const links = extractLinks(html, pageUrl, origin);
  const internalLinks = links
    .map((link) => link.url)
    .filter((value, index, list) => list.indexOf(value) === index)
    .slice(0, 80);
  const linkedLabels = links
    .map((link) => link.text)
    .filter(Boolean)
    .filter((value, index, list) => list.indexOf(value) === index)
    .slice(0, 15);
  const textPreview = stripHtml(html).slice(0, 280);

  return {
    url: pageUrl,
    path: url.pathname,
    status,
    title,
    metaDescription,
    h1,
    h2s,
    navItems,
    buttons,
    formCount,
    internalLinks,
    linkedLabels,
    textPreview,
  };
}

function scoreCandidate(candidate, startUrl) {
  const url = new URL(candidate);
  const pathName = url.pathname.toLowerCase();

  if (candidate === startUrl) {
    return 100;
  }

  let score = 0;
  const keywords = [
    ['pricing', 24],
    ['product', 22],
    ['feature', 22],
    ['platform', 20],
    ['solution', 18],
    ['use-case', 18],
    ['demo', 16],
    ['signup', 16],
    ['sign-up', 16],
    ['contact', 16],
    ['docs', 14],
    ['security', 14],
    ['customer', 12],
    ['case-study', 12],
    ['about', 10],
    ['blog', 6],
    ['login', -10],
    ['privacy', -20],
    ['terms', -20],
  ];

  for (const [keyword, value] of keywords) {
    if (pathName.includes(keyword)) {
      score += value;
    }
  }

  score -= Math.max(pathName.split('/').filter(Boolean).length - 1, 0) * 2;
  return score;
}

async function fetchText(url, timeoutMs) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'AuditWebsiteSkill/1.0 (+https://openai.com)',
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
  });

  return {
    ok: response.ok,
    status: response.status,
    url: response.url,
    contentType: response.headers.get('content-type') ?? '',
    text: await response.text(),
  };
}

async function fetchRobotsAndSitemaps(startUrl, timeoutMs) {
  const originUrl = new URL(startUrl);
  const robotsUrl = new URL('/robots.txt', originUrl).toString();
  const result = {
    robotsUrl,
    robotsAvailable: false,
    disallow: [],
    sitemapUrls: [],
  };

  try {
    const robots = await fetchText(robotsUrl, timeoutMs);
    if (robots.ok) {
      result.robotsAvailable = true;
      result.disallow = robots.text
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => /^disallow:/i.test(line))
        .map((line) => line.split(':').slice(1).join(':').trim())
        .filter(Boolean)
        .slice(0, 20);
      result.sitemapUrls = robots.text
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => /^sitemap:/i.test(line))
        .map((line) => line.split(':').slice(1).join(':').trim())
        .filter(Boolean);
    }
  } catch {
    // Best effort only.
  }

  if (result.sitemapUrls.length === 0) {
    result.sitemapUrls.push(new URL('/sitemap.xml', originUrl).toString());
  }

  return result;
}

function extractXmlLocs(xml) {
  return [...xml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)].map((match) => decodeEntities(match[1]).trim()).filter(Boolean);
}

async function collectSitemapPageUrls(startUrl, timeoutMs, sitemapUrls) {
  const pageUrls = new Set();
  const pending = [...sitemapUrls];
  const visited = new Set();

  while (pending.length > 0 && visited.size < 6) {
    const sitemapUrl = pending.shift();
    if (!sitemapUrl || visited.has(sitemapUrl)) {
      continue;
    }

    visited.add(sitemapUrl);

    try {
      const response = await fetchText(sitemapUrl, timeoutMs);
      if (!response.ok) {
        continue;
      }

      const locs = extractXmlLocs(response.text);
      if (response.text.includes('<sitemapindex')) {
        for (const loc of locs) {
          if (!visited.has(loc)) {
            pending.push(loc);
          }
        }
        continue;
      }

      for (const loc of locs) {
        const normalized = normalizeCandidateUrl(loc, startUrl);
        if (normalized && isSameOrigin(normalized, new URL(startUrl).origin) && !shouldSkipUrl(normalized)) {
          pageUrls.add(normalized);
        }
      }
    } catch {
      // Best effort only.
    }
  }

  return [...pageUrls];
}

function buildPageInventoryTable(pages) {
  const rows = pages.slice(0, 20).map((page) => {
    const title = page.title || '(untitled)';
    const signals = summarizePageSignals(page).replace(/\|/g, '/');
    return `| ${page.path} | ${title} | ${signals} |`;
  });

  return ['| Page | Title | Signals |', '| --- | --- | --- |', ...rows].join('\n');
}

function buildReportTemplate({ startUrl, slug, crawlPath, pages, options }) {
  return `# Website Audit: ${new URL(startUrl).hostname}

## Audit Metadata

- URL: ${startUrl}
- Generated at: ${new Date().toISOString()}
- Crawl artifact: ${crawlPath}
- Pages crawled: ${pages.length}
- Crawl limits: maxPages=${options.maxPages}, maxDepth=${options.maxDepth}
- Confidence note: Update after manual browser verification.

## Executive Summary

[Write a concise summary of what the site does, who it targets, and the biggest strengths and risks.]

## Evidence Overview

- Key pages reviewed:
- Crawl coverage summary:
- Important verification gaps:

## Layer 1: Positioning (定位层)

[Explain what the site is for, what problem it claims to solve, and whether the positioning is clear and differentiated.]

## Layer 2: Users (用户层)

[Explain who the site is for, who the likely buyer and operator are, and what audience signals are visible.]

## Layer 3: Capabilities (功能层)

### Confirmed capabilities

- [ ]

### Likely but unverified capabilities

- [ ]

## Key Page Inventory

${buildPageInventoryTable(pages)}

## Layer 4: Processes (流程层)

[Explain how users discover value, evaluate the offer, and complete important tasks such as signup, demo booking, contact, download, or support.]

## Layer 5: Data (数据层)

[Explain the main inputs, outputs, key records, and inferred data flow of the website or product.]

## Layer 6: Technology (技术层)

[Describe visible implementation clues, platform hints, SDK or integration signals, rendering clues, and what remains unverified.]

## Layer 7: Business (商业层)

[Explain how the company likely makes money and what the monetization motion appears to be.]

## Structural Synthesis

### Capability Collaboration (能力协同)

[Explain how the main capabilities work together and which capabilities are foundational, enabling, and downstream.]

### Core Loop (核心闭环)

[Write the central operating loop in one line, then explain briefly why it matters.]

### Growth Mechanism (增长机制)

[Explain how the site likely attracts, educates, qualifies, converts, and expands users or accounts.]

### Common Abilities vs Core Moat (通用能力与核心壁垒)

#### Common abilities

- [ ]

#### Core moat

- [ ]

## Cross-Layer Analysis

### UX and information architecture

[Assess navigation, hierarchy, flow clarity, and friction.]

### Content and messaging

[Assess specificity, credibility, and audience fit.]

### SEO and discoverability

[Assess titles, descriptions, headings, crawlability, and content targeting.]

### Trust, accessibility, and performance clues

[Assess trust signals, accessibility clues, and visible performance issues.]

## Prioritized Recommendations

### High impact

- [ ]

### Medium impact

- [ ]

### Low impact

- [ ]

## Limitations and Confidence Notes

- Scope:
- Observed vs inferred:
- Missing or inaccessible areas:

<!-- Generated by $audit-website (${slug}) -->
`;
}

async function fileExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function crawlSite(startUrl, options) {
  const origin = new URL(startUrl).origin;
  const robots = await fetchRobotsAndSitemaps(startUrl, options.timeoutMs);
  const sitemapPageUrls = await collectSitemapPageUrls(startUrl, options.timeoutMs, robots.sitemapUrls);

  const queue = [{ url: startUrl, depth: 0, source: 'start' }];
  const queued = new Set([startUrl]);
  const visited = new Set();
  const pages = [];
  const errors = [];

  for (const sitemapUrl of sitemapPageUrls) {
    if (queued.size >= options.maxPages * 3) {
      break;
    }

    if (!queued.has(sitemapUrl)) {
      queue.push({ url: sitemapUrl, depth: 1, source: 'sitemap' });
      queued.add(sitemapUrl);
    }
  }

  while (queue.length > 0 && pages.length < options.maxPages) {
    queue.sort((left, right) => {
      const scoreDelta = scoreCandidate(right.url, startUrl) - scoreCandidate(left.url, startUrl);
      if (scoreDelta !== 0) {
        return scoreDelta;
      }
      return left.depth - right.depth;
    });

    const current = queue.shift();
    if (!current || visited.has(current.url)) {
      continue;
    }

    visited.add(current.url);

    try {
      const response = await fetchText(current.url, options.timeoutMs);
      if (!response.contentType.includes('html')) {
        continue;
      }

      const page = extractPageData(response.text, response.url, origin, response.status);
      pages.push(page);

      if (current.depth >= options.maxDepth) {
        continue;
      }

      for (const nextUrl of page.internalLinks) {
        if (visited.has(nextUrl) || queued.has(nextUrl) || shouldSkipUrl(nextUrl)) {
          continue;
        }
        queue.push({ url: nextUrl, depth: current.depth + 1, source: page.url });
        queued.add(nextUrl);
      }
    } catch (error) {
      errors.push({
        url: current.url,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    robots,
    pages,
    errors,
    sitemapSeedCount: sitemapPageUrls.length,
  };
}

async function main() {
  const { url, options } = parseArgs(process.argv.slice(2));
  const startUrl = normalizeUrl(url);
  const slug = buildSiteSlug(new URL(startUrl));
  const targetDir = path.resolve(process.cwd(), options.outDir, slug);
  const crawlPath = path.join(targetDir, `${slug}.crawl.json`);
  const reportPath = path.join(targetDir, `${slug}.md`);

  await mkdir(targetDir, { recursive: true });

  const crawlResult = await crawlSite(startUrl, options);
  const crawlArtifact = {
    generatedAt: new Date().toISOString(),
    startUrl,
    origin: new URL(startUrl).origin,
    slug,
    options,
    artifacts: {
      crawlPath,
      reportPath,
    },
    robots: crawlResult.robots,
    crawlSummary: {
      pagesCrawled: crawlResult.pages.length,
      sitemapSeedCount: crawlResult.sitemapSeedCount,
      errorCount: crawlResult.errors.length,
    },
    pages: crawlResult.pages.map((page) => ({
      ...page,
      summary: summarizePageSignals(page),
    })),
    errors: crawlResult.errors,
  };

  await writeFile(crawlPath, `${JSON.stringify(crawlArtifact, null, 2)}\n`, 'utf8');

  const reportExists = await fileExists(reportPath);
  if (!reportExists || options.overwriteReport) {
    const report = buildReportTemplate({
      startUrl,
      slug,
      crawlPath,
      pages: crawlResult.pages,
      options,
    });
    await writeFile(reportPath, report, 'utf8');
  }

  console.log(
    JSON.stringify(
      {
        startUrl,
        slug,
        crawlPath,
        reportPath,
        reportUpdated: !reportExists || options.overwriteReport,
        pagesCrawled: crawlResult.pages.length,
        errorCount: crawlResult.errors.length,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
