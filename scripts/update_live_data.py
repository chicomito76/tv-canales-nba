#!/usr/bin/env python3
"""Update NBA schedule + best-effort Spanish broadcast data.

Designed for GitHub Actions. Uses only Python stdlib and fails gracefully:
- NBA official CDN: schedule + Prime Video hints
- ESPN Latin America Press Room: exact matchup + ESPN/Disney+ detection
- Movistar Plus TV guide: DAZN Baloncesto / M+ Deportes channel pages
- TNT Sports / CDN Deportes: conservative article/search matching

Existing confirmed channels are retained if a source is temporarily unavailable.
Local iPhone admin overrides are not stored here and always win in the app.
"""
from __future__ import annotations

import argparse
import html
import json
import re
import sys
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Iterable
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public" / "data"
DOCS = ROOT / "docs" / "data"
SCHEDULE_URL = "https://cdn.nba.com/static/json/staticData/scheduleLeagueV2_1.json"
ESPN_POSTS = "https://latinamerica.espnpressroom.com/wp-json/wp/v2/posts"
CHILE = ZoneInfo("America/Santiago")
MADRID = ZoneInfo("Europe/Madrid")
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 TV-Canales-NBA/2.2"
TIMEOUT = 12

TEAM_NAMES = {
    "ATL": "Atlanta Hawks", "BOS": "Boston Celtics", "BKN": "Brooklyn Nets",
    "CHA": "Charlotte Hornets", "CHI": "Chicago Bulls", "CLE": "Cleveland Cavaliers",
    "DAL": "Dallas Mavericks", "DEN": "Denver Nuggets", "DET": "Detroit Pistons",
    "GSW": "Golden State Warriors", "HOU": "Houston Rockets", "IND": "Indiana Pacers",
    "LAC": "LA Clippers", "LAL": "Los Angeles Lakers", "MEM": "Memphis Grizzlies",
    "MIA": "Miami Heat", "MIL": "Milwaukee Bucks", "MIN": "Minnesota Timberwolves",
    "NOP": "New Orleans Pelicans", "NYK": "New York Knicks", "OKC": "Oklahoma City Thunder",
    "ORL": "Orlando Magic", "PHI": "Philadelphia 76ers", "PHX": "Phoenix Suns",
    "POR": "Portland Trail Blazers", "SAC": "Sacramento Kings", "SAS": "San Antonio Spurs",
    "TOR": "Toronto Raptors", "UTA": "Utah Jazz", "WAS": "Washington Wizards",
}

TEAM_ALIASES = {
    "Atlanta Hawks": ["atlanta hawks", "hawks"],
    "Boston Celtics": ["boston celtics", "celtics"],
    "Brooklyn Nets": ["brooklyn nets", "nets"],
    "Charlotte Hornets": ["charlotte hornets", "hornets"],
    "Chicago Bulls": ["chicago bulls", "bulls"],
    "Cleveland Cavaliers": ["cleveland cavaliers", "cavaliers", "cavs"],
    "Dallas Mavericks": ["dallas mavericks", "mavericks", "mavs"],
    "Denver Nuggets": ["denver nuggets", "nuggets"],
    "Detroit Pistons": ["detroit pistons", "pistons"],
    "Golden State Warriors": ["golden state warriors", "warriors"],
    "Houston Rockets": ["houston rockets", "rockets"],
    "Indiana Pacers": ["indiana pacers", "pacers"],
    "LA Clippers": ["la clippers", "los angeles clippers", "clippers"],
    "Los Angeles Lakers": ["los angeles lakers", "la lakers", "lakers"],
    "Memphis Grizzlies": ["memphis grizzlies", "grizzlies"],
    "Miami Heat": ["miami heat", "heat"],
    "Milwaukee Bucks": ["milwaukee bucks", "bucks"],
    "Minnesota Timberwolves": ["minnesota timberwolves", "timberwolves", "wolves"],
    "New Orleans Pelicans": ["new orleans pelicans", "pelicans"],
    "New York Knicks": ["new york knicks", "knicks"],
    "Oklahoma City Thunder": ["oklahoma city thunder", "okc thunder", "thunder"],
    "Orlando Magic": ["orlando magic", "magic"],
    "Philadelphia 76ers": ["philadelphia 76ers", "76ers", "sixers"],
    "Phoenix Suns": ["phoenix suns", "suns"],
    "Portland Trail Blazers": ["portland trail blazers", "trail blazers", "blazers"],
    "Sacramento Kings": ["sacramento kings", "kings"],
    "San Antonio Spurs": ["san antonio spurs", "spurs"],
    "Toronto Raptors": ["toronto raptors", "raptors"],
    "Utah Jazz": ["utah jazz", "jazz"],
    "Washington Wizards": ["washington wizards", "wizards"],
}

