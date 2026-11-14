"""Pre-registered analysis of the room data. Run: python analysis/analyze.py room.csv [out_dir]

Fixed before measuring: the metric is speedDeltaPct, the exclusion rule is `usable`
(src/lib/room.ts), and nothing here uses or tunes the verdict thresholds.
room.csv holds row-level summaries and is never committed; only the tables and figures are.
"""
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from scipy import stats

NIGHT = ["21-24", "00-03", "03-06"]
PREDICTION = {0: "just as sharp", 1: "a bit slower", 2: "much slower"}


def summarize(x: pd.Series) -> pd.Series:
    n, m = len(x), x.mean()
    slower = int((x > 0).sum())
    out = {"n": n, "mean": m, "ci_low": np.nan, "ci_high": np.nan, "p_one_sided": np.nan,
           "slower": slower, "p_sign": np.nan}
    if n >= 2:
        half = stats.t.ppf(0.975, n - 1) * x.std(ddof=1) / np.sqrt(n)
        out["ci_low"], out["ci_high"] = m - half, m + half
        out["p_one_sided"] = stats.ttest_1samp(x, 0, alternative="greater").pvalue
    nonzero = int((x != 0).sum())
    if nonzero > 0:
        # Sign test: used instead of the mean for groups of 5 to 9.
        out["p_sign"] = stats.binomtest(slower, nonzero, 0.5, alternative="greater").pvalue
    return pd.Series(out)


def table(df: pd.DataFrame, by: str) -> pd.DataFrame:
    return df.groupby(by)["speedDeltaPct"].apply(summarize).unstack()


def main() -> None:
    src = Path(sys.argv[1] if len(sys.argv) > 1 else "room.csv")
    out = Path(sys.argv[2] if len(sys.argv) > 2 else "analysis/out")
    out.mkdir(parents=True, exist_ok=True)

    df = pd.read_csv(src)
    use = df[(df.kind == "compare") & df["first"] & ~df.alcohol & ~df.justWoke
             & df.baselineClass.isin(["day", "evening"]) & df.speedDeltaPct.notna()]
    night = use[use.bucket.isin(NIGHT)]

    # Table 1: change by time of night. Primary result: 03-06, or the larger of 00-03 and 03-06
    # if 03-06 has fewer than 10 people (say so when reporting).
    table1 = table(use, "bucket")
    n = table1["n"]
    primary = "03-06" if n.get("03-06", 0) >= 10 else max(["00-03", "03-06"], key=lambda b: n.get(b, 0))
    # Table 2: measured change by what people predicted.
    table2 = table(night, "prediction")
    rho = stats.spearmanr(night.prediction, night.speedDeltaPct) if len(night) >= 3 else None
    # Hours awake in three groups.
    awake = pd.cut(use.awakeH, [0, 17, 21, 100], right=False, labels=["<17 h", "17-21 h", ">=21 h"])
    table3 = use.groupby(awake, observed=True)["speedDeltaPct"].apply(summarize).unstack()
    # Exploratory only.
    caffeine = table(night, "caffeine")

    table1.to_csv(out / "table1_by_bucket.csv")
    table2.to_csv(out / "table2_by_prediction.csv")
    table3.to_csv(out / "table3_by_hours_awake.csv")
    caffeine.to_csv(out / "exploratory_caffeine.csv")

    pd.set_option("display.width", 160)
    print(f"daytime records: {(df.kind == 'baseline').sum()}, comparisons: {(df.kind == 'compare').sum()}, "
          f"in the analysis: {len(use)}")
    print(f"\nTable 1. Speed change by time (primary bucket: {primary})\n{table1.round(3)}")
    print(f"\nTable 2. Speed change by prediction (night buckets)\n{table2.round(3)}")
    if rho is not None:
        print(f"Spearman rho, prediction vs change: {rho.statistic:.3f} (p = {rho.pvalue:.3f})")
    print(f"\nHours awake\n{table3.round(3)}")
    print(f"\nCaffeine (exploratory)\n{caffeine.round(3)}")

    # Figure 1: mean and 95% CI per night bucket.
    fig, ax = plt.subplots(figsize=(6, 4))
    shown = [b for b in NIGHT if b in table1.index and table1.loc[b, "n"] >= 5]
    if shown:
        t = table1.loc[shown]
        ax.errorbar(range(len(shown)), t["mean"], yerr=[t["mean"] - t["ci_low"], t["ci_high"] - t["mean"]],
                    fmt="o", capsize=5, color="black")
        ax.set_xticks(range(len(shown)), [f"{b}\n(n={int(table1.loc[b, 'n'])})" for b in shown])
    ax.axhline(0, color="gray", lw=1)
    ax.set_ylabel("Slower than own daytime record (%)")
    ax.set_title("Speed change by time of night, mean and 95% CI")
    fig.tight_layout()
    fig.savefig(out / "fig1_by_bucket.png", dpi=200)

    # Figure 2: every test as a dot, by prediction, with the group mean.
    fig, ax = plt.subplots(figsize=(6, 4))
    rng = np.random.default_rng(0)
    for p, label in PREDICTION.items():
        x = night[night.prediction == p].speedDeltaPct
        ax.scatter(p + rng.uniform(-0.12, 0.12, len(x)), x, color="gray", alpha=0.7)
        if len(x):
            ax.hlines(x.mean(), p - 0.25, p + 0.25, color="black", lw=2)
    ax.axhline(0, color="gray", lw=1)
    ax.set_xticks(list(PREDICTION), [f"{v}\n(n={(night.prediction == k).sum()})" for k, v in PREDICTION.items()])
    ax.set_ylabel("Slower than own daytime record (%)")
    ax.set_title("Predicted vs measured (bar = mean)")
    fig.tight_layout()
    fig.savefig(out / "fig2_prediction.png", dpi=200)


if __name__ == "__main__":
    main()
