# Applied Lab R59-T028: Server-Launch Configuration Validator & Secret Redaction

This applied lab extends **Using a Code Editor: Mastering VSCode.dev** (`8-code-editor/1-using-a-code-editor/README.md`) by implementing a deterministic server launch configuration validator and environment secret redaction utility.

## Concepts & Lesson Mapping

In modern code editors such as VS Code and VSCode.dev, launch configurations (`launch.json` / task definitions) specify how local development servers, linters, and debuggers run:
1. **Command Structure:** The executable command must be specified explicitly (e.g. `node`, `python3`).
2. **Argument Boundaries:** Arguments must be an array of discrete strings (`args: ["server.js", "--port", "3000"]`). Providing a single string (e.g. `"server.js --port 3000"`) bypasses shell argument parsing boundaries and can lead to command injection or runtime failure.
3. **Secret Redaction:** Environment variables passed to servers frequently contain sensitive tokens (`DB_PASSWORD`, `API_KEY`, `JWT_SECRET`). Configuration reports must redact all environment values (`"[REDACTED]"`) to prevent accidental credential leakage in logs or shared editor workspaces.
4. **No Process Launch:** Configuration inspection and static analysis must never spawn arbitrary external processes.

## Prerequisites
- Python 3.9+ standard library only (no third-party dependencies required).

## How to Run

### Run Demo
From the repository root:
```bash
python3 8-code-editor/1-using-a-code-editor/applied-labs/r59-t028/example.py
```

### Run Tests
From the repository root:
```bash
python3 -m unittest discover -s 8-code-editor/1-using-a-code-editor/applied-labs/r59-t028 -p "test_*.py" -v
```

## Input Fixtures

Three controlled configurations demonstrate scaling from minimal local serving to multi-secret environments:

1. **Configuration 1 (`CFG-SMALL`):**
   - Command: `python3`
   - Args: `["-m", "http.server", "8000"]` (3 arguments)
   - Environment: `{"PORT": "8000"}` (1 key)

2. **Configuration 2 (`CFG-MEDIUM`):**
   - Command: `node`
   - Args: `["server.js", "--env", "development", "--port", "3000"]` (5 arguments)
   - Environment: `{"NODE_ENV": "development", "PORT": "3000", "DB_PASSWORD": "supersecretpassword", "JWT_SECRET": "token-sign-key-xyz"}` (4 keys)

3. **Configuration 3 (`CFG-LARGE`):**
   - Command: `python3`
   - Args: `["manage.py", "runserver", "0.0.0.0:8000", "--noreload", "--nothreading", "--verbosity", "2"]` (7 arguments)
   - Environment: `{"DEBUG": "False", "DATABASE_URL": "...", "SECRET_KEY": "...", "REDIS_HOST": "...", "API_KEY": "...", "AWS_SECRET_ACCESS_KEY": "..."}` (6 keys)

## Expected Output

Running `run_demo()` produces the following JSON summary:

```json
[
  {
    "config_id": "CFG-SMALL",
    "valid": true,
    "arg_count": 3,
    "env_key_count": 1,
    "redaction_rate_percent": 100.0,
    "process_launched": false,
    "redacted_summary": {
      "command": "python3",
      "args": [
        "-m",
        "http.server",
        "8000"
      ],
      "env": {
        "PORT": "[REDACTED]"
      }
    }
  },
  {
    "config_id": "CFG-MEDIUM",
    "valid": true,
    "arg_count": 5,
    "env_key_count": 4,
    "redaction_rate_percent": 100.0,
    "process_launched": false,
    "redacted_summary": {
      "command": "node",
      "args": [
        "server.js",
        "--env",
        "development",
        "--port",
        "3000"
      ],
      "env": {
        "NODE_ENV": "[REDACTED]",
        "PORT": "[REDACTED]",
        "DB_PASSWORD": "[REDACTED]",
        "JWT_SECRET": "[REDACTED]"
      }
    }
  },
  {
    "config_id": "CFG-LARGE",
    "valid": true,
    "arg_count": 7,
    "env_key_count": 6,
    "redaction_rate_percent": 100.0,
    "process_launched": false,
    "redacted_summary": {
      "command": "python3",
      "args": [
        "manage.py",
        "runserver",
        "0.0.0.0:8000",
        "--noreload",
        "--nothreading",
        "--verbosity",
        "2"
      ],
      "env": {
        "DEBUG": "[REDACTED]",
        "DATABASE_URL": "[REDACTED]",
        "SECRET_KEY": "[REDACTED]",
        "REDIS_HOST": "[REDACTED]",
        "API_KEY": "[REDACTED]",
        "AWS_SECRET_ACCESS_KEY": "[REDACTED]"
      }
    }
  }
]
```

## Scope and Limitations
- **Simulation / Sandbox Guard:** This lab simulates launch configuration validation and secret redaction. It deliberately does not spawn OS processes or bind to local ports (`process_launched: false`).
- **Secret Detection Boundary:** All environment dictionary values are redacted uniformly (`"[REDACTED]"`). Real-world editor credential scanners may differentiate between benign config flags and sensitive credentials.
- No network requests, cloud services, or external ML models are required.