MOVISTAR_CHANNELS = {
    "dazba": "DAZN Baloncesto",
    "dazb2": "DAZN Baloncesto 2",
    "dazb3": "DAZN Baloncesto 3",
    "cpdep": "Movistar Deportes",
    "arthur": "Movistar Deportes 2",
    "usop2": "Movistar Deportes 3",
}

CANONICAL = {
    "espn": "ESPN", "espn2": "ESPN 2", "espn 2": "ESPN 2",
    "espn3": "ESPN 3", "espn 3": "ESPN 3", "espn4": "ESPN 4", "espn 4": "ESPN 4",
    "espn5": "ESPN 5", "espn 5": "ESPN 5", "espn6": "ESPN 6", "espn 6": "ESPN 6",
    "espn7": "ESPN 7", "espn 7": "ESPN 7", "espn deportes": "ESPN Deportes",
    "disney+": "Disney+", "disney plus": "Disney+",
    "prime video": "Prime Video", "amazon prime video": "Prime Video", "amazon": "Prime Video",
    "tnt": "TNT Sports", "tnt sports": "TNT Sports", "tnt sports premium": "TNT Sports Premium",
    "hbo max": "HBO Max", "max": "HBO Max",
    "cdn deportes": "CDN Deportes",
    "movistar": "Movistar", "movistar plus": "Movistar", "movistar plus+": "Movistar",
    "m+ deportes": "Movistar Deportes", "movistar deportes": "Movistar Deportes",
    "m+ deportes 2": "Movistar Deportes 2", "movistar deportes 2": "Movistar Deportes 2",
    "m+ deportes 3": "Movistar Deportes 3", "movistar deportes 3": "Movistar Deportes 3",
    "dazn": "DAZN", "dazn baloncesto": "DAZN Baloncesto", "dazn baloncesto 1": "DAZN Baloncesto",
    "dazn baloncesto 2": "DAZN Baloncesto 2", "dazn baloncesto 3": "DAZN Baloncesto 3",
    "baloncesto de dazn": "DAZN Baloncesto", "baloncesto 2 de dazn": "DAZN Baloncesto 2",
    "baloncesto 3 de dazn": "DAZN Baloncesto 3",
    "nba tv alternativa espanol": "NBA TV alternativa español",
}


class TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        if data.strip():
            self.parts.append(data.strip())

    def text(self) -> str:
        return "\n".join(self.parts)


class LinkExtractor(HTMLParser):
    """Collect anchor URLs plus their visible text from an index page."""
    def __init__(self, base_url: str) -> None:
        super().__init__()
        self.base_url = base_url
        self.current_href: str | None = None
        self.current_parts: list[str] = []
        self.links: list[tuple[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() != "a":
            return
        href = dict(attrs).get("href")
        if href:
            self.current_href = urllib.parse.urljoin(self.base_url, href)
            self.current_parts = []

    def handle_data(self, data: str) -> None:
        if self.current_href and data.strip():
            self.current_parts.append(data.strip())

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "a" and self.current_href:
            self.links.append((self.current_href, " ".join(self.current_parts)))
            self.current_href = None
            self.current_parts = []


def strip_html(value: str) -> str:
    parser = TextExtractor()
    parser.feed(html.unescape(value or ""))
    return parser.text()


def normalize(value: str) -> str:
    value = unicodedata.normalize("NFKD", value)
    value = "".join(c for c in value if not unicodedata.combining(c))
    value = value.lower().replace("+", " plus ")
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def http_get(url: str, *, accept_json: bool = False) -> bytes:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": UA,
            "Accept": "application/json" if accept_json else "text/html,application/xhtml+xml",
            "Accept-Language": "es-ES,es;q=0.9,en;q=0.5",
        },
    )
    with urllib.request.urlopen(req, timeout=TIMEOUT) as response:
        return response.read()


