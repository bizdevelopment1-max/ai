#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Build source-traceable Korean display text for the live feeds.

This is a localisation job, never a fact-generation or summarisation job. It
does not change the source-evidence fields used by the verification pipeline.
Each displayed line is translated from a stored publisher-page sentence and the
original fragments plus a source hash remain in the published record.

The service request contains only public headline/snippet text. If the
translation endpoint is unavailable or its output fails the Korean quality
gate, the browser displays the original language instead. This makes a partial
network failure safe and prevents malformed Korean from being published.
"""

from __future__ import annotations

import hashlib
import html
import json
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen


ROOT = Path(os.environ.get("LOCALIZE_ROOT", "."))
NEWS_PATH = ROOT / os.environ.get("NEWS_JSON", "news.json")
RESEARCH_PATH = ROOT / os.environ.get("RESEARCH_JSON", "research.json")
MAX_ITEMS = int(os.environ.get("TRANSLATE_MAX", "500"))
TRANSLATE_URL = "https://translate.googleapis.com/translate_a/single"
LANG_CODES = {
    "english": "en", "en": "en", "japanese": "ja", "french": "fr",
    "spanish": "es", "portuguese": "pt", "german": "de", "italian": "it",
    "korean": "ko",
}
BAD_OUTPUT = re.compile(r"<unk>|</?s>|\b(?:nan|none|undefined)\b", re.I)
HANGUL = re.compile(r"[가-힣]")
KOREAN_CHAR = re.compile(r"[가-힣ㄱ-ㅎㅏ-ㅣ]")
SENTENCE_SPLIT = re.compile(r"(?<=[.!?。！？])\s+|\s*[;；]\s+|\s+—\s+|\s+–\s+")
CLAUSE_SPLIT = re.compile(r"\s*,\s+|\s*:\s+")


def clean(value: object) -> str:
    value = html.unescape(str(value or ""))
    value = re.sub(r"<[^>]+>", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def has_korean(value: str) -> bool:
    return bool(KOREAN_CHAR.search(value or ""))


def source_hash(title: str, excerpt: str) -> str:
    return hashlib.sha256(f"{title}\n{excerpt}".encode("utf-8")).hexdigest()


def canonical_fragments(title: str, excerpt: str, source: str, date: str) -> list[str]:
    """Keep one to three distinct source sentences; never add filler lines."""
    raw_lines = [clean(part) for part in str(excerpt or "").splitlines() if clean(part)]
    title, excerpt = clean(title), clean(excerpt)
    pieces: list[str] = []
    if raw_lines:
        pieces.extend(raw_lines)
    elif excerpt:
        raw = [part.strip() for part in SENTENCE_SPLIT.split(excerpt) if len(part.strip()) >= 12]
        if len(raw) == 1:
            clauses = [part.strip() for part in CLAUSE_SPLIT.split(raw[0]) if len(part.strip()) >= 18]
            if len(clauses) > 1:
                raw = clauses
        pieces.extend(raw)

    unique: list[str] = []
    for piece in pieces:
        key = re.sub(r"\W+", "", piece).casefold()
        if key and not any(re.sub(r"\W+", "", old).casefold() == key for old in unique):
            unique.append(piece[:500])
        if len(unique) >= 3:
            break
    return unique[:3]


def valid_korean(text: str, source: str) -> bool:
    text = clean(text)
    if len(text) < max(6, int(len(clean(source)) * 0.20)) or len(text) > max(700, len(source) * 5 + 80):
        return False
    if BAD_OUTPUT.search(text) or "�" in text or "http://" in text or "https://" in text:
        return False
    if re.search(r"(?<![A-Za-z])[a-z](?=\s*[가-힣])", text):
        return False
    letters = re.findall(r"[A-Za-z가-힣]", text)
    return bool(letters) and len(HANGUL.findall(text)) >= 2 and len(HANGUL.findall(text)) / len(letters) >= 0.12


class SourceTranslator:
    """Batched public-source translation with cache and bounded retry."""

    def __init__(self) -> None:
        self.cache: dict[tuple[str, str], str] = {}
        self.calls = 0

    def _request(self, text: str, source_language: str) -> str:
        query = urlencode({"client": "gtx", "sl": source_language, "tl": "ko", "dt": "t", "q": text})
        request = Request(f"{TRANSLATE_URL}?{query}", headers={"User-Agent": "Mozilla/5.0 (compatible; AI-Feed-Localizer/1.0)", "Accept": "application/json"})
        last_error: Exception | None = None
        for attempt in range(3):
            try:
                with urlopen(request, timeout=20) as response:
                    payload = json.loads(response.read().decode("utf-8"))
                self.calls += 1
                return "".join(str(part[0] or "") for part in (payload[0] or []))
            except Exception as exc:  # network errors deliberately become English fallback
                last_error = exc
                time.sleep(0.5 * (attempt + 1))
        raise RuntimeError(f"translation-request-failed:{type(last_error).__name__}")

    def translate_many(self, pairs: list[tuple[str, str]]) -> dict[tuple[str, str], str]:
        pending = [(clean(text), LANG_CODES.get((language or "").casefold(), "auto")) for text, language in pairs if clean(text)]
        pending = list(dict.fromkeys(pair for pair in pending if pair not in self.cache))
        by_language: dict[str, list[str]] = {}
        for text, language in pending:
            by_language.setdefault(language, []).append(text)
        for language, texts in by_language.items():
            chunk: list[str] = []
            for text in texts:
                if chunk and sum(len(value) for value in chunk) + len(text) + 40 > 3600:
                    self._translate_chunk(chunk, language)
                    chunk = []
                chunk.append(text)
            if chunk:
                self._translate_chunk(chunk, language)
        return self.cache

    def _translate_chunk(self, texts: list[str], language: str) -> None:
        markers = [f"<<<AIFB{index:03d}>>>" for index in range(len(texts) - 1)]
        joined = texts[0]
        for marker, text in zip(markers, texts[1:]):
            joined += f"\n{marker}\n{text}"
        translated = self._request(joined, language)
        parts = re.split(r"\s*<<<AIFB\d{3}>>>\s*", translated)
        if len(parts) != len(texts):
            # Do not guess segment boundaries. Smaller requests retain a safe
            # fallback path and make endpoint quirks local to one fragment.
            for text in texts:
                self.cache[(text, language)] = self._request(text, language)
            return
        for text, result in zip(texts, parts):
            self.cache[(text, language)] = clean(result)


def new_localization(item: dict, title: str, excerpt: str, language: str) -> dict:
    raw_excerpt = str(excerpt or "")
    title, excerpt = clean(title), clean(raw_excerpt)
    digest = source_hash(title, excerpt)
    previous = item.get("localization") or {}
    # A successful translation is cached until its source changes. A fallback
    # is deliberately retried on the next scheduled run so a transient
    # translation outage does not become permanent English display.
    if previous.get("version") == 5 and previous.get("sourceHash") == digest and previous.get("status") == "accepted":
        return previous
    return {
        "version": 5,
        "sourceHash": digest,
        "sourceLines": canonical_fragments(title, raw_excerpt, item.get("source", ""), item.get("date", "")),
        "checkedAt": datetime.now(timezone.utc).isoformat(),
        "method": "source-fragment-translation",
        "sourceLanguage": language or "English",
    }


def source_language_code(language: str) -> str:
    return LANG_CODES.get((language or "").strip().casefold(), "auto")


def localize_records(records: list[tuple[dict, str, str, str]], translator: SourceTranslator) -> tuple[int, int, int]:
    work: list[tuple[dict, str, str, str, dict]] = []
    queries: list[tuple[str, str]] = []
    for item, title, excerpt, language in records:
        loc = new_localization(item, title, excerpt, language)
        item["localization"] = loc
        if loc.get("status") in {"accepted", "fallback-english"}:
            continue
        work.append((item, clean(title), clean(excerpt), language, loc))
        if source_language_code(language) != "ko" and not has_korean(title):
            queries.append((title, language))
            queries.extend((line, language) for line in loc["sourceLines"])

    translations = translator.translate_many(queries) if queries else {}
    accepted = fallback = 0
    for item, title, excerpt, language, loc in work:
        lines = loc["sourceLines"]
        code = source_language_code(language)
        try:
            if code == "ko" or has_korean(title):
                ko_title = title
                ko_lines = lines
            else:
                ko_title = translations[(title, code)]
                ko_lines = [translations[(line, code)] for line in lines]
            if not ko_lines:
                raise ValueError("no-distinct-source-lines")
            if len({clean(line).casefold() for line in ko_lines}) != len(ko_lines):
                raise ValueError("duplicate-translated-lines")
            if valid_korean(ko_title, title) and all(valid_korean(line, source) for line, source in zip(ko_lines, lines)):
                item["localization"] = {**loc, "status": "accepted", "displayLanguage": "ko", "title": ko_title, "summaryLines": ko_lines, "provider": "public-source-translation", "issues": []}
                item["titleKo"] = ko_title
                item["summaryLinesKo"] = ko_lines
                accepted += 1
            else:
                raise ValueError("korean-quality-gate-failed")
        except Exception as exc:
            item["localization"] = {**loc, "status": "fallback-english", "displayLanguage": "en", "title": title, "summaryLines": lines, "provider": "public-source-translation", "issues": [str(exc)[:120]]}
            fallback += 1
    return len(work), accepted, fallback


def read_json(path: Path, fallback: dict) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"[localize] {path} read failed: {exc}")
        return fallback


def write_json(path: Path, value: dict) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    news = read_json(NEWS_PATH, {"articles": []})
    research = read_json(RESEARCH_PATH, {"feed": []})
    translator = SourceTranslator()
    def source_lines(item: dict) -> str:
        lines = item.get("summaryLinesEn") or []
        if isinstance(lines, list) and lines:
            return "\n".join(clean(line) for line in lines if clean(line))
        return item.get("descEn") or item.get("desc") or item.get("summary") or ""

    news_rows = [(item, item.get("titleEn") or item.get("title") or "", source_lines(item), "English") for item in (news.get("articles") or [])[:MAX_ITEMS]]
    research_rows = [(item, item.get("titleEn") or item.get("title") or "", source_lines(item), item.get("sourceLanguage") or "English") for item in (research.get("feed") or [])[:MAX_ITEMS]]
    changed_news, accepted_news, fallback_news = localize_records(news_rows, translator)
    changed_research, accepted_research, fallback_research = localize_records(research_rows, translator)
    write_json(NEWS_PATH, news)
    write_json(RESEARCH_PATH, research)
    print(f"[localize] changed {changed_news + changed_research}; Korean {accepted_news + accepted_research}; English fallback {fallback_news + fallback_research}; translation requests {translator.calls}")


if __name__ == "__main__":
    main()
