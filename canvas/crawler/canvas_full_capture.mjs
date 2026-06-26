import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

export const DEFAULT_COURSES = [
  {
    course_id: "2080857",
    code: "MTH-252",
    title: "Integral Calculus",
    home_url: "https://canvas.oregonstate.edu/courses/2080857",
  },
  {
    course_id: "2053263",
    code: "MTH-253",
    title: "Sequences and Series",
    home_url: "https://canvas.oregonstate.edu/courses/2053263",
  },
  {
    course_id: "2053526",
    code: "PHY-212",
    title: "Oscillations, Waves, Optics, and Rotation",
    home_url: "https://canvas.oregonstate.edu/courses/2053526",
  },
];

const TOP_SURFACES = [
  { surface: "home", path: "" },
  { surface: "modules", path: "/modules" },
  { surface: "assignments", path: "/assignments" },
  { surface: "grades", path: "/grades" },
  { surface: "announcements", path: "/announcements" },
  { surface: "syllabus", path: "/assignments/syllabus" },
  { surface: "discussions", path: "/discussion_topics" },
  { surface: "quizzes", path: "/quizzes" },
];

const DEFAULT_OPTIONS = {
  courses: DEFAULT_COURSES,
  outputRoot: "/Users/jake/Developer/SU26/canvas/archive",
  maxPages: 600,
  screenshotMode: "surfaces", // "none" | "surfaces" | "all"
  followExternal: false,
  waitAfterLoadMs: 900,
  networkIdleMs: 8000,
};

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function slugify(value, fallback = "untitled") {
  const slug = cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
  return slug || fallback;
}

function sha256(value) {
  return createHash("sha256").update(value ?? "").digest("hex");
}

function csvEscape(value) {
  if (value == null) return "";
  const text = String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function toCsv(rows, columns) {
  return [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(",")),
  ].join("\n") + "\n";
}

function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return url;
  }
}

function isCanvasLocal(url) {
  try {
    return new URL(url).hostname === "canvas.oregonstate.edu";
  } catch {
    return false;
  }
}

function belongsToCourse(url, courseId) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "canvas.oregonstate.edu" && parsed.pathname.startsWith(`/courses/${courseId}`);
  } catch {
    return false;
  }
}

function shouldSkipCanvasUrl(url, courseId) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "canvas.oregonstate.edu") return true;
    if (!parsed.pathname.startsWith(`/courses/${courseId}`)) return true;
    if (/\/download\b/.test(parsed.pathname) || parsed.searchParams.has("download_frd")) return true;
    if (/\/users(\/|$)/.test(parsed.pathname)) return true;
    if (/\/submissions(\/|$)/.test(parsed.pathname)) return true;
    if (/\/rubrics(\/|$)|\/rubric_associations(\/|$)|\/search\//.test(parsed.pathname)) return true;
    if (parsed.pathname.includes("%7B%7B")) return true;
    if (parsed.pathname.endsWith("/modules")) return false;
    const isAllowedDetail =
      /\/modules\/items\/[^/]+/.test(parsed.pathname) ||
      /\/assignments\/[^/]+/.test(parsed.pathname) ||
      /\/quizzes\/[^/]+/.test(parsed.pathname) ||
      /\/discussion_topics\/[^/]+/.test(parsed.pathname) ||
      /\/pages\/[^/]+/.test(parsed.pathname) ||
      /\/files\/[^/]+/.test(parsed.pathname) ||
      /\/announcements\/[^/]+/.test(parsed.pathname);
    return !isAllowedDetail;
  } catch {
    return true;
  }
}

function inferCanvasObject(url) {
  try {
    const parsed = new URL(url);
    const pathName = parsed.pathname;
    const patterns = [
      ["module_item", /\/modules\/items\/([^/]+)/],
      ["assignment", /\/assignments\/([^/]+)/],
      ["quiz", /\/quizzes\/([^/]+)/],
      ["discussion", /\/discussion_topics\/([^/]+)/],
      ["page", /\/pages\/([^/]+)/],
      ["file", /\/files\/([^/]+)/],
      ["announcement", /\/announcements\/([^/]+)/],
      ["modules", /\/modules$/],
      ["assignments", /\/assignments$/],
      ["grades", /\/grades$/],
      ["discussions", /\/discussion_topics$/],
      ["quizzes", /\/quizzes$/],
      ["syllabus", /\/assignments\/syllabus$/],
    ];
    for (const [type, regex] of patterns) {
      const match = pathName.match(regex);
      if (match) return { type, id: match[1] || "" };
    }
    return { type: "course_page", id: "" };
  } catch {
    return { type: "unknown", id: "" };
  }
}