def get_json(url: str) -> Any:
    return json.loads(http_get(url, accept_json=True).decode("utf-8"))


def get_text(url: str) -> str:
    raw = http_get(url).decode("utf-8", errors="replace")
    return strip_html(raw)


def get_html(url: str) -> str:
    return http_get(url).decode("utf-8", errors="replace")


def links_from_page(url: str) -> list[tuple[str, str]]:
    parser = LinkExtractor(url)
    parser.feed(get_html(url))
    return parser.links


def recent_article_texts(index_urls: Iterable[str], *, hosts: set[str], limit: int = 18) -> list[str]:
    """Fetch likely NBA article pages linked from current index/tag pages."""
    candidates: list[str] = []
    seen: set[str] = set()
    for index_url in index_urls:
        try:
            links = links_from_page(index_url)
        except Exception:
            continue
        for href, label in links:
            parsed = urllib.parse.urlparse(href)
            host = parsed.netloc.lower().removeprefix("www.")
            if host not in hosts:
                continue
            blob = normalize(label + " " + parsed.path)
            if "nba" not in blob:
                continue
            if href in seen:
                continue
            # Ignore index/tag/search pages; favor concrete HTML/article URLs.
            if parsed.path.rstrip("/") in {"", "/nba-t5608", "/polideportivo", "/deportes", "/basquet"}:
                continue
            seen.add(href)
            candidates.append(href)
            if len(candidates) >= limit:
                break
        if len(candidates) >= limit:
            break
    texts: list[str] = []
    for href in candidates[:limit]:
        parsed = urllib.parse.urlparse(href)
        host = parsed.netloc.lower().removeprefix("www.")
        variants = [href]
        if host == "latinamerica.espnpressroom.com" and not parsed.path.rstrip("/").endswith("/amp"):
            variants.append(href.rstrip("/") + "/amp/")
        for candidate in variants:
            try:
                texts.append(get_text(candidate))
                break
            except Exception:
                continue
    return texts


def iso_utc(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)


def game_id(game: dict[str, Any]) -> str | None:
    away = game.get("awayTeam", {}).get("teamTricode")
    home = game.get("homeTeam", {}).get("teamTricode")
    utc = game.get("gameDateTimeUTC")
    if not away or not home or not utc or away not in TEAM_NAMES or home not in TEAM_NAMES:
        return None
    try:
        dt = iso_utc(utc)
    except ValueError:
        return None
    # ID is based on the Chile calendar date, matching the app's existing IDs.
    day = dt.astimezone(CHILE).strftime("%Y%m%d")
    return f"{day}-{away}-{home}"


def official_schedule(payload: dict[str, Any]) -> tuple[dict[str, Any], dict[str, dict[str, Any]]]:
    dates = payload.get("leagueSchedule", {}).get("gameDates", [])
    games: list[dict[str, Any]] = []
    source_games: dict[str, dict[str, Any]] = {}
    for block in dates:
        for raw in block.get("games", []):
            gid = game_id(raw)
            if not gid:
                continue
            game_no = str(raw.get("gameId") or "")
            if game_no and not game_no.startswith("002"):
                continue
            away = raw["awayTeam"]["teamTricode"]
            home = raw["homeTeam"]["teamTricode"]
            utc = raw["gameDateTimeUTC"]
            try:
                dt = iso_utc(utc)
            except ValueError:
                continue
            if not (datetime(2026, 10, 20, tzinfo=timezone.utc) <= dt <= datetime(2027, 4, 13, tzinfo=timezone.utc)):
                continue
            games.append({
                "id": gid,
                "utc": utc,
                "away": TEAM_NAMES[away],
                "home": TEAM_NAMES[home],
                "awayCode": away,
                "homeCode": home,
            })
            source_games[gid] = raw
    games = list({g["id"]: g for g in games}.values())
    games.sort(key=lambda g: g["utc"])
    if len(games) < 100:
        raise RuntimeError(f"Calendario NBA incompleto ({len(games)} partidos)")
    return {"games": games}, source_games


