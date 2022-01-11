# Squeeth Frontend Contribution Guidelines

## Issues

- Check to see if your issue has been previously brought up, and if so add a comment to the existing issue
- Follow the issue templates for bugs or feature requests
- As much as possible, tie the issue back to the problem users are facing

## Branches

- Please create a feature / fix / documentation branch for what you’re working on
- Make a PR from your branch into the either the _master_ branch or a _staging_ branch.
  - Make PRs into _master_ for fixes and single features
  - Make PRs into the _staging_ branch for a bigger feature or set of fixes that need to be tested and then released all at once. Different features might have different staging branches. eg. "staging/strategies" and "staging/lp-nft-collateral"

## Commits

- Follow the [conventional commits](https://www.conventionalcommits.org/en/v1.0.0/) format

```
build: Changes that affect the build system or external dependencies (example scopes: gulp, broccoli, npm)

ci: Changes to our CI configuration files and scripts (example scopes: Travis, Circle, BrowserStack, SauceLabs)

docs: Documentation only changes

feat: A new feature

fix: A bug fix

perf: A code change that improves performance

refactor: A code change that neither fixes a bug nor adds a feature

style: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)

test: Adding missing tests or correcting existing tests
```

## PRs

- Each PR requires at least one review before it can be merged to master
- Follow the PR template when making PRs
- Link to the issue you are working on
