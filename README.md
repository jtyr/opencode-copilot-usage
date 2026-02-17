# Copilot Usage Tool for OpenCode

Display GitHub Copilot usage quota information in OpenCode.

## Features

- **Flexible authentication**: Supports `GITHUB_TOKEN` environment variable or
  OpenCode's auth.json file
- **Smart auth detection**: Automatically detects and uses available GitHub
  Copilot authentication (public or enterprise)
- **Comprehensive logging**: All operations logged via OpenCode's logging system

## Requirements

- [OpenCode](http://opencode.ai)
- [GitHub Copilot subscription](https://github.com/features/copilot/plans)
- Valid GitHub authentication (via `GITHUB_TOKEN` or OpenCode auth)
- [Bun](https://bun.com/)

## Installation

Install the dependency and symlink the files to your global OpenCode config
directory:

```bash
# Dependencies
bun install
# Create directories
mkdir -p ~/.config/opencode/{commands,plugins,tools}
# Symlink files
ln -s $PWD/tools/copilot-usage.ts ~/.config/opencode/tools/
ln -s $PWD/plugins/copilot-usage.ts ~/.config/opencode/plugins/
# Public GitHub Copilot
ln -s $PWD/commands/public/copilot-usage.md ~/.config/opencode/commands/
# Enterprise GitHub Copilot
ln -s $PWD/commands/enterprise/copilot-usage.md ~/.config/opencode/commands/
```

## Usage

### Slash Commands

```text
/copilot-usage
```

This displays the quota information as formatted markdown text in the chat.

### Natural Language

You can also ask the AI to check your quota naturally:

```text
Call the copilot-usage tool and display its output as is.
```

The AI will automatically call the `copilot-usage` tool.

### Direct Tool Invocation

The AI can call the tool directly with custom parameters:

```json
{
  "authSource": "enterprise"
}
```

## Tool Parameters

### `authSource` (string, optional)

Preferred authentication source when both are available.

- **Options**: `"enterprise"` or `"public"`
- **Default**: `"public"` (if both available), otherwise uses what is available
- **Example**: `{"authSource": "enterprise"}` - Use enterprise auth

## Authentication

The tool supports two authentication methods (tried in order):

### 1. Environment Variable (Preferred)

Set the `GITHUB_TOKEN` environment variable:

```bash
export GITHUB_TOKEN=ghp_your_token_here
```

### 2. OpenCode Auth File (Fallback)

The tool automatically reads from `~/.local/share/opencode/auth.json` if
`GITHUB_TOKEN` is not set.

Supports both:

- `github-copilot-enterprise` (GitHub Enterprise)
- `github-copilot` (Public GitHub)

If both are present, defaults to `public` unless `authSource` parameter
specifies otherwise.

## Output Examples

### Formatted Text Output

```markdown
# Copilot Pro Usage

Premium requests: 150/200 (75.00%)
```

### Unlimited Plan

```markdown
# Copilot Enterprise Usage

Premium requests: unlimited
```

## Error Handling

```markdown
# Copilot Usage Error

Error: Authentication not found. Set GITHUB_TOKEN env var or authenticate with OpenCode
```

## Logging

All operations are logged via OpenCode's logging system with service name
`copilot-usage-tool`:

- **debug**: Tool execution details, API calls
- **info**: Successful operations, auth source selection
- **error**: Failures, exceptions

View logs in OpenCode's log viewer or check the logs directory.

## Troubleshooting

### "Authentication not found"

**Solution**: Set `GITHUB_TOKEN` environment variable or authenticate with
OpenCode.

```bash
export GITHUB_TOKEN=ghp_your_token_here
```

### "GitHub Copilot authentication not found in auth.json"

**Solution**: Authenticate with GitHub Copilot in OpenCode first, or use the
`GITHUB_TOKEN` environment variable.

### "Premium requests not available for this plan"

**Solution**: Your GitHub Copilot plan does not include premium requests
tracking. This tool requires a plan with premium interaction limits (Pro,
Business, or Enterprise).

### "HTTP 401: Unauthorized"

**Solution**: Your token is invalid or expired. Generate a new GitHub personal
access token or re-authenticate with OpenCode.

## File Structure

```text
copilot-usage/
├── commands/
│   ├── public/
│   │   └── copilot-usage.md  # /copilot-usage command for public GitHub
│   └── enterprise/
│       └── copilot-usage.md  # /copilot-usage command for enterprise GitHub
├── tools/
│   └── copilot-usage.ts      # Main tool implementation
├── plugins/
│   └── copilot-usage.ts      # Plugin (for future extensibility)
└── README.md                 # This file
```

## Author

Jiri Tyr

## License

MIT