def family(name: str) -> str:
    if name.startswith("ESPN"): return "espn"
    if name.startswith("Movistar") or name.startswith("DAZN"): return "movistar-dazn"
    if name.startswith("TNT") or name == "HBO Max": return "tnt-max"
    if name == "Prime Video": return "prime"
    if name == "CDN Deportes": return "cdn"
    return name.lower()


def canonical_name(name: str) -> str:
    clean = re.sub(r"\s+", " ", name.strip())
    return CANONICAL.get(normalize(clean), clean)


def precise_channels(channels: Iterable[str]) -> list[str]:
    out: list[str] = []
    for raw in channels:
        name = canonical_name(raw)
        if not name or name.lower() == "nba tv" or name in out:
            continue
        out.append(name)
    # Generic labels disappear when a more exact member is present.
    if any(re.fullmatch(r"ESPN (?:2|3|4|5|6|7|Deportes)", c) for c in out):
        out = [c for c in out if c != "ESPN"]
    if "TNT Sports Premium" in out:
        out = [c for c in out if c != "TNT Sports"]
    if any(re.fullmatch(r"Movistar Deportes [23]", c) for c in out):
        out = [c for c in out if c not in {"Movistar", "Movistar Deportes", "DAZN"}]
    elif "Movistar Deportes" in out:
        out = [c for c in out if c not in {"Movistar", "DAZN"}]
    elif any(c.startswith("DAZN Baloncesto") for c in out):
        out = [c for c in out if c in {"DAZN Baloncesto", "DAZN Baloncesto 2", "DAZN Baloncesto 3"} or not c.startswith(("Movistar", "DAZN"))]
    return out


def game_context(text: str, away: str, home: str, radius: int = 260) -> str | None:
    ntext = normalize(text)
    aliases_a = [normalize(x) for x in TEAM_ALIASES[away]]
    aliases_h = [normalize(x) for x in TEAM_ALIASES[home]]
    positions: list[tuple[int, int]] = []
    for a in aliases_a:
        pa = ntext.find(a)
        if pa < 0: continue
        for h in aliases_h:
            ph = ntext.find(h)
            if ph < 0: continue
            if abs(pa - ph) <= 180:
                positions.append((min(pa, ph), max(pa + len(a), ph + len(h))))
    if not positions:
        return None
    start, end = min(positions, key=lambda x: x[0])
    return ntext[max(0, start - radius): min(len(ntext), end + radius)]


def game_line_context(text: str, away: str, home: str) -> str | None:
    """Return the exact schedule/list line containing both teams when possible."""
    aliases_a = [normalize(x) for x in TEAM_ALIASES[away]]
    aliases_h = [normalize(x) for x in TEAM_ALIASES[home]]
    lines = [normalize(line) for line in text.splitlines() if normalize(line)]
    for line in lines:
        if any(a in line for a in aliases_a) and any(h in line for h in aliases_h):
            return line
    return None


def is_tnt_broadcast_article(text: str) -> bool:
    n = normalize(text[:1800])
    has_brand = "tnt sports" in n or "hbo max" in n
    listing_words = (
        "cartelera nba", "partidos que podras ver", "donde ver", "transmision en vivo",
        "por tnt sports", "por hbo max", "ver por tnt", "se juegan por hbo max",
    )
    return has_brand and any(word in n for word in listing_words)


def is_cdn_broadcast_article(text: str) -> bool:
    n = normalize(text[:2200])
    has_cdn = "cdn deportes" in n
    broadcast_words = (
        "cdn deportes transmitira", "transmision de la nba", "transmisiones de la nba",
        "regreso del mejor baloncesto", "television abierta", "la nba vuelve a cdn",
        "regreso de la nba", "triple cartelera",
    )
    return has_cdn and any(word in n for word in broadcast_words)


