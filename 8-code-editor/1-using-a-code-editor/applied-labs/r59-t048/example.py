"""A minimal launch-config data validator; it does not launch commands."""

import json
import re
from collections.abc import Mapping


def validate(config):
    """Map config fields to a validity result and a value-redacted summary."""
    errors = []
    if not isinstance(config, Mapping):
        return {"valid": False, "errors": ["config must be a mapping"], "summary": None, "launched": False}

    command = config.get("command")
    if not isinstance(command, str) or not command.strip():
        errors.append("command must be a non-empty string")

    args = config.get("args")
    if not isinstance(args, list) or any(not isinstance(item, str) for item in args):
        errors.append("args must be an array of strings")

    env = config.get("env")
    if not isinstance(env, Mapping):
        errors.append("env must map explicit variable names to string values")
    else:
        for name, value in env.items():
            if not isinstance(name, str) or not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", name):
                errors.append("env keys must be identifier-like names")
                break
            if not isinstance(value, str):
                errors.append(f"env value for {name} must be a string")

    summary = None
    if not errors:
        summary = {
            "command": command.strip(),
            "args": list(args),
            "environment": {name: "[REDACTED]" for name in env},
        }
    return {"valid": not errors, "errors": errors, "summary": summary, "launched": False}


def demo():
    """Show how each input field maps to the returned public fields."""
    cases = [
        {"label": "missing command", "config": {"args": [], "env": {}}},
        {"label": "args is one string", "config": {"command": "python3", "args": "-m http.server", "env": {}}},
        {
            "label": "valid local example",
            "config": {
                "command": "python3",
                "args": ["-m", "http.server", "8000"],
                "env": {"API_TOKEN": "local-demo-secret"},
            },
        },
    ]
    return [
        {
            "case": case["label"],
            "input_fields": {
                "command": case["config"].get("command", "[missing]"),
                "args": case["config"].get("args", "[missing]"),
                "environment_keys": list(case["config"].get("env", {})),
                "environment_values": "[REDACTED]",
            },
            "output": validate(case["config"]),
        }
        for case in cases
    ]


if __name__ == "__main__":
    print(json.dumps(demo(), indent=2))
