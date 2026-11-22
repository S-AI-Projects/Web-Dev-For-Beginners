"""R59-T028: Server-launch configuration validator and redaction experiment.

Extends 'Using a Code Editor: Mastering VSCode.dev' by validating server
launch configurations, ensuring strict argument arrays, redacting sensitive
environment keys, and comparing configuration sizes without launching processes.
"""

from __future__ import annotations

import json
import time
from typing import Any, Dict, List, Optional


def validate_launch_config(config: Any) -> Dict[str, Any]:
    """Validate a server launch configuration and return a redacted summary.

    Contract:
    1. Input must be a dictionary.
    2. Missing or blank 'command' fails validation.
    3. 'args' must be a list/tuple of strings. If 'args' is a single string,
       it fails validation with an explicit error.
    4. 'env' must be a dictionary if present; all values are redacted in the output.
    5. No process is launched under any circumstances.

    Args:
        config: Dictionary containing command, args, and env fields.

    Returns:
        Structured result dictionary with validation status, redacted env, and errors.
    """
    if not isinstance(config, dict):
        raise TypeError(f"Configuration must be a dictionary, got {type(config).__name__}")

    config_id = str(config.get("config_id", "unnamed"))
    errors: List[str] = []

    # 1. Validate Command
    command = config.get("command")
    if command is None or not isinstance(command, str) or not command.strip():
        errors.append("Missing required command")

    # 2. Validate Args
    args = config.get("args")
    if isinstance(args, str):
        errors.append("Arguments must be an array of strings, not a single string")
    elif not isinstance(args, (list, tuple)):
        errors.append("Arguments must be an array/list of strings")
    else:
        for idx, arg in enumerate(args):
            if not isinstance(arg, str):
                errors.append(f"Argument at index {idx} must be a string, got {type(arg).__name__}")

    # 3. Validate Env
    env = config.get("env", {})
    if env is None:
        env = {}
    elif not isinstance(env, dict):
        errors.append("Environment must be a dictionary of key-value pairs")

    if errors:
        return {
            "valid": False,
            "config_id": config_id,
            "command": command if isinstance(command, str) else None,
            "args": None,
            "env_keys": [],
            "redacted_env": {},
            "process_launched": False,
            "errors": errors
        }

    # Redact all environment values
    redacted_env = {str(k): "[REDACTED]" for k in env.keys()}
    env_keys = sorted(list(redacted_env.keys()))

    return {
        "valid": True,
        "config_id": config_id,
        "command": command.strip(),
        "args": list(args),
        "env_keys": env_keys,
        "redacted_env": redacted_env,
        "process_launched": False,
        "errors": []
    }


# Controlled configurations for comparative evaluation
CONFIG_SMALL = {
    "config_id": "CFG-SMALL",
    "command": "python3",
    "args": ["-m", "http.server", "8000"],
    "env": {
        "PORT": "8000"
    }
}

CONFIG_MEDIUM = {
    "config_id": "CFG-MEDIUM",
    "command": "node",
    "args": ["server.js", "--env", "development", "--port", "3000"],
    "env": {
        "NODE_ENV": "development",
        "PORT": "3000",
        "DB_PASSWORD": "supersecretpassword",
        "JWT_SECRET": "token-sign-key-xyz"
    }
}

CONFIG_LARGE = {
    "config_id": "CFG-LARGE",
    "command": "python3",
    "args": ["manage.py", "runserver", "0.0.0.0:8000", "--noreload", "--nothreading", "--verbosity", "2"],
    "env": {
        "DEBUG": "False",
        "DATABASE_URL": "postgres://user:pass@db:5432/bank",
        "SECRET_KEY": "django-insecure-secret",
        "REDIS_HOST": "cache.internal",
        "API_KEY": "service-key-9988",
        "AWS_SECRET_ACCESS_KEY": "aws-secret-xyz"
    }
}

CONTROLLED_CONFIGURATIONS = [
    CONFIG_SMALL,
    CONFIG_MEDIUM,
    CONFIG_LARGE
]


def compare_configurations(configs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Compare multiple launch configurations across correctness and security metrics."""
    comparison_results: List[Dict[str, Any]] = []

    for cfg in configs:
        start_ns = time.perf_counter_ns()
        validated = validate_launch_config(cfg)
        elapsed_us = (time.perf_counter_ns() - start_ns) / 1000.0

        raw_env = cfg.get("env", {}) if isinstance(cfg.get("env"), dict) else {}
        total_secrets = len(raw_env)
        redacted_count = len(validated["redacted_env"])

        redaction_rate = 100.0 if total_secrets == redacted_count else 0.0

        comparison_results.append({
            "config_id": cfg.get("config_id", "unnamed"),
            "valid": validated["valid"],
            "arg_count": len(validated["args"]) if validated["args"] is not None else 0,
            "env_key_count": len(validated["env_keys"]),
            "redaction_rate_percent": redaction_rate,
            "process_launched": validated["process_launched"],
            "redacted_summary": {
                "command": validated["command"],
                "args": validated["args"],
                "env": validated["redacted_env"]
            }
        })

    return comparison_results


def run_demo() -> str:
    """Run validation comparison across small, medium, and large configurations."""
    results = compare_configurations(CONTROLLED_CONFIGURATIONS)
    return json.dumps(results, indent=2)


if __name__ == "__main__":
    print(run_demo())
