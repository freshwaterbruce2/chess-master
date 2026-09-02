# Chess Master Standalone Foundation Plan

## Objective

Establish `C:\projects\chess-master` as the independent foundation for the
Chess Master Android app, extracted from
`C:\projects\vibe-tech-monorepo\apps\vibe-chess` without changing or deleting
the monorepo source. The first phase ends when the standalone project no longer
depends on Nx, workspace-relative tools, or `workspace:*` packages and passes
its local typecheck, validators, and production web build.

## Context

- Product name: **Chess Master**. The old display name is ChessMaster Academy.
- GitHub destination supplied by Bruce:
  `https://github.com/freshwaterbruce2/chess-master.git`. Publishing or pushing
  is not part of this phase.
- Android identity is currently `com.chess.tutor`, versionName `1.0`, and
  versionCode `1`. Preserve that package ID during extraction; any package-ID
  change is a separate pre-Play decision.
- Current source authority for extraction is the local monorepo app and its
  resolved Nx configuration. The supplied GitHub repository was not available
  through anonymous web inspection.
- The only monorepo source dependency is `@vibetech/games/chess`. Vendor only
  its Chess-specific source closure into this standalone project.
- Preserve app behavior. This phase does not redesign gameplay, change the
  package ID, call providers, use a device, create a signed artifact, or touch
  Play Console.
- Do not use Git. Do not copy dependency folders, build output, environment
  files, credentials, logs, databases, or signing material.
- Baseline Nx typecheck was attempted on 2026-08-25 but did not reach the app:
  the shared `@vibetech/games:build` task could not resolve `tsc`. Record this
  as a local toolchain failure, not a Chess Master product failure.

## Checklist

- [x] Create and verify a timestamped, secret-safe pre-extraction snapshot.
- [x] Copy the app-owned source, Android project, backend, scripts, and configs
  into `C:\projects\chess-master`, excluding generated/private state.
- [x] Vendor the `packages/games/src/chess` dependency and the exact three-file
  3D-board closure required by the active Chess UI.
- [x] Replace Nx/workspace-relative scripts and configuration with standalone
  package-local paths.
- [x] Rename the user-visible product to Chess Master while preserving
  `com.chess.tutor` for this phase.
- [x] Install standalone dependencies after separate approval and generate an
  independent `pnpm-lock.yaml` using pnpm 11.19.0.
- [x] Run standalone typecheck, lesson validator, Chess-AI validator, and
  production build using already-present tooling where possible.
- [x] Produce a foundation handoff separating Confirmed, Partial, Blocked, and
  Untested results.

## Decisions

- 2026-08-25: Use `C:\projects\chess-master` as the standalone directory and
  **Chess Master** as the product/display name.
- 2026-08-25: Manual extraction is required. An Nx generator would create a new
  monorepo project and would not satisfy the independence objective.
- 2026-08-25: Keep `com.chess.tutor` unchanged during extraction to avoid
  silently changing Android application identity.
- 2026-08-25: Keep the app-local Gemini proxy but do not copy or use provider
  credentials and do not make live provider calls.

## Verification

- Confirm no `workspace:*`, Nx-root path, or monorepo-relative runtime/build
  dependency remains in production configuration.
- Confirm source and vendored Chess dependency manifests match the extraction
  allowlist.
- Run package-local typecheck, both validators, and production web build.
- Inspect Android package/display/version values after extraction.

### 2026-08-25 results

- **Confirmed:** Snapshot
  `C:\projects\_vibe-snapshots\chess-master-preextract-20260825-041630`
  contains 99 files / 4,171,926 bytes, zero forbidden artifacts, manifest
  SHA-256
  `10B246A92E309DBF1074E25FBC285CC1E6E29B6232DF2C05AE801994F773FEFB`.
- **Confirmed:** All 83 expected app files are present; the Nx-only
  `project.json`, four device-evidence screenshots, dependency/build state,
  credentials, signing material, logs, and databases were not extracted.
- **Confirmed:** All 11 vendored Chess files match the snapshot byte-for-byte.
  The three active 3D-board files match their monorepo sources byte-for-byte.
- **Confirmed:** No production `workspace:*`, `@vibetech/games`, Nx-root, or
  monorepo-relative path coupling remains. The local dependency is
  `@chess-master/games: file:packages/games`.
- **Confirmed:** Android remains `com.chess.tutor`, versionCode `1`,
  versionName `1.0`; the user-visible name is Chess Master.
- **Confirmed:** Direct local TypeScript gate passed with `tsc --noEmit`.
- **Confirmed:** Lesson validator passed 14 lessons and 6 puzzles.
- **Confirmed:** Chess-AI legality, determinism, and speed validator passed all
  four positions.
- **Confirmed:** Vite production build passed, transforming 2,453 modules and
  emitting the active `ChessBoard3D` chunk.
