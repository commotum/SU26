#!/usr/bin/env python3
"""Calculate minimum-slack prerequisite layers for a topic graph.

The hard constraint is:

    layer[topic] >= layer[requires] + 1

Among valid assignments, Graphviz/dot's network simplex ranker minimizes the
total direct prerequisite edge length. Since every edge has minimum length 1,
this is equivalent to minimizing total direct prerequisite slack.
"""

from __future__ import annotations

import argparse
import csv
import shutil
import subprocess
import sys
from collections import Counter, defaultdict, deque
from pathlib import Path
from statistics import median


TOPIC_ID_CANDIDATES = ("topic-id", "topic_id", "topic", "id")
TOPIC_COLUMN_CANDIDATES = ("topic", "topic-id", "topic_id", "id")
REQUIRES_COLUMN_CANDIDATES = ("requires", "required", "prerequisite", "prereq")


def id_sort_key(topic_id: str) -> tuple[int, int | str]:
    try:
        return (0, int(topic_id))
    except ValueError:
        return (1, topic_id)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Calculate min-slack prerequisite layers from topic IDs and "
            "topic,requires edges."
        )
    )
    topic_input = parser.add_mutually_exclusive_group(required=True)
    topic_input.add_argument(
        "--topics-csv",
        type=Path,
        help="CSV containing topic IDs. Extra columns are preserved in output.",
    )
    topic_input.add_argument(
        "--topic-ids",
        help="Comma/space/newline separated topic IDs, e.g. '1,2,3'.",
    )
    topic_input.add_argument(
        "--topic-ids-file",
        type=Path,
        help="File containing topic IDs, either one per line or in a CSV.",
    )

    edge_input = parser.add_mutually_exclusive_group(required=True)
    edge_input.add_argument(
        "--prerequisites-csv",
        type=Path,
        help="CSV containing prerequisite edges, normally columns topic,requires.",
    )
    edge_input.add_argument(
        "--edges",
        help=(
            "Inline edges as 'topic:requires,topic:requires' or "
            "'topic,requires;topic,requires'."
        ),
    )
    edge_input.add_argument(
        "--edges-file",
        type=Path,
        help=(
            "File containing edges. CSV with topic/requires columns is preferred; "
            "plain lines may use 'topic,requires' or 'topic:requires'."
        ),
    )

    parser.add_argument(
        "--topic-id-column",
        help="Topic ID column for --topics-csv or CSV --topic-ids-file.",
    )
    parser.add_argument(
        "--edge-topic-column",
        help="Dependent-topic column for prerequisite CSVs. Defaults to topic.",
    )
    parser.add_argument(
        "--edge-requires-column",
        help="Required-topic column for prerequisite CSVs. Defaults to requires.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Output CSV path. Defaults to stdout.",
    )
    parser.add_argument(
        "--layer-column",
        default="layer",
        help="Name of the output layer column. Default: layer.",
    )
    parser.add_argument(
        "--dot",
        default=None,
        help="Path to Graphviz dot. Defaults to the first dot on PATH.",
    )
    parser.add_argument(
        "--keep-duplicate-edges",
        action="store_true",
        help="Keep duplicate prerequisite rows as repeated objective weight.",
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Do not print summary diagnostics to stderr.",
    )
    return parser.parse_args()


def split_ids(text: str) -> list[str]:
    normalized = text.replace(",", " ").replace(";", " ")
    return [part.strip() for part in normalized.split() if part.strip()]


def choose_column(
    fieldnames: list[str] | None,
    explicit: str | None,
    candidates: tuple[str, ...],
    purpose: str,
) -> str:
    if not fieldnames:
        raise SystemExit(f"Cannot infer {purpose}: CSV has no header row.")
    if explicit:
        if explicit not in fieldnames:
            raise SystemExit(
                f"Column {explicit!r} was requested for {purpose}, but the CSV "
                f"columns are: {', '.join(fieldnames)}"
            )
        return explicit
    for candidate in candidates:
        if candidate in fieldnames:
            return candidate
    return fieldnames[0]


