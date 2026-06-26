import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_ARCHIVE =
  "/Users/jake/Developer/SU26/canvas/archive/full-fixed-2026-06-26T21-00-04-500Z";
const DEFAULT_OUTPUT = "/Users/jake/Developer/SU26/canvas/indexer/output";

const COURSES = {
  "2080857": { course_code: "MTH-252", title: "Integral Calculus" },
  "2053263": { course_code: "MTH-253", title: "Sequences and Series" },
  "2053526": { course_code: "PHY-212", title: "Oscillations, Waves, Optics, and Rotation" },
};

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

async function readJsonIfExists(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
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
  return existing;
}

function buildNormalizedGraph({ pageRows, downloadRows, metadataByPage, courseReadout }) {
  const destinationIndexes = buildDestinationIndexes(pageRows);
  const pageById = new Map(pageRows.map((row) => [row.page_id, row]));
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
    addObject(objectsById, {
      object_id: objectId,
      course_id,
      course_code,
      object_type: "download",
      canvas_object_id: extractCanvasFileId(row.href),
      title: fileName || row.text,
      canonical_url: row.href,
      first_page_id: row.page_id,
      capture_status: "indexed_download_link",
      read_status: "indexed_not_read",
      notes: "Download URL captured but file binary has not been downloaded or parsed.",
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
      canvas_file_id: extractCanvasFileId(row.href),
      href: row.href,
      download_attr: row.download_attr,
      read_status: "indexed_not_read",
      evidence_status: "link_only",
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
      detail: "Download URL indexed; binary not downloaded.",
    });
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

async function run({
  archiveRoot = DEFAULT_ARCHIVE,
  outputRoot = DEFAULT_OUTPUT,
} = {}) {
  await mkdir(outputRoot, { recursive: true });

  const [summary, warnings, pageRows, linkRows, iframeRows, downloadRows, manifestRows] = await Promise.all([
    readJsonIfExists(path.join(archiveRoot, "summary.json"), {}),
    readJsonIfExists(path.join(archiveRoot, "warnings.json"), []),
    readCsv(path.join(archiveRoot, "pages.csv")),
    readCsv(path.join(archiveRoot, "links.csv")),
    readCsv(path.join(archiveRoot, "iframes.csv")),
    readCsv(path.join(archiveRoot, "downloads.csv")),
    readCsv(path.join(archiveRoot, "crawl_manifest.csv")),
  ]);

  const metadataByPage = await readPageMetadata(archiveRoot, pageRows);
  const pageInventory = buildPageInventory(pageRows, metadataByPage);
  const sourceTypeCounts = buildSourceTypeCounts(pageRows);
  const courseReadout = buildCourseReadout({ pageRows, linkRows, iframeRows, downloadRows, warnings });
  const captureIssues = buildCaptureIssues({ pageRows, warnings, metadataByPage });
  const normalizedGraph = buildNormalizedGraph({ pageRows, downloadRows, metadataByPage, courseReadout });

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
    ]),
    "utf8",
  );
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
        output_files: [
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
    outputRoot,
    pages: pageRows.length,
    courses: courseReadout.length,
    captureIssues: captureIssues.length,
    normalized: {
      modules: normalizedGraph.modules.length,
      moduleItems: normalizedGraph.moduleItems.length,
      objects: normalizedGraph.objects.length,
      objectPages: normalizedGraph.objectPages.length,
      evidence: normalizedGraph.evidence.length,
      downloads: normalizedGraph.downloads.length,
    },
    outputFiles: await readdir(outputRoot),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const archiveRoot = process.argv[2] || DEFAULT_ARCHIVE;
  const outputRoot = process.argv[3] || DEFAULT_OUTPUT;
  const result = await run({ archiveRoot, outputRoot });
  console.log(JSON.stringify(result, null, 2));
}

export { run };
