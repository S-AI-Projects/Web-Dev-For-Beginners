"""Validate a local launch configuration without starting a process."""

from collections.abc import Mapping
import re


REDACTED = "[REDACTED]"


def validate_launch_config(config):
    """Return a safe validation report for a command, args list, and env map.

    This function intentionally validates data only. It never starts the
    configured command or exports environment values to the report.
    """
    errors = []
    if not isinstance(config, Mapping):
        return {
            "valid": False,
            "errors": ["configuration must be a mapping"],
            "summary": None,
            "launched": False,
        }

    command = config.get("command")
    if not isinstance(command, str) or not command.strip():
        errors.append("command must be a non-empty string")

    args = config.get("args")
    if not isinstance(args, list) or any(not isinstance(arg, str) for arg in args):
        errors.append("args must be an array of strings")

    env = config.get("env")
    if not isinstance(env, Mapping):
        errors.append("env must be a mapping of explicit variable names to values")
    else:
        for key, value in env.items():
            if not isinstance(key, str) or not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", key):
                errors.append("env keys must be identifier-like names")
                break
            if not isinstance(value, str):
                errors.append(f"env value for {key} must be a string")

    valid = not errors
    summary = None
    if valid:
        summary = {
            "command": command.strip(),
            "args": list(args),
            "environment": {key: REDACTED for key in env},
        }

    return {
        "valid": valid,
        "errors": errors,
        "summary": summary,
        "launched": False,
    }


def demo():
    """Show a missing-command error followed by a valid, redacted recovery."""
    invalid = {"args": ["-m", "http.server", "8000"], "env": {}}
    recovered = {
        "command": "python3",
        "args": ["-m", "http.server", "8000"],
        "env": {"API_TOKEN": "local-demo-secret"},
    }
    return {
        "invalid_input": invalid,
        "invalid_result": validate_launch_config(invalid),
        "recovery_input_summary": {
            "command": recovered["command"],
            "args": recovered["args"],
            "environment_keys": list(recovered["env"]),
            "environment_values": REDACTED,
        },
        "recovery_result": validate_launch_config(recovered),
    }


if __name__ == "__main__":
    import json

    print(json.dumps(demo(), indent=2))