def read_topics(args: argparse.Namespace) -> tuple[list[dict[str, str]], list[str], str]:
    if args.topics_csv:
        with args.topics_csv.open(newline="") as f:
            reader = csv.DictReader(f)
            topic_id_column = choose_column(
                reader.fieldnames,
                args.topic_id_column,
                TOPIC_ID_CANDIDATES,
                "topic ID",
            )
            rows = list(reader)
        for index, row in enumerate(rows, start=2):
            if not row.get(topic_id_column):
                raise SystemExit(f"Missing topic ID in {args.topics_csv}:{index}")
        return rows, list(reader.fieldnames or []), topic_id_column

    if args.topic_ids is not None:
        topic_ids = split_ids(args.topic_ids)
        if not topic_ids:
            raise SystemExit("--topic-ids did not contain any IDs.")
        return [{"topic-id": topic_id} for topic_id in topic_ids], ["topic-id"], "topic-id"

    assert args.topic_ids_file is not None
    text = args.topic_ids_file.read_text()
    first_line = next((line for line in text.splitlines() if line.strip()), "")
    if "," in first_line:
        with args.topic_ids_file.open(newline="") as f:
            reader = csv.DictReader(f)
            topic_id_column = choose_column(
                reader.fieldnames,
                args.topic_id_column,
                TOPIC_ID_CANDIDATES,
                "topic ID",
            )
            rows = list(reader)
        return rows, list(reader.fieldnames or []), topic_id_column

    topic_ids = split_ids(text)
    if not topic_ids:
        raise SystemExit(f"{args.topic_ids_file} did not contain any topic IDs.")
    return [{"topic-id": topic_id} for topic_id in topic_ids], ["topic-id"], "topic-id"


def read_edge_csv(
    path: Path,
    topic_column: str | None,
    requires_column: str | None,
) -> list[tuple[str, str]]:
    with path.open(newline="") as f:
        reader = csv.DictReader(f)
        edge_topic_column = choose_column(
            reader.fieldnames,
            topic_column,
            TOPIC_COLUMN_CANDIDATES,
            "edge topic",
        )
        edge_requires_column = choose_column(
            reader.fieldnames,
            requires_column,
            REQUIRES_COLUMN_CANDIDATES,
            "edge requires",
        )
        edges = []
        for index, row in enumerate(reader, start=2):
            topic = (row.get(edge_topic_column) or "").strip()
            requires = (row.get(edge_requires_column) or "").strip()
            if not topic or not requires:
                raise SystemExit(f"Missing edge endpoint in {path}:{index}")
            edges.append((requires, topic))
        return edges


def parse_edge_text(text: str, source_name: str) -> list[tuple[str, str]]:
    edges: list[tuple[str, str]] = []
    chunks = []
    for line in text.splitlines():
        chunks.extend(part.strip() for part in line.split(";") if part.strip())
    if len(chunks) == 1 and ":" in chunks[0] and "," in chunks[0]:
        chunks = [part.strip() for part in chunks[0].split(",") if part.strip()]

    for index, chunk in enumerate(chunks, start=1):
        if ":" in chunk:
            topic, requires = [part.strip() for part in chunk.split(":", 1)]
        else:
            parts = [part.strip() for part in chunk.split(",")]
            if len(parts) != 2:
                raise SystemExit(
                    f"Could not parse edge {index} from {source_name!r}: {chunk!r}"
                )
            topic, requires = parts
        if not topic or not requires:
            raise SystemExit(f"Missing edge endpoint in {source_name!r}: {chunk!r}")
        edges.append((requires, topic))
    return edges


def read_edges(args: argparse.Namespace) -> list[tuple[str, str]]:
    if args.prerequisites_csv:
        return read_edge_csv(
            args.prerequisites_csv,
            args.edge_topic_column,
            args.edge_requires_column,
        )

    if args.edges is not None:
        return parse_edge_text(args.edges, "--edges")

    assert args.edges_file is not None
    text = args.edges_file.read_text()
    first_line = next((line for line in text.splitlines() if line.strip()), "")
    if "," in first_line and not first_line.replace(",", "").replace(" ", "").isdigit():
        return read_edge_csv(
            args.edges_file,
            args.edge_topic_column,
            args.edge_requires_column,
        )
    return parse_edge_text(text, str(args.edges_file))


