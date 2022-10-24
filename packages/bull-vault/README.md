# BULL VAULT

## Table of Contents

- [BULL VAULT](#bull-vault)
  - [Table of Contents](#table-of-contents)
  - [Local Development](#local-development)
  - [Audits](#audits)
  - [License](#license)

## Local Development

To install dependencies and compile contracts:

```bash
git clone https://github.com/opynfinance/squeeth-monorepo && cd packages/bull-vault
```

To install Foundry (assuming a Linux or macOS system):

```bash
curl -L https://foundry.paradigm.xyz | bash
```

This will download foundryup. To start Foundry, run:

```bash
foundryup
```

To install dependencies:

```
forge install
```

<!-- There are three Foundry profiles for running the test suites, which bypass the IR pipeline to speed up compilation. To run tests, run any of the following: -->

```bash
forge test # default profile with 200 fuzz runs
FOUNDRY_PROFILE=fuzz forge test # with 2000 fuzz runs
```

To run tests, you need to create `.env` file with the variables included in `.env.example`.

You may wish to include a `.env` file that `export`s a specific profile when developing locally.

The following modifiers are also available:

- Level 2 (-vv): Logs emitted during tests are also displayed.
- Level 3 (-vvv): Stack traces for failing tests are also displayed.
- Level 4 (-vvvv): Stack traces for all tests are displayed, and setup traces for failing tests are displayed.
- Level 5 (-vvvvv): Stack traces and setup traces are always displayed.

```bash
forge test  -vv
```

For more information on foundry testing and use, see [Foundry Book installation instructions](https://book.getfoundry.sh/getting-started/installation.html).

## Audits

## License