def channels_from_context(context: str) -> list[str]:
    found: list[str] = []
    rules = [
        (r"\bespn\s*7\b", "ESPN 7"), (r"\bespn\s*6\b", "ESPN 6"),
        (r"\bespn\s*5\b", "ESPN 5"), (r"\bespn\s*4\b", "ESPN 4"),
        (r"\bespn\s*3\b", "ESPN 3"), (r"\bespn\s*2\b", "ESPN 2"),
        (r"\bespn\s+deportes\b", "ESPN Deportes"), (r"\bespn\b", "ESPN"),
        (r"\bdisney\s*(?:plus)?\b", "Disney+"),
        (r"\btnt\s+sports\s+premium\b", "TNT Sports Premium"),
        (r"\btnt\s+sports\b|\btnt\b", "TNT Sports"),
        (r"\bhbo\s+max\b", "HBO Max"),
        (r"\bprime\s+video\b|\bamazon\s+prime\b", "Prime Video"),
        (r"\bcdn\s+deportes\b", "CDN Deportes"),
        (r"\bmovistar\s+deportes\s+3\b|\bm\s+deportes\s+3\b", "Movistar Deportes 3"),
        (r"\bmovistar\s+deportes\s+2\b|\bm\s+deportes\s+2\b", "Movistar Deportes 2"),
        (r"\bmovistar\s+deportes\b|\bm\s+deportes\b", "Movistar Deportes"),
        (r"\bdazn\s+baloncesto\s+3\b", "DAZN Baloncesto 3"),
        (r"\bdazn\s+baloncesto\s+2\b", "DAZN Baloncesto 2"),
        (r"\bdazn\s+baloncesto(?:\s+1)?\b", "DAZN Baloncesto"),
        (r"\bdazn\b", "DAZN"),
    ]
    for pattern, name in rules:
        if re.search(pattern, context): found.append(name)
    return precise_channels(found)


def broadcaster_hints(raw_game: dict[str, Any]) -> list[str]:
    b = raw_game.get("broadcasters") or {}
    values: list[dict[str, Any]] = []
    for key in ("nationalBroadcasters", "nationalOttBroadcasters", "internationalBroadcasters"):
        v = b.get(key)
        if isinstance(v, list): values.extend(x for x in v if isinstance(x, dict))
    found: list[str] = []
    for item in values:
        blob = normalize(" ".join(str(item.get(k, "")) for k in (
            "broadcasterDisplay", "broadcasterAbbreviation", "broadcasterDescription", "localizationRegion"
        )))
        # Prime's NBA package is distributed internationally and offers Spanish in supported markets.
        if "prime video" in blob or "amazon" in blob:
            found.append("Prime Video")
    return precise_channels(found)


def espn_sources() -> tuple[list[str], str]:
    """Return ESPN Press Room texts, preferring WP JSON and falling back to HTML/AMP."""
    api_error: Exception | None = None
    try:
        params = urllib.parse.urlencode({
            "search": "NBA",
            "per_page": 30,
            "orderby": "date",
            "order": "desc",
        })
        payload = get_json(f"{ESPN_POSTS}?{params}")
        texts: list[str] = []
        for post in payload if isinstance(payload, list) else []:
            content = post.get("content", {}).get("rendered", "")
            title = post.get("title", {}).get("rendered", "")
            value = strip_html(title + "\n" + content)
            if value.strip():
                texts.append(value)
        if texts:
            return texts, "API"
    except Exception as exc:
        api_error = exc

    # Some GitHub-hosted requests to wp-json intermittently receive HTTPError/403.
    # Fall back to ESPN Press Room's public HTML indexes and concrete article pages.
    index_urls = [
        "https://latinamerica.espnpressroom.com/?s=NBA",
        "https://latinamerica.espnpressroom.com/press-releases/",
        "https://latinamerica.espnpressroom.com/",
    ]
    texts = recent_article_texts(
        index_urls,
        hosts={"latinamerica.espnpressroom.com"},
        limit=30,
    )
    if texts:
        return texts, "HTML"

    # Last fallback: the search/index pages themselves can contain the full relevant excerpt.
    index_texts: list[str] = []
    for url in index_urls:
        for candidate in (url, url.rstrip("/") + "/amp/"):
            try:
                value = get_text(candidate)
            except Exception:
                continue
            if "nba" in normalize(value):
                index_texts.append(value)
                break
    if index_texts:
        return index_texts, "HTML/AMP"

    if api_error is not None:
        raise api_error
    raise RuntimeError("ESPN Press Room sin datos utilizables")


