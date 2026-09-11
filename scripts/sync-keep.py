#!/usr/bin/env python3
"""Read and check off items on a Google Keep list, via the unofficial
gkeepapi client — there is no official Keep API for a personal account.

Needs GOOGLE_KEEP_EMAIL and GOOGLE_KEEP_MASTER_TOKEN in the environment.
Never her password: the master token is generated once, by Charlotte, on her
own device, and stored only as a Claude Code Environment variable — see
CLAUDE.md. This script errors out rather than prompting if either is unset.

    uv run --with gkeepapi scripts/sync-keep.py list --list "Meal Planning"
    uv run --with gkeepapi scripts/sync-keep.py check --list "Meal Planning" --ids <id> [<id> ...]
"""
import argparse
import json
import os
import sys


def _client():
    email = os.environ.get("GOOGLE_KEEP_EMAIL")
    token = os.environ.get("GOOGLE_KEEP_MASTER_TOKEN")
    if not email or not token:
        sys.exit("GOOGLE_KEEP_EMAIL and GOOGLE_KEEP_MASTER_TOKEN must be set in the environment.")
    import gkeepapi

    keep = gkeepapi.Keep()
    keep.resume(email, token)
    return keep


def _find_list(keep, name):
    for note in keep.all():
        if note.title.strip().lower() == name.strip().lower() and not note.trashed and not note.archived:
            return note
    sys.exit(f'No Keep list named "{name}" found.')


def cmd_list(args):
    keep = _client()
    note = _find_list(keep, args.list)
    items = [{"id": item.id, "text": item.text} for item in note.items if not item.checked]
    print(json.dumps(items))


def cmd_check(args):
    keep = _client()
    note = _find_list(keep, args.list)
    by_id = {item.id: item for item in note.items}
    missing = [item_id for item_id in args.ids if item_id not in by_id]
    if missing:
        sys.exit(f"Unknown item id(s): {', '.join(missing)}")
    for item_id in args.ids:
        by_id[item_id].checked = True
    keep.sync()


def main():
    parser = argparse.ArgumentParser(description="Sync a Google Keep shopping list.")
    sub = parser.add_subparsers(dest="command", required=True)

    p_list = sub.add_parser("list", help="Print unchecked items on a list as JSON.")
    p_list.add_argument("--list", default="Meal Planning", help='Keep list/note title (default: "Meal Planning").')
    p_list.set_defaults(func=cmd_list)

    p_check = sub.add_parser("check", help="Mark items checked so they aren't re-synced.")
    p_check.add_argument("--list", default="Meal Planning", help='Keep list/note title (default: "Meal Planning").')
    p_check.add_argument("--ids", nargs="+", required=True, help="Item ids to check off (from `list`'s output).")
    p_check.set_defaults(func=cmd_check)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