- **Untested/held:** Android sync, Gradle APK/AAB builds, signing, emulator or
  physical-device behavior, live Gemini provider behavior, Git/GitHub
  publication, and Play Console actions.

## Status

**Standalone foundation complete.** `C:\projects\chess-master` is the new local
development foundation. Start a new task for the next single bounded unit.
Recommended next gate: decide the permanent Android application ID and release
identity before any Play artifact is created. Git/GitHub publication and every
external/device/release action remain separately held.

## Current bounded unit — permanent Android identity (2026-08-25)

### Objective and frozen scope

Decide and establish the permanent pre-Play Android identity without changing
gameplay, UI behavior, the 3D chessboard, dependencies, or provider behavior.

- Permanent application ID and Java namespace: `com.vibetech.chessmaster`.
- Product/display name: `Chess Master`.
- Initial Android release identity: `versionCode 1`, `versionName 1.0.0`.
- Version policy: every published update must increase `versionCode`; use
  semantic `major.minor.patch` text for `versionName`.
- Held/non-goals: Git/GitHub, providers, devices/ADB, signing material, signed
  artifacts, Play Console, dependency changes, feature work, and redesign.

The `com.vibetech` namespace keeps Chess Master aligned with the established
Vibe Tech Android product family, while `chessmaster` gives this independently
installed app a product-specific, stable identity. The legacy
`com.chess.tutor` value is pre-release extraction state and is intentionally not
retained as the permanent identifier.

### Task contract

- Allowed writes: this plan; `capacitor.config.ts`; `package.json` Android
  launch metadata; Android app Gradle identity/version fields; Android identity
  resources; Java package paths/declarations; package-sensitive Android tests;
  and a secret-safe snapshot plus manifest under `C:\projects\_vibe-snapshots`.
- Before source edits, create and verify a timestamped snapshot excluding
  dependencies, build output, logs, databases, environment files, credentials,
  and signing material.
- Success requires no active `com.chess.tutor` references outside historical
  plan text, exact agreement among Capacitor/Gradle/resources/Java/launch
  metadata, passing local typecheck/validators/web production build, and an
  unsigned local Android build if the already-present toolchain permits it.
- Preserve the active 3D board: do not edit its source; verify the production
  build still emits the `ChessBoard3D` chunk.

### Checklist

- [x] Create and verify the required secret-safe pre-identity snapshot.
- [x] Apply `com.vibetech.chessmaster` consistently and move Java/test package
  paths to match.
- [x] Establish `versionCode 1` / `versionName 1.0.0` and retain `Chess Master`.
- [x] Verify identity consistency and absence of active legacy references.
- [x] Run focused local gates, then record Confirmed/Partial/Blocked/Untested.

### Current status

**Bounded identity unit complete.** The permanent source identity is established
and locally verified. All device, signing, provider, Git/GitHub, release-artifact,
and Play actions remain held.

### 2026-08-25 identity results

- **Fixed:** Capacitor app ID, Gradle namespace/application ID, Android package
  resources/custom scheme, `MainActivity`, Android test packages, and the local
  launch script now agree on `com.vibetech.chessmaster`. Java source/test paths
  were moved to match. Android release identity is `versionCode 1` /
  `versionName 1.0.0`; display name remains `Chess Master`.
- **Confirmed:** Pre-edit snapshot
  `C:\projects\_vibe-snapshots\chess-master-preidentity-20260825-070431`
  contains 101 files / 2,647,911 bytes, zero forbidden artifacts, and manifest
  SHA-256
  `0B5F2F7D170C1533C05071E6255C4B15F0578172F078C5BE790F18BD26C54E94`.
  Post-edit comparison found only the four expected content edits and three
  expected Java package-path moves.
- **Confirmed:** Direct TypeScript typecheck passed; the lesson validator passed
  14 lessons and 6 puzzles; the Chess-AI validator passed all four positions;
  and the Vite production build passed with 2,453 modules and emitted
  `ChessBoard3D-DEuOO1l3.js`.
- **Confirmed:** Active source/config contains no `com.chess.tutor` or
  `ChessMaster Academy`; remaining mentions are historical facts in this plan.
  Old Java package paths are absent.
- **Partial:** The normal sandbox could not read parts of the already-installed
  pnpm dependency tree because of existing ACL/package-manager state. The four
  local gates above passed with elevated read access and no dependency install.
- **Blocked:** A compliant unsigned Android debug build was not obtained. The
  Gradle wrapper unexpectedly began a Gradle 8.14.3 distribution download even
  when invoked with `--offline`; the attempt was stopped, not repeated, and
  produced no APK. No cleanup of any possible Gradle cache was authorized.
- **Untested/held:** Android runtime behavior, installs/ADB/devices, signing,
  release artifacts, providers, Git/GitHub, and Play Console.

## Current bounded unit — local Android debug build (2026-08-25)

### Objective and frozen scope

Confirm whether the permanent Android identity can produce one compliant local
debug APK using the checked-in Gradle wrapper and current source.