def verify_acyclic(topic_ids: set[str], edges: list[tuple[str, str]]) -> list[str]:
    prereqs: dict[str, set[str]] = {topic_id: set() for topic_id in topic_ids}
    dependents: dict[str, set[str]] = {topic_id: set() for topic_id in topic_ids}
    for requires, topic in edges:
        prereqs[topic].add(requires)
        dependents[requires].add(topic)

    indegree = {topic_id: len(prereqs[topic_id]) for topic_id in topic_ids}
    queue = deque(
        sorted(
            (topic_id for topic_id in topic_ids if indegree[topic_id] == 0),
            key=id_sort_key,
        )
    )
    ordered: list[str] = []
    while queue:
        topic_id = queue.popleft()
        ordered.append(topic_id)
        for child in sorted(dependents[topic_id], key=id_sort_key):
            indegree[child] -= 1
            if indegree[child] == 0:
                queue.append(child)

    if len(ordered) != len(topic_ids):
        cyclic = sorted(
            (topic_id for topic_id, degree in indegree.items() if degree > 0),
            key=id_sort_key,
        )
        sample = ", ".join(cyclic[:20])
        raise SystemExit(
            "The internal prerequisite graph contains a cycle; strict layers are "
            f"not possible. Nodes still in cycles include: {sample}"
        )
    return ordered


def calculate_layers(
    topic_ids: set[str],
    edges: list[tuple[str, str]],
    dot_path: str | None,
) -> dict[str, int]:
    dot = dot_path or shutil.which("dot")
    if not dot:
        raise SystemExit(
            "Graphviz dot was not found. Install Graphviz or pass --dot /path/to/dot."
        )

    sorted_ids = sorted(topic_ids, key=id_sort_key)
    node_by_id = {topic_id: f"n{index}" for index, topic_id in enumerate(sorted_ids)}
    id_by_node = {node: topic_id for topic_id, node in node_by_id.items()}

    lines = [
        "digraph G {",
        "graph [rankdir=TB];",
        'node [shape=point,width=0.01,height=0.01,label=""];',
        "edge [weight=1];",
    ]
    for topic_id in sorted_ids:
        lines.append(f"{node_by_id[topic_id]};")
    for requires, topic in edges:
        lines.append(f"{node_by_id[requires]} -> {node_by_id[topic]};")
    lines.append("}")

    try:
        proc = subprocess.run(
            [dot, "-Tplain"],
            input="\n".join(lines).encode(),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=True,
            timeout=60,
        )
    except subprocess.CalledProcessError as exc:
        stderr = exc.stderr.decode(errors="replace")
        raise SystemExit(f"dot failed:\n{stderr}") from exc
    except subprocess.TimeoutExpired as exc:
        raise SystemExit("dot timed out while calculating layers.") from exc

    y_by_id: dict[str, float] = {}
    for line in proc.stdout.decode().splitlines():
        parts = line.split()
        if parts and parts[0] == "node":
            node = parts[1]
            y_by_id[id_by_node[node]] = float(parts[3])

    if set(y_by_id) != topic_ids:
        missing = sorted(topic_ids - set(y_by_id), key=id_sort_key)
        raise SystemExit(f"dot did not return ranks for these topic IDs: {missing[:20]}")

    rank_values = sorted(set(y_by_id.values()), reverse=True)
    y_to_layer = {value: index for index, value in enumerate(rank_values)}
    layers = {topic_id: y_to_layer[y] for topic_id, y in y_by_id.items()}

    bad_edges = [
        (requires, topic)
        for requires, topic in edges
        if layers[topic] <= layers[requires]
    ]
    if bad_edges:
        sample = ", ".join(f"{requires}->{topic}" for requires, topic in bad_edges[:20])
        raise SystemExit(f"Layer assignment violates prerequisite order: {sample}")

    return layers


