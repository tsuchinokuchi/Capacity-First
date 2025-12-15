#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
定期タスクを日次スケジュールノートへ追記するスクリプト。

Usage examples:

    # 今日から30日分（デフォルト）を更新
    python insert_recurring_tasks.py

    # 日付範囲を指定して更新
    python insert_recurring_tasks.py --start 2025-12-01 --end 2026-01-31

    # 60日分だけ更新
    python insert_recurring_tasks.py --days 60
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Iterable, List, Optional

# ディレクトリ構成
BASE_DIR = Path(__file__).resolve().parents[1]
SCHEDULE_DIR = BASE_DIR / "スケジュール"


@dataclass(frozen=True)
class RecurringTask:
    title: str
    tag: Optional[str] = None
    duration_minutes: Optional[int] = None
    frequency: str = "daily"  # daily / weekly / monthly
    weekdays: Optional[List[int]] = None  # Monday = 0
    monthdays: Optional[List[int]] = None  # 1-31
    extra_suffix: Optional[str] = None  # e.g. "#calendar"

    def applies_to(self, target: date) -> bool:
        if self.frequency == "daily":
            return True
        if self.frequency == "weekly":
            if not self.weekdays:
                return False
            return target.weekday() in self.weekdays
        if self.frequency == "monthly":
            if not self.monthdays:
                return False
            return target.day in self.monthdays
        return False

    def to_line(self, day: date) -> str:
        tag_part = f" {self.tag}" if self.tag else ""
        duration_part = (
            f" ⏱️ {self.duration_minutes}" if self.duration_minutes is not None else ""
        )
        extra_part = f" {self.extra_suffix}" if self.extra_suffix else ""
        date_str = day.isoformat()
        return f"- [ ] {self.title}{tag_part}{duration_part} 📅 {date_str}{extra_part}"


RECURRING_TASKS: List[RecurringTask] = [
    RecurringTask(
        title="店長日次チェックリスト更新",
        tag="#定型作業",
        duration_minutes=15,
        frequency="daily",
    ),
    RecurringTask(
        title="売場・在庫確認",
        tag="#売場作業",
        duration_minutes=30,
        frequency="daily",
    ),
    RecurringTask(
        title="スタッフ共有事項整理",
        tag="#デスクワーク",
        duration_minutes=30,
        frequency="daily",
    ),
    RecurringTask(
        title="日報・AI要約メモ作成",
        tag="#デスクワーク",
        duration_minutes=30,
        frequency="daily",
    ),
]


def parse_date(value: str) -> date:
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError as exc:
        raise argparse.ArgumentTypeError(f"日付の形式が不正です: {value}") from exc


def ensure_schedule_file(day: date) -> Path:
    """日付に対応するスケジュールノートを保証する。存在しなければ雛形で作成。"""
    path = SCHEDULE_DIR / f"{day.isoformat()}.md"
    if not path.exists():
        template = (
            "- [ ] ## 今日のスケジュール\n\n"
            f"- [ ] 00:00-00:00 シフト未設定 📅 {day.isoformat()} ⏳ {day.isoformat()} #calendar\n"
        )
        path.write_text(template, encoding="utf-8")
    return path


def update_day(day: date) -> bool:
    """指定日のノートに定期タスクを追記し、変化があればTrueを返す。"""
    path = ensure_schedule_file(day)
    content = path.read_text(encoding="utf-8")
    added_lines: List[str] = []

    for task in RECURRING_TASKS:
        if not task.applies_to(day):
            continue
        line = task.to_line(day)
        if line not in content:
            added_lines.append(line)

    if not added_lines:
        return False

    # ノート末尾に追記（末尾が改行で終わっていなければ追加）
    if not content.endswith("\n"):
        content += "\n"
    content += "\n".join(added_lines) + "\n"
    path.write_text(content, encoding="utf-8")
    return True


def iter_dates(start: date, end: date) -> Iterable[date]:
    current = start
    while current <= end:
        yield current
        current += timedelta(days=1)


def main() -> None:
    parser = argparse.ArgumentParser(description="日次スケジュールに定期タスクを追記します。")
    parser.add_argument("--start", type=parse_date, help="更新開始日 (YYYY-MM-DD)")
    parser.add_argument("--end", type=parse_date, help="更新終了日 (YYYY-MM-DD)")
    parser.add_argument(
        "--days",
        type=int,
        default=30,
        help="開始日からの適用日数。--end が指定されている場合は無視されます。（デフォルト: 30日）",
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="処理結果のログ出力を抑制します。",
    )
    args = parser.parse_args()

    if args.start and args.end and args.start > args.end:
        parser.error("--start は --end より前の日付を指定してください。")

    start_date = args.start or date.today()
    end_date = args.end or (start_date + timedelta(days=args.days - 1))

    SCHEDULE_DIR.mkdir(parents=True, exist_ok=True)

    updated = 0
    for day in iter_dates(start_date, end_date):
        if update_day(day):
            updated += 1
            if not args.quiet:
                print(f"[UPDATED] {day.isoformat()}")

    if not args.quiet:
        if updated:
            print(f"完了: {updated} 日分を更新しました。")
        else:
            print("変更はありませんでした。")


if __name__ == "__main__":
    main()