function shouldScreenshot(item, mode) {
  if (mode === "all") return true;
  if (mode === "none") return false;
  return item.kind === "surface" || item.source_surface === "error";
}

async function ensureDirs(root) {
  const dirs = [
    root,
    "raw_html",
    "markdown",
    "text",
    "screenshots",
    "metadata",
    "downloads",
    "normalized",
  ];
  for (const dir of dirs) await mkdir(path.join(root, dir), { recursive: true });
}

async function gotoAndWait(tab, url, options) {
  await tab.goto(url);
  await tab.playwright.waitForLoadState({ state: "domcontentloaded", timeoutMs: 60_000 }).catch(() => null);
  if (options.waitAfterLoadMs > 0) {
    await tab.playwright.waitForTimeout(options.waitAfterLoadMs);
  }
  await tab.playwright.waitForLoadState({ state: "networkidle", timeoutMs: options.networkIdleMs }).catch(() => null);
}

async function extractPageSnapshot(tab, requestedUrl, course, sourceSurface) {
  return await tab.playwright.evaluate(
    ({ requestedUrl, course, sourceSurface }) => {
      const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
      const attr = (element, name) => element?.getAttribute(name) || "";
      const main = document.querySelector("main") || document.querySelector("#content") || document.body;
      const allLinks = Array.from(document.querySelectorAll("a[href]")).map((a, index) => ({
        index,
        text: clean(a.textContent || attr(a, "aria-label") || attr(a, "title")),
        href: a.href || attr(a, "href"),
        raw_href: attr(a, "href"),
        title: attr(a, "title"),
        download: attr(a, "download"),
        target: attr(a, "target"),
        rel: attr(a, "rel"),
      }));
      const mainLinks = Array.from(main.querySelectorAll("a[href]")).map((a, index) => ({
        index,
        text: clean(a.textContent || attr(a, "aria-label") || attr(a, "title")),
        href: a.href || attr(a, "href"),
        raw_href: attr(a, "href"),
        title: attr(a, "title"),
        download: attr(a, "download"),
        target: attr(a, "target"),
        rel: attr(a, "rel"),
      }));
      const headings = Array.from(main.querySelectorAll("h1,h2,h3,h4,h5,h6")).map((h, index) => ({
        index,
        level: h.tagName,
        text: clean(h.textContent),
      }));
      const iframes = Array.from(document.querySelectorAll("iframe")).map((iframe, index) => ({
        index,
        title: attr(iframe, "title"),
        src: iframe.src || attr(iframe, "src"),
        name: attr(iframe, "name"),
        width: attr(iframe, "width"),
        height: attr(iframe, "height"),
      }));
      const embeds = Array.from(document.querySelectorAll("embed,object")).map((element, index) => ({
        index,
        tag: element.tagName,
        src: attr(element, "src") || attr(element, "data"),
        type: attr(element, "type"),
      }));
      const buttons = Array.from(main.querySelectorAll("button,input[type=button],input[type=submit]")).map((button, index) => ({
        index,
        text: clean(button.textContent || attr(button, "aria-label") || attr(button, "value") || attr(button, "title")),
        type: attr(button, "type"),
        disabled: Boolean(button.disabled),
      }));
      const forms = Array.from(main.querySelectorAll("form")).map((form, index) => ({
        index,
        action: form.action || attr(form, "action"),
        method: attr(form, "method"),
        text: clean(form.textContent).slice(0, 1000),
      }));
      const tables = Array.from(main.querySelectorAll("table")).map((table, index) => ({
        index,
        caption: clean(table.querySelector("caption")?.textContent),
        text: clean(table.innerText || table.textContent),
      }));
      const moduleItems = Array.from(document.querySelectorAll("#context_modules .context_module_item")).map((item, index) => {
        const link = item.querySelector("a.ig-title, a.item_link, .module-item-title a");
        const type = clean(item.querySelector(".type_icon")?.getAttribute("title") || item.querySelector(".type_icon .screenreader-only")?.textContent);
        const module = item.closest(".context_module");
        return {
          index,
          module_title: clean(module?.querySelector(".ig-header-title[aria-expanded=true] .name")?.textContent || module?.querySelector(".ig-header .name")?.textContent || module?.getAttribute("aria-label")),
          type,
          title: clean(link?.textContent || item.querySelector(".ig-title")?.textContent || item.querySelector(".module-item-title")?.textContent),
          href: link?.href || link?.getAttribute("href") || "",
          text: clean(item.textContent),
          class_name: item.className,
        };
      });
      const assignmentRows = Array.from(document.querySelectorAll(".assignment_group li.assignment .ig-row")).map((row, index) => {
        const group = row.closest(".assignment_group");
        const link = row.querySelector("a.ig-title");
        return {
          index,
          group_name: clean(group?.querySelector(".ig-header-title button, .ig-header-title, h2")?.textContent),
          type: clean(row.querySelector(".ig-type-icon .screenreader-only")?.textContent || "Assignment"),
          title: clean(link?.textContent),
          href: link?.href || "",
          due: clean(row.querySelector(".assignment-date-due .screenreader-only, .assignment-date-due .css-r9cwls-screenReaderContent")?.textContent || row.querySelector(".assignment-date-due time")?.getAttribute("title") || row.querySelector(".assignment-date-due")?.textContent),
          available: clean(row.querySelector(".assignment-date-available .screenreader-only, .assignment-date-available .css-r9cwls-screenReaderContent")?.textContent || row.querySelector(".assignment-date-available time")?.getAttribute("title") || row.querySelector(".assignment-date-available")?.textContent),
          text: clean(row.textContent),
        };
      });
      const gradeRows = Array.from(document.querySelectorAll("#grades_summary tbody tr, tr.student_assignment")).map((row, index) => {
        const link = row.querySelector("a[href*='/assignments/']");
        return {
          index,
          title: clean(link?.textContent || row.querySelector("th,td")?.textContent),
          href: link?.href || "",
          cells: Array.from(row.querySelectorAll("th,td")).map((cell) => clean(cell.textContent)),
          text: clean(row.textContent),
        };
      }).filter((row) => row.title);
      const hiddenText = Array.from(main.querySelectorAll(".screenreader-only,.css-r9cwls-screenReaderContent,[aria-label]")).map((element, index) => ({
        index,
        text: clean(element.textContent || attr(element, "aria-label")),
      })).filter((row) => row.text);
      const nav = Array.from(document.querySelectorAll("nav[aria-label='Courses Navigation Menu'] a")).map((a, index) => ({
        index,
        label: clean(a.textContent),
        href: a.href || attr(a, "href"),
      }));
      return {
        requested_url: requestedUrl,
        resolved_url: location.href,
        title: document.title,
        course_id: course.course_id,
        course_code: course.code,
        source_surface: sourceSurface,
        html: document.documentElement.outerHTML,
        visible_text: main.innerText || "",
        text_content: main.textContent || "",
        body_visible_text: document.body?.innerText || "",
        headings,
        links: allLinks,
        main_links: mainLinks,
        iframes,
        embeds,
        buttons,
        forms,
        tables,
        module_items: moduleItems,
        assignment_rows: assignmentRows,
        grade_rows: gradeRows,
        hidden_text: hiddenText,
        nav,
        environment_keys: Object.keys(window.ENV || {}).sort(),
      };
    },
    { requestedUrl, course, sourceSurface },
    { timeoutMs: 30_000 },
  );
}