- Authorized action: allow the wrapper to download its declared Gradle 8.14.3
  distribution if required, then run one non-clean `assembleDebug` invocation.
- Allowed writes: this plan plus ordinary Gradle wrapper/cache and Android debug
  build outputs created by that single invocation.
- No application-source or configuration edits are authorized. A new source
  snapshot is therefore not required for this build-only gate.
- Held/non-goals: cache cleanup, `clean`, repeated Gradle invocations, dependency
  or source changes, ADB/devices, signing-material access, release artifacts,
  providers, Git/GitHub, Play Console, and deployment.

### Success criteria and verification

- The single `assembleDebug` invocation exits successfully and produces the
  expected local debug APK.
- Inspect the APK locally without installing it. Confirm its SHA-256, byte size,
  package ID `com.vibetech.chessmaster`, `versionCode 1`, `versionName 1.0.0`,
  and debug/non-release signing state using already-present local tooling.
- Record Fixed, Confirmed, Partial, Blocked, and Untested separately. Stop after
  inspection regardless of result; do not broaden the gate to fix failures.

### Checklist

- [x] Delegate the frozen build-only contract to the project-scoped Terra
  executor.
- [x] Run exactly one non-clean `assembleDebug` invocation.
- [x] Inspect locally for any produced APK without ADB or installation.
- [x] Record the result and stop.

### Current status

**Complete with blocker.** Bruce approved this exact build-only gate on
2026-08-25. The one allowed Gradle invocation failed during configuration; no
APK was produced. No source edits, cleanup, device action, release action, or
external publication occurred.

### 2026-08-25 local Android debug-build results

- **Fixed:** None; this gate authorized build and inspection only.
- **Confirmed:** Terra ran exactly one non-clean
  `.\gradlew.bat assembleDebug --no-daemon --console=plain` invocation from
  `C:\projects\chess-master\android`. It exited 1 after 1 minute 6 seconds.
  No repeated Gradle invocation or `clean` was run.
- **Confirmed:** Gradle failed while evaluating
  `android\app\capacitor.build.gradle` line 10 because generated file
  `android\capacitor-cordova-android-plugins\cordova.variables.gradle` does not
  exist. Sol independently confirmed both the apply statement and missing file.
- **Confirmed:** A recursive local APK search returned no artifact. Gradle wrote
  `android\build\reports\problems\problems-report.html`; no source or
  configuration file was edited.
- **Partial:** APK inspection was attempted but package ID, version, SHA-256,
  byte size, and debug/non-release signing state cannot be inspected without an
  APK.
- **Blocked:** A compliant local Android debug APK remains blocked on restoring
  the generated Capacitor Cordova Android plugin files through a separately
  scoped and approved action. Do not infer that `cap sync android` or another
  command is authorized by this result.
- **Untested/held:** APK metadata and signing state, Android runtime,
  installs/ADB/devices, signing material, release artifacts, providers,
  Git/GitHub, Play Console, and deployment.

## Current bounded unit — Capacitor Android generated-file restoration (2026-08-25)

### Objective and frozen scope

Restore and verify the checked-in/generated Capacitor Android project state
required by the local debug build, without running Gradle or broadening into a
build, device, provider, release, or publication action.

- Before generated-file changes, create and verify a new timestamped,
  secret-safe snapshot under `C:\projects\_vibe-snapshots`.
- Snapshot exclusions: dependencies, build output, Gradle caches, logs,
  databases, environment files, credentials, signing material,
  `local.properties`, and `google-services.json`.
- Authorized mutation: run the already-installed `pnpm run android:sync`
  command exactly once and retain only its ordinary generated Android changes.
- Allowed writes: this plan, the new snapshot and manifest, and generated files
  under `android` changed by that one Capacitor sync.
- Held/non-goals: Gradle invocations, cleanup, dependency or tooling
  installation/download, manual application-source edits, gameplay/UI/3D-board
  changes, ADB/devices, signing, APK/AAB or release work, providers, Git/GitHub,
  Play Console, and deployment.

### Success criteria and verification

- The snapshot contains the complete allowed pre-sync project state, has zero
  forbidden artifacts, and records file count, byte count, and manifest
  SHA-256.
- The single Capacitor sync exits successfully without installing or downloading
  dependencies or tooling.
- `android\capacitor-cordova-android-plugins\cordova.variables.gradle` exists
  afterward and generated-state changes are limited to expected Android files.
- Permanent identity remains `com.vibetech.chessmaster`, product name remains
  `Chess Master`, and release identity remains `versionCode 1` /
  `versionName 1.0.0`.
- Record Fixed, Confirmed, Partial, Blocked, and Untested separately, then stop.
  A Gradle retry is a separate approval gate.

### Checklist

- [x] Delegate the frozen restoration contract to the project-scoped Terra
  executor.
