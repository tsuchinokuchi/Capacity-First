#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
スケジュールファイルのタスクを新しいフォーマットに変換
"""

import os
import re
from pathlib import Path
from datetime import datetime

# 設定（スクリプトの位置から相対パスで指定）
SCRIPT_DIR = Path(__file__).parent
SCHEDULE_DIR = SCRIPT_DIR.parent / "スケジュール"

def guess_genre(task_name):
    """タスク名からジャンルを推測"""
    name_lower = task_name.lower()
    
    # 売場作業
    if '品出し' in name_lower or '売場' in name_lower or '坪売り' in name_lower:
        return '売場作業'
    
    # 顧客対応
    if '接客' in name_lower or '顧客' in name_lower or '電話' in name_lower or '客' in name_lower:
        return '顧客対応'
    
    # 定型作業
    if 'チェックリスト' in name_lower or '週報' in name_lower or '月報' in name_lower or '年末調整' in name_lower:
        return '定型作業'
    
    # デスクワーク（デフォルト）
    return 'デスクワーク'

def calculate_minutes(time_range):
    """時間帯から分を計算"""
    match = re.match(r'(\d{2}):(\d{2})-(\d{2}):(\d{2})', time_range)
    if not match:
        return None
    
    start_hour = int(match.group(1))
    start_min = int(match.group(2))
    end_hour = int(match.group(3))
    end_min = int(match.group(4))
    
    start_total = start_hour * 60 + start_min
    end_total = end_hour * 60 + end_min
    
    return end_total - start_total

def convert_task_line(line, file_date):
    """タスク行を変換"""
    # 既に新しいフォーマットの場合はスキップ
    if '⏱️' in line and '#' in line and re.search(r'#(デスクワーク|売場作業|顧客対応|定型作業|学習|健康|趣味)', line):
        return line
    
    # 完了状態を抽出
    is_completed = re.match(r'^-\s+\[x\]', line)
    checkbox = '- [x]' if is_completed else '- [ ]'
    
    # 時間帯を抽出
    time_match = re.search(r'(\d{2}:\d{2}-\d{2}:\d{2})', line)
    
    # タスク名を抽出（時間帯、📅、⏳、#calendar、🔁、✅などを除去）
    task_name = line
    task_name = re.sub(r'^-\s+\[[ x]\]\s*', '', task_name)
    if time_match:
        task_name = task_name.replace(time_match.group(1), '', 1)
    task_name = re.sub(r'📅\s*\d{4}-\d{2}-\d{2}\s*', '', task_name)
    task_name = re.sub(r'⏳\s*\d{4}-\d{2}-\d{2}\s*', '', task_name)
    task_name = re.sub(r'#calendar\s*', '', task_name)
    # 繰り返し情報を除去（🔁 every day, 🔁 every Sunday, 🔁 2nd, 4th Wednesday など）
    task_name = re.sub(r'🔁\s*[^\s]*\s*', '', task_name)
    task_name = re.sub(r'\s*(every\s+)?(day|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|1st|2nd|3rd|4th)\s*', '', task_name, flags=re.IGNORECASE)
    task_name = re.sub(r'✅\s*\d{4}-\d{2}-\d{2}\s*', '', task_name)
    task_name = task_name.strip()
    
    # 「勤務」「休み」などの時間帯指定タスクは容量管理対象外なので、そのまま残す
    if task_name in ['勤務', '休み', '休憩は打刻！']:
        return line
    
    # 時間帯から分を計算
    duration = None
    if time_match:
        duration = calculate_minutes(time_match.group(1))
    
    # 所要時間が計算できない、または0以下の場合はスキップ（時間帯指定のまま）
    if not duration or duration <= 0:
        return line
    
    # ジャンルを推測
    genre = guess_genre(task_name)
    
    # 新しいフォーマットで生成
    new_line = f"{checkbox} {task_name} #{genre} ⏱️ {duration} 📅 {file_date}"
    
    return new_line

def convert_schedule_file(file_path):
    """スケジュールファイルを変換"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        lines = content.split('\n')
        file_date = file_path.stem  # YYYY-MM-DD
        
        new_lines = []
        has_changes = False
        
        for line in lines:
            # タスク行を変換
            if re.match(r'^-\s+\[[ x]\]', line):
                converted = convert_task_line(line, file_date)
                new_lines.append(converted)
                if converted != line:
                    has_changes = True
            else:
                new_lines.append(line)
        
        # 変更があった場合のみファイルを更新
        if has_changes:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write('\n'.join(new_lines))
            return True
        
        return False
    except Exception as e:
        print(f"Error converting {file_path}: {e}")
        return False

def main():
    """メイン処理"""
    if not SCHEDULE_DIR.exists():
        print(f"スケジュールディレクトリが見つかりません: {SCHEDULE_DIR}")
        return
    
    schedule_files = list(SCHEDULE_DIR.glob("*.md"))
    
    if not schedule_files:
        print("スケジュールファイルが見つかりません")
        return
    
    print(f"スケジュールファイル {len(schedule_files)}件 を変換します...")
    
    converted_count = 0
    skipped_count = 0
    
    for file_path in schedule_files:
        if convert_schedule_file(file_path):
            converted_count += 1
            print(f"✅ 変換完了: {file_path.name}")
        else:
            skipped_count += 1
    
    print(f"\n変換完了: {converted_count}件, スキップ: {skipped_count}件")

if __name__ == "__main__":
    main()

