<img align="right" src="https://www.speko.io/wp-content/uploads/2023/06/speko-blue-logo.png" width=150></img>

# SpaceLift Interface

This GitHub Action is an interface to Spacelift GraphQL (stacks, spaces). It also utilizes the `spacectl` cli tool as well. 

## IO

Input and output variables used by `action-spacelift`.

### Inputs

| Input          | Description                          | Required | Default                       |
|----------------|--------------------------------------|----------|-------------------------------|
| `command`      | Spacelift command.                   | Yes      |                               |
| `spacelift_url`| Spacelift organization.              | No       | `test.app.spacelift.io`       |
| `region`       | Region.                              | Yes      |                               |
| `env`          | Environment.                         | Yes      |                               |
| `integration-name` | Name of Spacelift cloud integration| Yes | |
| `service_name` | Service name.                        | Yes      |                               |
| `label_prefix` | Label prefix.                        | No       | `aws:services`                |
| `label_postfix`| Label postfix.                       | Yes      |                               |
| `github-token` | GitHub token.                        | No       | `${{ github.token }}`         |

## Build & Push

Here is how you can build locally:
```
pnpm install
pnpm run build
```

Then, you can just push this to Github.

## Usage

Here is an example of how to use this action in your workflow:

```yaml
name: Preview

on: [push]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          token: ${{ env.GITHUB_TOKEN }}
      
      - name: Run Spacelift Command
        uses: your-username/your-action@v1
        with:
          command: "preview --sha ${{ github.sha }}"
          region: "use1" # use short env name
          env: "dev"
          service_name: "service-name" # use short service name
          label_postfix: "service"
```
