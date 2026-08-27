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
MARKET_PATH = ROOT / os.environ.get("MARKET_JSON", "market.json")
STARTUPS_PATH = ROOT / os.environ.get("STARTUPS_JSON", "startups.json")
MAX_ITEMS = int(os.environ.get("TRANSLATE_MAX", "500"))
# 무료 번역 엔드포인트 IP 레이트리밋 회피 — 요청 간 최소 간격(초). 배치(마커 청크)와
# 함께 동작해 호출 수를 줄이면서 순간 폭주를 막아 English 폴백을 최소화.
TRANSLATE_PACE_S = float(os.environ.get("TRANSLATE_PACE_S", "0.4"))
TRANSLATE_RETRIES = max(0, int(os.environ.get("TRANSLATE_RETRIES", "4")))
TRANSLATE_BACKOFF_BASE_S = max(0.1, float(os.environ.get("TRANSLATE_BACKOFF_BASE_S", "0.8")))
TRANSLATE_CHUNK_CHARS = max(800, int(os.environ.get("TRANSLATE_CHUNK_CHARS", "3600")))
TRANSLATE_MARKER_OVERHEAD = len("\n<<<AIFB000>>>\n")
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

# Korean display copy is intentionally terse: factual source fragments remain
# unchanged in sourceLines, while the presentation copy uses bullet-style
# endings without sentence-final full stops or the declarative -다 style.
BULLET_ENDINGS = (
    (re.compile(r"하지 않았습니다$"), "하지 않음"),
    (re.compile(r"되지 않았습니다$"), "되지 않음"),
    (re.compile(r"있지 않았습니다$"), "있지 않음"),
    (re.compile(r"있지 않습니다$"), "있지 않음"),
    (re.compile(r"찾지 못했습니다$"), "찾지 못함"),
    (re.compile(r"않습니다$"), "않음"),
    (re.compile(r"것으로 보입니다$"), "것으로 전망"),
    (re.compile(r"것으로 보인다$"), "것으로 전망"),
    (re.compile(r"아니었습니다$"), "아니었음"),
    (re.compile(r"아닙니다$"), "아님"),
    (re.compile(r"아니다$"), "아님"),
    (re.compile(r"하였습니다$"), "함"),
    (re.compile(r"했습니다$"), "함"),
    (re.compile(r"하였다$"), "함"),
    (re.compile(r"했다$"), "함"),
    (re.compile(r"되었습니다$"), "됨"),
    (re.compile(r"됐습니다$"), "됨"),
    (re.compile(r"되었다$"), "됨"),
    (re.compile(r"됐다$"), "됨"),
    (re.compile(r"됩니다$"), "됨"),
    (re.compile(r"있었습니다$"), "있었음"),
    (re.compile(r"있었다$"), "있었음"),
    (re.compile(r"있습니다$"), "있음"),
    (re.compile(r"없었습니다$"), "없었음"),
    (re.compile(r"없었다$"), "없었음"),
    (re.compile(r"없습니다$"), "없음"),
    (re.compile(r"이었습니다$"), "이었음"),
    (re.compile(r"였습니다$"), "였음"),
    (re.compile(r"이었다$"), "이었음"),
    (re.compile(r"였다$"), "였음"),
    (re.compile(r"입니다$"), "임"),
    (re.compile(r"합니다$"), "함"),
    (re.compile(r"보입니다$"), "보임"),
    (re.compile(r"보인다$"), "보임"),
    (re.compile(r"나타났습니다$"), "나타남"),
    (re.compile(r"나타났다$"), "나타남"),
    (re.compile(r"밝혔습니다$"), "밝힘"),
    (re.compile(r"밝혔다$"), "밝힘"),
    (re.compile(r"예상됩니다$"), "예상"),
    (re.compile(r"전망됩니다$"), "전망"),
    (re.compile(r"필요합니다$"), "필요"),
    (re.compile(r"중요합니다$"), "중요"),
    (re.compile(r"가능합니다$"), "가능"),
    (re.compile(r"습니다$"), "음"),
    (re.compile(r"않는다$"), "않음"),
    (re.compile(r"된다$"), "됨"),
    (re.compile(r"한다$"), "함"),
    (re.compile(r"이다$"), "임"),
    (re.compile(r"있다$"), "있음"),
    (re.compile(r"없다$"), "없음"),
    (re.compile(r"본다$"), "판단"),
    (re.compile(r"과제다$"), "과제"),
    (re.compile(r"전제다$"), "전제"),
    (re.compile(r"목표다$"), "목표"),
)


