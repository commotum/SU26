import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_ARCHIVE =
  "/Users/jake/Developer/SU26/canvas/archive/full-fixed-2026-06-26T21-00-04-500Z";
const DEFAULT_INPUT = "/Users/jake/Developer/SU26/canvas/indexer/input";
const DEFAULT_OUTPUT = "/Users/jake/Developer/SU26/canvas/indexer/output";

const COURSES = {
  "2080857": { course_code: "MTH-252", title: "Integral Calculus" },
  "2053263": { course_code: "MTH-253", title: "Sequences and Series" },
  "2053526": { course_code: "PHY-212", title: "Oscillations, Waves, Optics, and Rotation" },
};

const CLASSIFICATION_RULES = [
  {
    rule_id: "rule-graded-object",
    label: "graded_task",
    description: "Assignment, quiz, and task-like discussion objects are treated as graded/actionable candidates.",
  },
  {
    rule_id: "rule-module-requirement",
    label: "required_ungraded_task",
    description: "Module item requirement classes such as must_view, must_submit, must_contribute, or must_mark_done create required-task evidence.",
  },
  {
    rule_id: "rule-critical-setup",
    label: "critical_setup",
    description: "Registration, Proctorio, Gradescope, scanning, lab-supply, course-material, syllabus/calendar, and similar setup pages are critical setup candidates.",
  },
  {
    rule_id: "rule-prep-reading",
    label: "prep_reading",
    description: "Reading, textbook, OpenStax, notes, learning-material, lecture-note, practice-problem, and homework-prep titles are prep/reference candidates.",
  },
  {
    rule_id: "rule-lecture-video",
    label: "lecture_video",
    description: "Video, YouTube, recording, lecture-video, and media titles are lecture video candidates.",
  },
  {
    rule_id: "rule-download-not-read",
    label: "download_indexed_not_read",
    description: "Download links are explicitly not considered read until binaries are downloaded and parsed; image-only files are flagged for OCR/vision review.",
  },
  {
    rule_id: "rule-blocked",
    label: "blocked_or_broken",
    description: "Capture failures, unauthorized pages, page-not-found pages, and unresolved external surfaces are review-blocking evidence.",
  },
  {
    rule_id: "rule-admin-policy",
    label: "admin_policy",
    description: "Academic misconduct, privacy, accessibility, policy, conduct, support, and similar items are retained as admin/policy evidence.",
  },
  {
    rule_id: "rule-navigation-surface",
    label: "course_navigation_surface",
    description: "Course home, module, assignments, grades, discussions, files, people, and similar index pages are retained as navigation evidence, not emitted as tasks.",
  },
];

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function slugify(value, fallback = "item") {
  const slug = cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || fallback;
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

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  if (!rows.length) return [];

  const headers = rows[0];
  return rows.slice(1).filter((values) => values.some(Boolean)).map((values) => {
    const out = {};
    headers.forEach((header, index) => {
      out[header] = values[index] ?? "";
    });
    return out;
  });
}

async function readCsv(filePath) {
  return parseCsv(await readFile(filePath, "utf8"));
}

