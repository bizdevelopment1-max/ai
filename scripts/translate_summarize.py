#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
무료·오프라인 영어→한국어 번역 + 추출식(Extractive) 요약 — API 키 불필요.

목적: crawl-news.mjs 이후에도 한국어로 번역되지 않고 영어로 남은 기사 요약을
      로컬 무료 모델로 번역·요약해 채운다(할루시네이션 0 — 원문 번역·문장 추출만).

파이프라인(모두 CPU·오프라인, GitHub Actions Ubuntu 러너 4GB RAM 안):
  · 번역: Helsinki-NLP/opus-mt-en-ko (MarianMT, ~300MB) — EN→KO
  · 요약: 번역된 한국어 본문에서 핵심 문장 3~5개 추출
          (sumy LexRank 사용 가능 시 랭킹, 아니면 문장 슬라이스) → 개조식(명사형·마침표 제거)

결과가 news.json에 커밋되므로 사용자 브라우저 부하 0.
라이브러리/모델 다운로드 실패 시 graceful하게 건너뛴다(기존 동작 보존, exit 0).

대안(무거워서 기본 비활성): 신경망 요약 csebuetnlp/mT5_multilingual_XLSum(~2.3GB).
환경변수 USE_MT5=1 이면 번역본을 mT5로 추상 요약(러너 메모리 여유 시).
"""
import json, os, re, sys

NEWS = os.environ.get("NEWS_JSON", "news.json")
MAX_ITEMS = int(os.environ.get("TRANSLATE_MAX", "60"))     # 러너 시간 보호(1회 상한)


def is_korean(s):
    return bool(re.search(r"[가-힣]", s or ""))


def has_korean_summary(a):
    sm = a.get("summary", "")
    lines = [l.strip() for l in sm.split("\n") if l.strip()]
    return is_korean(a.get("title", "")) and is_korean(sm) and len(lines) >= 2


# 개조식 변환(JS nounize 포팅): 서술/존댓말 종결 → 명사형, 끝 마침표 제거
NOUN_END = [
    (r"하고 있습니다$", ""), (r"하고 있다$", ""), (r"되고 있습니다$", "됨"), (r"되고 있다$", "됨"),
    (r"합니다$", "함"), (r"입니다$", "임"), (r"됩니다$", "됨"), (r"있습니다$", "있음"), (r"없습니다$", "없음"),
    (r"([가-힣])습니다$", r"\1음"), (r"한다$", "함"), (r"된다$", "됨"), (r"이다$", "임"), (r"있다$", "있음"),
    (r"없다$", "없음"), (r"했다$", "했음"), (r"였다$", "였음"), (r"([가-힣])었다$", r"\1었음"), (r"([가-힣])았다$", r"\1았음"),
]


def nounize(line):
    l = re.sub(r"[.。]+\s*$", "", (line or "").strip())
    for pat, rep in NOUN_END:
        if re.search(pat, l):
            l = re.sub(pat, rep, l)
            break
    return re.sub(r"[.。]+\s*$", "", l).strip()


def ko_sentences(text):
    # 한국어/영어 혼용 문장 분리(마침표·물음표·느낌표·종결어미 뒤)
    parts = re.split(r"(?<=[.!?。])\s+", (text or "").strip())
    return [p.strip() for p in parts if len(p.strip()) > 1]


def main():
    try:
        data = json.load(open(NEWS, encoding="utf-8"))
    except Exception as e:
        print("[translate] news.json 없음 — skip:", e)
        return
    arts = data.get("articles", [])
    todo = [a for a in arts if not has_korean_summary(a) and (a.get("descEn") or a.get("titleEn") or a.get("title"))]
    if not todo:
        print("[translate] 한국어 번역이 필요한 영어 기사 없음")
        return
    todo = todo[:MAX_ITEMS]

    # 지연 임포트 — 미설치/다운로드 실패 시 기존 동작 보존
    try:
        import torch
        from transformers import MarianMTModel, MarianTokenizer
    except Exception as e:
        print("[translate] transformers/torch 없음 — skip:", e)
        return

    MODEL = "Helsinki-NLP/opus-mt-en-ko"
    try:
        tok = MarianTokenizer.from_pretrained(MODEL)
        model = MarianMTModel.from_pretrained(MODEL)
        model.eval()
    except Exception as e:
        print("[translate] opus-mt-en-ko 로드 실패 — skip:", e)
        return

    # 선택: sumy LexRank(추출 랭킹). 없으면 문장 슬라이스로 폴백
    summarizer = None
    try:
        from sumy.parsers.plaintext import PlaintextParser
        from sumy.nlp.tokenizers import Tokenizer
        from sumy.summarizers.lex_rank import LexRankSummarizer
        summarizer = (PlaintextParser, Tokenizer, LexRankSummarizer())
    except Exception:
        summarizer = None

    def translate(text, max_sents=6):
        text = (text or "").strip()
        if not text:
            return ""
        sents = re.split(r"(?<=[.!?])\s+", text)[:max_sents]
        out = []
        for s in sents:
            s = s.strip()
            if not s:
                continue
            batch = tok([s], return_tensors="pt", truncation=True, max_length=512, padding=True)
            with torch.no_grad():
                gen = model.generate(**batch, max_length=256, num_beams=2)
            out.append(tok.decode(gen[0], skip_special_tokens=True).strip())
        return " ".join([o for o in out if o])

    def extract(ko_text, n=3):
        sents = ko_sentences(ko_text)
        if len(sents) <= n:
            return sents
        if summarizer:
            try:
                Parser, Tokr, summ = summarizer
                parser = Parser.from_string(ko_text, Tokr("english"))
                picks = [str(s) for s in summ(parser.document, n)]
                if picks:
                    return picks
            except Exception:
                pass
        return sents[:n]

    use_mt5 = os.environ.get("USE_MT5") == "1"
    mt5 = None
    if use_mt5:
        try:
            from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
            mt = "csebuetnlp/mT5_multilingual_XLSum"
            mt5 = (AutoTokenizer.from_pretrained(mt), AutoModelForSeq2SeqLM.from_pretrained(mt))
        except Exception as e:
            print("[translate] mT5 로드 실패 — 추출식으로 진행:", e)
            mt5 = None

    done = 0
    for a in todo:
        src = a.get("descEn") or a.get("titleEn") or a.get("title") or ""
        ko_title = translate(a.get("titleEn") or a.get("title") or "", max_sents=1)
        ko_body = translate(src, max_sents=6)
        if not is_korean(ko_body):
            continue
        if mt5:
            try:
                mtok, mmodel = mt5
                inp = mtok([ko_body], return_tensors="pt", truncation=True, max_length=512)
                with torch.no_grad():
                    g = mmodel.generate(**inp, max_length=140, num_beams=4, no_repeat_ngram_size=2)
                abstract = mtok.decode(g[0], skip_special_tokens=True)
                picks = ko_sentences(abstract) or [abstract]
            except Exception:
                picks = extract(ko_body, 3)
        else:
            picks = extract(ko_body, 3)
        summary = "\n".join("· " + nounize(re.sub(r"^[·\-•]\s*", "", p)) for p in picks if p.strip())
        if not summary:
            continue
        if is_korean(ko_title):
            a["title"] = nounize(ko_title)
        a["summary"] = summary
        a["engine"] = "local-mt"          # 무료 로컬 번역(opus-mt) + 추출식 요약
        a["needsLLM"] = False
        done += 1

    data["articles"] = arts
    json.dump(data, open(NEWS, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    open(NEWS, "a", encoding="utf-8").write("\n")
    print(f"[translate] {done}건 로컬 번역·요약 완료 (Helsinki opus-mt-en-ko + {'mT5' if mt5 else 'LexRank/슬라이스'})")


if __name__ == "__main__":
    main()