- [x] Create and verify the required pre-sync secret-safe snapshot.
- [x] Run exactly one already-installed Capacitor Android sync attempt.
- [x] Compare pre/post allowed state and verify generated file plus identity.
- [x] Record the result and stop without Gradle.

### Current status

**Complete.** The package-script attempt stopped safely before mutation, then
Bruce manually ran the separately proposed already-installed Capacitor CLI
directly from the project root. That direct sync completed successfully and its
generated Android footprint was independently verified. No Gradle retry or
downstream action is authorized.

### 2026-08-25 generated-file restoration results

- **Fixed:** None; Capacitor generation did not begin.
- **Confirmed:** Pre-sync snapshot
  `C:\projects\_vibe-snapshots\chess-master-presync-20260825-072844`
  contains 101 allowed files / 2,655,795 bytes, zero forbidden artifacts, and
  manifest SHA-256
  `B1405C03BC4A4E66E698D6451ED2733F10078B4E0561AA24863D6DDBEDEF9E45`.
  Sol independently verified the count, byte sum, hash, and that all manifest
  entries remained unchanged after the attempt.
- **Confirmed:** The already-installed local Capacitor CLI exists at
  `node_modules\.bin\cap.cmd` and under `node_modules\@capacitor\cli`.
- **Confirmed:** Terra ran `pnpm run android:sync` exactly once. It exited 1 in
  2.348 seconds with `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` after pnpm
  initiated an `install` prerequisite. No install/download or module-directory
  removal completed, and the Capacitor sync phase did not execute.
- **Confirmed:** Pre/post comparison found no added, modified, or removed
  allowed project files. Permanent package, display, and version identity still
  match the completed identity unit. No Gradle command was run.
- **Partial:** Generated-file restoration was attempted but did not reach
  Capacitor; `android\capacitor-cordova-android-plugins\cordova.variables.gradle`
  remains absent.
- **Blocked:** The package-script route is blocked because pnpm attempts a
  dependency-install/module-directory prerequisite that this gate expressly
  prohibited. Invoking the already-installed Capacitor CLI directly, permitting
  pnpm installation/purge behavior, or choosing another repair is a separate
  approval decision.
- **Untested/held:** Successful Capacitor generation, another Gradle build, APK
  production/metadata/signing, Android runtime, installs/ADB/devices, signing
  material, release artifacts, providers, Git/GitHub, Play Console, and
  deployment.

### 2026-08-25 user-run direct Capacitor sync completion

- **Fixed:** Bruce ran
  `node node_modules/@capacitor/cli/bin/capacitor sync android` from
  `C:\projects\chess-master`. His terminal reported successful copy/update and
  `Sync finished in 0.284s`. The previously missing generated file
  `android\capacitor-cordova-android-plugins\cordova.variables.gradle` now
  exists with the expected generated Cordova/SDK variables.
- **Confirmed:** Read-only comparison against snapshot
  `chess-master-presync-20260825-072844` found 25 added generated Android files,
  two modified Capacitor integration files, and zero removed files. The only
  other modified allowed file was this Sol-owned plan.
- **Confirmed:** Added outputs are generated `capacitor.config.json`, empty
  `capacitor.plugins.json`, copied web/Cordova assets, `res/xml/config.xml`, and
  the Cordova Android plugin scaffold. Modified Android files are
  `android\app\capacitor.build.gradle` and
  `android\capacitor.settings.gradle`. No unexpected allowed-state change was
  found.
- **Confirmed:** Generated web assets include the active
  `ChessBoard3D-DEuOO1l3.js` bundle. Generated Capacitor configuration retains
  app ID `com.vibetech.chessmaster`, app name `Chess Master`, and `webDir`
  `dist`. Active Gradle/resources/Java/tests/launch metadata retain the permanent
  package and `versionCode 1` / `versionName 1.0.0`; no active legacy identity
  was found.
- **Partial:** The successful command and 0.284-second timing are direct
  user-observed terminal evidence; Sol/Terra did not replay the mutation.
- **Blocked:** None for generated-file restoration. The prior debug-build
  blocker is cleared at its missing-file prerequisite only; build success is
  not yet established.
- **Untested/held:** Another Gradle invocation, APK production/metadata/signing,
  Android runtime, installs/ADB/devices, signing material, release artifacts,
  providers, Git/GitHub, Play Console, and deployment.

## Current bounded unit — post-sync Android debug build (2026-08-25)

### Objective and frozen scope

Run one new non-clean debug build after the verified Capacitor sync and inspect
any resulting local APK without installation or external action.

- Authorized command: exactly one
  `.\gradlew.bat assembleDebug --offline --no-daemon --console=plain`
  invocation from
  `C:\projects\chess-master\android`.
- Allowed writes: this plan plus ordinary Gradle cache/report/debug-build output
  created by that invocation.
- No source/configuration edit is authorized, so no new source snapshot is
  required. The verified pre-sync snapshot remains recovery evidence for the
  preceding generated-state mutation.