def summarize(
    layers: dict[str, int],
    internal_edges: list[tuple[str, str]],
    total_topic_rows: int,
    unique_topic_ids: int,
    total_edge_rows: int,
    external_edges: int,
) -> str:
    gaps = [layers[topic] - layers[requires] for requires, topic in internal_edges]
    if not gaps:
        return (
            f"topic rows: {total_topic_rows}\n"
            f"unique topic IDs: {unique_topic_ids}\n"
            f"edge rows: {total_edge_rows}\n"
            f"internal edges: 0\n"
            f"external/ignored edges: {external_edges}\n"
            f"layers: {len(set(layers.values()))}\n"
        )
    slacks = [gap - 1 for gap in gaps]
    distribution = Counter(gaps)
    first_dist = ", ".join(
        f"{gap}:{count}" for gap, count in sorted(distribution.items())[:15]
    )
    return "\n".join(
        [
            f"topic rows: {total_topic_rows}",
            f"unique topic IDs: {unique_topic_ids}",
            f"edge rows: {total_edge_rows}",
            f"internal edges: {len(internal_edges)}",
            f"external/ignored edges: {external_edges}",
            f"layers: {len(set(layers.values()))}",
            f"layer range: {min(layers.values())}-{max(layers.values())}",
            f"total edge length: {sum(gaps)}",
            f"total slack: {sum(slacks)}",
            f"average edge length: {sum(gaps) / len(gaps):.4f}",
            f"average slack: {sum(slacks) / len(slacks):.4f}",
            f"median edge length: {median(gaps)}",
            f"max edge length: {max(gaps)}",
            f"adjacent edges: {sum(gap == 1 for gap in gaps)}",
            f"non-adjacent edges: {sum(gap > 1 for gap in gaps)}",
            f"edge-length distribution: {first_dist}",
        ]
    )


def write_output(
    args: argparse.Namespace,
    rows: list[dict[str, str]],
    input_fieldnames: list[str],
    topic_id_column: str,
    layers: dict[str, int],
) -> None:
    output_fieldnames = [args.layer_column] + [
        field for field in input_fieldnames if field != args.layer_column
    ]
    output_file = args.output.open("w", newline="") if args.output else sys.stdout
    close_output = args.output is not None
    try:
        writer = csv.DictWriter(output_file, fieldnames=output_fieldnames)
        writer.writeheader()
        for row in rows:
            topic_id = row[topic_id_column].strip()
            out = {args.layer_column: layers[topic_id]}
            for field in output_fieldnames:
                if field == args.layer_column:
                    continue
                out[field] = row.get(field, "")
            writer.writerow(out)
    finally:
        if close_output:
            output_file.close()


def main() -> None:
    args = parse_args()
    rows, input_fieldnames, topic_id_column = read_topics(args)
    topic_ids = [row[topic_id_column].strip() for row in rows]
    topic_id_set = set(topic_ids)
    raw_edges = read_edges(args)
    internal_edge_rows = [
        (requires, topic)
        for requires, topic in raw_edges
        if requires in topic_id_set and topic in topic_id_set
    ]
    if args.keep_duplicate_edges:
        internal_edges = internal_edge_rows
    else:
        internal_edges = sorted(
            set(internal_edge_rows),
            key=lambda edge: (id_sort_key(edge[0]), id_sort_key(edge[1])),
        )
    external_edges = len(raw_edges) - len(internal_edge_rows)

    verify_acyclic(topic_id_set, internal_edges)
    layers = calculate_layers(topic_id_set, internal_edges, args.dot)
    write_output(args, rows, input_fieldnames, topic_id_column, layers)

    if not args.quiet:
        print(
            summarize(
                layers,
                internal_edges,
                total_topic_rows=len(rows),
                unique_topic_ids=len(topic_id_set),
                total_edge_rows=len(raw_edges),
                external_edges=external_edges,
            ),
            file=sys.stderr,
        )


if __name__ == "__main__":
    main()