function pageMarkdown(record) {
  const lines = [
    `# ${record.title || record.resolved_url}`,
    "",
    `- Course: ${record.course_code}`,
    `- Source surface: ${record.source_surface}`,
    `- Requested URL: ${record.requested_url}`,
    `- Resolved URL: ${record.resolved_url}`,
    `- Captured: ${record.captured_at}`,
    `- Canvas object: ${record.canvas_object_type}${record.canvas_object_id ? ` ${record.canvas_object_id}` : ""}`,
    `- Redirected: ${record.redirected ? "yes" : "no"}`,
    "",
    "## Headings",
    ...record.headings.map((heading) => `- ${heading.level}: ${heading.text}`),
    "",
    "## Visible Text",
    record.visible_text.trim(),
    "",
    "## Links",
    ...record.main_links.map((link) => `- ${link.text || link.href} -> ${link.href}`),
    "",
    "## Iframes",
    ...record.iframes.map((iframe) => `- ${iframe.title || "(untitled)"} -> ${iframe.src}`),
    "",
    "## Buttons",
    ...record.buttons.map((button) => `- ${button.text || "(blank)"}`),
    "",
    "## Hidden Text",
    ...record.hidden_text.map((row) => `- ${row.text}`),
    "",
  ];
  return lines.join("\n");
}