# BULLET_ENDINGS above only lists verbs seen so far; any other -ㅂ니다(formal)/
# -ㄴ다(plain present) verb still needs a correct noun-form ending. Blindly
# cutting the final -다 breaks the stem (e.g. "가져옵니다" -> "가져옵니"), so shift
# the stem's own batchim (ㅂ or ㄴ) to ㅁ instead, which is how Korean actually
# nominalizes these.
_HANGUL_BASE, _HANGUL_LAST, _JONG_COUNT = 0xAC00, 0xD7A3, 28
_JONG_NIEUN, _JONG_MIEUM, _JONG_BIEUP = 4, 16, 17


def _jongseong_of(ch: str) -> int:
    code = ord(ch)
    return (code - _HANGUL_BASE) % _JONG_COUNT if _HANGUL_BASE <= code <= _HANGUL_LAST else -1


def _with_jongseong(ch: str, jong: int) -> str:
    return chr(ord(ch) - _jongseong_of(ch) + jong)


def _nominalize_statement_ending(clause: str) -> str | None:
    if clause.endswith("니다") and len(clause) >= 3:
        stem = clause[:-2]
        last = stem[-1]
        return stem[:-1] + _with_jongseong(last, _JONG_MIEUM) if _jongseong_of(last) == _JONG_BIEUP else None
    if clause.endswith("다") and len(clause) >= 2:
        last = clause[-2]
        if _jongseong_of(last) == _JONG_NIEUN:
            return clause[:-2] + _with_jongseong(last, _JONG_MIEUM)
    return None


