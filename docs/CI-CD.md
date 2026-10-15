# CI and release delivery

## Pull requests and branch builds

GitHub Actions runs on pull requests and pushes to `main`, `refactor/**`, and
`ci/**`. It can also be started manually. All actions are pinned to commit SHAs;
PR jobs have read-only repository permissions and receive no deployment secrets.

- **Quality:** clean `npm ci`, Prettier, JSDoc checking, original-source feature
  characterization, and negative type-contract checks on Node 24.
- **Regression:** all 23 current simulation, version, fuzz, and balance suites
  discovered from `test/`, on Node 18, 22, 24, and 26. Node 18 checks the declared
  game runtime minimum; use Node 24+ for development tooling. Each suite runs in
  its own process with a timeout and seed `123456789`; override `RIFT_TEST_SEED`
  locally to explore other scenarios. One seed is not exhaustive stochastic coverage.
- **Integration:** the existing two-captain network bot and six Chromium smoke
  checks (login/landing, jobs, market, departure/snapshots, fleet command toggling,
  and ship information). Servers use temporary saves, unused local ports, and no
  seeded personal accounts; they are stopped and saves removed after each lane.
  Historical Python screenshot scripts remain available for deeper manual checks;
  they are not all automated by this workflow.
- **Packaging:** only after all checks pass, build the existing split release
  ZIPs, check their CRCs and 28 MB limits, and compare every file against the exact
  committed Git tree. Extract all parts together and boot the extracted game
  without `npm install`. Upload the ZIPs plus `SHA256SUMS` as `release-zips`.

Logs and browser screenshots/results are retained as artifacts for seven days;
release-candidate artifacts are retained for fourteen days. No public GitHub
release is created by a PR or branch push. Configure branch protection to require
the stable **CI required** check after the workflow has run in the upstream repo.

## Running checks locally

Use Node 24+ and run:

```sh
npm ci
npm run format:check
npm run typecheck
npm run test:features
npm run test:types
npm run test:regression
npm run test:network
npx playwright install --with-deps chromium
npm run test:browser
```

The network runner needs Node 22+ for its built-in WebSocket client. Browser
tests use the pinned development-only Playwright dependency. Logs and screenshots
go under ignored `.artifacts/`; installing browsers is a development/CI step, not
a runtime dependency of the game.

`tools/package.sh` packages **committed HEAD**, not uncommitted working files, and
requires Git, Node, tar, and zip. This prevents `.git`, ignored local saves, and
dependencies from being swept into a release. Do not commit secrets or live saves.
For a local candidate after committing:

```sh
sh tools/package.sh /tmp
python3 tools/verify-package.py /tmp/out /tmp/quantum-rift-unpacked
RIFT_PACKAGE_ROOT="/tmp/quantum-rift-unpacked/Quantum Rift v2.6" npm run test:package
```

Replace `v2.6` with the committed package version. The verifier requires Python 3
(standard library only). A game ZIP needs only Node 18+ to run.

## Publishing a release

CD delivers downloadable GitHub release ZIPs, not a live-server deployment.

1. Merge the stack bottom-up into upstream `main`. Configure a GitHub environment
   named **release**, ideally with required maintainer reviewers and allowed
   workflow branches restricted to `main`. These are repository settings, not
   settings this PR changes. Without configured reviewers, the environment name
   alone does not introduce an approval gate.
2. Update `package.json` and its lockfile version together, merge, and push a
   version tag for that commit, for example `v2.6` for package version `2.6`.
3. From `main`, manually run **Release ZIPs** with that existing tag. The workflow
   verifies the version and that the tag's commit is contained in upstream `main`,
   then reruns the entire CI workflow for that immutable commit and builds its ZIPs.
4. Approve the `release` environment if reviewers are configured. The publish job
   checks archive hashes and rechecks that the tag still resolves to the tested
   commit, then creates the release with every ZIP part and `SHA256SUMS`.

Only the publish job has `contents: write`. It uses the built-in `GITHUB_TOKEN`,
not a personal access token. Publication is restricted to
`KnightMagnus/quantum-rift`; forks may run CI but cannot publish via this workflow.
Existing releases/assets are never overwritten. If publishing fails, inspect the
release and retained artifacts before retrying; an existing release causes a
retry to stop, requiring an explicit maintainer decision about recovery.

Download every part and extract into the same directory. Verify with
`sha256sum --check SHA256SUMS`. To roll back a local installation, keep a copy of
its saves and use the prior release; save compatibility must be checked before
opening newer saves in an older game. There is no automatic live rollout or save migration here.