function pageMetadata(record) {
  const {
    html,
    visible_text,
    text_content,
    body_visible_text,
    ...metadata
  } = record;
  return metadata;
}

function enqueue(queue, queued, item) {
  const key = normalizeUrl(item.requested_url);
  if (queued.has(key)) return false;
  queued.add(key);
  queue.push(item);
  return true;
}

function recordDownloads(record, downloadRows) {
  for (const link of record.links) {
    if (!link.href) continue;
    const isDownload = link.download || /\/files\/\d+\/download\b/.test(link.href) || /download_frd=1/.test(link.href);
    if (!isDownload) continue;
    downloadRows.push({
      course_code: record.course_code,
      page_id: record.page_id,
      text: link.text,
      href: link.href,
      download_attr: link.download,
    });
  }
}

function classifyExternalHandler(record) {
  const externalToolSignals = [
    /external_tools/,
    /This tool needs to be loaded in a new browser window/i,
    /Load .* in a new window/i,
  ];
  if (externalToolSignals.some((signal) => signal.test(record.resolved_url) || signal.test(record.visible_text))) return true;
  return record.iframes.some((iframe) => {
    try {
      const host = new URL(iframe.src).hostname;
      return host && host !== "canvas.oregonstate.edu" && host !== "sso.canvaslms.com";
    } catch {
      return false;
    }
  });
}

const MANIFEST_COLUMNS = [
  "requested_url",
  "resolved_url",
  "course_code",
  "source_surface",
  "source_kind",
  "page_id",
  "started_at",
  "finished_at",
  "status",
  "error",
  "discovered_count",
];

const PAGE_COLUMNS = [
  "page_id",
  "course_id",
  "course_code",
  "source_surface",
  "source_kind",
  "requested_url",
  "resolved_url",
  "title",
  "canvas_object_type",
  "canvas_object_id",
  "depth",
  "redirected",
  "requires_external_handler",
  "html_path",
  "text_path",
  "full_text_path",
  "markdown_path",
  "screenshot_path",
  "metadata_path",
  "html_sha256",
  "text_sha256",
  "captured_at",
  "heading_count",
  "link_count",
  "iframe_count",
  "module_item_count",
  "assignment_row_count",
  "grade_row_count",
];

const LINK_COLUMNS = [
  "page_id",
  "course_code",
  "source_surface",
  "link_index",
  "text",
  "href",
  "raw_href",
  "target",
  "download",
  "is_canvas_local",
  "belongs_to_course",
];

const IFRAME_COLUMNS = [
  "page_id",
  "course_code",
  "source_surface",
  "iframe_index",
  "title",
  "src",
  "name",
  "width",
  "height",
];

const DOWNLOAD_COLUMNS = ["course_code", "page_id", "text", "href", "download_attr"];

function seedInitialQueue(options, queue, queued) {
  for (const course of options.courses) {
    for (const surface of TOP_SURFACES) {
      enqueue(queue, queued, {
        kind: "surface",
        course,
        source_surface: surface.surface,
        requested_url: `${course.home_url}${surface.path}`,
        depth: 0,
        discovered_from: "",
        discovered_text: surface.surface,
      });
    }
  }
}