- Held/non-goals: `clean`, repeated Gradle invocations, source or dependency
  changes, any install/download,
  ADB/devices, signing-material access, release artifacts, providers,
  Git/GitHub, Play Console, and deployment.

### Success criteria and verification

- The single build exits successfully and produces the expected debug APK.
- Inspect locally without installation: exact path, byte size, SHA-256, package
  ID `com.vibetech.chessmaster`, `versionCode 1`, `versionName 1.0.0`, SDK
  metadata, and debug/non-release signing state using already-present SDK tools.
- Confirm the packaged artifact contains the synchronized web application and
  active `ChessBoard3D` asset without extracting or modifying source state.
- Record Fixed, Confirmed, Partial, Blocked, and Untested, then stop regardless
  of result. Do not repair a new failure within this gate.

### Checklist

- [x] Delegate the frozen build/inspection contract to project-scoped Terra.
- [x] Run exactly one non-clean `assembleDebug` invocation.
- [x] Inspect locally for any resulting APK without ADB or installation.
- [x] Record the result and stop.

### Current status

**Complete with ACL blocker.** Bruce authorized continuation on 2026-08-25.
The one offline build invocation failed because the normal execution context
cannot read an existing Capacitor Android Gradle file. No APK was produced. No
downstream device, signing, release, publication, or deployment action is
authorized.

### 2026-08-25 post-sync Android debug-build results

- **Fixed:** None; this gate authorized one build and inspection only.
- **Confirmed:** Terra ran exactly one
  `.\gradlew.bat assembleDebug --offline --no-daemon --console=plain`
  invocation from `C:\projects\chess-master\android`. It exited 1 after 51
  seconds. Offline mode prevented dependency/tooling downloads. No `clean` or
  retry occurred.
- **Confirmed:** Gradle failed while configuring `:capacitor-android`, reporting
  that it could not read
  `node_modules\@capacitor\android\capacitor\build.gradle` as it did not exist.
  Sol independently confirmed the file actually exists, is 4,039 bytes, and
  has an August 14, 2026 timestamp; normal-context `Get-Content` and direct file
  ACL inspection both return `Access is denied`.
- **Confirmed:** The accurate blocker is normal sandbox/ACL readability of
  already-present dependency files, not absence of the `@capacitor/android`
  package. A recursive APK search returned no artifact.
- **Partial:** Artifact discovery completed, but package/version/SDK/debuggable,
  signing, SHA-256, size, and packaged-asset inspection cannot occur without an
  APK.
- **Blocked:** A compliant debug build requires a separately authorized route
  that can read the existing dependency tree, such as one elevated offline
  Gradle invocation. No ACL mutation, dependency reinstall, or elevated retry
  is authorized by this gate.
- **Untested/held:** Compilation, APK production and metadata/signing/content,
  Android runtime, installs/ADB/devices, signing material, release artifacts,
  providers, Git/GitHub, Play Console, and deployment.

## Current bounded unit — clean-exit offline Android debug build (2026-08-27)

### Objective and frozen scope

Recoverably preserve the stale Gradle problems report, then run one elevated
offline non-clean debug build and require an exit-code-zero result before any
phone action.

- Exact report source:
  `android\build\reports\problems\problems-report.html`.
- Authorized recoverable action: move that one existing generated report to a
  timestamped sibling named
  `problems-report.pre-clean-exit-YYYYMMDD-HHMMSS.html`. Do not delete or
  overwrite either file; verify the source and destination first.
- Authorized build command: exactly one elevated
  `.\gradlew.bat assembleDebug --offline --no-daemon --console=plain`
  invocation from `C:\projects\chess-master\android`.
- Allowed writes: this plan, the one renamed report, ordinary Gradle
  cache/report/debug-build outputs, and the resulting debug APK.
- No source/configuration/dependency edit is authorized; no new source snapshot
  is required for this generated-output/build-only gate.
- Held/non-goals: `clean`, retry, deletion, broader move/cleanup, downloads,
  manual ACL changes, ADB/device access despite the connected A54, installation,
  signing-material access, release artifacts, providers, Git/GitHub, Play
  Console, and deployment.

### Success criteria and verification

- The old report is preserved under the unique backup name and Gradle creates
  any new report without collision.
- The single offline build exits zero and produces the debug APK.
- Reinspect locally without installation: APK path, bytes, SHA-256, permanent
  identity/version/SDK/debug state, debug certificate, generated Capacitor
  configuration, and active `ChessBoard3D` asset.
- Record Fixed, Confirmed, Partial, Blocked, and Untested, then stop. Phone
  identity/install/runtime acceptance is a separate gate.

### Checklist

- [x] Delegate the recoverable report/build/inspection contract to Terra.
- [ ] Verify and move only the stale problems report to a timestamped sibling —
  **Blocked:** Windows returned `Access is denied` normally and elevated.
- [ ] Run exactly one elevated offline non-clean build invocation.
- [ ] Inspect the resulting APK locally.
- [x] Record the blocked result and stop without ADB or device access.