async function readCsvIfExists(filePath) {
  try {
    return await readCsv(filePath);
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

async function readJsonIfExists(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
}

function resolveMaybeAbsolute(basePath, filePath) {
  if (!filePath) return "";
  return path.isAbsolute(filePath) ? filePath : path.resolve(basePath, filePath);
}

async function hydrateParsedDownloadRows(outputRoot, parsedDownloadRows) {
  const hydrated = [];
  for (const row of parsedDownloadRows) {
    const parsedPath = resolveMaybeAbsolute(outputRoot, row.parsed_markdown_path);
    let parsedText = "";
    if (parsedPath) {
      try {
        parsedText = await readFile(parsedPath, "utf8");
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
    }
    hydrated.push({
      ...row,
      parsed_markdown_path: parsedPath || row.parsed_markdown_path || "",
      repo_file_path: resolveMaybeAbsolute(outputRoot, row.repo_file_path) || row.repo_file_path || "",
      parsed_text: parsedText,
    });
  }
  return hydrated;
}

function courseFromUrl(url) {
  const match = String(url || "").match(/\/courses\/(\d+)/);
  if (!match) return { course_id: "", course_code: "" };
  const course_id = match[1];
  return { course_id, course_code: COURSES[course_id]?.course_code || "" };
}

function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return String(url || "");
  }
}

function isCanvasUrl(url) {
  try {
    return new URL(url).hostname === "canvas.oregonstate.edu";
  } catch {
    return false;
  }
}

function extractModuleItemId(urlOrText) {
  const text = String(urlOrText || "");
  const pathMatch = text.match(/\/modules\/items\/(\d+)/);
  if (pathMatch) return pathMatch[1];
  try {
    const parsed = new URL(text);
    const fromSearch = parsed.searchParams.get("module_item_id");
    if (fromSearch) return fromSearch;
  } catch {
    // Fall through to text matching.
  }
  const typedMatch = text.match(/\b(?:wiki_page|attachment|external_url|external_tool|discussion_topic|quiz|assignment|context_module_sub_header)\s+(\d+)\b/i);
  return typedMatch?.[1] || "";
}

function extractCanvasFileId(url) {
  return String(url || "").match(/\/files\/(\d+)/)?.[1] || "";
}

function moduleItemObjectType(type) {
  const normalized = cleanText(type).toLowerCase();
  if (normalized === "page") return "page";
  if (normalized === "attachment") return "file";
  if (normalized === "external url") return "external_url";
  if (normalized === "external tool") return "external_tool";
  if (normalized === "discussion topic") return "discussion";
  if (normalized === "quiz") return "quiz";
  if (normalized === "assignment") return "assignment";
  if (normalized === "context module sub header") return "module_subheader";
  return normalized.replace(/[^a-z0-9]+/g, "_") || "unknown";
}

function titleKey(value) {
  return slugify(value, "");
}

function countBy(rows, keyFn) {
  const counts = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

function titleSignals(row, metadata) {
  const title = `${row.title || ""} ${metadata?.title || ""} ${metadata?.resolved_url || ""}`.toLowerCase();
  const text = cleanText(metadata?.visible_text || metadata?.discovered_text || "").toLowerCase();
  const joined = `${title} ${text}`.slice(0, 5000);
  return {
    unauthorized: /\bunauthorized\b|access denied|not authorized/.test(joined),
    page_not_found: /page not found|404|doesn't exist|does not exist/.test(joined),
    external_tool: row.requires_external_handler === "yes" || /external_tools/.test(joined),
  };
}

function severityForIssue(type) {
  if (type === "capture_failed" || type === "unauthorized") return "high";
  if (type === "external_tool" || type === "page_not_found") return "medium";
  if (type === "redirected") return "low";
  return "medium";
}

function canvasObjectIdForPage(row) {
  const courseSlug = (row.course_code || "course").toLowerCase();
  const objectType = row.canvas_object_type || "unknown";
  const objectKey = row.canvas_object_id || normalizeUrl(row.resolved_url || row.requested_url);
  return `obj-${courseSlug}-${slugify(objectType)}-${slugify(objectKey)}`;
}

function canvasObjectIdForModuleItem(row) {
  return `obj-${(row.course_code || "course").toLowerCase()}-${slugify(row.destination_canvas_object_type)}-${slugify(row.canvas_module_item_id || row.module_item_id)}`;
}

function canvasObjectIdForDownload(row, index) {
  const fileId = extractCanvasFileId(row.href);
  return `obj-${(row.course_code || "course").toLowerCase()}-download-${slugify(fileId || row.href || String(index + 1))}`;
}

async function readPageMetadata(archiveRoot, pageRows) {
  const metadataByPage = new Map();
  for (const row of pageRows) {
    if (!row.metadata_path) continue;
    const absolutePath = path.join(archiveRoot, row.metadata_path);
    const metadata = await readJsonIfExists(absolutePath, null);
    if (metadata) metadataByPage.set(row.page_id, metadata);
  }
  return metadataByPage;
}

function buildPageInventory(pageRows, metadataByPage) {
  return pageRows.map((row) => {
    const metadata = metadataByPage.get(row.page_id) || {};
    const headings = metadata.headings || [];
    const nav = metadata.nav || [];
    const hiddenText = metadata.hidden_text || [];
    return {
      page_id: row.page_id,
      course_id: row.course_id,
      course_code: row.course_code,
      source_kind: row.source_kind,
      source_surface: row.source_surface,
      canvas_object_type: row.canvas_object_type,
      canvas_object_id: row.canvas_object_id,
      title: row.title,
      requested_url: row.requested_url,
      resolved_url: row.resolved_url,
      redirected: row.redirected,
      requires_external_handler: row.requires_external_handler,
      depth: row.depth,
      markdown_path: row.markdown_path,
      metadata_path: row.metadata_path,
      visible_heading_count: row.heading_count,
      link_count: row.link_count,
      iframe_count: row.iframe_count,
      module_item_count: row.module_item_count,
      assignment_row_count: row.assignment_row_count,
      grade_row_count: row.grade_row_count,
      metadata_heading_count: headings.length,
      nav_count: nav.length,
      hidden_text_count: hiddenText.length,
      heading_sample: headings.slice(0, 5).map((heading) => cleanText(heading.text)).join(" | "),
      captured_at: row.captured_at,
    };
  });
}

function buildSourceTypeCounts(pageRows) {
  const counts = countBy(
    pageRows,
    (row) => `${row.course_code}\t${row.source_kind}\t${row.source_surface}\t${row.canvas_object_type}`,
  );
  return [...counts.entries()].map(([key, count]) => {
    const [course_code, source_kind, source_surface, canvas_object_type] = key.split("\t");
    return { course_code, source_kind, source_surface, canvas_object_type, count };
  }).sort((a, b) =>
    a.course_code.localeCompare(b.course_code) ||
    a.source_kind.localeCompare(b.source_kind) ||
    a.canvas_object_type.localeCompare(b.canvas_object_type) ||
    a.source_surface.localeCompare(b.source_surface)
  );
}

function buildCourseReadout({ pageRows, linkRows, iframeRows, downloadRows, warnings }) {
  return Object.entries(COURSES).map(([course_id, course]) => {
    const pages = pageRows.filter((row) => row.course_id === course_id || row.course_code === course.course_code);
    const links = linkRows.filter((row) => row.course_code === course.course_code);
    const iframes = iframeRows.filter((row) => row.course_code === course.course_code);
    const downloads = downloadRows.filter((row) => row.course_code === course.course_code);
    const courseWarnings = warnings.filter((warning) => courseFromUrl(warning.requested_url).course_id === course_id);
    const objectCounts = countBy(pages, (row) => row.canvas_object_type || "unknown");
    const sourceKindCounts = countBy(pages, (row) => row.source_kind || "unknown");
    return {
      course_id,
      course_code: course.course_code,
      title: course.title,
      pages: pages.length,
      source_surface_pages: sourceKindCounts.get("surface") || 0,
      module_item_pages: sourceKindCounts.get("module_item") || 0,
      linked_detail_pages: sourceKindCounts.get("linked_detail") || 0,
      assignment_detail_pages: sourceKindCounts.get("assignment_detail") || 0,
      assignments: objectCounts.get("assignment") || 0,
      quizzes: objectCounts.get("quiz") || 0,
      discussions: objectCounts.get("discussion") || 0,
      pages_content: objectCounts.get("page") || 0,
      files: objectCounts.get("file") || 0,
      module_items: objectCounts.get("module_item") || 0,
      grade_surfaces: objectCounts.get("grades") || 0,
      links: links.length,
      iframes: iframes.length,
      downloads: downloads.length,
      redirected_pages: pages.filter((row) => row.redirected === "yes").length,
      external_handler_pages: pages.filter((row) => row.requires_external_handler === "yes").length,
      warnings: courseWarnings.length,
      first_capture: pages.map((row) => row.captured_at).filter(Boolean).sort()[0] || "",
      last_capture: pages.map((row) => row.captured_at).filter(Boolean).sort().at(-1) || "",
    };
  });
}

function buildCaptureIssues({ pageRows, warnings, metadataByPage }) {
  const issues = [];
  let issueNumber = 0;
  const addIssue = (issue) => {
    issueNumber += 1;
    issues.push({
      issue_id: `issue-${String(issueNumber).padStart(4, "0")}`,
      severity: severityForIssue(issue.issue_type),
      ...issue,
    });
  };

  for (const warning of warnings) {
    const course = courseFromUrl(warning.requested_url);
    addIssue({
      issue_type: warning.warning || "warning",
      course_id: course.course_id,
      course_code: course.course_code,
      page_id: warning.page_id || "",
      title: "",
      requested_url: warning.requested_url || "",
      resolved_url: "",
      source_file: "warnings.json",
      detail: warning.detail || "",
    });
  }

  for (const row of pageRows) {
    const metadata = metadataByPage.get(row.page_id) || {};
    const signals = titleSignals(row, metadata);
    if (signals.unauthorized) {
      addIssue({
        issue_type: "unauthorized",
        course_id: row.course_id,
        course_code: row.course_code,
        page_id: row.page_id,
        title: row.title,
        requested_url: row.requested_url,
        resolved_url: row.resolved_url,
        source_file: row.metadata_path,
        detail: "Captured page appears to be unauthorized or access denied.",
      });
    }
    if (signals.page_not_found) {
      addIssue({
        issue_type: "page_not_found",
        course_id: row.course_id,
        course_code: row.course_code,
        page_id: row.page_id,
        title: row.title,
        requested_url: row.requested_url,
        resolved_url: row.resolved_url,
        source_file: row.metadata_path,
        detail: "Captured page appears to be a missing Canvas page.",
      });
    }
    if (signals.external_tool) {
      addIssue({
        issue_type: "external_tool",
        course_id: row.course_id,
        course_code: row.course_code,
        page_id: row.page_id,
        title: row.title,
        requested_url: row.requested_url,
        resolved_url: row.resolved_url,
        source_file: row.metadata_path,
        detail: "Page may require external-tool handling beyond rendered Canvas text.",
      });
    }
    if (row.redirected === "yes") {
      addIssue({
        issue_type: "redirected",
        course_id: row.course_id,
        course_code: row.course_code,
        page_id: row.page_id,
        title: row.title,
        requested_url: row.requested_url,
        resolved_url: row.resolved_url,
        source_file: row.metadata_path,
        detail: "Requested URL resolved to a different URL.",
      });
    }
  }

  return issues;
}

function buildDestinationIndexes(pageRows) {
  const byRequested = new Map();
  const byResolved = new Map();
  const byModuleItemId = new Map();

  const prefer = (existing, candidate) => {
    if (!existing) return candidate;
    if (candidate.source_kind === "module_item" && existing.source_kind !== "module_item") return candidate;
    return existing;
  };

  for (const row of pageRows) {
    if (row.requested_url) {
      const key = normalizeUrl(row.requested_url);
      byRequested.set(key, prefer(byRequested.get(key), row));
    }
    if (row.resolved_url) {
      const key = normalizeUrl(row.resolved_url);
      byResolved.set(key, prefer(byResolved.get(key), row));
    }
    for (const candidate of [row.requested_url, row.resolved_url]) {
      const moduleItemId = extractModuleItemId(candidate);
      if (moduleItemId) byModuleItemId.set(moduleItemId, prefer(byModuleItemId.get(moduleItemId), row));
    }
  }

  return { byRequested, byResolved, byModuleItemId };
}

function findDestinationPage(item, indexes) {
  if (!item.href) return null;
  const normalized = normalizeUrl(item.href);
  const exact = indexes.byRequested.get(normalized) || indexes.byResolved.get(normalized);
  if (exact) return exact;
  const moduleItemId = extractModuleItemId(item.href) || extractModuleItemId(item.text);
  if (moduleItemId) return indexes.byModuleItemId.get(moduleItemId) || null;
  return null;
}

function requirementSummary(className) {
  const text = String(className || "");
  const requirements = [];
  if (/progression_requirement/.test(text)) requirements.push("progression");
  if (/must_view_requirement/.test(text)) requirements.push("must_view");
  if (/must_submit_requirement/.test(text)) requirements.push("must_submit");
  if (/must_contribute_requirement/.test(text)) requirements.push("must_contribute");
  if (/must_mark_done_requirement/.test(text)) requirements.push("must_mark_done");
  if (/min_score_requirement/.test(text)) requirements.push("min_score");
  return requirements.join("|");
}

function moduleItemIndent(className) {
  return String(className || "").match(/\bindent_(\d+)\b/)?.[1] || "";
}

function addObject(objectsById, object) {
  const existing = objectsById.get(object.object_id);
  if (!existing) {
    objectsById.set(object.object_id, {
      ...object,
      page_ids: object.first_page_id ? new Set([object.first_page_id]) : new Set(),
      evidence_count: 0,
    });
    return objectsById.get(object.object_id);
  }
  if (object.first_page_id) existing.page_ids.add(object.first_page_id);
  if (!existing.title && object.title) existing.title = object.title;
  if (!existing.canonical_url && object.canonical_url) existing.canonical_url = object.canonical_url;
  if (existing.capture_status !== "captured" && object.capture_status === "captured") {
    existing.capture_status = "captured";
  }
  if (object.capture_status === "downloaded_and_parsed" && existing.capture_status === "indexed_download_link") {
    existing.capture_status = object.capture_status;
  }
  if (["downloaded_needs_ocr", "downloaded_parse_failed"].includes(object.capture_status) && existing.capture_status === "indexed_download_link") {
    existing.capture_status = object.capture_status;
  }
  if (object.read_status === "parsed_file_text" && existing.read_status === "indexed_not_read") {
    existing.read_status = object.read_status;
    existing.notes = object.notes || existing.notes;
  }
  if (["downloaded_text_empty_needs_ocr", "downloaded_parse_failed"].includes(object.read_status) && existing.read_status === "indexed_not_read") {
    existing.read_status = object.read_status;
    existing.notes = object.notes || existing.notes;
  }
  return existing;
}

function splitJoined(value) {
  return cleanText(value).split("|").map((part) => part.trim()).filter(Boolean);
}

function buildParsedDownloadIndexes(parsedDownloadRows) {
  const byDownloadId = new Map();
  const byObjectId = new Map();
  const byCourseFileId = new Map();

  for (const row of parsedDownloadRows) {
    for (const downloadId of splitJoined(row.download_ids)) byDownloadId.set(downloadId, row);
    for (const objectId of splitJoined(row.object_ids)) byObjectId.set(objectId, row);
    if (row.course_code && row.canvas_file_id) byCourseFileId.set(`${row.course_code}\t${row.canvas_file_id}`, row);
  }

  return { byDownloadId, byObjectId, byCourseFileId };
}

function parsedDownloadFor({ parsedDownloadIndexes, downloadId, objectId, course_code, canvas_file_id }) {
  return parsedDownloadIndexes.byDownloadId.get(downloadId) ||
    parsedDownloadIndexes.byObjectId.get(objectId) ||
    parsedDownloadIndexes.byCourseFileId.get(`${course_code}\t${canvas_file_id}`) ||
    null;
}

function readStatusForDownloadAttempt(downloadAttempt) {
  if (!downloadAttempt) return "indexed_not_read";
  if (downloadAttempt.parse_status === "parsed") return "parsed_file_text";
  if (downloadAttempt.parse_status === "parsed_text_empty_needs_ocr") return "downloaded_text_empty_needs_ocr";
  return "downloaded_parse_failed";
}

function captureStatusForDownloadAttempt(downloadAttempt) {
  if (!downloadAttempt) return "indexed_download_link";
  if (downloadAttempt.parse_status === "parsed") return "downloaded_and_parsed";
  if (downloadAttempt.parse_status === "parsed_text_empty_needs_ocr") return "downloaded_needs_ocr";
  return "downloaded_parse_failed";
}

function evidenceStatusForDownloadAttempt(downloadAttempt) {
  if (!downloadAttempt) return "link_only";
  if (downloadAttempt.parse_status === "parsed") return "parsed_text";
  if (downloadAttempt.parse_status === "parsed_text_empty_needs_ocr") return "downloaded_needs_ocr";
  return "parse_failed";
}

function buildNormalizedGraph({ pageRows, downloadRows, metadataByPage, courseReadout, parsedDownloadRows = [] }) {
  const destinationIndexes = buildDestinationIndexes(pageRows);
  const pageById = new Map(pageRows.map((row) => [row.page_id, row]));
  const parsedDownloadIndexes = buildParsedDownloadIndexes(parsedDownloadRows);
  const objectsById = new Map();
  const modulesByKey = new Map();
  const moduleRows = [];
  const moduleItemRows = [];
  const objectPageRows = [];
  const evidenceRows = [];
  const downloadRowsNormalized = [];
  let evidenceNumber = 0;

  const addEvidence = (evidence) => {
    evidenceNumber += 1;
    const row = {
      evidence_id: `ev-${String(evidenceNumber).padStart(5, "0")}`,
      ...evidence,
    };
    evidenceRows.push(row);
    const object = objectsById.get(row.object_id);
    if (object) object.evidence_count += 1;
    return row;
  };

  const findObjectForSurfaceRow = ({ course_code, href, title }) => {
    const assignmentId = String(href || "").match(/\/assignments\/(\d+)/)?.[1] || "";
    const candidates = [...objectsById.values()].filter((object) => object.course_code === course_code);
    if (assignmentId) {
      const exactAssignment = candidates.find((object) => object.object_type === "assignment" && object.canvas_object_id === assignmentId);
      if (exactAssignment) return exactAssignment;
    }
    const key = titleKey(title);
    if (!key) return null;
    return candidates.find((object) =>
      ["assignment", "quiz", "discussion"].includes(object.object_type) && titleKey(object.title) === key
    ) || null;
  };

  for (const page of pageRows) {
    const objectId = canvasObjectIdForPage(page);
    addObject(objectsById, {
      object_id: objectId,
      course_id: page.course_id,
      course_code: page.course_code,
      object_type: page.canvas_object_type || "unknown",
      canvas_object_id: page.canvas_object_id,
      title: page.title,
      canonical_url: normalizeUrl(page.resolved_url || page.requested_url),
      first_page_id: page.page_id,
      capture_status: "captured",
      read_status: "captured_rendered_page",
      notes: "",
    });
    objectPageRows.push({
      object_id: objectId,
      page_id: page.page_id,
      course_id: page.course_id,
      course_code: page.course_code,
      object_type: page.canvas_object_type || "unknown",
      canvas_object_id: page.canvas_object_id,
      title: page.title,
      requested_url: page.requested_url,
      resolved_url: page.resolved_url,
      redirected: page.redirected,
      source_kind: page.source_kind,
      source_surface: page.source_surface,
      markdown_path: page.markdown_path,
      metadata_path: page.metadata_path,
    });
    addEvidence({
      object_id: objectId,
      evidence_type: "page_capture",
      relation: "captured_as_object",
      course_id: page.course_id,
      course_code: page.course_code,
      source_page_id: page.page_id,
      source_url: page.resolved_url || page.requested_url,
      source_title: page.title,
      module_id: "",
      module_item_id: "",
      download_id: "",
      target_page_id: page.page_id,
      target_url: page.resolved_url || page.requested_url,
      detail: `${page.source_kind}:${page.source_surface}`,
    });
  }

  const moduleSurfacePages = pageRows.filter((row) => row.source_surface === "modules" && row.canvas_object_type === "modules");
  for (const page of moduleSurfacePages) {
    const metadata = metadataByPage.get(page.page_id) || {};
    const moduleItems = metadata.module_items || [];
    const moduleOrderByTitle = new Map();

    for (const item of moduleItems) {
      const moduleTitle = cleanText(item.module_title || "Unsorted");
      if (!moduleOrderByTitle.has(moduleTitle)) {
        const moduleOrder = moduleOrderByTitle.size + 1;
        moduleOrderByTitle.set(moduleTitle, moduleOrder);
        const module_id = `mod-${page.course_code.toLowerCase()}-${String(moduleOrder).padStart(3, "0")}-${slugify(moduleTitle)}`;
        const moduleKey = `${page.course_id}\t${moduleTitle}`;
        modulesByKey.set(moduleKey, {
          module_id,
          course_id: page.course_id,
          course_code: page.course_code,
          module_order: moduleOrder,
          module_title: moduleTitle,
          source_page_id: page.page_id,
          source_url: page.resolved_url || page.requested_url,
          module_item_count: 0,
        });
        moduleRows.push(modulesByKey.get(moduleKey));
      }
    }

    for (const item of moduleItems) {
      const moduleTitle = cleanText(item.module_title || "Unsorted");
      const moduleRow = modulesByKey.get(`${page.course_id}\t${moduleTitle}`);
      const canvasModuleItemId = extractModuleItemId(item.href) || extractModuleItemId(item.text);
      const stableModuleItemId = `mi-${page.course_code.toLowerCase()}-${canvasModuleItemId || `${page.page_id}-${item.index}`}`;
      const destinationPage = findDestinationPage(item, destinationIndexes);
      const destinationType = destinationPage?.canvas_object_type || moduleItemObjectType(item.type);
      const itemRow = {
        module_item_id: stableModuleItemId,
        canvas_module_item_id: canvasModuleItemId,
        course_id: page.course_id,
        course_code: page.course_code,
        module_id: moduleRow.module_id,
        module_order: moduleRow.module_order,
        item_order: Number(item.index ?? 0) + 1,
        title: cleanText(item.title),
        item_type: cleanText(item.type),
        destination_canvas_object_type: destinationType,
        destination_canvas_object_id: destinationPage?.canvas_object_id || "",
        destination_object_id: "",
        destination_page_id: destinationPage?.page_id || "",
        href: item.href || "",
        external_href: item.href && !isCanvasUrl(item.href) ? item.href : "",
        indent: moduleItemIndent(item.class_name),
        requirements: requirementSummary(item.class_name),
        requirement_raw: cleanText(item.class_name),
        capture_status: "",
        source_page_id: page.page_id,
        source_url: page.resolved_url || page.requested_url,
        source_text_sample: cleanText(item.text).slice(0, 500),
      };

      if (destinationPage) {
        itemRow.destination_object_id = canvasObjectIdForPage(destinationPage);
        itemRow.capture_status = "captured";
      } else if (!item.href) {
        itemRow.destination_object_id = canvasObjectIdForModuleItem(itemRow);
        itemRow.capture_status = "structural_no_href";
      } else if (isCanvasUrl(item.href)) {
        itemRow.destination_object_id = canvasObjectIdForModuleItem(itemRow);
        itemRow.capture_status = "unvisited_canvas";
      } else {
        itemRow.destination_object_id = canvasObjectIdForModuleItem(itemRow);
        itemRow.capture_status = "external_unvisited";
      }

      if (!destinationPage) {
        addObject(objectsById, {
          object_id: itemRow.destination_object_id,
          course_id: page.course_id,
          course_code: page.course_code,
          object_type: itemRow.destination_canvas_object_type,
          canvas_object_id: itemRow.canvas_module_item_id,
          title: itemRow.title,
          canonical_url: itemRow.href,
          first_page_id: "",
          capture_status: itemRow.capture_status,
          read_status: itemRow.capture_status === "external_unvisited" ? "not_read_external" : "not_captured",
          notes: "Object inferred from module item listing without captured destination page.",
        });
      }

      moduleRow.module_item_count += 1;
      moduleItemRows.push(itemRow);
      addEvidence({
        object_id: itemRow.destination_object_id,
        evidence_type: "module_item_listing",
        relation: "module_contains_object",
        course_id: page.course_id,
        course_code: page.course_code,
        source_page_id: page.page_id,
        source_url: page.resolved_url || page.requested_url,
        source_title: itemRow.title,
        module_id: moduleRow.module_id,
        module_item_id: itemRow.module_item_id,
        download_id: "",
        target_page_id: itemRow.destination_page_id,
        target_url: itemRow.href,
        detail: `module=${moduleTitle}; item_type=${itemRow.item_type}; capture_status=${itemRow.capture_status}`,
      });
    }
  }

  for (const [index, row] of downloadRows.entries()) {
    const sourcePage = pageById.get(row.page_id) || {};
    const fileName = cleanText(row.text).replace(/^Download\s+/i, "");
    const downloadId = `dl-${(row.course_code || "course").toLowerCase()}-${String(index + 1).padStart(4, "0")}`;
    const objectId = canvasObjectIdForDownload(row, index);
    const course_id = sourcePage.course_id || courseFromUrl(row.href).course_id;
    const course_code = row.course_code || sourcePage.course_code || courseFromUrl(row.href).course_code;
    const canvasFileId = extractCanvasFileId(row.href);
    const downloadAttempt = parsedDownloadFor({
      parsedDownloadIndexes,
      downloadId,
      objectId,
      course_code,
      canvas_file_id: canvasFileId,
    });
    const isParsed = downloadAttempt?.parse_status === "parsed";
    const readStatus = readStatusForDownloadAttempt(downloadAttempt);
    const captureStatus = captureStatusForDownloadAttempt(downloadAttempt);
    const evidenceStatus = evidenceStatusForDownloadAttempt(downloadAttempt);
    addObject(objectsById, {
      object_id: objectId,
      course_id,
      course_code,
      object_type: "download",
      canvas_object_id: canvasFileId,
      title: fileName || row.text,
      canonical_url: row.href,
      first_page_id: row.page_id,
      capture_status: captureStatus,
      read_status: readStatus,
      notes: isParsed
        ? `Parsed file text captured at ${downloadAttempt.parsed_markdown_path || downloadAttempt.repo_file_path || ""}`.trim()
        : downloadAttempt
          ? `Downloaded file requires additional extraction: parse_status=${downloadAttempt.parse_status}; path=${downloadAttempt.repo_file_path || ""}`.trim()
        : "Download URL captured but file binary has not been downloaded or parsed.",
    });
    downloadRowsNormalized.push({
      download_id: downloadId,
      object_id: objectId,
      course_id,
      course_code,
      source_page_id: row.page_id,
      source_page_title: sourcePage.title || "",
      source_page_url: sourcePage.resolved_url || sourcePage.requested_url || "",
      text: row.text,
      file_name: fileName,
      canvas_file_id: canvasFileId,
      href: row.href,
      download_attr: row.download_attr,
      read_status: readStatus,
      evidence_status: evidenceStatus,
      repo_file_path: downloadAttempt?.repo_file_path || "",
      parsed_markdown_path: downloadAttempt?.parsed_markdown_path || "",
    });
    addEvidence({
      object_id: objectId,
      evidence_type: "download_link",
      relation: "page_links_download",
      course_id,
      course_code,
      source_page_id: row.page_id,
      source_url: sourcePage.resolved_url || sourcePage.requested_url || "",
      source_title: sourcePage.title || "",
      module_id: "",
      module_item_id: "",
      download_id: downloadId,
      target_page_id: "",
      target_url: row.href,
      detail: isParsed
        ? `Download URL indexed; parsed_markdown_path=${downloadAttempt.parsed_markdown_path}; char_count=${downloadAttempt.char_count}; page_count=${downloadAttempt.page_count}`
        : downloadAttempt
          ? `Download URL indexed; file downloaded but not text-readable; parse_status=${downloadAttempt.parse_status}; repo_file_path=${downloadAttempt.repo_file_path}`
          : "Download URL indexed; binary not downloaded.",
    });
    if (isParsed) {
      addEvidence({
        object_id: objectId,
        evidence_type: "parsed_download_text",
        relation: "download_binary_parsed",
        course_id,
        course_code,
        source_page_id: row.page_id,
        source_url: sourcePage.resolved_url || sourcePage.requested_url || "",
        source_title: sourcePage.title || "",
        module_id: "",
        module_item_id: "",
        download_id: downloadId,
        target_page_id: "",
        target_url: downloadAttempt.parsed_markdown_path || downloadAttempt.repo_file_path || row.href,
        detail: `file=${downloadAttempt.repo_file_path}; parsed=${downloadAttempt.parsed_markdown_path}; parsed_text=${compactText(downloadAttempt.parsed_text || downloadAttempt.text_sample || "", 60000)}`,
      });
    } else if (downloadAttempt) {
      addEvidence({
        object_id: objectId,
        evidence_type: "download_requires_ocr",
        relation: "download_binary_not_text_readable",
        course_id,
        course_code,
        source_page_id: row.page_id,
        source_url: sourcePage.resolved_url || sourcePage.requested_url || "",
        source_title: sourcePage.title || "",
        module_id: "",
        module_item_id: "",
        download_id: downloadId,
        target_page_id: "",
        target_url: downloadAttempt.repo_file_path || row.href,
        detail: `parse_status=${downloadAttempt.parse_status}; parsed_markdown_path=${downloadAttempt.parsed_markdown_path}; notes=${downloadAttempt.notes || ""}`,
      });
    }
  }

  for (const page of pageRows) {
    const metadata = metadataByPage.get(page.page_id) || {};
    for (const assignment of metadata.assignment_rows || []) {
      const object = findObjectForSurfaceRow({
        course_code: page.course_code,
        href: assignment.href,
        title: assignment.title,
      });
      if (!object) continue;
      addEvidence({
        object_id: object.object_id,
        evidence_type: "assignment_surface_row",
        relation: "assignments_surface_lists_object",
        course_id: page.course_id,
        course_code: page.course_code,
        source_page_id: page.page_id,
        source_url: page.resolved_url || page.requested_url,
        source_title: assignment.title,
        module_id: "",
        module_item_id: "",
        download_id: "",
        target_page_id: "",
        target_url: assignment.href,
        detail: `group=${assignment.group_name || ""}; type=${assignment.type || ""}; due=${assignment.due || ""}; available=${assignment.available || ""}; text=${assignment.text || ""}`,
      });
    }
    for (const grade of metadata.grade_rows || []) {
      const object = findObjectForSurfaceRow({
        course_code: page.course_code,
        href: grade.href,
        title: grade.title,
      });
      if (!object) continue;
      addEvidence({
        object_id: object.object_id,
        evidence_type: "grade_surface_row",
        relation: "grades_surface_lists_object",
        course_id: page.course_id,
        course_code: page.course_code,
        source_page_id: page.page_id,
        source_url: page.resolved_url || page.requested_url,
        source_title: grade.title,
        module_id: "",
        module_item_id: "",
        download_id: "",
        target_page_id: "",
        target_url: grade.href,
        detail: `cells=${(grade.cells || []).join(" | ")}; text=${grade.text || ""}`,
      });
    }
  }

  const objectRows = [...objectsById.values()].map((object) => ({
    object_id: object.object_id,
    course_id: object.course_id,
    course_code: object.course_code,
    object_type: object.object_type,
    canvas_object_id: object.canvas_object_id,
    title: object.title,
    canonical_url: object.canonical_url,
    first_page_id: object.first_page_id,
    page_count: object.page_ids.size,
    evidence_count: object.evidence_count,
    capture_status: object.capture_status,
    read_status: object.read_status,
    notes: object.notes,
  })).sort((a, b) =>
    a.course_code.localeCompare(b.course_code) ||
    a.object_type.localeCompare(b.object_type) ||
    a.title.localeCompare(b.title)
  );

  const courseRows = Object.entries(COURSES).map(([course_id, course]) => {
    const readout = courseReadout.find((row) => row.course_id === course_id) || {};
    return {
      course_id,
      course_code: course.course_code,
      title: course.title,
      pages_captured: readout.pages || 0,
      modules: moduleRows.filter((row) => row.course_id === course_id).length,
      module_items: moduleItemRows.filter((row) => row.course_id === course_id).length,
      canvas_objects: objectRows.filter((row) => row.course_id === course_id).length,
      downloads: downloadRowsNormalized.filter((row) => row.course_id === course_id).length,
      warnings: readout.warnings || 0,
    };
  });

  return {
    courses: courseRows,
    modules: moduleRows.sort((a, b) => a.course_code.localeCompare(b.course_code) || Number(a.module_order) - Number(b.module_order)),
    moduleItems: moduleItemRows.sort((a, b) =>
      a.course_code.localeCompare(b.course_code) ||
      Number(a.module_order) - Number(b.module_order) ||
      Number(a.item_order) - Number(b.item_order)
    ),
    objects: objectRows,
    objectPages: objectPageRows.sort((a, b) => a.object_id.localeCompare(b.object_id) || a.page_id.localeCompare(b.page_id)),
    evidence: evidenceRows,
    downloads: downloadRowsNormalized,
  };
}

function compactText(value, maxLength = 60_000) {
  return cleanText(value).slice(0, maxLength);
}

function metadataText(metadata) {
  if (!metadata) return "";
  const headings = (metadata.headings || []).map((heading) => heading.text).join(" ");
  const hidden = (metadata.hidden_text || []).map((row) => row.text).join(" ");
  const tables = (metadata.tables || []).map((table) => table.text).join(" ");
  const links = (metadata.main_links || []).map((link) => `${link.text} ${link.href}`).join(" ");
  return compactText(`${metadata.title || ""} ${headings} ${metadata.visible_text || ""} ${metadata.text_content || ""} ${hidden} ${tables} ${links}`);
}

function firstRegex(text, regex) {
  const match = String(text || "").match(regex);
  return cleanText(match?.[1] || "");
}

function cleanDateish(value) {
  const text = cleanText(value).replace(/^(Due|Available)\s+/i, "");
  const monthPattern = "(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)";
  const match = text.match(new RegExp(`(${monthPattern}\\s+\\d{1,2}(?:\\s+(?:at|by)\\s+\\d{1,2}:\\d{2}\\s*(?:am|pm))?)`, "i"));
  return cleanText(match?.[1] || text.slice(0, 80));
}

function extractTaskSignals(text) {
  const months = "(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)";
  const dueRegex = new RegExp(`\\bDue\\s+(${months}[^\\n.;,]{0,80}(?:am|pm)?)`, "i");
  const availableRegex = new RegExp(`\\bAvailable(?:\\s+until)?\\s+(${months}[^\\n.;,]{0,80}(?:am|pm)?)`, "i");
  const gradebookDateRegex = new RegExp(`\\b(${months}\\s+\\d{1,2}\\s+(?:by|at)\\s+\\d{1,2}:\\d{2}\\s*(?:am|pm))`, "i");
  const dueField = firstRegex(text, /(?:^|[;|]\s*)due=([^;|]+)/i);
  const availableField = firstRegex(text, /(?:^|[;|]\s*)available=([^;|]+)/i);
  const points =
    firstRegex(text, /\b(\d+(?:\.\d+)?)\s*(?:points|pts)\b/i) ||
    firstRegex(text, /-\s*\/\s*(\d+(?:\.\d+)?)\s*(?:points|pts)?\b/i) ||
    firstRegex(text, /\/\s*(\d+(?:\.\d+)?)\s+(?:points|pts)\b/i);
  const estimated =
    firstRegex(text, /(?:🕓|clock)?\s*(\d+(?:\.\d+)?\s*(?:-|to)\s*\d+(?:\.\d+)?\s*hours?)/i) ||
    firstRegex(text, /(?:🕓|clock)\s*(\d+(?:\.\d+)?\s*hours?)/i);
  return {
    due_text: cleanDateish(dueField || firstRegex(text, dueRegex) || firstRegex(text, gradebookDateRegex)),
    available_text: cleanDateish(availableField || firstRegex(text, availableRegex)),
    points_text: points,
    estimated_time: estimated,
  };
}

function priorityForReview(reason) {
  if (/capture_failed|unauthorized|blocked|missing_evidence/.test(reason)) return "high";
  if (/external|not_read|page_not_found|low_confidence/.test(reason)) return "medium";
  return "low";
}

function uniqueJoined(values) {
  return [...new Set(values.filter(Boolean))].join("|");
}

function yesNo(value) {
  return value ? "yes" : "no";
}

function classifyObject({ object, moduleItems, objectPages, objectEvidence, issueTypes, objectText }) {
  const labels = new Set();
  const reasons = [];
  const title = `${object.title || ""} ${objectText || ""}`.toLowerCase();
  const objectType = object.object_type || "";
  const moduleRequirementText = moduleItems.map((item) => item.requirements).join("|");
  const moduleCaptureStatuses = moduleItems.map((item) => item.capture_status).join("|");
  const navigationSurfaceTypes = new Set(["course_page", "modules", "assignments", "quizzes", "discussions", "files", "people", "grades"]);

  if (navigationSurfaceTypes.has(objectType)) {
    labels.add("course_navigation_surface");
    reasons.push("course navigation/index surface");
  }
  if (["assignment", "quiz"].includes(objectType)) {
    labels.add("graded_task");
    reasons.push(`${objectType} object`);
  }
  if (objectType === "discussion" && /(reflection|discussion|reply|post|contribute|introductions?)/i.test(title)) {
    labels.add("graded_task");
    reasons.push("task-like discussion object");
  }
  if (/(must_view|must_submit|must_contribute|must_mark_done|min_score|progression)/.test(moduleRequirementText)) {
    labels.add("required_ungraded_task");
    reasons.push("module requirement marker");
  }
  if (/(registration|proctorio|gradescope|scan|scanning|lab supplies|collaboration contract|course materials|access code|syllabus|calendar|getting internet)/i.test(title)) {
    labels.add("critical_setup");
    reasons.push("critical setup title/text signal");
  }
  if (/(reading|read\b|openstax|textbook|lecture notes?|notes\b|learning materials?|practice problems?|homework assignment|pre-class|preclass|study guide)/i.test(title)) {
    labels.add("prep_reading");
    reasons.push("prep/reading title/text signal");
  }
  if (/(video|youtube|youtu\.be|recording|media|lecture video|dr\.?\s*g'?s videos?)/i.test(title)) {
    labels.add("lecture_video");
    reasons.push("video title/link signal");
  }
  if (objectType === "file" || objectType === "download") {
    labels.add("file_reference");
    reasons.push(`${objectType} object`);
  }
  if (object.read_status === "indexed_not_read") {
    labels.add("download_indexed_not_read");
    reasons.push("download link not parsed");
  }
  if (object.read_status === "downloaded_text_empty_needs_ocr") {
    labels.add("download_needs_ocr");
    reasons.push("downloaded file produced no extractable text");
  }
  if (object.read_status === "downloaded_parse_failed") {
    labels.add("download_parse_failed");
    reasons.push("downloaded file parse failed");
  }
  if (objectType === "external_tool" || objectType === "external_url" || /external_tool|external_unvisited/.test(moduleCaptureStatuses)) {
    labels.add("external_tool");
    reasons.push("external surface");
  }
  if (issueTypes.some((issue) => ["capture_failed", "unauthorized", "page_not_found"].includes(issue))) {
    labels.add("blocked_or_broken");
    reasons.push(`issue=${issueTypes.join("|")}`);
  }
  if (/(academic misconduct|privacy|accessibility|policy|conduct|plagiarism|discrimination|harassment|student resources|financial resources)/i.test(title)) {
    labels.add("admin_policy");
    reasons.push("admin/policy signal");
  }
  if (!labels.size) {
    labels.add("reference");
    reasons.push("default retained reference");
  }

  let primary_category = "reference";
  for (const candidate of [
    "blocked_or_broken",
    "graded_task",
    "critical_setup",
    "required_ungraded_task",
    "prep_reading",
    "lecture_video",
    "file_reference",
    "admin_policy",
    "external_tool",
    "reference",
  ]) {
    if (labels.has(candidate)) {
      primary_category = candidate;
      break;
    }
  }

  let importance = "low";
  if (labels.has("blocked_or_broken") || labels.has("graded_task") || labels.has("critical_setup")) importance = "high";
  else if (labels.has("required_ungraded_task") || labels.has("prep_reading") || labels.has("lecture_video")) importance = "medium";

  let actionability = "reference_only";
  if (labels.has("blocked_or_broken") || labels.has("external_tool") || labels.has("download_indexed_not_read") || labels.has("download_needs_ocr") || labels.has("download_parse_failed")) actionability = "review_needed";
  if (labels.has("graded_task") || labels.has("critical_setup") || labels.has("required_ungraded_task")) actionability = "action_required";
  if (!labels.has("graded_task") && !labels.has("required_ungraded_task") && !labels.has("critical_setup") && (labels.has("prep_reading") || labels.has("lecture_video"))) {
    actionability = "prep_required";
  }

  let confidence = "medium";
  if (labels.has("blocked_or_broken") || labels.has("download_indexed_not_read") || labels.has("download_needs_ocr") || labels.has("download_parse_failed") || labels.has("external_tool")) confidence = "low";
  if ((labels.has("graded_task") && objectEvidence.length) || labels.has("critical_setup")) confidence = "high";
  if (!objectEvidence.length) confidence = "low";
  if (labels.has("course_navigation_surface") && !labels.has("blocked_or_broken")) {
    primary_category = "reference";
    importance = "low";
    actionability = "reference_only";
    confidence = objectEvidence.length ? "high" : "medium";
  }

  return {
    labels: [...labels],
    primary_category,
    importance,
    actionability,
    confidence,
    reason: uniqueJoined(reasons),
  };
}

function buildClassificationOutputs({ normalizedGraph, metadataByPage, captureIssues }) {
  const objectPagesByObject = new Map();
  const objectEvidenceByObject = new Map();
  const moduleItemsByObject = new Map();
  const pageToObject = new Map();
  const issuesByObject = new Map();
  const classifiedItems = [];
  const tasks = [];
  const taskEvidence = [];
  const reviewQueue = [];
  let taskNumber = 0;
  let reviewNumber = 0;

  for (const row of normalizedGraph.objectPages) {
    if (!objectPagesByObject.has(row.object_id)) objectPagesByObject.set(row.object_id, []);
    objectPagesByObject.get(row.object_id).push(row);
    pageToObject.set(row.page_id, row.object_id);
  }
  for (const row of normalizedGraph.evidence) {
    if (!objectEvidenceByObject.has(row.object_id)) objectEvidenceByObject.set(row.object_id, []);
    objectEvidenceByObject.get(row.object_id).push(row);
  }
  for (const row of normalizedGraph.moduleItems) {
    if (!moduleItemsByObject.has(row.destination_object_id)) moduleItemsByObject.set(row.destination_object_id, []);
    moduleItemsByObject.get(row.destination_object_id).push(row);
  }
  for (const issue of captureIssues) {
    const objectId = pageToObject.get(issue.page_id);
    if (!objectId) continue;
    if (!issuesByObject.has(objectId)) issuesByObject.set(objectId, []);
    issuesByObject.get(objectId).push(issue);
  }

  const addReview = (review) => {
    reviewNumber += 1;
    reviewQueue.push({
      review_id: `review-${String(reviewNumber).padStart(5, "0")}`,
      priority: priorityForReview(review.review_reason),
      ...review,
    });
  };

  for (const object of normalizedGraph.objects) {
    const objectPages = objectPagesByObject.get(object.object_id) || [];
    const moduleItems = moduleItemsByObject.get(object.object_id) || [];
    const objectEvidence = objectEvidenceByObject.get(object.object_id) || [];
    const issues = issuesByObject.get(object.object_id) || [];
    const issueTypes = [...new Set(issues.map((issue) => issue.issue_type))];
    const text = compactText([
      object.title,
      ...moduleItems.map((item) => `${item.title} ${item.source_text_sample}`),
      ...objectEvidence.map((evidence) => evidence.detail),
      ...objectPages.map((page) => metadataText(metadataByPage.get(page.page_id))),
    ].join(" "));
    const signals = extractTaskSignals(text);
    const classification = classifyObject({
      object,
      moduleItems,
      objectPages,
      objectEvidence,
      issueTypes,
      objectText: text,
    });
    const moduleIds = uniqueJoined(moduleItems.map((item) => item.module_id));
    const moduleTitles = uniqueJoined(moduleItems.map((item) => {
      const module = normalizedGraph.modules.find((row) => row.module_id === item.module_id);
      return module?.module_title || "";
    }));
    const moduleItemIds = uniqueJoined(moduleItems.map((item) => item.module_item_id));
    const evidenceIds = objectEvidence.map((row) => row.evidence_id);
    const sourcePageIds = uniqueJoined([
      ...objectPages.map((page) => page.page_id),
      ...objectEvidence.map((row) => row.source_page_id),
    ]);
    const sourceUrls = uniqueJoined([
      object.canonical_url,
      ...objectPages.map((page) => page.resolved_url || page.requested_url),
      ...objectEvidence.map((row) => row.source_url),
    ]);

    classifiedItems.push({
      object_id: object.object_id,
      course_id: object.course_id,
      course_code: object.course_code,
      object_type: object.object_type,
      title: object.title,
      primary_category: classification.primary_category,
      classification_labels: classification.labels.join("|"),
      importance: classification.importance,
      actionability: classification.actionability,
      confidence: classification.confidence,
      due_text: signals.due_text,
      available_text: signals.available_text,
      points_text: signals.points_text,
      estimated_time: signals.estimated_time,
      module_ids: moduleIds,
      module_titles: moduleTitles,
      module_item_ids: moduleItemIds,
      issue_types: issueTypes.join("|"),
      evidence_count: objectEvidence.length,
      reason: classification.reason,
    });

    const taskLabels = new Set(["graded_task", "required_ungraded_task", "critical_setup", "prep_reading", "lecture_video", "blocked_or_broken", "external_tool"]);
    const shouldEmitTask = classification.labels.some((label) => taskLabels.has(label)) &&
      !classification.labels.includes("admin_policy") &&
      !classification.labels.includes("course_navigation_surface");
    let taskId = "";
    if (shouldEmitTask) {
      taskNumber += 1;
      taskId = `task-${String(taskNumber).padStart(5, "0")}-${object.course_code.toLowerCase()}-${slugify(classification.primary_category)}-${slugify(object.title || object.object_id)}`;
      tasks.push({
        task_id: taskId,
        course_id: object.course_id,
        course_code: object.course_code,
        task_type: classification.primary_category,
        title: object.title,
        importance: classification.importance,
        actionability: classification.actionability,
        confidence: classification.confidence,
        due_text: signals.due_text,
        available_text: signals.available_text,
        points_text: signals.points_text,
        estimated_time: signals.estimated_time,
        object_id: object.object_id,
        object_type: object.object_type,
        module_ids: moduleIds,
        module_titles: moduleTitles,
        module_item_ids: moduleItemIds,
        source_page_ids: sourcePageIds,
        source_urls: sourceUrls,
        labels: classification.labels.join("|"),
        review_state: classification.confidence === "low" || classification.actionability === "review_needed" ? "needs_review" : "candidate",
      });
      for (const evidence of objectEvidence) {
        taskEvidence.push({
          task_id: taskId,
          object_id: object.object_id,
          evidence_id: evidence.evidence_id,
          evidence_type: evidence.evidence_type,
          relation: evidence.relation,
          source_page_id: evidence.source_page_id,
          source_url: evidence.source_url,
          target_page_id: evidence.target_page_id,
          target_url: evidence.target_url,
          detail: evidence.detail,
        });
      }
    }

    const reviewReasons = [];
    if (classification.confidence === "low") reviewReasons.push("low_confidence");
    if (classification.labels.includes("blocked_or_broken")) reviewReasons.push("blocked_or_broken");
    if (classification.labels.includes("external_tool")) reviewReasons.push("external_surface");
    if (classification.labels.includes("download_indexed_not_read")) reviewReasons.push("download_not_read");
    if (classification.labels.includes("download_needs_ocr")) reviewReasons.push("download_needs_ocr");
    if (classification.labels.includes("download_parse_failed")) reviewReasons.push("download_parse_failed");
    if (moduleItems.some((item) => item.capture_status === "structural_no_href")) reviewReasons.push("structural_no_href");
    if (!objectEvidence.length) reviewReasons.push("missing_evidence");
    for (const reason of reviewReasons) {
      addReview({
        review_reason: reason,
        course_id: object.course_id,
        course_code: object.course_code,
        task_id: taskId,
        object_id: object.object_id,
        page_id: objectPages[0]?.page_id || "",
        title: object.title,
        source_url: object.canonical_url,
        suggested_action:
          reason === "download_not_read"
            ? "Download and parse file before treating contents as read."
            : reason === "download_needs_ocr"
              ? "Run OCR or visual extraction before treating contents as read."
              : reason === "download_parse_failed"
                ? "Inspect parse failure and retry with a better parser."
            : reason === "external_surface"
              ? "Inspect external tool/link if it may contain required work."
              : reason === "blocked_or_broken"
                ? "Retry or manually review blocked/broken capture."
                : "Review classification evidence and adjust rules or overrides.",
      });
    }
  }

  for (const issue of captureIssues.filter((row) => !row.page_id)) {
    addReview({
      review_reason: issue.issue_type || "capture_issue",
      course_id: issue.course_id,
      course_code: issue.course_code,
      task_id: "",
      object_id: "",
      page_id: "",
      title: issue.title,
      source_url: issue.requested_url,
      suggested_action: "Retry capture or manually inspect this uncaptured URL.",
    });
  }

  return {
    classifiedItems,
    tasks,
    taskEvidence,
    reviewQueue,
    classificationRules: CLASSIFICATION_RULES,
  };
}

function addMapList(map, key, value) {
  if (!key) return;
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}

function buildCrosscheckSummary({ moduleCrosscheck, gradeTaskCrosscheck, missingOrSuspicious }) {
  const grouped = new Map();

  const add = ({ course_id, course_code, source_table, category, status, title, url }) => {
    const key = `${course_id}\t${course_code}\t${source_table}\t${category}\t${status}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        course_id,
        course_code,
        source_table,
        category,
        status,
        count: 0,
        example_titles: [],
        example_urls: [],
      });
    }
    const row = grouped.get(key);
    row.count += 1;
    if (title && row.example_titles.length < 3 && !row.example_titles.includes(title)) {
      row.example_titles.push(title);
    }
    if (url && row.example_urls.length < 3 && !row.example_urls.includes(url)) {
      row.example_urls.push(url);
    }
  };

  for (const row of moduleCrosscheck) {
    add({
      course_id: row.course_id,
      course_code: row.course_code,
      source_table: "crosscheck_modules_assignments",
      category: row.destination_object_type || row.item_type || "module_item",
      status: row.crosscheck_status,
      title: row.module_item_title,
      url: row.destination_url || row.source_url,
    });
  }
  for (const row of gradeTaskCrosscheck) {
    add({
      course_id: row.course_id,
      course_code: row.course_code,
      source_table: "crosscheck_grades_tasks",
      category: row.surface_type,
      status: row.crosscheck_status,
      title: row.object_title || row.source_title,
      url: row.target_url || row.source_url,
    });
  }
  for (const row of missingOrSuspicious) {
    add({
      course_id: row.course_id,
      course_code: row.course_code,
      source_table: "missing_or_suspicious",
      category: row.category,
      status: row.status,
      title: row.title,
      url: row.related_url || row.source_url,
    });
  }

  let summaryNumber = 0;
  return [...grouped.values()].sort((a, b) =>
    a.course_code.localeCompare(b.course_code) ||
    a.source_table.localeCompare(b.source_table) ||
    a.category.localeCompare(b.category) ||
    a.status.localeCompare(b.status)
  ).map((row) => {
    summaryNumber += 1;
    return {
      summary_id: `xsum-${String(summaryNumber).padStart(4, "0")}`,
      ...row,
      example_titles: row.example_titles.join(" | "),
      example_urls: row.example_urls.join(" | "),
    };
  });
}

function buildCrosscheckOutputs({ normalizedGraph, classificationOutputs, captureIssues }) {
  const objectById = new Map(normalizedGraph.objects.map((row) => [row.object_id, row]));
  const moduleById = new Map(normalizedGraph.modules.map((row) => [row.module_id, row]));
  const classifiedByObject = new Map(classificationOutputs.classifiedItems.map((row) => [row.object_id, row]));
  const tasksByObject = new Map();
  const evidenceByObject = new Map();
  const moduleItemsByObject = new Map();
  const reviewsByObject = new Map();
  const issuesByObject = new Map();
  const issuesByUrl = new Map();
  const pageToObject = new Map();
  const moduleCrosscheck = [];
  const gradeTaskCrosscheck = [];
  const missingOrSuspicious = [];
  let suspicionNumber = 0;

  for (const task of classificationOutputs.tasks) addMapList(tasksByObject, task.object_id, task);
  for (const evidence of normalizedGraph.evidence) addMapList(evidenceByObject, evidence.object_id, evidence);
  for (const item of normalizedGraph.moduleItems) addMapList(moduleItemsByObject, item.destination_object_id, item);
  for (const review of classificationOutputs.reviewQueue) addMapList(reviewsByObject, review.object_id, review);
  for (const page of normalizedGraph.objectPages) pageToObject.set(page.page_id, page.object_id);

  for (const issue of captureIssues) {
    const objectId = pageToObject.get(issue.page_id);
    if (objectId) addMapList(issuesByObject, objectId, issue);
    for (const url of [issue.requested_url, issue.resolved_url]) {
      if (url) addMapList(issuesByUrl, normalizeUrl(url), issue);
    }
  }

  const addSuspicion = (row) => {
    suspicionNumber += 1;
    missingOrSuspicious.push({
      suspicion_id: `sus-${String(suspicionNumber).padStart(5, "0")}`,
      ...row,
    });
  };

  const crosscheckStatusForModuleItem = ({ item, object, task, classified, issueTypes }) => {
    if (issueTypes.some((issue) => ["capture_failed", "unauthorized", "page_not_found"].includes(issue))) {
      return "module_item_blocked";
    }
    if (item.capture_status === "external_unvisited") return "module_item_external_unvisited";
    if (item.capture_status === "unvisited_canvas") return "module_item_unvisited_canvas";
    if (item.capture_status === "structural_no_href") return "module_item_structural";
    if (task) return "module_item_has_task";
    const objectType = object?.object_type || item.destination_canvas_object_type;
    if (["assignment", "quiz", "discussion"].includes(objectType)) return "module_item_task_candidate_without_task";
    if (classified?.importance === "high" || classified?.importance === "medium") return "module_item_important_reference";
    return "module_item_reference_only";
  };

  for (const item of normalizedGraph.moduleItems) {
    const object = objectById.get(item.destination_object_id) || {};
    const module = moduleById.get(item.module_id) || {};
    const classified = classifiedByObject.get(item.destination_object_id) || {};
    const objectEvidence = evidenceByObject.get(item.destination_object_id) || [];
    const reviews = reviewsByObject.get(item.destination_object_id) || [];
    const itemIssues = [
      ...(issuesByObject.get(item.destination_object_id) || []),
      ...(issuesByUrl.get(normalizeUrl(item.href)) || []),
    ];
    const issueTypes = [...new Set(itemIssues.map((issue) => issue.issue_type).filter(Boolean))];
    const evidenceTypes = [...new Set(objectEvidence.map((evidence) => evidence.evidence_type))];
    const reviewReasons = [...new Set(reviews.map((review) => review.review_reason).filter(Boolean))];
    const task = (tasksByObject.get(item.destination_object_id) || [])[0] || null;
    const status = crosscheckStatusForModuleItem({ item, object, task, classified, issueTypes });
    const row = {
      course_id: item.course_id,
      course_code: item.course_code,
      module_id: item.module_id,
      module_order: item.module_order,
      module_title: module.module_title || "",
      module_item_id: item.module_item_id,
      canvas_module_item_id: item.canvas_module_item_id,
      item_order: item.item_order,
      module_item_title: item.title,
      item_type: item.item_type,
      destination_object_id: item.destination_object_id,
      destination_object_type: object.object_type || item.destination_canvas_object_type,
      destination_canvas_object_id: object.canvas_object_id || item.destination_canvas_object_id,
      destination_page_id: item.destination_page_id,
      capture_status: item.capture_status,
      has_task: yesNo(task),
      task_id: task?.task_id || "",
      task_type: task?.task_type || "",
      task_review_state: task?.review_state || "",
      classification_category: classified.primary_category || "",
      classification_labels: classified.classification_labels || "",
      confidence: classified.confidence || "",
      in_assignments_surface: yesNo(evidenceTypes.includes("assignment_surface_row")),
      in_grades_surface: yesNo(evidenceTypes.includes("grade_surface_row")),
      has_download: yesNo(evidenceTypes.includes("download_link") || object.object_type === "download"),
      has_review: yesNo(reviewReasons.length),
      review_reasons: reviewReasons.join("|"),
      issue_types: issueTypes.join("|"),
      crosscheck_status: status,
      notes: object.notes || "",
      source_page_id: item.source_page_id,
      source_url: item.source_url,
      destination_url: object.canonical_url || item.href,
    };
    moduleCrosscheck.push(row);

    if ([
      "module_item_blocked",
      "module_item_external_unvisited",
      "module_item_unvisited_canvas",
      "module_item_structural",
      "module_item_task_candidate_without_task",
    ].includes(status)) {
      addSuspicion({
        course_id: item.course_id,
        course_code: item.course_code,
        severity: status === "module_item_blocked" ? "high" : "medium",
        category: "module_crosscheck",
        object_id: item.destination_object_id,
        task_id: task?.task_id || "",
        module_id: item.module_id,
        module_item_id: item.module_item_id,
        page_id: item.destination_page_id,
        title: item.title,
        source_url: item.source_url,
        related_url: object.canonical_url || item.href,
        evidence_id: "",
        review_id: "",
        status,
        detail: `capture_status=${item.capture_status}; issue_types=${issueTypes.join("|")}`,
        suggested_action: "Inspect this module item or add a retry/rule if it contains required work.",
      });
    }
  }

  const surfaceEvidenceRows = normalizedGraph.evidence.filter((row) =>
    row.evidence_type === "grade_surface_row" || row.evidence_type === "assignment_surface_row"
  );
  for (const evidence of surfaceEvidenceRows) {
    const object = objectById.get(evidence.object_id) || {};
    const classified = classifiedByObject.get(evidence.object_id) || {};
    const tasks = tasksByObject.get(evidence.object_id) || [];
    const task = tasks[0] || null;
    const moduleItems = moduleItemsByObject.get(evidence.object_id) || [];
    const moduleIds = uniqueJoined(moduleItems.map((item) => item.module_id));
    const moduleTitles = uniqueJoined(moduleItems.map((item) => moduleById.get(item.module_id)?.module_title || ""));
    const moduleItemIds = uniqueJoined(moduleItems.map((item) => item.module_item_id));
    const signals = extractTaskSignals(evidence.detail);
    const surfaceType = evidence.evidence_type === "grade_surface_row" ? "grades" : "assignments";
    let status = `${surfaceType}_surface_task_in_modules`;
    if (!task) status = `${surfaceType}_surface_missing_task`;
    else if (!moduleItems.length) status = `${surfaceType}_surface_task_not_in_modules`;
    const row = {
      course_id: evidence.course_id,
      course_code: evidence.course_code,
      surface_type: surfaceType,
      evidence_id: evidence.evidence_id,
      source_page_id: evidence.source_page_id,
      source_url: evidence.source_url,
      source_title: evidence.source_title,
      object_id: evidence.object_id,
      object_type: object.object_type || "",
      object_title: object.title || evidence.source_title,
      target_url: evidence.target_url,
      in_modules: yesNo(moduleItems.length),
      module_ids: moduleIds,
      module_titles: moduleTitles,
      module_item_ids: moduleItemIds,
      has_task: yesNo(task),
      task_id: task?.task_id || "",
      task_type: task?.task_type || "",
      due_text: task?.due_text || "",
      available_text: task?.available_text || "",
      points_text: task?.points_text || "",
      surface_due_text: signals.due_text,
      surface_available_text: signals.available_text,
      surface_points_text: signals.points_text,
      classification_category: classified.primary_category || "",
      confidence: classified.confidence || "",
      crosscheck_status: status,
      detail: evidence.detail,
    };
    gradeTaskCrosscheck.push(row);

    if (status !== `${surfaceType}_surface_task_in_modules`) {
      addSuspicion({
        course_id: evidence.course_id,
        course_code: evidence.course_code,
        severity: task ? "medium" : "high",
        category: `${surfaceType}_surface_crosscheck`,
        object_id: evidence.object_id,
        task_id: task?.task_id || "",
        module_id: moduleIds,
        module_item_id: moduleItemIds,
        page_id: evidence.source_page_id,
        title: object.title || evidence.source_title,
        source_url: evidence.source_url,
        related_url: evidence.target_url || object.canonical_url,
        evidence_id: evidence.evidence_id,
        review_id: "",
        status,
        detail: evidence.detail,
        suggested_action: task
          ? "Decide whether this surface-listed task needs module context or should stay grade/assignment-only."
          : "Create or fix a task classification for this Assignments/Grades surface row.",
      });
    }
  }

  for (const issue of captureIssues.filter((row) => row.issue_type !== "redirected")) {
    addSuspicion({
      course_id: issue.course_id,
      course_code: issue.course_code,
      severity: issue.severity,
      category: "capture_issue",
      object_id: pageToObject.get(issue.page_id) || "",
      task_id: "",
      module_id: "",
      module_item_id: "",
      page_id: issue.page_id,
      title: issue.title,
      source_url: issue.requested_url,
      related_url: issue.resolved_url,
      evidence_id: "",
      review_id: "",
      status: issue.issue_type,
      detail: issue.detail,
      suggested_action:
        issue.issue_type === "capture_failed"
          ? "Retry this URL or manually inspect it before considering the course complete."
          : "Inspect the captured page and decide whether the blocker affects required work.",
    });
  }

  for (const download of normalizedGraph.downloads) {
    if (!["indexed_not_read", "downloaded_text_empty_needs_ocr", "downloaded_parse_failed"].includes(download.read_status)) continue;
    const needsOcr = download.read_status === "downloaded_text_empty_needs_ocr";
    const parseFailed = download.read_status === "downloaded_parse_failed";
    addSuspicion({
      course_id: download.course_id,
      course_code: download.course_code,
      severity: "medium",
      category: needsOcr ? "download_needs_ocr" : parseFailed ? "download_parse_failed" : "download_not_read",
      object_id: download.object_id,
      task_id: "",
      module_id: "",
      module_item_id: "",
      page_id: download.source_page_id,
      title: download.file_name || download.text,
      source_url: download.source_page_url,
      related_url: download.href,
      evidence_id: "",
      review_id: "",
      status: download.read_status,
      detail: `source_page_title=${download.source_page_title}; evidence_status=${download.evidence_status}; repo_file_path=${download.repo_file_path || ""}`,
      suggested_action: needsOcr
        ? "Run OCR or visual extraction before treating the file contents as indexed."
        : parseFailed
          ? "Inspect the parse failure and retry with a better parser."
          : "Download and parse the file before treating the file contents as indexed.",
    });
  }

  for (const review of classificationOutputs.reviewQueue) {
    addSuspicion({
      course_id: review.course_id,
      course_code: review.course_code,
      severity: review.priority,
      category: "review_queue",
      object_id: review.object_id,
      task_id: review.task_id,
      module_id: "",
      module_item_id: "",
      page_id: review.page_id,
      title: review.title,
      source_url: review.source_url,
      related_url: "",
      evidence_id: "",
      review_id: review.review_id,
      status: review.review_reason,
      detail: review.suggested_action,
      suggested_action: review.suggested_action,
    });
  }

  for (const task of classificationOutputs.tasks) {
    if (!task.module_ids) {
      addSuspicion({
        course_id: task.course_id,
        course_code: task.course_code,
        severity: "medium",
        category: "task_without_module",
        object_id: task.object_id,
        task_id: task.task_id,
        module_id: "",
        module_item_id: task.module_item_ids,
        page_id: "",
        title: task.title,
        source_url: task.source_urls,
        related_url: "",
        evidence_id: "",
        review_id: "",
        status: task.task_type,
        detail: `labels=${task.labels}; review_state=${task.review_state}`,
        suggested_action: "Confirm whether this task is intentionally outside Modules.",
      });
    }
    if (task.task_type === "graded_task" && !task.due_text) {
      addSuspicion({
        course_id: task.course_id,
        course_code: task.course_code,
        severity: "medium",
        category: "graded_task_missing_due",
        object_id: task.object_id,
        task_id: task.task_id,
        module_id: task.module_ids,
        module_item_id: task.module_item_ids,
        page_id: "",
        title: task.title,
        source_url: task.source_urls,
        related_url: "",
        evidence_id: "",
        review_id: "",
        status: "missing_due_text",
        detail: `points_text=${task.points_text}; labels=${task.labels}`,
        suggested_action: "Inspect detail, Grades, or Assignments evidence for a due date.",
      });
    }
  }

  const summary = buildCrosscheckSummary({ moduleCrosscheck, gradeTaskCrosscheck, missingOrSuspicious });

  return {
    moduleCrosscheck,
    gradeTaskCrosscheck,
    missingOrSuspicious,
    summary,
  };
}

function overrideStateFromRow(override) {
  if (cleanText(override.mark_resolved).toLowerCase() === "yes") return "resolved";
  const state = cleanText(override.override_review_state).toLowerCase();
  if (["needs_rule", "needs_retry", "needs_download", "needs_ocr", "needs_manual_decision", "resolved"].includes(state)) {
    return state;
  }
  return "";
}

function applyReviewOverrides({ classificationOutputs, reviewOverrides }) {
  const classifiedItems = classificationOutputs.classifiedItems.map((row) => ({ ...row }));
  const tasks = classificationOutputs.tasks.map((row) => ({ ...row }));
  const reviewQueue = classificationOutputs.reviewQueue.map((row) => ({ ...row }));
  const classifiedByObject = new Map(classifiedItems.map((row) => [row.object_id, row]));
  const tasksById = new Map(tasks.map((row) => [row.task_id, row]));
  const tasksByObject = new Map();
  const reviewsById = new Map(reviewQueue.map((row) => [row.review_id, row]));
  const appliedReviewOverrides = [];
  let generatedId = 0;

  for (const task of tasks) addMapList(tasksByObject, task.object_id, task);

  for (const override of reviewOverrides) {
    generatedId += 1;
    const overrideId = override.override_id || `override-${String(generatedId).padStart(4, "0")}`;
    const targetType = cleanText(override.target_type).toLowerCase();
    const targetId = cleanText(override.target_id);
    const objectId = override.object_id || (targetType === "object" ? targetId : "");
    const taskId = override.task_id || (targetType === "task" ? targetId : "");
    const reviewId = targetType === "review" ? targetId : "";
    const appliedFields = [];
    const targets = [];

    const classified = classifiedByObject.get(objectId);
    if (classified) {
      if (override.override_primary_category) {
        classified.primary_category = override.override_primary_category;
        appliedFields.push("classified.primary_category");
      }
      if (override.override_labels) {
        classified.classification_labels = override.override_labels;
        appliedFields.push("classified.classification_labels");
      }
      if (override.override_importance) {
        classified.importance = override.override_importance;
        appliedFields.push("classified.importance");
      }
      if (override.override_actionability) {
        classified.actionability = override.override_actionability;
        appliedFields.push("classified.actionability");
      }
      if (override.override_confidence) {
        classified.confidence = override.override_confidence;
        appliedFields.push("classified.confidence");
      }
      targets.push(`object:${objectId}`);
    }

    const taskTargets = [
      ...(taskId && tasksById.has(taskId) ? [tasksById.get(taskId)] : []),
      ...(!taskId && objectId ? (tasksByObject.get(objectId) || []) : []),
    ];
    for (const task of taskTargets) {
      if (override.override_primary_category) {
        task.task_type = override.override_primary_category;
        appliedFields.push("task.task_type");
      }
      if (override.override_labels) {
        task.labels = override.override_labels;
        appliedFields.push("task.labels");
      }
      if (override.override_importance) {
        task.importance = override.override_importance;
        appliedFields.push("task.importance");
      }
      if (override.override_actionability) {
        task.actionability = override.override_actionability;
        appliedFields.push("task.actionability");
      }
      if (override.override_confidence) {
        task.confidence = override.override_confidence;
        appliedFields.push("task.confidence");
      }
      if (override.override_review_state) {
        task.review_state = override.override_review_state;
        appliedFields.push("task.review_state");
      }
      targets.push(`task:${task.task_id}`);
    }

    const review = reviewsById.get(reviewId);
    if (review && cleanText(override.mark_resolved).toLowerCase() === "yes") {
      review.priority = "resolved";
      review.suggested_action = `Resolved by ${overrideId}: ${override.notes || ""}`.trim();
      appliedFields.push("review.resolved");
      targets.push(`review:${review.review_id}`);
    }

    appliedReviewOverrides.push({
      override_id: overrideId,
      target_type: override.target_type,
      target_id: override.target_id,
      object_id: objectId,
      task_id: taskId,
      review_id: reviewId,
      applied: yesNo(appliedFields.length),
      applied_targets: uniqueJoined(targets),
      applied_fields: uniqueJoined(appliedFields),
      override_review_state: overrideStateFromRow(override),
      notes: override.notes || "",
    });
  }

  return {
    classificationOutputs: {
      classifiedItems,
      tasks,
      taskEvidence: classificationOutputs.taskEvidence,
      reviewQueue,
      classificationRules: classificationOutputs.classificationRules,
    },
    appliedReviewOverrides,
  };
}

function findMatchingOverride(row, reviewOverrides) {
  return reviewOverrides.find((override) => {
    const targetType = cleanText(override.target_type).toLowerCase();
    const targetId = cleanText(override.target_id);
    if (override.object_id && override.object_id === row.object_id) return true;
    if (override.task_id && override.task_id === row.task_id) return true;
    if (targetType === "object" && targetId === row.object_id) return true;
    if (targetType === "task" && targetId === row.task_id) return true;
    if (targetType === "review" && targetId === row.review_id) return true;
    if (targetType === "url" && [row.source_url, row.related_url].includes(targetId)) return true;
    return false;
  }) || null;
}

function hasPlaceholderCanvasUrl(row) {
  return [row.source_url, row.related_url].some((url) => /\$CANVAS_COURSE_REFERENCE\$/.test(String(url || "")));
}

function inferReviewState(row, override) {
  const overrideState = override ? overrideStateFromRow(override) : "";
  if (overrideState) return overrideState;

  if (row.category === "download_needs_ocr" || row.status === "downloaded_text_empty_needs_ocr" || row.status === "download_needs_ocr") {
    return "needs_ocr";
  }
  if (row.category === "download_parse_failed" || row.status === "downloaded_parse_failed" || row.status === "download_parse_failed") {
    return "needs_ocr";
  }
  if (row.category === "download_not_read" || row.status === "download_not_read" || row.status === "indexed_not_read") {
    return "needs_download";
  }
  if (hasPlaceholderCanvasUrl(row)) return "needs_rule";
  if (["capture_failed", "unauthorized", "page_not_found", "module_item_blocked", "module_item_unvisited_canvas"].includes(row.status)) {
    return "needs_retry";
  }
  if (row.status === "blocked_or_broken") return "needs_retry";
  if (["graded_task_missing_due", "review_queue"].includes(row.category) && /low_confidence|missing_due|task_candidate/.test(row.status)) {
    return "needs_rule";
  }
  if (/surface_crosscheck|task_without_module/.test(row.category)) return "needs_manual_decision";
  if (/task_candidate_without_task|structural/.test(row.status)) return "needs_rule";
  if (/external/.test(row.status)) return "needs_manual_decision";
  if (row.category === "review_queue" && /needs_ocr|parse_failed/.test(row.status)) return "needs_ocr";
  if (row.category === "review_queue" && /download/.test(row.status)) return "needs_download";
  if (row.category === "review_queue" && /capture_failed|blocked|unauthorized|page_not_found/.test(row.status)) return "needs_retry";
  return "needs_manual_decision";
}

function nextActionForReviewState(state) {
  if (state === "needs_rule") return "improve_classifier_or_override";
  if (state === "needs_retry") return "retry_canvas_capture";
  if (state === "needs_download") return "download_and_parse_file";
  if (state === "needs_ocr") return "ocr_or_vision_extract_file";
  if (state === "resolved") return "none";
  return "manual_review";
}

function buildRecursiveOutputs({ normalizedGraph, crosscheckOutputs, reviewOverrides, appliedReviewOverrides }) {
  const reviewStateManifest = [];
  const retryByUrl = new Map();
  const ruleGroups = new Map();
  const manualReviewManifest = [];
  let reviewItemNumber = 0;
  let retryNumber = 0;
  let downloadNumber = 0;
  let ruleNumber = 0;
  let manualNumber = 0;

  for (const row of crosscheckOutputs.missingOrSuspicious) {
    reviewItemNumber += 1;
    const override = findMatchingOverride(row, reviewOverrides);
    const state = inferReviewState(row, override);
    const reviewRow = {
      review_item_id: `ri-${String(reviewItemNumber).padStart(5, "0")}`,
      suspicion_id: row.suspicion_id,
      course_id: row.course_id,
      course_code: row.course_code,
      review_state: state,
      next_action_type: nextActionForReviewState(state),
      severity: row.severity,
      category: row.category,
      status: row.status,
      object_id: row.object_id,
      task_id: row.task_id,
      module_id: row.module_id,
      module_item_id: row.module_item_id,
      page_id: row.page_id,
      title: row.title,
      source_url: row.source_url,
      related_url: row.related_url,
      evidence_id: row.evidence_id,
      review_id: row.review_id,
      override_id: override?.override_id || "",
      override_status: override ? (state === "resolved" ? "resolved_by_override" : "override_applied") : "",
      suggested_action: row.suggested_action,
      detail: row.detail,
    };
    reviewStateManifest.push(reviewRow);

    if (state === "needs_retry") {
      const retryUrl = row.related_url || row.source_url;
      if (retryUrl && !retryByUrl.has(normalizeUrl(retryUrl))) {
        retryNumber += 1;
        retryByUrl.set(normalizeUrl(retryUrl), {
          retry_id: `retry-${String(retryNumber).padStart(4, "0")}`,
          course_id: row.course_id,
          course_code: row.course_code,
          url: retryUrl,
          reason: row.status,
          severity: row.severity,
          source_review_item_ids: reviewRow.review_item_id,
          source_categories: row.category,
          source_statuses: row.status,
          execute_status: "queued_not_executed",
          suggested_action: "Retry in browser/crawler and re-run the offline indexer.",
        });
      } else if (retryUrl) {
        const retry = retryByUrl.get(normalizeUrl(retryUrl));
        retry.source_review_item_ids = uniqueJoined([retry.source_review_item_ids, reviewRow.review_item_id]);
        retry.source_categories = uniqueJoined([retry.source_categories, row.category]);
        retry.source_statuses = uniqueJoined([retry.source_statuses, row.status]);
        if (row.severity === "high") retry.severity = "high";
      }
    }

    if (state === "needs_rule") {
      const key = `${row.course_code}\t${row.category}\t${row.status}`;
      if (!ruleGroups.has(key)) {
        ruleNumber += 1;
        ruleGroups.set(key, {
          rule_review_id: `rule-${String(ruleNumber).padStart(4, "0")}`,
          course_id: row.course_id,
          course_code: row.course_code,
          category: row.category,
          status: row.status,
          count: 0,
          example_titles: [],
          example_urls: [],
          proposed_rule_action: "Review examples and add or adjust deterministic classifier/cross-check rules.",
        });
      }
      const rule = ruleGroups.get(key);
      rule.count += 1;
      if (row.title && rule.example_titles.length < 3 && !rule.example_titles.includes(row.title)) {
        rule.example_titles.push(row.title);
      }
      const url = row.related_url || row.source_url;
      if (url && rule.example_urls.length < 3 && !rule.example_urls.includes(url)) {
        rule.example_urls.push(url);
      }
    }

    if (state === "needs_manual_decision") {
      manualNumber += 1;
      manualReviewManifest.push({
        manual_review_id: `manual-${String(manualNumber).padStart(5, "0")}`,
        ...reviewRow,
      });
    }
  }

  const retryManifest = [...retryByUrl.values()].sort((a, b) =>
    a.course_code.localeCompare(b.course_code) ||
    a.severity.localeCompare(b.severity) ||
    a.url.localeCompare(b.url)
  );

  const downloadManifest = normalizedGraph.downloads.map((download) => {
    downloadNumber += 1;
    const executeStatus =
      download.read_status === "parsed_file_text" ? "downloaded_and_parsed" :
      download.read_status === "downloaded_text_empty_needs_ocr" ? "downloaded_needs_ocr" :
      download.read_status === "downloaded_parse_failed" ? "downloaded_parse_failed" :
      "queued_not_executed";
    const suggestedAction =
      download.read_status === "parsed_file_text" ? "Parsed file text is attached as evidence." :
      download.read_status === "downloaded_text_empty_needs_ocr" ? "Run OCR or visual extraction before treating file contents as read." :
      download.read_status === "downloaded_parse_failed" ? "Inspect parse failure and retry with a better parser." :
      "Download binary, parse text/tables, attach parsed evidence, then re-run indexer.";
    return {
      download_manifest_id: `download-${String(downloadNumber).padStart(4, "0")}`,
      download_id: download.download_id,
      course_id: download.course_id,
      course_code: download.course_code,
      object_id: download.object_id,
      file_name: download.file_name,
      canvas_file_id: download.canvas_file_id,
      href: download.href,
      source_page_id: download.source_page_id,
      source_page_title: download.source_page_title,
      source_page_url: download.source_page_url,
      read_status: download.read_status,
      execute_status: executeStatus,
      repo_file_path: download.repo_file_path || "",
      parsed_markdown_path: download.parsed_markdown_path || "",
      suggested_action: suggestedAction,
    };
  });

  const ruleImprovementManifest = [...ruleGroups.values()].map((row) => ({
    ...row,
    example_titles: row.example_titles.join(" | "),
    example_urls: row.example_urls.join(" | "),
  })).sort((a, b) =>
    a.course_code.localeCompare(b.course_code) ||
    b.count - a.count ||
    a.category.localeCompare(b.category) ||
    a.status.localeCompare(b.status)
  );

  return {
    reviewStateManifest,
    retryManifest,
    downloadManifest,
    ruleImprovementManifest,
    manualReviewManifest,
    appliedReviewOverrides,
  };
}

function parseDueSortKey(dueText) {
  const text = cleanText(dueText);
  if (!text) return "";
  const months = {
    jan: "01",
    feb: "02",
    mar: "03",
    apr: "04",
    may: "05",
    jun: "06",
    jul: "07",
    aug: "08",
    sep: "09",
    sept: "09",
    oct: "10",
    nov: "11",
    dec: "12",
  };
  const match = text.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(\d{1,2})(?:\s+(?:at|by)\s+(\d{1,2}):(\d{2})\s*(am|pm))?/i);
  if (!match) return "";
  const month = months[match[1].toLowerCase()];
  const day = match[2].padStart(2, "0");
  let hour = Number(match[3] || "23");
  const minute = match[4] || "59";
  const meridiem = (match[5] || "pm").toLowerCase();
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  return `2026-${month}-${day}T${String(hour).padStart(2, "0")}:${minute}`;
}

function markdownLink(label, url) {
  const text = cleanText(label || "Open");
  if (!url) return text;
  return `[${text.replace(/\]/g, "\\]")}](${url})`;
}

function taskSortValue(task) {
  return parseDueSortKey(task.due_text) || `9999-${task.course_code}-${task.title}`;
}

function buildReportOutputs({ normalizedGraph, classificationOutputs, crosscheckOutputs, recursiveOutputs }) {
  const taskByObject = new Map(classificationOutputs.tasks.map((row) => [row.object_id, row]));
  const moduleById = new Map(normalizedGraph.modules.map((row) => [row.module_id, row]));
  const reviewRowsByObject = new Map();
  const moduleCrosscheckByCourse = new Map();
  const reportDate = "2026-06-26";
  const nextActions = [];
  const dueDates = [];
  const upcomingDueDates = [];
  const pastDueOrCompleted = [];
  const requiredPrep = [];
  const criticalSetup = [];
  const courseMaps = [];

  for (const row of recursiveOutputs.reviewStateManifest) addMapList(reviewRowsByObject, row.object_id, row);
  for (const row of crosscheckOutputs.moduleCrosscheck) addMapList(moduleCrosscheckByCourse, row.course_code, row);

  const sortedTasks = [...classificationOutputs.tasks].sort((a, b) =>
    a.course_code.localeCompare(b.course_code) ||
    taskSortValue(a).localeCompare(taskSortValue(b)) ||
    a.title.localeCompare(b.title)
  );

  let nextActionRank = 0;
  for (const task of sortedTasks) {
    nextActionRank += 1;
    const dueSortKey = parseDueSortKey(task.due_text);
    const dueStatus = dueSortKey && dueSortKey.slice(0, 10) < reportDate ? "past_due_or_completed" : dueSortKey ? "upcoming" : "no_due_found";
    const reviewRows = reviewRowsByObject.get(task.object_id) || [];
    const reviewStates = uniqueJoined(reviewRows.map((row) => row.review_state));
    const nextAction = task.review_state === "needs_review"
      ? "Review blocked/uncertain evidence before relying on this task."
      : task.actionability === "prep_required"
        ? "Complete or review this prep item before the related graded work."
        : "Plan/complete this task according to its module and due information.";
    const row = {
      rank: nextActionRank,
      course_id: task.course_id,
      course_code: task.course_code,
      task_id: task.task_id,
      task_type: task.task_type,
      title: task.title,
      due_sort_key: dueSortKey,
      due_text: task.due_text,
      due_status: dueStatus,
      available_text: task.available_text,
      points_text: task.points_text,
      estimated_time: task.estimated_time,
      module_titles: task.module_titles,
      module_item_ids: task.module_item_ids,
      actionability: task.actionability,
      confidence: task.confidence,
      review_state: task.review_state,
      recursive_review_states: reviewStates,
      object_id: task.object_id,
      object_type: task.object_type,
      source_urls: task.source_urls,
      next_action: nextAction,
    };
    nextActions.push(row);
    if (dueSortKey) {
      dueDates.push(row);
      if (dueStatus === "upcoming") upcomingDueDates.push(row);
      else pastDueOrCompleted.push(row);
    }
    if (["prep_reading", "lecture_video"].includes(task.task_type)) requiredPrep.push(row);
    if (["critical_setup", "required_ungraded_task", "blocked_or_broken"].includes(task.task_type)) criticalSetup.push(row);
  }

  const dueSort = (a, b) =>
    a.due_sort_key.localeCompare(b.due_sort_key) ||
    a.course_code.localeCompare(b.course_code) ||
    a.title.localeCompare(b.title);
  dueDates.sort(dueSort);
  upcomingDueDates.sort(dueSort);
  pastDueOrCompleted.sort(dueSort);

  for (const course of normalizedGraph.courses) {
    const modules = normalizedGraph.modules.filter((row) => row.course_code === course.course_code);
    const tasks = classificationOutputs.tasks.filter((row) => row.course_code === course.course_code);
    const crossRows = moduleCrosscheckByCourse.get(course.course_code) || [];
    const surfaceOnly = crosscheckOutputs.gradeTaskCrosscheck.filter((row) =>
      row.course_code === course.course_code && row.crosscheck_status.endsWith("_task_not_in_modules")
    );
    const retryRows = recursiveOutputs.retryManifest.filter((row) => row.course_code === course.course_code);
    const downloadRows = recursiveOutputs.downloadManifest.filter((row) => row.course_code === course.course_code);
    const ruleRows = recursiveOutputs.ruleImprovementManifest.filter((row) => row.course_code === course.course_code);
    const manualRows = recursiveOutputs.manualReviewManifest.filter((row) => row.course_code === course.course_code);
    const lines = [
      `# ${course.course_code} Course Map`,
      "",
      `Generated ${reportDate} from the completed Canvas crawl archive.`,
      "",
      "## Summary",
      "",
      `- Modules: ${modules.length}`,
      `- Module items: ${crossRows.length}`,
      `- Tasks: ${tasks.length}`,
      `- Surface-only Assignments/Grades rows: ${surfaceOnly.length}`,
      `- Retry URLs queued: ${retryRows.length}`,
      `- Downloads queued for parsing: ${downloadRows.length}`,
      `- Rule-improvement buckets: ${ruleRows.length}`,
      `- Manual-review rows: ${manualRows.length}`,
      "",
      "## Modules",
      "",
    ];

    for (const module of modules) {
      lines.push(`### ${module.module_order}. ${module.module_title}`, "");
      const moduleRows = crossRows
        .filter((row) => row.module_id === module.module_id)
        .sort((a, b) => Number(a.item_order) - Number(b.item_order));
      for (const row of moduleRows) {
        const task = taskByObject.get(row.destination_object_id);
        const label = task
          ? task.task_type === "graded_task"
            ? "TASK"
            : task.task_type === "critical_setup"
              ? "SETUP"
              : task.task_type === "prep_reading" || task.task_type === "lecture_video"
                ? "PREP"
                : task.task_type === "blocked_or_broken"
                  ? "BLOCKED"
                  : "ACTION"
          : row.crosscheck_status.includes("reference")
            ? "REF"
            : row.crosscheck_status.includes("external")
              ? "EXTERNAL"
              : "CHECK";
        const due = task?.due_text ? ` due ${task.due_text}` : "";
        const points = task?.points_text ? ` (${task.points_text} pts)` : "";
        const review = row.has_review === "yes" ? ` review=${row.review_reasons}` : "";
        lines.push(`- **${label}** ${markdownLink(row.module_item_title, row.destination_url)}${due}${points} - ${row.crosscheck_status}${review}`);
      }
      lines.push("");
    }

    if (surfaceOnly.length) {
      lines.push("## Assignments/Grades Not In Modules", "");
      for (const row of surfaceOnly) {
        const due = row.due_text ? ` due ${row.due_text}` : row.surface_due_text ? ` due ${row.surface_due_text}` : "";
        const points = row.points_text ? ` (${row.points_text} pts)` : row.surface_points_text ? ` (${row.surface_points_text} pts)` : "";
        lines.push(`- **${row.surface_type.toUpperCase()}** ${markdownLink(row.object_title, row.target_url)}${due}${points} - ${row.crosscheck_status}`);
      }
      lines.push("");
    }

    if (retryRows.length || downloadRows.length || ruleRows.length || manualRows.length) {
      lines.push("## Review Queues", "");
      if (retryRows.length) {
        lines.push("### Retry", "");
        for (const row of retryRows.slice(0, 20)) {
          lines.push(`- ${markdownLink(row.reason, row.url)} - ${row.severity}`);
        }
        if (retryRows.length > 20) lines.push(`- ... ${retryRows.length - 20} more retry URLs`);
        lines.push("");
      }
      if (downloadRows.length) {
        lines.push("### Downloads To Parse", "");
        for (const row of downloadRows.slice(0, 20)) {
          lines.push(`- ${markdownLink(row.file_name || row.download_id, row.href)} - ${row.source_page_title}`);
        }
        if (downloadRows.length > 20) lines.push(`- ... ${downloadRows.length - 20} more downloads`);
        lines.push("");
      }
      if (ruleRows.length) {
        lines.push("### Rule Improvements", "");
        for (const row of ruleRows.slice(0, 20)) {
          lines.push(`- ${row.category} / ${row.status}: ${row.count} examples`);
        }
        lines.push("");
      }
    }

    courseMaps.push({
      course_code: course.course_code,
      file_name: `course_map_${course.course_code.toLowerCase()}.md`,
      markdown: lines.join("\n"),
    });
  }

  const blockedLines = [
    "# Blocked Review",
    "",
    `Generated ${reportDate}.`,
    "",
    "## Retry Manifest",
    "",
    ...recursiveOutputs.retryManifest.map((row) => `- **${row.course_code}** ${markdownLink(row.reason, row.url)} - ${row.severity}`),
    "",
    "## Rule Improvements",
    "",
    ...recursiveOutputs.ruleImprovementManifest.map((row) => `- **${row.course_code}** ${row.category} / ${row.status}: ${row.count} examples`),
    "",
    "## Manual Review Counts",
    "",
    ...[...countBy(recursiveOutputs.manualReviewManifest, (row) => `${row.course_code} ${row.status}`).entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, count]) => `- ${key}: ${count}`),
    "",
  ];

  const indexLines = [
    "# Canvas Course Maps",
    "",
    `Generated ${reportDate}.`,
    "",
    ...courseMaps.map((row) => `- ${markdownLink(row.course_code, row.file_name)}`),
    "- [Blocked Review](blocked_review.md)",
    "",
  ];

  return {
    nextActions,
    dueDates,
    upcomingDueDates,
    pastDueOrCompleted,
    requiredPrep,
    criticalSetup,
    courseMaps,
    blockedReviewMarkdown: blockedLines.join("\n"),
    courseMapsIndexMarkdown: indexLines.join("\n"),
  };
}