async function loadCrawlerState(runRoot) {
  try {
    return JSON.parse(await readFile(path.join(runRoot, "crawler_state.json"), "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function buildSummary({
  runId,
  runRoot,
  options,
  pageRows,
  linkRows,
  iframeRows,
  downloadRows,
  manifestRows,
  warnings,
  queue,
  status,
  stopReason,
  pagesThisInvocation,
}) {
  return {
    run_id: runId,
    run_root: runRoot,
    status,
    stop_reason: stopReason,
    pages_captured: pageRows.length,
    pages_this_invocation: pagesThisInvocation,
    manifest_rows: manifestRows.length,
    links: linkRows.length,
    iframes: iframeRows.length,
    downloads: downloadRows.length,
    warnings: warnings.length,
    queued_remaining: queue.length,
    max_pages: options.maxPages,
    max_pages_per_invocation: options.maxPagesPerInvocation || "",
    screenshot_mode: options.screenshotMode,
    pages_by_course: Object.fromEntries(
      options.courses.map((course) => [
        course.code,
        pageRows.filter((row) => row.course_code === course.code).length,
      ]),
    ),
    pages_by_object_type: pageRows.reduce((acc, row) => {
      acc[row.canvas_object_type] = (acc[row.canvas_object_type] || 0) + 1;
      return acc;
    }, {}),
  };
}

async function writeCrawlerOutputs({
  runId,
  runRoot,
  options,
  pageNumber,
  queue,
  queued,
  visited,
  pageRows,
  linkRows,
  iframeRows,
  downloadRows,
  manifestRows,
  warnings,
  status,
  stopReason,
  pagesThisInvocation,
}) {
  await writeFile(path.join(runRoot, "crawl_manifest.csv"), toCsv(manifestRows, MANIFEST_COLUMNS), "utf8");
  await writeFile(path.join(runRoot, "pages.csv"), toCsv(pageRows, PAGE_COLUMNS), "utf8");
  await writeFile(path.join(runRoot, "links.csv"), toCsv(linkRows, LINK_COLUMNS), "utf8");
  await writeFile(path.join(runRoot, "iframes.csv"), toCsv(iframeRows, IFRAME_COLUMNS), "utf8");
  await writeFile(path.join(runRoot, "downloads.csv"), toCsv(downloadRows, DOWNLOAD_COLUMNS), "utf8");
  await writeFile(path.join(runRoot, "warnings.json"), JSON.stringify(warnings, null, 2), "utf8");

  const summary = buildSummary({
    runId,
    runRoot,
    options,
    pageRows,
    linkRows,
    iframeRows,
    downloadRows,
    manifestRows,
    warnings,
    queue,
    status,
    stopReason,
    pagesThisInvocation,
  });
  await writeFile(path.join(runRoot, "summary.json"), JSON.stringify(summary, null, 2), "utf8");
  await writeFile(
    path.join(runRoot, "crawler_state.json"),
    JSON.stringify(
      {
        run_id: runId,
        saved_at: new Date().toISOString(),
        page_number: pageNumber,
        queue,
        queued: [...queued],
        visited: [...visited],
        page_rows: pageRows,
        link_rows: linkRows,
        iframe_rows: iframeRows,
        download_rows: downloadRows,
        manifest_rows: manifestRows,
        warnings,
        summary,
      },
      null,
      2,
    ),
    "utf8",
  );
  return summary;
}

export async function runCanvasFullCapture({ browser, ...userOptions } = {}) {
  if (!browser) throw new Error("runCanvasFullCapture requires a browser instance");
  const options = { ...DEFAULT_OPTIONS, ...userOptions };
  const runId = options.runId || new Date().toISOString().replace(/[:.]/g, "-");
  const runRoot = path.join(options.outputRoot, runId);
  await ensureDirs(runRoot);

  const tab = await browser.tabs.new();
  const savedState = options.resume ? await loadCrawlerState(runRoot) : null;
  const queue = savedState?.queue || [];
  const queued = new Set(savedState?.queued || []);
  const visited = new Set(savedState?.visited || []);
  const pageRows = savedState?.page_rows || [];
  const linkRows = savedState?.link_rows || [];
  const iframeRows = savedState?.iframe_rows || [];
  const downloadRows = savedState?.download_rows || [];
  const manifestRows = savedState?.manifest_rows || [];
  const warnings = savedState?.warnings || [];

  if (!savedState) seedInitialQueue(options, queue, queued);

  let pageNumber = savedState?.page_number || 0;
  let pagesThisInvocation = 0;
  let stopReason = "";
  const startedMs = Date.now();
  while (queue.length > 0 && pageRows.length < options.maxPages) {
    if (options.maxPagesPerInvocation && pagesThisInvocation >= options.maxPagesPerInvocation) {
      stopReason = "chunk_page_limit";
      break;
    }
    if (options.timeBudgetMs && Date.now() - startedMs >= options.timeBudgetMs) {
      stopReason = "chunk_time_budget";
      break;
    }

    const item = queue.shift();
    const normalizedRequested = normalizeUrl(item.requested_url);
    if (visited.has(normalizedRequested)) continue;
    visited.add(normalizedRequested);

    const course = item.course;
    const pageStart = new Date().toISOString();
    let record = null;
    let error = "";
    try {
      await gotoAndWait(tab, item.requested_url, options);
      const snapshot = await extractPageSnapshot(tab, item.requested_url, course, item.source_surface);
      const object = inferCanvasObject(snapshot.resolved_url);
      pageNumber += 1;
      const pageId = `${String(pageNumber).padStart(5, "0")}-${course.code.toLowerCase()}-${slugify(item.source_surface)}-${slugify(snapshot.title || object.type)}`;
      record = {
        ...snapshot,
        page_id: pageId,
        captured_at: new Date().toISOString(),
        source_kind: item.kind,
        discovered_from: item.discovered_from,
        discovered_text: item.discovered_text,
        depth: item.depth,
        redirected: normalizeUrl(snapshot.resolved_url) !== normalizedRequested,
        canvas_object_type: object.type,
        canvas_object_id: object.id,
        html_sha256: sha256(snapshot.html),
        text_sha256: sha256(snapshot.visible_text),
        requires_external_handler: false,
      };
      record.requires_external_handler = classifyExternalHandler(record);

      const htmlPath = path.join("raw_html", `${pageId}.html`);
      const textPath = path.join("text", `${pageId}.txt`);
      const fullTextPath = path.join("text", `${pageId}.fulltext.txt`);
      const markdownPath = path.join("markdown", `${pageId}.md`);
      const metadataPath = path.join("metadata", `${pageId}.json`);
      let screenshotPath = "";

      await writeFile(path.join(runRoot, htmlPath), record.html, "utf8");
      await writeFile(path.join(runRoot, textPath), record.visible_text, "utf8");
      await writeFile(path.join(runRoot, fullTextPath), record.text_content, "utf8");
      await writeFile(path.join(runRoot, markdownPath), pageMarkdown(record), "utf8");
      await writeFile(path.join(runRoot, metadataPath), JSON.stringify(pageMetadata(record), null, 2), "utf8");

      if (shouldScreenshot(item, options.screenshotMode)) {
        screenshotPath = path.join("screenshots", `${pageId}.png`);
        try {
          const bytes = await tab.screenshot({ fullPage: true });
          await writeFile(path.join(runRoot, screenshotPath), bytes);
        } catch (screenshotError) {
          warnings.push({
            page_id: pageId,
            warning: "screenshot_failed",
            detail: String(screenshotError).slice(0, 500),
          });
        }
      }

      pageRows.push({
        page_id: pageId,
        course_id: course.course_id,
        course_code: course.code,
        source_surface: item.source_surface,
        source_kind: item.kind,
        requested_url: item.requested_url,
        resolved_url: record.resolved_url,
        title: record.title,
        canvas_object_type: record.canvas_object_type,
        canvas_object_id: record.canvas_object_id,
        depth: item.depth,
        redirected: record.redirected ? "yes" : "",
        requires_external_handler: record.requires_external_handler ? "yes" : "",
        html_path: htmlPath,
        text_path: textPath,
        full_text_path: fullTextPath,
        markdown_path: markdownPath,
        screenshot_path: screenshotPath,
        metadata_path: metadataPath,
        html_sha256: record.html_sha256,
        text_sha256: record.text_sha256,
        captured_at: record.captured_at,
        heading_count: record.headings.length,
        link_count: record.links.length,
        iframe_count: record.iframes.length,
        module_item_count: record.module_items.length,
        assignment_row_count: record.assignment_rows.length,
        grade_row_count: record.grade_rows.length,
      });

      for (const [index, link] of record.links.entries()) {
        linkRows.push({
          page_id: pageId,
          course_code: course.code,
          source_surface: item.source_surface,
          link_index: index,
          text: link.text,
          href: link.href,
          raw_href: link.raw_href,
          target: link.target,
          download: link.download,
          is_canvas_local: isCanvasLocal(link.href) ? "yes" : "",
          belongs_to_course: belongsToCourse(link.href, course.course_id) ? "yes" : "",
        });
      }
      for (const [index, iframe] of record.iframes.entries()) {
        iframeRows.push({
          page_id: pageId,
          course_code: course.code,
          source_surface: item.source_surface,
          iframe_index: index,
          title: iframe.title,
          src: iframe.src,
          name: iframe.name,
          width: iframe.width,
          height: iframe.height,
        });
      }
      recordDownloads(record, downloadRows);

      const discovered = [];
      const candidateLinks = [
        ...record.module_items.map((moduleItem) => ({
          href: moduleItem.href,
          text: moduleItem.title,
          source_surface: "module_item",
          kind: "module_item",
        })),
        ...record.assignment_rows.map((assignment) => ({
          href: assignment.href,
          text: assignment.title,
          source_surface: "assignment_detail",
          kind: "assignment_detail",
        })),
        ...record.grade_rows.map((grade) => ({
          href: grade.href,
          text: grade.title,
          source_surface: "grade_detail",
          kind: "grade_detail",
        })),
        ...record.main_links.map((link) => ({
          href: link.href,
          text: link.text,
          source_surface: "linked_detail",
          kind: "linked_detail",
        })),
      ];
      for (const candidate of candidateLinks) {
        if (!candidate.href) continue;
        if (options.followExternal === false && !isCanvasLocal(candidate.href)) continue;
        if (shouldSkipCanvasUrl(candidate.href, course.course_id)) continue;
        const normalized = normalizeUrl(candidate.href);
        if (visited.has(normalized) || queued.has(normalized)) continue;
        discovered.push(candidate.href);
        enqueue(queue, queued, {
          kind: candidate.kind,
          course,
          source_surface: candidate.source_surface,
          requested_url: candidate.href,
          depth: item.depth + 1,
          discovered_from: pageId,
          discovered_text: candidate.text,
        });
      }

      manifestRows.push({
        requested_url: item.requested_url,
        resolved_url: record.resolved_url,
        course_code: course.code,
        source_surface: item.source_surface,
        source_kind: item.kind,
        page_id: pageId,
        started_at: pageStart,
        finished_at: new Date().toISOString(),
        status: "ok",
        error: "",
        discovered_count: discovered.length,
      });
    } catch (captureError) {
      error = String(captureError).slice(0, 1000);
      warnings.push({
        page_id: "",
        warning: "capture_failed",
        detail: error,
        requested_url: item.requested_url,
      });
      manifestRows.push({
        requested_url: item.requested_url,
        resolved_url: "",
        course_code: course.code,
        source_surface: item.source_surface,
        source_kind: item.kind,
        page_id: "",
        started_at: pageStart,
        finished_at: new Date().toISOString(),
        status: "error",
        error,
        discovered_count: 0,
      });
    }

    pagesThisInvocation += 1;
    if (options.checkpointEveryPages !== 0) {
      const checkpointEvery = options.checkpointEveryPages || 1;
      if (pagesThisInvocation % checkpointEvery === 0) {
        await writeCrawlerOutputs({
          runId,
          runRoot,
          options,
          pageNumber,
          queue,
          queued,
          visited,
          pageRows,
          linkRows,
          iframeRows,
          downloadRows,
          manifestRows,
          warnings,
          status: "running",
          stopReason: "",
          pagesThisInvocation,
        });
      }
    }
  }

  if (queue.length > 0 && pageRows.length >= options.maxPages && !warnings.some((row) => row.warning === "max_pages_reached")) {
    warnings.push({
      page_id: "",
      warning: "max_pages_reached",
      detail: `Stopped at ${options.maxPages}; ${queue.length} queued URLs remain.`,
    });
  }

  const status = queue.length === 0 ? "complete" : pageRows.length >= options.maxPages ? "max_pages_reached" : "paused";
  return await writeCrawlerOutputs({
    runId,
    runRoot,
    options,
    pageNumber,
    queue,
    queued,
    visited,
    pageRows,
    linkRows,
    iframeRows,
    downloadRows,
    manifestRows,
    warnings,
    status,
    stopReason,
    pagesThisInvocation,
  });
}