### Current status

**Blocked before Gradle.** Bruce agreed to the recommended clean-exit gate on
2026-08-27 and reported the A54 connected. Windows denied the required
recoverable move both normally and elevated, so Gradle was not invoked. The
phone remained out of scope and untouched.

### 2026-08-27 clean-exit gate results

- **Fixed:** None.
- **Confirmed:** Terra resolved the source exactly as
  `android\build\reports\problems\problems-report.html`, confirmed it is a
  130,691-byte file under the intended reports directory, and verified unused
  sibling destination
  `problems-report.pre-clean-exit-20260827-040549.html` before acting.
- **Confirmed:** The authorized `Move-Item -LiteralPath` operation returned
  `Access to the path is denied` normally and again with approved elevation.
  No alternate rename, copy/delete, ACL change, overwrite, or cleanup was
  attempted. Sol independently confirmed the source remains intact and the
  destination remains absent.
- **Confirmed:** Required ordering was preserved: Gradle invocation count was
  zero after the move prerequisite failed. No ADB/device action occurred. The
  prior valid APK remains unchanged at 6,672,749 bytes with SHA-256
  `CC680564F58D00B6601725A099384CB0B9159FE39E500F76A5D69CD910C95C09`
  and its original 2026-08-26 timestamp.
- **Partial:** The stale report was precisely validated and a unique recovery
  destination was reserved, but preservation could not complete.
- **Blocked:** Windows access control prevents moving the report even through
  the approved elevated route. Any copy-then-delete, ACL repair, alternate
  shell/owner action, build without preservation, or other treatment requires a
  separately frozen and authorized gate.
- **Untested/held:** Clean offline Gradle exit, fresh report regeneration, new
  APK production/inspection, A54 identity, installation, launch, gameplay/UI,
  runtime/device acceptance, release signing/artifacts, providers, Git/GitHub,
  Play Console, and deployment.

## Current bounded unit — online Android dependency resolution and debug build (2026-08-26)

### Objective and frozen scope

Run one elevated non-clean Android debug build with network resolution enabled
only for the project's declared Gradle/Maven build dependencies, then inspect
any resulting APK locally.

- Authorized command: exactly one elevated
  `.\gradlew.bat assembleDebug --no-daemon --console=plain` invocation from
  `C:\projects\chess-master\android`.
- Authorized network activity: Gradle may resolve and cache only dependencies
  declared by the current Android project and their transitive build artifacts
  from the repositories already configured in the project/Gradle environment.
- This does not authorize provider API use, credentials, Google Services app
  configuration, arbitrary tooling installation, source/dependency declaration
  changes, or a second build attempt.
- Allowed writes: this plan, ordinary Gradle dependency caches, reports, and
  debug-build outputs produced by that one invocation.
- No source/configuration edit is authorized; no new source snapshot is needed
  for this dependency/build-only gate.
- Held/non-goals: `clean`, retry, manual cache or ACL changes, ADB/devices,
  signing-material access, release artifacts, providers, Git/GitHub, Play
  Console, and deployment.

### Success criteria and verification

- The single build resolves its declared build dependencies, exits successfully,
  and produces the local debug APK.
- Inspect without installation: exact path, byte size, SHA-256, application ID,
  versionCode/versionName, min/target SDK, debuggable state, signer certificate
  summary from the APK, generated Capacitor configuration, and active
  `ChessBoard3D` asset.
- Record Fixed, Confirmed, Partial, Blocked, and Untested, then stop. Do not fix
  a new failure or perform downstream actions within this gate.

### Checklist

- [x] Delegate the online dependency/build/inspection contract to Terra.
- [x] Run exactly one elevated non-clean online `assembleDebug` invocation.
- [x] Inspect the resulting APK locally without ADB or installation.
- [x] Record the result and stop.

### Current status

**Complete with valid APK and report-file blocker.** Bruce approved this exact
online dependency and debug-build gate on 2026-08-26. Android compile, debug
signing validation, packaging, and `assembleDebug` completed and produced a
valid inspected APK. Gradle nevertheless exited 1 afterward because it could
not replace an existing problems-report HTML file. No downstream action is
authorized.

### 2026-08-26 online build and APK inspection results

- **Fixed:** The previously uncached declared Android build dependencies,
  including `com.google.gms:google-services:4.4.4`, resolved sufficiently for
  Gradle to configure all three Android projects, compile Java, validate debug
  signing, package, and complete `:app:assembleDebug`.
- **Confirmed:** Terra ran exactly one elevated
  `.\gradlew.bat assembleDebug --no-daemon --console=plain` invocation. Gradle
  reported 1 minute 55 seconds and 93 actionable tasks. No `clean`, retry,
  source/config/dependency declaration edit, manual cache/ACL change, device,
  release, provider, Git, Play Console, or deployment action occurred.
