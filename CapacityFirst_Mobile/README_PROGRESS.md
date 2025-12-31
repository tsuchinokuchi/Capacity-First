# CapacityFirst Mobile App - プロジェクト進捗状況

**最終更新**: 2026-01-01

## 現在のステータス: 要件定義完了・実装開始待ち

要件定義と実装計画の策定が完了しました。
次回は **「プロジェクトセットアップ (Expo Init)」** から開始します。

## 次回のアクション: プロジェクトセットアップ
1.  **Expoプロジェクトの作成**: `npx create-expo-app`
2.  **ライブラリのインストール**: Zustand, MMKV, React Native Paper, PagerViewなど
3.  **基本画面の実装**: スワイプ可能なナビゲーション基盤の構築

## 決定事項 (要件定義結果)

### 1. アプリの方向性
- **スタンドアローン**: PC版との連携は初期フェーズでは行わない。
- **オフラインファースト**: ローカルDBで完結し、爆速で動作する。

### 2. 主要機能・UI
- **Swipe Navigation**: 左右フリックで以下の画面を切り替え。
    - **[Pool]** (左/右 設定可) ⇔ **[Daily (Home)]** ⇔ **[Weekly]**
- **Weekly View**: 週間予定表を実装。
- **Dark Mode**: 標準対応。

### 3. 技術スタック
- **Framework**: React Native (Expo)
- **State**: Zustand
- **Storage**: react-native-mmkv
- **UI**: React Native Paper

## 参照ファイル
- **task.md**: 詳細なタスクリスト（更新済み）
- **requirements.md**: 要件定義書（更新済み）
- **implementation_plan.md**: 実装計画書（作成済み）
