# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/) and this project adheres to [Semantic Versioning](http://semver.org/).

## [Unreleased]

### Added

- Adds `toggleexcludedfiles.storeLocation` setting to store toggle state in user settings &mdash; closes #47, thanks to [PR #<pr>](...) by KaiStarkk ([@KaiStarkk](https://github.com/KaiStarkk))
- Adds `toggleexcludedfiles.exclude` setting for predefined exclude lists, useful for devcontainers &mdash; closes #43, thanks to [PR #<pr>](...) by KaiStarkk ([@KaiStarkk](https://github.com/KaiStarkk))
- Adds `toggleexcludedfiles.toggleGitIgnore` setting to also toggle `explorer.excludeGitIgnore` &mdash; closes #50, thanks to [PR #<pr>](...) by KaiStarkk ([@KaiStarkk](https://github.com/KaiStarkk))

### Changed

- Merges current `files.exclude` settings when restoring to prevent losing manual changes

### Fixed

- Fixes #22, toggle state is now persisted when closing VS Code &mdash; thanks to [PR #<pr>](...) by KaiStarkk ([@KaiStarkk](https://github.com/KaiStarkk))
- Fixes #46, status bar icon will now update when any related configuration is changed &mdash; thanks to [PR #<pr>](...) by KaiStarkk ([@KaiStarkk](https://github.com/KaiStarkk))


## [2.0.0] - 2023-03-05

### Added

- Adds toggle button to the Explorer view &mdash; closes [#44](https://github.com/eamodio/vscode-toggle-excluded-files/issues/44)
- Adds support for VS Code on the Web (vscode.dev / github.dev)
- Adds workspace trust support

## [1.7.0] - 2019-10-18

### Fixed

- Fixes [#11](https://github.com/eamodio/vscode-toggle-excluded-files/issues/11) - Doesn't re-hide anything
- Fixes [#8](https://github.com/eamodio/vscode-toggle-excluded-files/issues/8) - Extension does not work when Workspace has multiple folders

## [1.6.0]

### Removed

- Removes hack now that [vscode #25508](https://github.com/Microsoft/vscode/issues/25508) as been resolved

## [1.5.1]

### Fixed

- Fixes marketplace badge layout

## [1.5.0]

### Added

- Adds current toggle state (`Show` vs `Restore`) to the status bar button
- Adds folder (workspace) detection to disable of Toggle Exclude Files if a folder (workspace) is not loaded

### Changed

- Changes status bar button to only appear if `files.exclude` is in use (either in user or workspace settings)
- Changes shortcut key for the `Toggle Excluded Files` command to only work when the file explorer is focused
- Renames `toggleexcludedfiles.advanced.debug` setting to `toggleexcludedfiles.debug`
- Renames `toggleexcludedfiles.output.level` setting to `toggleexcludedfiles.outputLevel`

### Fixed

- Fixes intermittent issue where restoring existing exclude rules failed

## [1.1.3]

### Fixed

- Fixes issue with output channel logging

## [1.1.2]

### Fixed

- Fixes intermittent issue with restoring the previous exclude rules

## [1.1.1]

### Fixed

- Fixes logging to clean up on extension deactivate

## [1.1.0]

### Changed

- Completely refactored to save & restore existing exclude rules, even if they change while the toggle is active

### Fixed

- Fixes [#1](https://github.com/eamodio/vscode-toggle-excluded-files/issues/1) - Doesn't restore the original rules

## [1.0.1]

### Changed

- Updates the README and some dependencies

## [1.0.0]

### Changed

- No longer preview since vscode 1.8 has been released

## [0.0.1]

### Added

- Initial release
