#!/usr/bin/env python3
"""Conservative preflight for Apple Notes export. Does NOT generate or publish ICS."""
from pathlib import Path
from datetime import date
import re, json, sys

source = Path("concerts_source.txt")
if not source.is_file():
    sys.exit("Missing concerts_source.txt")
text = source.read_text(encoding="utf-8")
lines = text.splitlines()
if not text.startswith("Concerts to See in ATL:"):
    sys.exit("Unexpected note title; refusing to process")
if "Upcoming Events" not in text or "Past Events" not in text:
    sys.exit("Missing Upcoming Events / Past Events boundary")
upcoming = text.split("Upcoming Events", 1)[1].split("Past Events", 1)[0]
events = []
warnings = []
for number, line in enumerate(upcoming.splitlines(), 1):
    match = re.match(r"^\s*-\s*\[([ xX])\]\s*(.*)$", line)
    if not match:
        if line.strip():
            warnings.append(f"Upcoming line {number}: unstructured continuation: {line.strip()[:120]}")
        continue
    checked, raw = match.groups()
    date_match = re.match(r"(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?\b", raw)
    if not date_match:
        warnings.append(f"Upcoming line {number}: missing or unrecognized date: {raw[:120]}")
        continue
    month, day, year = date_match.groups()
    if not year:
        warnings.append(f"Upcoming line {number}: year omitted: {raw[:120]}")
    else:
        y = int(year)
        y = y + 2000 if y < 100 else y
        try:
            date(y, int(month), int(day))
        except ValueError:
            warnings.append(f"Upcoming line {number}: invalid date: {raw[:120]}")
    if not re.search(r"\s[-–]\s", raw):
        warnings.append(f"Upcoming line {number}: artist/venue separator unclear: {raw[:120]}")
    events.append({"line":number,"tickets_purchased":checked.lower()=="x","raw":raw})
report = {
    "source":"concerts_source.txt",
    "mode":"validation-only; no ICS publication",
    "upcoming_count":len(events),
    "checked_count":sum(e["tickets_purchased"] for e in events),
    "warnings":warnings,
    "events":events,
}
Path("notes_validation_report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(f"Parsed {len(events)} upcoming candidates; {len(warnings)} review warnings.")
for warning in warnings:
    print("REVIEW:", warning)
if not events:
    sys.exit("No upcoming entries recognized; refusing to process")