def apply_espn(games: list[dict[str, Any]], results: dict[str, list[str]], log: list[str]) -> None:
    try:
        texts, source = espn_sources()
    except Exception as exc:
        log.append(f"ESPN: fuente no disponible ({type(exc).__name__})")
        return
    hits = 0
    for g in games:
        for text in texts:
            context = game_context(text, g["away"], g["home"])
            if not context: continue
            channels = channels_from_context(context)
            espn = [c for c in channels if c.startswith("ESPN") or c == "Disney+"]
            if espn:
                results[g["id"]].extend(espn)
                hits += 1
                break
    log.append(f"ESPN: {hits} partidos identificados ({source})")


def apply_movistar(games: list[dict[str, Any]], results: dict[str, list[str]], log: list[str]) -> None:
    # A Chile-night game usually appears on the following date in Spain; use the UTC instant.
    by_date: dict[str, list[dict[str, Any]]] = {}
    for g in games:
        date = iso_utc(g["utc"]).astimezone(MADRID).date().isoformat()
        by_date.setdefault(date, []).append(g)
    hits = 0
    for day, day_games in by_date.items():
        for slug, label in MOVISTAR_CHANNELS.items():
            url = f"https://www.movistarplus.es/programacion-tv/{slug}/{day}"
            try:
                text = get_text(url)
            except Exception:
                continue
            for g in day_games:
                context = game_context(text, g["away"], g["home"], 180)
                if context:
                    results[g["id"]].append(label)
                    hits += 1
    log.append(f"Movistar/DAZN: {hits} coincidencias de canal")


def apply_tnt(games: list[dict[str, Any]], results: dict[str, list[str]], log: list[str]) -> None:
    # TNT Sports Chile publishes recurring "Cartelera NBA" articles with per-game channel details.
    index_urls = [
        "https://tntsports.cl/nba-t5608",
        "https://tntsports.cl/polideportivo/",
        "https://tntsports.com.ar/basquet/",
    ]
    texts: list[str] = []
    # Keep index text as a fallback, then crawl recent NBA article links.
    for url in index_urls:
        try:
            texts.append(get_text(url))
        except Exception:
            pass
    texts.extend(recent_article_texts(
        index_urls,
        hosts={"tntsports.cl", "tntsports.com.ar"},
        limit=20,
    ))
    texts = [t for t in texts if is_tnt_broadcast_article(t)]
    hits = 0
    for g in games:
        for text in texts:
            # Schedule articles list one game per bullet/line. Reading only that line avoids
            # leaking TNT Sports Premium from a neighboring HBO-Max-only game.
            context = game_line_context(text, g["away"], g["home"])
            if not context:
                context = game_context(text, g["away"], g["home"], 95)
            if not context:
                continue
            channels = channels_from_context(context)
            tnt = [x for x in channels if x.startswith("TNT") or x == "HBO Max"]
            if tnt:
                results[g["id"]].extend(tnt)
                hits += 1
                break
    log.append(f"TNT/HBO Max: {hits} partidos identificados ({len(texts)} fuentes de cartelera)")


def apply_cdn(games: list[dict[str, Any]], results: dict[str, list[str]], log: list[str]) -> None:
    # CDN Deportes often announces its NBA selections as articles rather than a fixed TV grid.
    index_urls = [
        "https://cdndeportes.com.do/",
        "https://cdndeportes.com.do/deportes/",
        "https://cdn.com.do/?s=NBA",
    ]
    texts: list[str] = []
    for url in index_urls:
        try:
            texts.append(get_text(url))
        except Exception:
            pass
    texts.extend(recent_article_texts(
        index_urls[:2],
        hosts={"cdndeportes.com.do"},
        limit=20,
    ))
    texts = [t for t in texts if is_cdn_broadcast_article(t)]
    if not texts:
        log.append("CDN: no se encontró una cartelera reciente verificable")
        return
    hits = 0
    for g in games:
        for text in texts:
            # Once the article explicitly identifies itself as a CDN NBA broadcast listing,
            # the presence of the exact matchup is sufficient to tag CDN Deportes.
            context = game_line_context(text, g["away"], g["home"])
            if not context:
                context = game_context(text, g["away"], g["home"], 120)
            if context:
                results[g["id"]].append("CDN Deportes")
                hits += 1
                break
    log.append(f"CDN: {hits} partidos identificados ({len(texts)} fuentes verificadas)")