- **Confirmed:** Valid debug APK
  `android\app\build\outputs\apk\debug\app-debug.apk` is 6,672,749 bytes with
  SHA-256
  `CC680564F58D00B6601725A099384CB0B9159FE39E500F76A5D69CD910C95C09`.
  Sol independently rechecked the file, size, and hash.
- **Confirmed:** APK inspection reports application ID
  `com.vibetech.chessmaster`, `versionCode 1`, `versionName 1.0.0`, min SDK 24,
  target/compile SDK 36, app label `Chess Master`, launch activity
  `com.vibetech.chessmaster.MainActivity`, and `android:debuggable=true`.
- **Confirmed:** APK Signature Scheme v2 verification passed with one RSA-2048
  signer certificate `C=US, O=Android, CN=Android Debug`, certificate SHA-256
  `9e8781688c9acc1c3c62508f83ad935ac0e058c14b7665bdd0cc6a9e3e947905`.
  Only APK certificate metadata was inspected; no private signing material was
  accessed.
- **Confirmed:** The archive contains `assets/capacitor.config.json` with app ID
  `com.vibetech.chessmaster`, app name `Chess Master`, and `webDir` `dist`, plus
  `assets/public/assets/ChessBoard3D-DEuOO1l3.js` (20,102 bytes).
- **Partial:** The APK is valid and `:app:assembleDebug` completed, but the
  overall Gradle process exited 1 after packaging because moving a temporary
  problems report onto existing
  `android\build\reports\problems\problems-report.html` raised
  `FileAlreadyExistsException`. The existing report is 130,691 bytes and dates
  from 2026-08-25.
- **Blocked:** A clean exit-code-zero Gradle gate remains blocked on a separately
  authorized recoverable treatment of the stale problems-report output followed
  by one offline retry. Do not delete, move, replace, or rebuild automatically.
- **Untested/held:** APK installation, launch, gameplay/UI/runtime behavior,
  physical-device acceptance, release signing/artifacts, providers, Git/GitHub,
  Play Console, and deployment.

## Current bounded unit — elevated offline Android debug build (2026-08-25)

### Objective and frozen scope

Run one elevated but offline non-clean debug build solely to bypass normal
sandbox read restrictions on the already-present dependency tree, then inspect
any resulting APK locally.

- Authorized command: exactly one elevated
  `.\gradlew.bat assembleDebug --offline --no-daemon --console=plain`
  invocation from `C:\projects\chess-master\android`.
- Elevation is authorized only for read access to existing dependencies and
  ordinary Gradle cache/report/debug-build outputs. It does not authorize ACL
  changes, dependency installation, downloads, or unrelated privileged action.
- No source/configuration edit is authorized; no new source snapshot is needed
  for this build-only gate.
- Held/non-goals: `clean`, repeated Gradle invocations, ACL mutation, source or
  dependency changes, installs/downloads, ADB/devices, signing-material access,
  release artifacts, providers, Git/GitHub, Play Console, and deployment.

### Success criteria and verification

- The single elevated offline build exits successfully and produces the local
  debug APK.
- Inspect locally without installation: path, bytes, SHA-256, application ID,
  versionCode/versionName, min/target SDK, debuggable state, signer certificate
  summary, and packaged Capacitor/ChessBoard3D assets.
- Record Fixed, Confirmed, Partial, Blocked, and Untested, then stop. Do not fix
  a new build failure or perform a downstream action within this gate.

### Checklist

- [x] Delegate the elevated build/inspection contract to project-scoped Terra.
- [x] Run exactly one elevated offline non-clean Gradle invocation.
- [x] Inspect locally for any resulting APK without ADB or installation.
- [x] Record the result and stop.

### Current status

**Complete with wrapper-distribution blocker.** Bruce authorized continuation
from the foundation plan on 2026-08-25. The one elevated invocation was stopped
when the wrapper performed an unauthorized pre-Gradle download. No APK was
produced. No ACL modification or downstream action is authorized.

### 2026-08-25 elevated offline build results

- **Fixed:** None; Gradle did not reach project configuration or compilation.
- **Confirmed:** Terra requested and received elevation only for the authorized
  command, then ran exactly one
  `.\gradlew.bat assembleDebug --offline --no-daemon --console=plain`
  invocation. The wrapper began downloading Gradle 8.14.3 before Gradle could
  process `--offline`; progress reached 100%, so Terra interrupted the same
  invocation and did not retry.
- **Confirmed:** No `clean`, ACL change, source/config/dependency edit, ADB,
  device, signing, release, Git, publication, or deployment action occurred. A
  recursive APK search returned no artifact.
- **Partial:** Read-only cache inspection found the 224,584,249-byte
  `gradle-8.14.3-all.zip` and extracted `gradle-8.14.3` directory under
  `C:\Users\fresh\.gradle\wrapper\dists`, but no wrapper `.ok` completion
  marker. A zero-byte `.lck` file remains. Treat this distribution as incomplete
  rather than confirmed reusable.
