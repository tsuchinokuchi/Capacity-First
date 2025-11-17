#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
繰り返しタスクを展開するスクリプト（Python版）
"""

import os
import re
from pathlib import Path
from datetime import datetime, timedelta

# 設定
SCHEDULE_DIR = Path("03.ツェッテルカステン/030.データベース/タスク管理/スケジュール")
DAILY_TASKS_PATH = Path("03.ツェッテルカステン/030.データベース/タスク管理/繰り返しタスク/毎日.md")
WEEKLY_TASKS_PATH = Path("03.ツェッテルカステン/030.データベース/タスク管理/繰り返しタスク/毎週.md")

# 曜日マッピング
DAY_MAP = {
    'monday': 0, 'tuesday': 1, 'wednesday': 2, 'thursday': 3,
    'friday': 4, 'saturday': 5, 'sunday': 6
}

def load_recurring_tasks(file_path):
    """繰り返しタスク定義ファイルからタスクを読み込む"""
    if not file_path.exists():
        return []
    
    tasks = []
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
        lines = content.split('\n')
        
        for line in lines:
            # タスク行を抽出（- [ ] で始まる行）
            match = re.match(r'^-\s+\[([ x])\]\s+(.+)$', line)
            if not match:
                continue
            
            is_completed = match.group(1) == 'x'
            task_text = match.group(2).strip()
            
            # コメントや説明行はスキップ
            if task_text.startswith('<!--') or len(task_text) == 0:
                continue
            
            tasks.append({
                'text': task_text,
                'line': line.strip(),
                'is_completed': is_completed
            })
    
    return tasks

def task_exists(date_str, task_text):
    """タスクが既に存在するかチェック"""
    file_path = SCHEDULE_DIR / f"{date_str}.md"
    if not file_path.exists():
        return False
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # タスク名を抽出（メタデータを除く）
    task_name = task_text
    task_name = re.sub(r'^- \[[ x]\] ', '', task_name)
    task_name = re.sub(r'⏱️ \d+', '', task_name)
    task_name = re.sub(r'📅 \d{4}-\d{2}-\d{2}', '', task_name)
    task_name = re.sub(r'#\w+', '', task_name)
    task_name = re.sub(r'🔁.*$', '', task_name)
    task_name = task_name.strip()
    
    # ファイル内のタスクをチェック
    for line in content.split('\n'):
        if line.strip().startswith('- ['):
            existing_name = line
            existing_name = re.sub(r'^- \[[ x]\] ', '', existing_name)
            existing_name = re.sub(r'⏱️ \d+', '', existing_name)
            existing_name = re.sub(r'📅 \d{4}-\d{2}-\d{2}', '', existing_name)
            existing_name = re.sub(r'#\w+', '', existing_name)
            existing_name = existing_name.strip()
            
            if existing_name == task_name:
                return True
    
    return False

def add_task_to_date(date_str, task_line):
    """タスクを日付に追加"""
    file_path = SCHEDULE_DIR / f"{date_str}.md"
    
    # ファイルが存在しない場合は作成
    if not file_path.exists():
        file_path.parent.mkdir(parents=True, exist_ok=True)
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write("## 今日のスケジュール\n\n")
    
    # 日付を更新したタスク行を作成（🔁マーカーを削除）
    task_text = task_line
    task_text = re.sub(r'🔁.*$', '', task_text)  # 繰り返しマーカーを削除
    task_text = re.sub(r'📅 \d{4}-\d{2}-\d{2}', f'📅 {date_str}', task_text)  # 日付を更新
    task_text = task_text.strip()
    
    # ファイルに追加
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 既に存在する場合はスキップ
    if task_exists(date_str, task_text):
        return False
    
    new_content = content.rstrip() + '\n' + task_text + '\n'
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    return True

def main():
    """メイン処理"""
    # 今日から2週間先まで展開
    today = datetime.now()
    end_date = today + timedelta(days=14)
    
    # 繰り返しタスクを読み込む
    daily_tasks = load_recurring_tasks(DAILY_TASKS_PATH)
    weekly_tasks = load_recurring_tasks(WEEKLY_TASKS_PATH)
    
    added_count = 0
    skipped_count = 0
    
    # 毎日のタスクを展開（出勤日のみ）
    for task in daily_tasks:
        if task['is_completed']:
            continue
        
        current = today
        while current <= end_date:
            date_str = current.strftime("%Y-%m-%d")
            
            # スケジュールファイルが存在する場合は出勤日とみなす
            schedule_file = SCHEDULE_DIR / f"{date_str}.md"
            if schedule_file.exists():
                # ファイルに「勤務」を含む行があるかチェック
                with open(schedule_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                    if '勤務' in content or '出勤' in content:
                        if not task_exists(date_str, task['text']):
                            if add_task_to_date(date_str, task['line']):
                                added_count += 1
                            else:
                                skipped_count += 1
                        else:
                            skipped_count += 1
            
            current += timedelta(days=1)
    
    # 毎週のタスクを展開
    for task in weekly_tasks:
        if task['is_completed']:
            continue
        
        # 曜日を抽出（例: every Thursday）
        day_match = re.search(r'🔁\s*every\s+(\w+)', task['text'], re.IGNORECASE)
        if not day_match:
            continue
        
        day_name = day_match.group(1).lower()
        target_day = DAY_MAP.get(day_name)
        if target_day is None:
            continue
        
        current = today
        while current <= end_date:
            # 指定された曜日の場合
            if current.weekday() == target_day:
                date_str = current.strftime("%Y-%m-%d")
                
                # スケジュールファイルが存在する場合は出勤日とみなす
                schedule_file = SCHEDULE_DIR / f"{date_str}.md"
                if schedule_file.exists():
                    # ファイルに「勤務」を含む行があるかチェック
                    with open(schedule_file, 'r', encoding='utf-8') as f:
                        content = f.read()
                        if '勤務' in content or '出勤' in content:
                            if not task_exists(date_str, task['text']):
                                if add_task_to_date(date_str, task['line']):
                                    added_count += 1
                                else:
                                    skipped_count += 1
                            else:
                                skipped_count += 1
                else:
                    # ファイルが存在しない場合は作成して追加
                    if not task_exists(date_str, task['text']):
                        if add_task_to_date(date_str, task['line']):
                            added_count += 1
                        else:
                            skipped_count += 1
                    else:
                        skipped_count += 1
            
            current += timedelta(days=1)
    
    print(f"✅ 繰り返しタスクを展開しました")
    print(f"追加: {added_count}件, スキップ: {skipped_count}件")

if __name__ == "__main__":
    main()

