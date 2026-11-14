"""Reference implementation of the 0.08 scoring rules (dev plan, section 6) and generator of test vectors.

The TypeScript implementation in src/scoring must reproduce the `expected` block of every fixture in
scoring-fixtures.json (tolerance 1e-6 on numbers, exact match on strings and booleans).
The constants are fixed for the event. They come from a design simulation with an assumed reaction-time
distribution, not from validation on real participants.
Usage: python3 reference_scoring.py            -> writes scoring-fixtures.json and prints a summary table
"""
import json
import math
import random

LAPSE_MS, MIN_VALID_MS, TIMEOUT_MS = 355, 100, 5000
S_SPEED_REL = {90: 0.070, 180: 0.066}      # session-to-session SD of speed, relative to own daytime speed
S_LAPSE = {90: 0.065, 180: 0.055}          # session-to-session SD of lapse share (absolute)
E_FIRST, G_NONE, E_OVERTIME, F_SIGNS = 3.0, 1.0, 3.2, 2.0
MAX_BASELINE_LAPSE_FOR_LAPSE_RULE = 0.25
FT_PER_S_AT_65MPH = 95.33
VALID = ("ok", "lapse", "timeout")


def classify(rt_ms):
    if rt_ms < MIN_VALID_MS:
        return "false_start"
    return "lapse" if rt_ms >= LAPSE_MS else "ok"


def metrics(trials, upto_ms):
    """Valid stimuli: kind ok / lapse / timeout with onset before upto_ms. A timeout counts as rt 5000."""
    v = [t for t in trials if t["kind"] in VALID and t["onsetMs"] is not None and t["onsetMs"] < upto_ms]
    n = len(v)
    rts = [t["rtMs"] for t in v]
    made = [t["rtMs"] for t in v if t["kind"] != "timeout"]      # responses that were actually made
    speed = sum(1000.0 / r for r in rts) / n
    return {
        "n": n,
        "speed": speed,                                           # mean of 1000 / rt
        "lapseShare": sum(1 for r in rts if r >= LAPSE_MS) / n,
        "typicalRtMs": 1000.0 / speed,                            # shown to the user; one missed stimulus barely moves it
        "fastestMs": min(made) if made else None,
        "slowestMs": max(made) if made else None,
    }


def baseline_of(sessions, upto_ms):
    ms = [metrics(s, upto_ms) for s in sessions]
    k = len(ms)
    base = {key: sum(m[key] for m in ms) / k for key in ("speed", "lapseShare")}
    base["typicalRtMs"] = 1000.0 / base["speed"]
    return base, k


def zscores(now, base, k, t_now, t_base):
    den_s = base["speed"] * math.sqrt(S_SPEED_REL[t_now] ** 2 + S_SPEED_REL[t_base] ** 2 / k)
    den_l = math.sqrt(S_LAPSE[t_now] ** 2 + S_LAPSE[t_base] ** 2 / k)
    z_s = (base["speed"] - now["speed"]) / den_s
    z_l = (now["lapseShare"] - base["lapseShare"]) / den_l
    lapse_rule = base["lapseShare"] <= MAX_BASELINE_LAPSE_FOR_LAPSE_RULE
    return z_s, z_l, (max(z_s, z_l) if lapse_rule else z_s), lapse_rule