async function run({
  archiveRoot = DEFAULT_ARCHIVE,
  inputRoot = DEFAULT_INPUT,
  outputRoot = DEFAULT_OUTPUT,
} = {}) {
  await mkdir(outputRoot, { recursive: true });
  await mkdir(inputRoot, { recursive: true });
  const reportsRoot = path.join(outputRoot, "reports");
  await mkdir(reportsRoot, { recursive: true });

  const [summary, warnings, pageRows, linkRows, iframeRows, downloadRows, manifestRows, reviewOverrides, parsedDownloadRowsRaw] = await Promise.all([
    readJsonIfExists(path.join(archiveRoot, "summary.json"), {}),
    readJsonIfExists(path.join(archiveRoot, "warnings.json"), []),
    readCsv(path.join(archiveRoot, "pages.csv")),
    readCsv(path.join(archiveRoot, "links.csv")),
    readCsv(path.join(archiveRoot, "iframes.csv")),
    readCsv(path.join(archiveRoot, "downloads.csv")),
    readCsv(path.join(archiveRoot, "crawl_manifest.csv")),
    readCsvIfExists(path.join(inputRoot, "review_overrides.csv")),
    readCsvIfExists(path.join(outputRoot, "parsed_downloads.csv")),
  ]);

  const parsedDownloadRows = await hydrateParsedDownloadRows(outputRoot, parsedDownloadRowsRaw);
  const metadataByPage = await readPageMetadata(archiveRoot, pageRows);
  const pageInventory = buildPageInventory(pageRows, metadataByPage);
  const sourceTypeCounts = buildSourceTypeCounts(pageRows);
  const courseReadout = buildCourseReadout({ pageRows, linkRows, iframeRows, downloadRows, warnings });
  const captureIssues = buildCaptureIssues({ pageRows, warnings, metadataByPage });
  const normalizedGraph = buildNormalizedGraph({ pageRows, downloadRows, metadataByPage, courseReadout, parsedDownloadRows });
  const rawClassificationOutputs = buildClassificationOutputs({ normalizedGraph, metadataByPage, captureIssues });
  const { classificationOutputs, appliedReviewOverrides } = applyReviewOverrides({
    classificationOutputs: rawClassificationOutputs,
    reviewOverrides,
  });
  const crosscheckOutputs = buildCrosscheckOutputs({ normalizedGraph, classificationOutputs, captureIssues });
  const recursiveOutputs = buildRecursiveOutputs({
    normalizedGraph,
    crosscheckOutputs,
    reviewOverrides,
    appliedReviewOverrides,
  });
  const reportOutputs = buildReportOutputs({
    normalizedGraph,
    classificationOutputs,
    crosscheckOutputs,
    recursiveOutputs,
  });

  await writeFile(
    path.join(outputRoot, "course_readout.csv"),
    toCsv(courseReadout, [
      "course_id",
      "course_code",
      "title",
      "pages",
      "source_surface_pages",
      "module_item_pages",
      "linked_detail_pages",
      "assignment_detail_pages",
      "assignments",
      "quizzes",
      "discussions",
      "pages_content",
      "files",
      "module_items",
      "grade_surfaces",
      "links",
      "iframes",
      "downloads",
      "redirected_pages",
      "external_handler_pages",
      "warnings",
      "first_capture",
      "last_capture",
    ]),
    "utf8",
  );
  await writeFile(
    path.join(outputRoot, "page_inventory.csv"),
    toCsv(pageInventory, [
      "page_id",
      "course_id",
      "course_code",
      "source_kind",
      "source_surface",
      "canvas_object_type",
      "canvas_object_id",
      "title",
      "requested_url",
      "resolved_url",
      "redirected",
      "requires_external_handler",
      "depth",
      "markdown_path",
      "metadata_path",
      "visible_heading_count",
      "link_count",
      "iframe_count",
      "module_item_count",
      "assignment_row_count",
      "grade_row_count",
      "metadata_heading_count",
      "nav_count",
      "hidden_text_count",
      "heading_sample",
      "captured_at",
    ]),
    "utf8",
  );
  await writeFile(
    path.join(outputRoot, "source_type_counts.csv"),
    toCsv(sourceTypeCounts, ["course_code", "source_kind", "source_surface", "canvas_object_type", "count"]),
    "utf8",
  );
  await writeFile(
    path.join(outputRoot, "capture_issues.csv"),
    toCsv(captureIssues, [
      "issue_id",
      "severity",
      "issue_type",
      "course_id",
      "course_code",
      "page_id",
      "title",
      "requested_url",
      "resolved_url",
      "source_file",
      "detail",
    ]),
    "utf8",
  );
  await writeFile(
    path.join(outputRoot, "courses.csv"),
    toCsv(normalizedGraph.courses, [
      "course_id",
      "course_code",
      "title",
      "pages_captured",
      "modules",
      "module_items",
      "canvas_objects",
      "downloads",
      "warnings",
    ]),
    "utf8",
  );
  await writeFile(
    path.join(outputRoot, "modules.csv"),
    toCsv(normalizedGraph.modules, [
      "module_id",
      "course_id",
      "course_code",
      "module_order",
      "module_title",
      "source_page_id",
      "source_url",
      "module_item_count",
    ]),
    "utf8",
  );
  await writeFile(
    path.join(outputRoot, "module_items.csv"),
    toCsv(normalizedGraph.moduleItems, [
      "module_item_id",
      "canvas_module_item_id",
      "course_id",
      "course_code",
      "module_id",
      "module_order",
      "item_order",
      "title",
      "item_type",
      "destination_canvas_object_type",
      "destination_canvas_object_id",
      "destination_object_id",
      "destination_page_id",
      "href",
      "external_href",
      "indent",
      "requirements",
      "requirement_raw",
      "capture_status",
      "source_page_id",
      "source_url",
      "source_text_sample",
    ]),
    "utf8",
  );
  await writeFile(
    path.join(outputRoot, "canvas_objects.csv"),
    toCsv(normalizedGraph.objects, [
      "object_id",
      "course_id",
      "course_code",
      "object_type",
      "canvas_object_id",
      "title",
      "canonical_url",
      "first_page_id",
      "page_count",
      "evidence_count",
      "capture_status",
      "read_status",
      "notes",
    ]),
    "utf8",
  );
  await writeFile(
    path.join(outputRoot, "object_evidence.csv"),
    toCsv(normalizedGraph.evidence, [
      "evidence_id",
      "object_id",
      "evidence_type",
      "relation",
      "course_id",
      "course_code",
      "source_page_id",
      "source_url",
      "source_title",
      "module_id",
      "module_item_id",
      "download_id",
      "target_page_id",
      "target_url",
      "detail",
    ]),
    "utf8",
  );
  await writeFile(
    path.join(outputRoot, "object_pages.csv"),
    toCsv(normalizedGraph.objectPages, [
      "object_id",
      "page_id",
      "course_id",
      "course_code",
      "object_type",
      "canvas_object_id",
      "title",
      "requested_url",
      "resolved_url",
      "redirected",
      "source_kind",
      "source_surface",
      "markdown_path",
      "metadata_path",
    ]),
    "utf8",
  );
  await writeFile(
    path.join(outputRoot, "downloads_normalized.csv"),
    toCsv(normalizedGraph.downloads, [
      "download_id",
      "object_id",
      "course_id",
      "course_code",
      "source_page_id",
      "source_page_title",
      "source_page_url",
      "text",
      "file_name",
      "canvas_file_id",
      "href",
      "download_attr",
      "read_status",
      "evidence_status",
      "repo_file_path",
      "parsed_markdown_path",
    ]),
    "utf8",
  );
  await writeFile(
    path.join(outputRoot, "classified_items.csv"),
    toCsv(classificationOutputs.classifiedItems, [
      "object_id",
      "course_id",
      "course_code",
      "object_type",
      "title",
      "primary_category",
      "classification_labels",
      "importance",
      "actionability",
      "confidence",
      "due_text",
      "available_text",
      "points_text",
      "estimated_time",
      "module_ids",
      "module_titles",
      "module_item_ids",
      "issue_types",
      "evidence_count",
      "reason",
    ]),
    "utf8",
  );
  await writeFile(
    path.join(outputRoot, "tasks.csv"),
    toCsv(classificationOutputs.tasks, [
      "task_id",
      "course_id",
      "course_code",
      "task_type",
      "title",
      "importance",
      "actionability",
      "confidence",
      "due_text",
      "available_text",
      "points_text",
      "estimated_time",
      "object_id",
      "object_type",
      "module_ids",
      "module_titles",
      "module_item_ids",
      "source_page_ids",
      "source_urls",
      "labels",
      "review_state",
    ]),
    "utf8",
  );
  await writeFile(
    path.join(outputRoot, "task_evidence.csv"),
    toCsv(classificationOutputs.taskEvidence, [
      "task_id",
      "object_id",
      "evidence_id",
      "evidence_type",
      "relation",
      "source_page_id",
      "source_url",
      "target_page_id",
      "target_url",
      "detail",
    ]),
    "utf8",
  );
  await writeFile(
    path.join(outputRoot, "review_queue.csv"),
    toCsv(classificationOutputs.reviewQueue, [
      "review_id",
      "priority",
      "review_reason",
      "course_id",
      "course_code",
      "task_id",
      "object_id",
      "page_id",
      "title",
      "source_url",
      "suggested_action",
    ]),
    "utf8",
  );
  await writeFile(
    path.join(outputRoot, "classification_rules.csv"),
    toCsv(classificationOutputs.classificationRules, ["rule_id", "label", "description"]),
    "utf8",
  );
  await writeFile(
    path.join(outputRoot, "crosscheck_modules_assignments.csv"),
    toCsv(crosscheckOutputs.moduleCrosscheck, [
      "course_id",
      "course_code",
      "module_id",
      "module_order",
      "module_title",
      "module_item_id",
      "canvas_module_item_id",
      "item_order",
      "module_item_title",
      "item_type",
      "destination_object_id",
      "destination_object_type",
      "destination_canvas_object_id",
      "destination_page_id",
      "capture_status",
      "has_task",
      "task_id",
      "task_type",
      "task_review_state",
      "classification_category",
      "classification_labels",
      "confidence",
      "in_assignments_surface",
      "in_grades_surface",
      "has_download",
      "has_review",
      "review_reasons",
      "issue_types",
      "crosscheck_status",
      "notes",
      "source_page_id",
      "source_url",
      "destination_url",
    ]),
    "utf8",
  );
  await writeFile(
    path.join(outputRoot, "crosscheck_grades_tasks.csv"),
    toCsv(crosscheckOutputs.gradeTaskCrosscheck, [
      "course_id",
      "course_code",
      "surface_type",
      "evidence_id",
      "source_page_id",
      "source_url",
      "source_title",
      "object_id",
      "object_type",
      "object_title",
      "target_url",
      "in_modules",
      "module_ids",
      "module_titles",
      "module_item_ids",
      "has_task",
      "task_id",
      "task_type",
      "due_text",
      "available_text",
      "points_text",
      "surface_due_text",
      "surface_available_text",
      "surface_points_text",
      "classification_category",
      "confidence",
      "crosscheck_status",
      "detail",
    ]),
    "utf8",
  );
  await writeFile(
    path.join(outputRoot, "missing_or_suspicious.csv"),
    toCsv(crosscheckOutputs.missingOrSuspicious, [
      "suspicion_id",
      "course_id",
      "course_code",
      "severity",
      "category",
      "object_id",
      "task_id",
      "module_id",
      "module_item_id",
      "page_id",
      "title",
      "source_url",
      "related_url",
      "evidence_id",
      "review_id",
      "status",
      "detail",
      "suggested_action",
    ]),
    "utf8",
  );
  await writeFile(
    path.join(outputRoot, "crosscheck_summary.csv"),
    toCsv(crosscheckOutputs.summary, [
      "summary_id",
      "course_id",
      "course_code",
      "source_table",
      "category",
      "status",
      "count",
      "example_titles",
      "example_urls",
    ]),
    "utf8",
  );
  await writeFile(
    path.join(outputRoot, "review_state_manifest.csv"),
    toCsv(recursiveOutputs.reviewStateManifest, [
      "review_item_id",
      "suspicion_id",
      "course_id",
      "course_code",
      "review_state",
      "next_action_type",
      "severity",
      "category",
      "status",
      "object_id",
      "task_id",
      "module_id",
      "module_item_id",
      "page_id",
      "title",
      "source_url",
      "related_url",
      "evidence_id",
      "review_id",
      "override_id",
      "override_status",
      "suggested_action",
      "detail",
    ]),
    "utf8",
  );
  await writeFile(
    path.join(outputRoot, "retry_manifest.csv"),
    toCsv(recursiveOutputs.retryManifest, [
      "retry_id",
      "course_id",
      "course_code",
      "url",
      "reason",
      "severity",
      "source_review_item_ids",
      "source_categories",
      "source_statuses",
      "execute_status",
      "suggested_action",
    ]),
    "utf8",
  );
  await writeFile(
    path.join(outputRoot, "download_manifest.csv"),
    toCsv(recursiveOutputs.downloadManifest, [
      "download_manifest_id",
      "download_id",
      "course_id",
      "course_code",
      "object_id",
      "file_name",
      "canvas_file_id",
      "href",
      "source_page_id",
      "source_page_title",
      "source_page_url",
      "read_status",
      "execute_status",
      "repo_file_path",
      "parsed_markdown_path",
      "suggested_action",
    ]),
    "utf8",
  );
  await writeFile(
    path.join(outputRoot, "rule_improvement_manifest.csv"),
    toCsv(recursiveOutputs.ruleImprovementManifest, [
      "rule_review_id",
      "course_id",
      "course_code",
      "category",
      "status",
      "count",
      "example_titles",
      "example_urls",
      "proposed_rule_action",
    ]),
    "utf8",
  );
  await writeFile(
    path.join(outputRoot, "manual_review_manifest.csv"),
    toCsv(recursiveOutputs.manualReviewManifest, [
      "manual_review_id",
      "review_item_id",
      "suspicion_id",
      "course_id",
      "course_code",
      "review_state",
      "next_action_type",
      "severity",
      "category",
      "status",
      "object_id",
      "task_id",
      "module_id",
      "module_item_id",
      "page_id",
      "title",
      "source_url",
      "related_url",
      "evidence_id",
      "review_id",
      "override_id",
      "override_status",
      "suggested_action",
      "detail",
    ]),
    "utf8",
  );
  await writeFile(
    path.join(outputRoot, "applied_review_overrides.csv"),
    toCsv(recursiveOutputs.appliedReviewOverrides, [
      "override_id",
      "target_type",
      "target_id",
      "object_id",
      "task_id",
      "review_id",
      "applied",
      "applied_targets",
      "applied_fields",
      "override_review_state",
      "notes",
    ]),
    "utf8",
  );
  const actionColumns = [
    "rank",
    "course_id",
    "course_code",
    "task_id",
    "task_type",
    "title",
    "due_sort_key",
    "due_text",
    "due_status",
    "available_text",
    "points_text",
    "estimated_time",
    "module_titles",
    "module_item_ids",
    "actionability",
    "confidence",
    "review_state",
    "recursive_review_states",
    "object_id",
    "object_type",
    "source_urls",
    "next_action",
  ];
  await writeFile(path.join(outputRoot, "next_actions.csv"), toCsv(reportOutputs.nextActions, actionColumns), "utf8");
  await writeFile(path.join(outputRoot, "due_dates.csv"), toCsv(reportOutputs.dueDates, actionColumns), "utf8");
  await writeFile(path.join(outputRoot, "upcoming_due_dates.csv"), toCsv(reportOutputs.upcomingDueDates, actionColumns), "utf8");
  await writeFile(path.join(outputRoot, "past_due_or_completed.csv"), toCsv(reportOutputs.pastDueOrCompleted, actionColumns), "utf8");
  await writeFile(path.join(outputRoot, "required_prep.csv"), toCsv(reportOutputs.requiredPrep, actionColumns), "utf8");
  await writeFile(path.join(outputRoot, "critical_setup.csv"), toCsv(reportOutputs.criticalSetup, actionColumns), "utf8");
  await writeFile(path.join(reportsRoot, "course_maps_index.md"), reportOutputs.courseMapsIndexMarkdown, "utf8");
  await writeFile(path.join(reportsRoot, "blocked_review.md"), reportOutputs.blockedReviewMarkdown, "utf8");
  for (const courseMap of reportOutputs.courseMaps) {
    await writeFile(path.join(reportsRoot, courseMap.file_name), courseMap.markdown, "utf8");
  }
  await writeFile(
    path.join(outputRoot, "readout_summary.json"),
    JSON.stringify(
      {
        archiveRoot,
        outputRoot,
        archive_summary: summary,
        pages: pageRows.length,
        links: linkRows.length,
        iframes: iframeRows.length,
        downloads: downloadRows.length,
        manifest_rows: manifestRows.length,
        metadata_files_read: metadataByPage.size,
        inputRoot,
        review_overrides: reviewOverrides.length,
        courses: courseReadout,
        capture_issues: captureIssues.length,
        normalized: {
          courses: normalizedGraph.courses.length,
          modules: normalizedGraph.modules.length,
          module_items: normalizedGraph.moduleItems.length,
          canvas_objects: normalizedGraph.objects.length,
          object_pages: normalizedGraph.objectPages.length,
          object_evidence: normalizedGraph.evidence.length,
          downloads: normalizedGraph.downloads.length,
        },
        classified: {
          classified_items: classificationOutputs.classifiedItems.length,
          tasks: classificationOutputs.tasks.length,
          task_evidence: classificationOutputs.taskEvidence.length,
          review_queue: classificationOutputs.reviewQueue.length,
          classification_rules: classificationOutputs.classificationRules.length,
        },
        crosscheck: {
          module_crosscheck: crosscheckOutputs.moduleCrosscheck.length,
          grade_task_crosscheck: crosscheckOutputs.gradeTaskCrosscheck.length,
          missing_or_suspicious: crosscheckOutputs.missingOrSuspicious.length,
          summary: crosscheckOutputs.summary.length,
        },
        recursive: {
          review_state_manifest: recursiveOutputs.reviewStateManifest.length,
          retry_manifest: recursiveOutputs.retryManifest.length,
          download_manifest: recursiveOutputs.downloadManifest.length,
          rule_improvement_manifest: recursiveOutputs.ruleImprovementManifest.length,
          manual_review_manifest: recursiveOutputs.manualReviewManifest.length,
          applied_review_overrides: recursiveOutputs.appliedReviewOverrides.length,
        },
        reports: {
          next_actions: reportOutputs.nextActions.length,
          due_dates: reportOutputs.dueDates.length,
          upcoming_due_dates: reportOutputs.upcomingDueDates.length,
          past_due_or_completed: reportOutputs.pastDueOrCompleted.length,
          required_prep: reportOutputs.requiredPrep.length,
          critical_setup: reportOutputs.criticalSetup.length,
          course_maps: reportOutputs.courseMaps.length,
          reports_root: reportsRoot,
        },
        output_files: [
          "applied_review_overrides.csv",
          "critical_setup.csv",
          "course_readout.csv",
          "page_inventory.csv",
          "source_type_counts.csv",
          "capture_issues.csv",
          "courses.csv",
          "modules.csv",
          "module_items.csv",
          "canvas_objects.csv",
          "object_pages.csv",
          "object_evidence.csv",
          "downloads_normalized.csv",
          "classified_items.csv",
          "tasks.csv",
          "task_evidence.csv",
          "review_queue.csv",
          "classification_rules.csv",
          "crosscheck_modules_assignments.csv",
          "crosscheck_grades_tasks.csv",
          "missing_or_suspicious.csv",
          "crosscheck_summary.csv",
          "review_state_manifest.csv",
          "retry_manifest.csv",
          "download_manifest.csv",
          "rule_improvement_manifest.csv",
          "manual_review_manifest.csv",
          "next_actions.csv",
          "due_dates.csv",
          "upcoming_due_dates.csv",
          "past_due_or_completed.csv",
          "required_prep.csv",
          "reports/course_maps_index.md",
          "reports/blocked_review.md",
          ...reportOutputs.courseMaps.map((row) => `reports/${row.file_name}`),
          "readout_summary.json",
        ],
      },
      null,
      2,
    ),
    "utf8",
  );

  return {
    archiveRoot,
    inputRoot,
    outputRoot,
    pages: pageRows.length,
    courses: courseReadout.length,
    captureIssues: captureIssues.length,
    reviewOverrides: reviewOverrides.length,
    normalized: {
      modules: normalizedGraph.modules.length,
      moduleItems: normalizedGraph.moduleItems.length,
      objects: normalizedGraph.objects.length,
      objectPages: normalizedGraph.objectPages.length,
      evidence: normalizedGraph.evidence.length,
      downloads: normalizedGraph.downloads.length,
    },
    classified: {
      classifiedItems: classificationOutputs.classifiedItems.length,
      tasks: classificationOutputs.tasks.length,
      taskEvidence: classificationOutputs.taskEvidence.length,
      reviewQueue: classificationOutputs.reviewQueue.length,
    },
    crosscheck: {
      moduleCrosscheck: crosscheckOutputs.moduleCrosscheck.length,
      gradeTaskCrosscheck: crosscheckOutputs.gradeTaskCrosscheck.length,
      missingOrSuspicious: crosscheckOutputs.missingOrSuspicious.length,
      summary: crosscheckOutputs.summary.length,
    },
    recursive: {
      reviewStateManifest: recursiveOutputs.reviewStateManifest.length,
      retryManifest: recursiveOutputs.retryManifest.length,
      downloadManifest: recursiveOutputs.downloadManifest.length,
      ruleImprovementManifest: recursiveOutputs.ruleImprovementManifest.length,
      manualReviewManifest: recursiveOutputs.manualReviewManifest.length,
      appliedReviewOverrides: recursiveOutputs.appliedReviewOverrides.length,
    },
    reports: {
      nextActions: reportOutputs.nextActions.length,
      dueDates: reportOutputs.dueDates.length,
      upcomingDueDates: reportOutputs.upcomingDueDates.length,
      pastDueOrCompleted: reportOutputs.pastDueOrCompleted.length,
      requiredPrep: reportOutputs.requiredPrep.length,
      criticalSetup: reportOutputs.criticalSetup.length,
      courseMaps: reportOutputs.courseMaps.length,
      reportsRoot,
    },
    outputFiles: await readdir(outputRoot),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const archiveRoot = process.argv[2] || DEFAULT_ARCHIVE;
  const outputRoot = process.argv[3] || DEFAULT_OUTPUT;
  const inputRoot = process.argv[4] || DEFAULT_INPUT;
  const result = await run({ archiveRoot, inputRoot, outputRoot });
  console.log(JSON.stringify(result, null, 2));
}

export { run };