def clean(value: object) -> str:
    value = html.unescape(str(value or ""))
    value = re.sub(r"<[^>]+>", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def bulletize_korean(value: object) -> str:
    """Convert display-only Korean prose to compact bullet phrasing.

    This function never changes source fragments. It only removes sentence
    punctuation and converts a terminal Korean declarative ending into a
    non-sentence form such as 함, 됨, 임, or 음.
    """
    text = clean(value)
    text = re.sub(r"\b(\d{4})\.(\d{1,2})\.(\d{1,2})\b", r"\1-\2-\3", text)
    text = re.sub(r"\bU\.S\.", "US", text, flags=re.IGNORECASE)
    text = re.sub(r"\bU\.K\.", "UK", text, flags=re.IGNORECASE)
    text = re.sub(r"\bE\.U\.", "EU", text, flags=re.IGNORECASE)
    text = re.sub(r"([가-힣])([.!?。！？]+)([\"'”’]?)(?=\s|$|라고|이라며|라는)", r"\1\3 · ", text)
    text = re.sub(r"([가-힣])\s*[:：]\s+", r"\1 · ", text)
    # English fallback copy is presentation text too. Preserve decimal and
    # model-version dots, but turn sentence stops into consulting separators.
    text = re.sub(r"([^0-9])\.(?=\s+)", r"\1 · ", text)
    text = re.sub(r"([^0-9])\.(?=[\"'”’]?\s*$)", r"\1", text)
    text = text.replace("。", " · ")
    parts = []
    # A compact middle dot can be a decimal separator (for example 10·9%),
    # while a spaced middle dot is the presentation separator between points.
    for raw in re.split(r"\s+·\s+", text):
        part = raw.strip(" \t\n·")
        if not part:
            continue
        closing_match = re.search(r"([\"'”’]+)$", part)
        closing = closing_match.group(1) if closing_match else ""
        if closing:
            part = part[:-len(closing)].rstrip()
        part = re.sub(r"[。.!?！？]+$", "", part).strip()
        for pattern, replacement in BULLET_ENDINGS:
            if pattern.search(part):
                part = pattern.sub(replacement, part)
                break
        if part.endswith("다"):
            part = (_nominalize_statement_ending(part) or re.sub(r"다$", "", part)).strip()
        parts.append(f"{part}{closing}")
    return " · ".join(parts)


def bullet_style_valid(value: str) -> bool:
    text = str(value or "")
    if re.search(r"[가-힣](?:다|습니다|ㅂ니다)[.!?。！？]*[\"'”’]*\s*(?:·|$)", text):
        return False
    return not re.search(r"[가-힣][.!?。！？]+[\"'”’]?(?=\s|$|라고|이라며|라는)", text)


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
    # Short broken fragments such as "6월에는 미국" must not pass, but a
    # faithful Korean translation can be materially shorter than verbose
    # English source copy.  This keeps Korean display available without
    # accepting truncated output.
    if len(text) < max(12, int(len(clean(source)) * 0.12)) or len(text) > max(700, len(source) * 5 + 80):
        return False
    if BAD_OUTPUT.search(text) or "�" in text or "http://" in text or "https://" in text:
        return False
    if not bullet_style_valid(text):
        return False
    # Do not reject a valid model/version token such as "GPT-5.x보다".
    # This still blocks a stray standalone Latin fragment glued to Hangul.
    if re.search(r"(?<![A-Za-z0-9._-])[a-z](?=\s*[가-힣])", text):
        return False
    letters = re.findall(r"[A-Za-z가-힣]", text)
    return bool(letters) and len(HANGUL.findall(text)) >= 2 and len(HANGUL.findall(text)) / len(letters) >= 0.12


class SourceTranslator:
    """Batched public-source translation with cache and bounded retry."""

    def __init__(self) -> None:
        self.cache: dict[tuple[str, str], str] = {}
        self.calls = 0
        self.failures = 0
        self.skipped = 0
        self.unavailable = False
        self.last_error = ""
        self._last = 0.0   # 마지막 요청 시각(모노토닉) — 요청 간 페이싱용

    def _throttle(self) -> None:
        gap = time.monotonic() - self._last
        if gap < TRANSLATE_PACE_S:
            time.sleep(TRANSLATE_PACE_S - gap)
        self._last = time.monotonic()

    def _request(self, text: str, source_language: str) -> str:
        if self.unavailable:
            self.skipped += 1
            raise RuntimeError(self.last_error or "translation-endpoint-unavailable")
        query = urlencode({"client": "gtx", "sl": source_language, "tl": "ko", "dt": "t", "q": text})
        request = Request(f"{TRANSLATE_URL}?{query}", headers={"User-Agent": "Mozilla/5.0 (compatible; AI-Feed-Localizer/1.0)", "Accept": "application/json"})
        last_error: Exception | None = None
        # Initial request + four retries. The final 6.4-second backoff is now
        # followed by a real fifth attempt instead of sleeping and giving up.
        for attempt in range(TRANSLATE_RETRIES + 1):
            try:
                self._throttle()   # 요청 간 최소 간격 보장(레이트리밋 회피)
                with urlopen(request, timeout=20) as response:
                    payload = json.loads(response.read().decode("utf-8"))
                self.calls += 1
                return "".join(str(part[0] or "") for part in (payload[0] or []))
            except Exception as exc:  # network errors deliberately become English fallback
                last_error = exc
                if attempt < TRANSLATE_RETRIES:
                    time.sleep(TRANSLATE_BACKOFF_BASE_S * (2 ** attempt))
        self.failures += 1
        self.unavailable = True
        self.last_error = f"translation-request-failed:{type(last_error).__name__}"
        raise RuntimeError(self.last_error)

    def translate_many(self, pairs: list[tuple[str, str]]) -> dict[tuple[str, str], str]:
        pending = [(clean(text), LANG_CODES.get((language or "").casefold(), "auto")) for text, language in pairs if clean(text)]
        pending = list(dict.fromkeys(pair for pair in pending if pair not in self.cache))
        if self.unavailable:
            self.skipped += len(pending)
            return self.cache
        by_language: dict[str, list[str]] = {}
        for text, language in pending:
            by_language.setdefault(language, []).append(text)
        for language, texts in by_language.items():
            if self.unavailable:
                self.skipped += len(texts)
                break
            chunk: list[str] = []
            for text in texts:
                candidate_chars = (
                    sum(len(value) for value in chunk)
                    + len(text)
                    + TRANSLATE_MARKER_OVERHEAD * len(chunk)
                )
                if chunk and candidate_chars > TRANSLATE_CHUNK_CHARS:
                    try:
                        self._translate_chunk(chunk, language)
                    except RuntimeError:
                        # Translation is presentation-only. Once the endpoint
                        # is unavailable, open a circuit for this run and let
                        # every missing row use the source-language fallback.
                        # A transient third-party outage must never block the
                        # daily source collection, verification or publishing.
                        self.skipped += len(texts)
                        return self.cache
                    chunk = []
                chunk.append(text)
            if chunk:
                try:
                    self._translate_chunk(chunk, language)
                except RuntimeError:
                    self.skipped += len(texts)
                    return self.cache
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
    if previous.get("version") == 14 and previous.get("sourceHash") == digest and previous.get("status") == "accepted":
        if item.get("house"):
            item["displayEligible"] = item.get("sourceContent", {}).get("status") == "content-extracted"
        return previous
    return {
        "version": 14,
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
            if item.get("house"):
                cached_lines = loc.get("summaryLines") or []
                item["displayEligible"] = (
                    loc.get("status") == "accepted"
                    and loc.get("displayLanguage") == "ko"
                    and len(cached_lines) == 3
                    and all(has_korean(str(line or "")) for line in cached_lines)
                    and item.get("sourceContent", {}).get("status") == "content-extracted"
                )
            continue
        work.append((item, clean(title), clean(excerpt), language, loc))
        if source_language_code(language) != "ko" and not has_korean(title):
            queries.append((title, language))
            queries.extend((line, language) for line in loc["sourceLines"])

    translations = translator.translate_many(queries) if queries else {}
    accepted = fallback = 0
    for item, title, excerpt, language, loc in work:
        lines = loc["sourceLines"]
        roles = list(item.get("summaryRoles") or [])[:len(lines)]
        code = source_language_code(language)
        try:
            if code == "ko" or has_korean(title):
                ko_title = title
                ko_lines = lines
            else:
                ko_title = translations[(title, code)]
                ko_lines = [translations[(line, code)] for line in lines]
            ko_title = bulletize_korean(ko_title)
            ko_lines = [bulletize_korean(line) for line in ko_lines]
            if not ko_lines:
                raise ValueError("no-distinct-source-lines")
            if len({clean(line).casefold() for line in ko_lines}) != len(ko_lines):
                raise ValueError("duplicate-translated-lines")
            if valid_korean(ko_title, title) and all(valid_korean(line, source) for line, source in zip(ko_lines, lines)):
                item["localization"] = {**loc, "status": "accepted", "displayLanguage": "ko", "title": ko_title, "summaryLines": ko_lines, "summaryRoles": roles, "provider": "public-source-translation", "issues": []}
                item["titleKo"] = ko_title
                item["summaryLinesKo"] = ko_lines
                if item.get("house"):
                    # Translation success alone is not enough: a refreshed
                    # source page must still be available for the displayed
                    # three bullets to remain auditable.
                    item["displayEligible"] = (
                        len(ko_lines) == 3
                        and all(has_korean(str(line or "")) for line in ko_lines)
                        and item.get("sourceContent", {}).get("status") == "content-extracted"
                    )
                accepted += 1
            else:
                raise ValueError("korean-quality-gate-failed")
        except Exception as exc:
            # An English fallback remains source-verbatim in meaning, while its
            # presentation follows the same compact bullet rule as Korean:
            # no sentence-final dots and no prose-style line endings.
            # This avoids a transient translation failure breaking the whole
            # scheduled pipeline or making one card visually inconsistent.
            fallback_title = bulletize_korean(title)
            fallback_lines = [bulletize_korean(line) for line in lines]
            item["localization"] = {**loc, "status": "fallback-english", "displayLanguage": "en", "title": fallback_title, "summaryLines": fallback_lines, "summaryRoles": roles, "provider": "public-source-translation", "issues": [str(exc)[:120]]}
            # Do not put an English fallback into the research briefing. The
            # original record and its source text remain in the expanding DB,
            # and the next scheduled run retries the source-bound translation.
            if item.get("house"):
                item["displayEligible"] = False
            fallback += 1
    return len(work), accepted, fallback


def read_json(path: Path, fallback: dict) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"[localize] {path} read failed: {exc}")
        return fallback


def write_json(path: Path, value: dict) -> None:
    # verify-pipeline keeps research.json compact, so preserve that stable
    # layout instead of creating a formatting-only churn on every translation.
    if path in {NEWS_PATH, RESEARCH_PATH, MARKET_PATH, STARTUPS_PATH}:
        path.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    else:
        path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    news = read_json(NEWS_PATH, {"articles": []})
    research = read_json(RESEARCH_PATH, {"feed": []})
    market = read_json(MARKET_PATH, {"records": []})
    startups = read_json(STARTUPS_PATH, {"large": [], "small": []})
    translator = SourceTranslator()
    def source_lines(item: dict) -> str:
        lines = item.get("summaryLinesEn") or []
        if isinstance(lines, list) and lines:
            return "\n".join(clean(line) for line in lines if clean(line))
        return item.get("descEn") or item.get("desc") or item.get("summary") or ""

    news_rows = [(item, item.get("titleEn") or item.get("title") or "", source_lines(item), "English") for item in (news.get("articles") or [])[:MAX_ITEMS]]
    research_rows = [(item, item.get("titleEn") or item.get("title") or "", source_lines(item), item.get("sourceLanguage") or "English") for item in (research.get("feed") or [])[:MAX_ITEMS]]
    # Translation is presentation-only.  RSS discovery rows are deliberately
    # omitted: only extracted publisher-page sentences may be localized and
    # later shown in the quantitative market database.
    market_rows = [
        (item, item.get("titleEn") or item.get("title") or "", source_lines(item), item.get("sourceLanguage") or "English")
        for item in (market.get("records") or [])
        if item.get("displayEligible") is True
        and item.get("provenance", {}).get("status") == "source-backed"
        and item.get("sourceContent", {}).get("status") == "content-extracted"
    ][:MAX_ITEMS]
    # Startup analysis preserves each source link as an append-only history.
    # Translate only the stored headline (and extracted source fragments when
    # available) so the UI can show a Korean, source-bound one-line brief
    # without inventing a company or deal interpretation.
    startup_rows = []
    seen_startup_sources = set()
    for startup in [*(startups.get("large") or []), *(startups.get("small") or [])]:
        fallback_language = (startup.get("latest") or {}).get("sourceLanguage") or "auto"
        for entry in [startup.get("latest"), *((startup.get("history") or []))]:
            if not isinstance(entry, dict):
                continue
            key = str(entry.get("url") or entry.get("title") or "").strip()
            title = entry.get("title") or ""
            if not key or not clean(title) or key in seen_startup_sources:
                continue
            seen_startup_sources.add(key)
            excerpt = "\n".join(clean(line) for line in (entry.get("sourceLinesEn") or []) if clean(line)) or title
            language = entry.get("sourceLanguage") or fallback_language
            startup_rows.append((entry, title, excerpt, language))
            if len(startup_rows) >= MAX_ITEMS:
                break
        if len(startup_rows) >= MAX_ITEMS:
            break
    changed_news, accepted_news, fallback_news = localize_records(news_rows, translator)
    changed_research, accepted_research, fallback_research = localize_records(research_rows, translator)
    changed_market, accepted_market, fallback_market = localize_records(market_rows, translator)
    changed_startups, accepted_startups, fallback_startups = localize_records(startup_rows, translator)
    write_json(NEWS_PATH, news)
    write_json(RESEARCH_PATH, research)
    write_json(MARKET_PATH, market)
    write_json(STARTUPS_PATH, startups)
    health = "degraded-source-language-fallback" if translator.unavailable else "healthy"
    print(f"[localize] changed {changed_news + changed_research + changed_market + changed_startups}; Korean {accepted_news + accepted_research + accepted_market + accepted_startups}; English fallback {fallback_news + fallback_research + fallback_market + fallback_startups}; translation requests {translator.calls}; health {health}; skipped {translator.skipped}")


if __name__ == "__main__":
    main()