def score(baselines, night, team, overtime_accepted):
    """baselines: list of trial lists; night: trial list (90 s, or 180 s when overtime was taken or team mode)."""
    out = {}
    if team:
        base, k = baseline_of(baselines, 180000)
        now = metrics(night, 180000)
        z_s, z_l, z, rule = zscores(now, base, k, 180, 180)
        verdict = "clear" if z >= E_FIRST else "signs" if z >= F_SIGNS else "none"
        out.update(zS180=z_s, zL180=z_l, z180=z, z90=None, overtimeOffered=False, finalLengthS=180)
    else:
        base, k = baseline_of(baselines, 90000)
        now90 = metrics(night, 90000)
        z_s, z_l, z90, rule = zscores(now90, base, k, 90, 90)
        out.update(zS90=z_s, zL90=z_l, z90=z90)
        now = now90
        if z90 >= E_FIRST:
            verdict, offered, final = "clear", False, 90
        elif z90 < G_NONE:
            verdict, offered, final = "none", False, 90
        else:
            offered = True
            if overtime_accepted:
                now = metrics(night, 180000)
                z_s2, z_l2, z180, _ = zscores(now, base, k, 180, 90)
                out.update(zS180=z_s2, zL180=z_l2, z180=z180)
                verdict = "clear" if z180 >= E_OVERTIME else "signs" if z180 >= F_SIGNS else "none"
                final = 180
            else:
                verdict = "signs" if z90 >= F_SIGNS else "none"
                final = 90
        out.update(overtimeOffered=offered, finalLengthS=final)
    delta_rt = 1000.0 / now["speed"] - 1000.0 / base["speed"]      # typical reaction time now minus daytime
    out.update(
        k=k, lapseRuleUsed=rule, verdict=verdict,
        baseline=base, now=now,
        speedDeltaPct=100.0 * (base["speed"] - now["speed"]) / base["speed"],
        lapseDeltaPts=100.0 * (now["lapseShare"] - base["lapseShare"]),
        rtDeltaMs=delta_rt,
        distanceFt=max(0.0, delta_rt) / 1000.0 * FT_PER_S_AT_65MPH,
    )
    out["z"] = out.get("z180") if out.get("z180") is not None and out["finalLengthS"] == 180 else out.get("z90")
    return out


# ---------- test-vector generation (not part of the product) ----------
def gen_session(rng, length_s, mu=230.0, sigma=22.0, tau=45.0, p_early=0.04, p_invalid=0.03, p_timeout=0.0):
    t, i, trials = 0.0, 0, []
    while True:
        isi = rng.uniform(1000, 4000)
        due = t + isi
        if due >= length_s * 1000:
            break
        if rng.random() < p_early:                      # tapped before the stimulus: no onset, new interval
            tap = t + rng.uniform(150, isi - 50)
            trials.append({"i": i, "isiMs": round(isi), "onsetMs": None, "rtMs": None, "kind": "false_start", "frameMs": 16.7})
            i += 1
            t = tap
            continue
        rt = max(105.0, rng.gauss(mu, sigma) + rng.expovariate(1.0 / tau))
        if rng.random() < p_timeout or rt >= TIMEOUT_MS:
            rt, kind = float(TIMEOUT_MS), "timeout"
        else:
            rt = float(round(rt))
            kind = classify(rt)
        frame = 16.7
        if rng.random() < p_invalid:                    # dropped frame at onset: excluded from the metrics
            kind, frame = "invalid", 33.4
        trials.append({"i": i, "isiMs": round(isi), "onsetMs": round(due), "rtMs": rt, "kind": kind, "frameMs": frame})
        i += 1
        t = due + rt
    return trials


def find(name, want, team=False, k=1, night_kw=None, base_kw=None, accept=False, note=""):
    night_kw, base_kw = night_kw or {}, base_kw or {}
    for seed in range(1, 20000):
        rng = random.Random(seed * 7919 + len(name))
        bl = [gen_session(rng, 180 if team else 90, **base_kw) for _ in range(k)]
        nt = gen_session(rng, 180 if (team or accept) else 90, **night_kw)
        try:
            res = score(bl, nt, team, accept)
        except ZeroDivisionError:
            continue
        res["_night"] = nt
        ok = want(res)
        del res["_night"]
        if ok:
            return {"name": name, "note": note, "team": team, "overtimeAccepted": accept, "baselines": bl, "night": nt, "expected": res}
    raise SystemExit("no seed found for " + name)


def timeouts90(res_fx_night):
    return sum(1 for t in res_fx_night if t["kind"] == "timeout" and t["onsetMs"] < 90000)