def load_existing() -> dict[str, Any]:
    path = PUBLIC / "broadcasts.json"
    if not path.exists(): return {"lastUpdated": "1970-01-01T00:00:00Z", "games": {}}
    return json.loads(path.read_text(encoding="utf-8"))


def target_games(schedule: dict[str, Any], now: datetime) -> list[dict[str, Any]]:
    today = now.astimezone(CHILE).date()
    wanted = {today - timedelta(days=1), today, today + timedelta(days=1)}
    out = []
    for g in schedule["games"]:
        if iso_utc(g["utc"]).astimezone(CHILE).date() in wanted:
            out.append(g)
    return out


def merge_result(old: dict[str, Any] | None, fresh: list[str]) -> dict[str, Any]:
    fresh = precise_channels(fresh)
    if fresh:
        # If fresh has a family, replace stale members of that family; preserve other families.
        fresh_families = {family(c) for c in fresh}
        previous = [] if not old or old.get("status") != "confirmed" else list(old.get("channels") or [])
        kept = [c for c in previous if family(canonical_name(c)) not in fresh_families]
        return {"status": "confirmed", "channels": precise_channels(kept + fresh)}
    if old and old.get("status") == "confirmed" and old.get("channels"):
        return {"status": "confirmed", "channels": precise_channels(old["channels"])}
    if old and old.get("status") == "none":
        return {"status": "none", "channels": []}
    return {"status": "pending", "channels": []}


def atomic_write(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temp.replace(path)


def run(offline: bool = False) -> int:
    log: list[str] = []
    existing = load_existing()
    source_games: dict[str, dict[str, Any]] = {}
    if offline:
        schedule = json.loads((PUBLIC / "schedule.json").read_text(encoding="utf-8"))
        log.append("Modo offline: calendario local")
    else:
        try:
            schedule, source_games = official_schedule(get_json(SCHEDULE_URL))
            log.append(f"NBA: calendario oficial ({len(schedule['games'])} partidos)")
        except Exception as exc:
            schedule = json.loads((PUBLIC / "schedule.json").read_text(encoding="utf-8"))
            log.append(f"NBA: se conserva calendario local ({type(exc).__name__})")

    now = datetime.now(timezone.utc)
    near = target_games(schedule, now)
    results: dict[str, list[str]] = {g["id"]: [] for g in near}

    for g in near:
        raw = source_games.get(g["id"])
        if raw:
            results[g["id"]].extend(broadcaster_hints(raw))

    if not offline:
        apply_espn(near, results, log)
        apply_movistar(near, results, log)
        apply_tnt(near, results, log)
        apply_cdn(near, results, log)

    games_out = dict(existing.get("games") or {})
    for g in near:
        gid = g["id"]
        games_out[gid] = merge_result(games_out.get(gid), results[gid])

    # Keep only games still present in the official/local season schedule.
    valid_ids = {g["id"] for g in schedule["games"]}
    games_out = {gid: val for gid, val in games_out.items() if gid in valid_ids}
    payload = {
        "lastUpdated": now.replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "games": games_out,
        "automation": {
            "version": "2.2",
            "window": "ayer-hoy-mañana Chile",
            "notes": log,
        },
    }

    for directory in (PUBLIC, DOCS):
        atomic_write(directory / "schedule.json", schedule)
        atomic_write(directory / "broadcasts.json", payload)

    print("\n".join(log))
    for g in near:
        b = payload["games"].get(g["id"], {"status": "pending", "channels": []})
        print(f"{g['id']}: {b['status']} {' · '.join(b.get('channels', []))}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--offline", action="store_true", help="No network; validate merge using local files")
    args = parser.parse_args()
    try:
        return run(args.offline)
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
