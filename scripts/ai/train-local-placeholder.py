#!/usr/bin/env python3
"""Placeholder for future NizamKitchen local fine-tuning.

This script intentionally avoids heavy ML dependencies. It documents the future
workflow without making the web app require a GPU or paid AI provider.
"""

from pathlib import Path


def main() -> None:
    print("NizamKitchen local training placeholder")
    print("--------------------------------------")
    print("1. Export a verified dataset JSONL from /admin/ai-training/datasets.")
    print("2. Place it in data/ai-training/nizamkitchen-training.jsonl.")
    print("3. Fine-tune an existing open-source model outside the production web app.")
    print("4. Save the model artifact to a local path, for example models/nizamkitchen-local-v1.")
    print("5. Serve inference through LOCAL_AI_BASE_URL using local-inference-server-placeholder.py or a real server.")
    print()
    print("Expected JSONL path:")
    print(Path("data/ai-training/nizamkitchen-training.jsonl").resolve())
    print()
    print("Training from scratch is not recommended for MVP. Collect verified corrections first.")


if __name__ == "__main__":
    main()