- **Blocked:** The wrapper prerequisite occurs before Gradle offline handling
  and conflicts with this gate's no-download contract. A future unit must
  explicitly authorize the wrapper distribution to complete/validate or provide
  a separately approved local-distribution approach; do not clean or reuse the
  partial cache automatically.
- **Untested/held:** Gradle project configuration/compilation, APK production and
  metadata/signing/content, Android runtime, installs/ADB/devices, signing
  material, release artifacts, providers, Git/GitHub, Play Console, and
  deployment.

## Current bounded unit — Gradle 8.14.3 wrapper completion and build (2026-08-25)

### Objective and frozen scope

Allow the checked-in wrapper to complete or validate only its specific partial
Gradle 8.14.3 distribution, then run one elevated offline non-clean debug build
and inspect any resulting APK.

- Authorized cache target:
  `C:\Users\fresh\.gradle\wrapper\dists\gradle-8.14.3-all` only.
- The wrapper may complete, validate, replace, or redownload its Gradle 8.14.3
  distribution if its normal prerequisite handling requires it. No manual or
  broader Gradle-cache cleanup is authorized.
- Authorized build command: exactly one elevated
  `.\gradlew.bat assembleDebug --offline --no-daemon --console=plain`
  invocation from `C:\projects\chess-master\android`. The wrapper prerequisite
  occurs within that same invocation; Gradle dependency resolution remains
  offline.
- Allowed writes: this plan, wrapper-managed files inside the exact cache target,
  and ordinary Gradle cache/report/debug-build outputs from the invocation.
- No source/configuration edit is authorized; no new source snapshot is needed
  for this wrapper/build-only gate.
- Held/non-goals: `clean`, repeated Gradle invocations, manual ACL mutation,
  broader cache cleanup, dependency/source changes, non-wrapper installs or
  downloads, ADB/devices, signing-material access, release artifacts,
  providers, Git/GitHub, Play Console, and deployment.

### Success criteria and verification

- Wrapper handling completes with a valid Gradle 8.14.3 distribution and the
  single Gradle build exits successfully.
- Inspect the APK locally without installation: path, bytes, SHA-256,
  application ID, versionCode/versionName, min/target SDK, debuggable state,
  signer certificate summary, generated Capacitor configuration, and active
  `ChessBoard3D` asset.
- Record Fixed, Confirmed, Partial, Blocked, and Untested, then stop. Do not
  repair a new failure or perform a downstream action within this gate.

### Checklist

- [x] Delegate the wrapper/build/inspection contract to project-scoped Terra.
- [x] Run exactly one elevated wrapper plus offline non-clean build invocation.
- [x] Verify wrapper completion state and inspect locally for any resulting APK.
- [x] Record the result and stop.

### Current status

**Complete with offline dependency blocker.** Bruce explicitly approved this
wrapper-completion gate on 2026-08-25. The wrapper prerequisite completed and
Gradle 8.14.3 reached root-project configuration, where offline resolution
failed on one uncached declared build dependency. No APK was produced. No
broader cleanup or downstream action is authorized.

### 2026-08-25 wrapper completion and offline build results

- **Fixed:** The wrapper repaired its explicitly authorized Gradle 8.14.3 target
  and produced a usable expanded distribution. The elevated cache now contains
  `gradle-8.14.3\bin\gradle.bat`, and the invocation printed `Welcome to Gradle
  8.14.3!` before reaching project configuration.
- **Confirmed:** Terra ran exactly one elevated
  `.\gradlew.bat assembleDebug --offline --no-daemon --console=plain`
  invocation. Gradle reported 2 minutes 48 seconds and exited 1. The wrapper's
  deletion/re-extraction stayed inside the one approved
  `gradle-8.14.3-all` target. No manual or broader cleanup occurred.
- **Confirmed:** Root project configuration failed because
  `com.google.gms:google-services:4.4.4` is not present in the local offline
  cache. Sol confirmed that `android\build.gradle` declares this classpath
  dependency unconditionally, while `android\app\google-services.json` is
  absent and app-level plugin application is conditional on that file.
- **Confirmed:** Gradle remained offline; no Maven dependency download or online
  retry occurred. No source/config/ACL change or device/release/external action
  occurred. A recursive APK search returned no artifact.
- **Partial:** Wrapper distribution completion and root-project configuration
  are established, but APK metadata/signing/content inspection cannot occur
  without an APK. The wrapper layout retained the expanded distribution but no
  ZIP or `.ok` marker after its normal repair.
- **Blocked:** Android build dependency resolution requires a separately
  authorized online dependency-resolution/build gate, or a separately scoped
  source decision about the unconditional Google Services classpath. Do not
  download dependencies or edit Gradle configuration automatically.
- **Untested/held:** Compilation, APK production and metadata/signing/content,
  Android runtime, installs/ADB/devices, signing material, release artifacts,
  providers, Git/GitHub, Play Console, and deployment.