FIX = [
    find("room_none_at_first_call", lambda r: r["z90"] < 0.6 and r["verdict"] == "none", note="rested night session; finishes at 90 s"),
    find("room_clear_at_first_call", lambda r: r["z90"] >= 3.4 and timeouts90(r["_night"]) >= 1, night_kw=dict(tau=140.0, p_timeout=0.03), note="clearly slower; finishes at 90 s; contains a timeout (counted as rt 5000 and as a lapse)"),
    find("room_overtime_signs", lambda r: 1.2 <= r["z90"] < 2.8 and r.get("z180") is not None and 2.2 <= r["z180"] < 3.0, night_kw=dict(tau=85.0), accept=True, note="unclear at 90 s, overtime taken, ends as 'signs'"),
    find("room_overtime_signs_below_3_2", lambda r: 1.0 <= r["z90"] < 3.0 and r.get("z180") is not None and 3.0 <= r["z180"] < 3.2, night_kw=dict(tau=100.0), accept=True, note="overtime taken, z180 between 3.0 and 3.2: after overtime the bar for 'clear' is 3.2, so this is 'signs'"),
    find("room_overtime_none", lambda r: 1.2 <= r["z90"] < 2.8 and r.get("z180") is not None and r["z180"] < 1.8, night_kw=dict(tau=60.0), accept=True, note="unclear at 90 s, overtime taken, ends as 'none'"),
    find("room_overtime_clear_k2", lambda r: 1.2 <= r["z90"] < 2.8 and r.get("z180") is not None and r["z180"] >= 3.4, k=2, night_kw=dict(tau=110.0), accept=True, note="two daytime records; unclear at 90 s, 'clear' after overtime"),
    find("room_declined_signs", lambda r: 2.2 <= r["z90"] < 2.8, night_kw=dict(tau=95.0), note="unclear at 90 s, overtime declined, z90 >= 2.0 so 'signs'"),
    find("room_declined_none", lambda r: 1.2 <= r["z90"] < 1.8, night_kw=dict(tau=70.0), note="unclear at 90 s, overtime declined, z90 < 2.0 so 'none'"),
    find("room_speed_only_rule", lambda r: (not r["lapseRuleUsed"]) and r["zL90"] > r["zS90"] and r["zS90"] < 1.0 and r["zL90"] >= 1.0, base_kw=dict(mu=305.0), night_kw=dict(mu=305.0, tau=75.0), note="slow device: daytime lapse share above 25%, so only the speed z is used"),
    find("room_one_timeout_none", lambda r: r["z90"] < 1.0 and timeouts90(r["_night"]) == 1, night_kw=dict(p_timeout=0.04), note="rested night session with exactly one missed stimulus: still 'none', and the distance line stays small"),
    find("team_180_signs_k2", lambda r: 2.2 <= r["z180"] < 2.8, team=True, k=2, night_kw=dict(tau=75.0), note="team mode: 3-minute records day and night, single look"),
    find("team_180_clear", lambda r: 3.0 <= r["z180"] < 3.2, team=True, k=1, night_kw=dict(tau=95.0), note="team mode, z180 between 3.0 and 3.2: a single look uses 3.0, so this is 'clear'"),
]
doc = {
    "about": "Test vectors for src/scoring. Generated by reference_scoring.py. Reaction times are synthetic.",
    "constants": {"LAPSE_MS": LAPSE_MS, "MIN_VALID_MS": MIN_VALID_MS, "TIMEOUT_MS": TIMEOUT_MS, "S_SPEED_REL": S_SPEED_REL, "S_LAPSE": S_LAPSE,
                  "E_FIRST": E_FIRST, "G_NONE": G_NONE, "E_OVERTIME": E_OVERTIME, "F_SIGNS": F_SIGNS,
                  "MAX_BASELINE_LAPSE_FOR_LAPSE_RULE": MAX_BASELINE_LAPSE_FOR_LAPSE_RULE, "FT_PER_S_AT_65MPH": FT_PER_S_AT_65MPH},
    "fixtures": FIX,
}
with open("scoring-fixtures.json", "w", encoding="utf-8") as f:
    json.dump(doc, f, ensure_ascii=False, indent=1)
print("name | k | n90/n_final | z90 | z180 | verdict | speedDelta% | rtDelta ms | feet | lapse rule | timeouts<90s")
for fx in FIX:
    e = fx["expected"]
    z90 = "-" if e.get("z90") is None else f"{e['z90']:.2f}"
    z180 = "-" if e.get("z180") is None else f"{e['z180']:.2f}"
    n90 = metrics(fx["night"], 90000)["n"]
    print(f"{fx['name']} | {e['k']} | {n90}/{e['now']['n']} | {z90} | {z180} | {e['verdict']} | {e['speedDeltaPct']:.1f} | {e['rtDeltaMs']:.0f} | {e['distanceFt']:.1f} | {e['lapseRuleUsed']} | {timeouts90(fx['night'])}")
import os
print(os.path.getsize("scoring-fixtures.json"), "bytes")
