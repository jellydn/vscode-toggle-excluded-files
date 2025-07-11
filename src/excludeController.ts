import type { ConfigurationChangeEvent, Disposable, Event } from 'vscode'
import { ConfigurationTarget, EventEmitter } from 'vscode'
import type { CoreConfiguration, StoredFilesExcludes } from './constants'
import type { Container } from './container'
import { configuration } from './system/configuration'
import { setContext } from './system/context'
import { Logger } from './system/logger'
import { areEqual } from './system/object'
import type { Storage } from './system/storage'

export type FilesExcludeConfiguration = Record<string, boolean>

export class FilesExcludeController implements Disposable {
	private _onDidToggle = new EventEmitter<void>()
	get onDidToggle(): Event<void> {
		return this._onDidToggle.event
	}

	private readonly _disposable: Disposable
	private _working: boolean = false

	constructor(
		private readonly container: Container,
		private readonly storage: Storage,
	) {
		this._disposable = configuration.onDidChangeAny(this.onAnyConfigurationChanged, this)
		this.onAnyConfigurationChanged()
	}

	dispose() {
		this._disposable.dispose()
	}

	private onAnyConfigurationChanged(e?: ConfigurationChangeEvent) {
		if (this._working) return
		if (e != null && !configuration.changedAny(e, ['files.exclude', 'explorer.excludeGitIgnore'])) return

		const savedExclude = this.getSavedExcludeConfiguration()
		if (savedExclude == null) return

		Logger.log('FilesExcludeController.onOtherConfigurationChanged()')

		const newExclude = this.getExcludeConfiguration()
		if (
			newExclude != null &&
			areEqual(savedExclude.globalValue, newExclude.globalValue) &&
			areEqual(savedExclude.workspaceValue, newExclude.workspaceValue)
		) {
			return
		}

		const appliedExclude = this.getAppliedExcludeConfiguration()
		if (
			newExclude != null &&
			appliedExclude != null &&
			areEqual(appliedExclude.globalValue, newExclude.globalValue) &&
			areEqual(appliedExclude.workspaceValue, newExclude.workspaceValue)
		) {
			return
		}

		Logger.log('FilesExcludeController.onOtherConfigurationChanged()', 'clearing state')

		// Remove the currently saved config, since it was directly edited
		void this.clearExcludeConfiguration()
	}

	async applyConfiguration() {
		// If we have saved state, the we are already applied to exit
		if (this._working || this.hasSavedExcludeConfiguration()) return

		Logger.log('FilesExcludeController.applyConfiguration()')

		try {
			this._working = true

			const exclude = this.getExcludeConfiguration()!
			await this.saveExcludeConfiguration(exclude)

			const appliedExcludes: StoredFilesExcludes = {
				key: exclude.key,
				globalValue: exclude.globalValue == null ? undefined : {},
				workspaceValue: exclude.workspaceValue == null ? undefined : {},
				// workspaceFolderValue: exclude.workspaceFolderValue == null ? undefined : {},
			}

			const promises: Promise<unknown>[] = []

			if (exclude.globalValue != null && appliedExcludes.globalValue != null) {
				const apply: FilesExcludeConfiguration = Object.create(null)
				for (const key of Object.keys(exclude.globalValue)) {
					appliedExcludes.globalValue[key] = apply[key] = false
				}

				promises.push(
					Promise.resolve(
						configuration.updateAny<CoreConfiguration, FilesExcludeConfiguration>(
							'files.exclude',
							apply,
							ConfigurationTarget.Global,
						),
					),
				)
			}

			if (exclude.workspaceValue != null && appliedExcludes.workspaceValue != null) {
				const apply: FilesExcludeConfiguration = Object.create(null)
				for (const key of Object.keys(exclude.workspaceValue)) {
					appliedExcludes.workspaceValue[key] = apply[key] = false
				}

				promises.push(
					Promise.resolve(
						configuration.updateAny<CoreConfiguration, FilesExcludeConfiguration>(
							'files.exclude',
							apply,
							ConfigurationTarget.Workspace,
						),
					),
				)
			}

			// Handle git ignore toggle
			if (configuration.get('toggleGitIgnore')) {
				const gitIgnoreState = this.getGitIgnoreConfiguration()
				if (gitIgnoreState !== undefined) {
					await this.saveGitIgnoreConfiguration(gitIgnoreState)
					await this.saveAppliedGitIgnoreConfiguration(false)
					promises.push(
						Promise.resolve(
							configuration.updateAny<CoreConfiguration, boolean>(
								'explorer.excludeGitIgnore',
								false,
								ConfigurationTarget.Workspace,
							),
						),
					)
				}
			}

			await this.saveAppliedExcludeConfiguration(appliedExcludes)

			if (!promises.length) return

			await Promise.allSettled(promises)
		} catch (ex) {
			Logger.error(ex)
			await this.clearExcludeConfiguration()
		} finally {
			Logger.log('FilesExcludeController.applyConfiguration()', 'done')

			this._working = false
			this._onDidToggle.fire()
		}
	}

	async restoreConfiguration() {
		// If we don't have saved state, the we don't have anything to restore so exit
		if (this._working || !this.hasSavedExcludeConfiguration()) return

		Logger.log('FilesExcludeController.restoreConfiguration()')

		try {
			this._working = true
			const savedExclude = this.getSavedExcludeConfiguration()
			if (savedExclude == null) return

			const currentExclude = this.getExcludeConfiguration()
			const promises: Promise<unknown>[] = []

			const mergedWorkspaceValue = {
				...(savedExclude.workspaceValue ?? {}),
				...(currentExclude?.workspaceValue ?? {}),
			}

			if (Object.keys(mergedWorkspaceValue).length > 0) {
				promises.push(
					Promise.resolve(
						configuration.updateAny<CoreConfiguration, FilesExcludeConfiguration>(
							'files.exclude',
							mergedWorkspaceValue,
							ConfigurationTarget.Workspace,
						),
					),
				)
			} else if (savedExclude.workspaceValue != null) {
				// Ensures we clear the setting if the merged result is empty
				promises.push(
					Promise.resolve(
						configuration.updateAny<CoreConfiguration, FilesExcludeConfiguration | undefined>(
							'files.exclude',
							undefined,
							ConfigurationTarget.Workspace,
						),
					),
				)
			}

			const mergedGlobalValue = {
				...(savedExclude.globalValue ?? {}),
				...(currentExclude?.globalValue ?? {}),
			}

			if (Object.keys(mergedGlobalValue).length > 0) {
				promises.push(
					Promise.resolve(
						configuration.updateAny<CoreConfiguration, FilesExcludeConfiguration>(
							'files.exclude',
							mergedGlobalValue,
							ConfigurationTarget.Global,
						),
					),
				)
			} else if (savedExclude.globalValue != null) {
				// Ensures we clear the setting if the merged result is empty
				promises.push(
					Promise.resolve(
						configuration.updateAny<CoreConfiguration, FilesExcludeConfiguration | undefined>(
							'files.exclude',
							undefined,
							ConfigurationTarget.Global,
						),
					),
				)
			}

			if (savedExclude.workspaceFolderValue != null || currentExclude?.workspaceFolderValue != null) {
				const mergedWorkspaceFolderValue = {
					...(savedExclude.workspaceFolderValue ?? {}),
					...(currentExclude?.workspaceFolderValue ?? {}),
				}

				if (Object.keys(mergedWorkspaceFolderValue).length > 0) {
					promises.push(
						Promise.resolve(
							configuration.updateAny(
								'files.exclude',
								mergedWorkspaceFolderValue,
								ConfigurationTarget.WorkspaceFolder,
							),
						),
					)
				}
			}

			// Handle git ignore restore
			if (configuration.get('toggleGitIgnore')) {
				const savedGitIgnoreState = this.getSavedGitIgnoreConfiguration()
				if (savedGitIgnoreState !== undefined) {
					promises.push(
						Promise.resolve(
							configuration.updateAny<CoreConfiguration, boolean>(
								'explorer.excludeGitIgnore',
								savedGitIgnoreState,
								ConfigurationTarget.Workspace,
							),
						),
					)
				}
			}

			// Remove the currently saved config, since we just restored it
			await this.clearExcludeConfiguration()

			if (!promises.length) return

			await Promise.allSettled(promises)
		} catch (ex) {
			Logger.error(ex)
			await this.clearExcludeConfiguration()
		} finally {
			Logger.log('FilesExcludeController.restoreConfiguration()', 'done')

			this._working = false
			this._onDidToggle.fire()
		}
	}

	async toggleConfiguration() {
		if (this._working) return

		Logger.log('FilesExcludeController.toggleConfiguration()')

		if (this.hasSavedExcludeConfiguration()) {
			await this.restoreConfiguration()
		} else {
			await this.applyConfiguration()
		}
	}

	get canToggle() {
		const exclude = this.getExcludeConfiguration()
		const customExclude = this.getCustomExcludeConfiguration()
		return (exclude != null && (exclude.globalValue != null || exclude.workspaceValue != null)) || (customExclude != null && customExclude.length > 0)
	}

	get toggled() {
		return this.hasSavedExcludeConfiguration()
	}

	private async clearExcludeConfiguration() {
		await this.saveAppliedExcludeConfiguration(undefined)
		await this.saveExcludeConfiguration(undefined)
		if (configuration.get('toggleGitIgnore')) {
			await this.saveAppliedGitIgnoreConfiguration(undefined)
			await this.saveGitIgnoreConfiguration(undefined)
		}
	}

	private getAppliedExcludeConfiguration(): StoredFilesExcludes | undefined {
		const storeLocation = configuration.get('storeLocation')
		return storeLocation === 'user'
			? this.storage.get('appliedState')
			: this.storage.getWorkspace('appliedState')
	}

	private getExcludeConfiguration(): StoredFilesExcludes | undefined {
		const customExclude = this.getCustomExcludeConfiguration()
		if (customExclude) {
			// Create a synthetic StoredFilesExcludes from the custom exclude list
			const excludeConfig: FilesExcludeConfiguration = {}
			customExclude.forEach(pattern => {
				excludeConfig[pattern] = true
			})
			return {
				key: 'files.exclude',
				globalValue: undefined,
				workspaceValue: excludeConfig,
				workspaceFolderValue: undefined,
				defaultValue: undefined
			}
		}
		return configuration.inspectAny<CoreConfiguration, Record<string, boolean>>('files.exclude')
	}

	private getSavedExcludeConfiguration(): StoredFilesExcludes | undefined {
		const storeLocation = configuration.get('storeLocation')
		const excludes = storeLocation === 'user'
			? this.storage.get('savedState')
			: this.storage.getWorkspace('savedState')
		this.updateContext(excludes)
		return excludes
	}

	private hasSavedExcludeConfiguration(): boolean {
		return this.getSavedExcludeConfiguration() != null
	}

	private saveAppliedExcludeConfiguration(excludes: StoredFilesExcludes | undefined): Promise<void> {
		const storeLocation = configuration.get('storeLocation')
		return storeLocation === 'user'
			? this.storage.store('appliedState', excludes)
			: this.storage.storeWorkspace('appliedState', excludes)
	}

	private saveExcludeConfiguration(excludes: StoredFilesExcludes | undefined): Promise<void> {
		this.updateContext(excludes)
		const storeLocation = configuration.get('storeLocation')
		return storeLocation === 'user'
			? this.storage.store('savedState', excludes)
			: this.storage.storeWorkspace('savedState', excludes)
	}

	private getCustomExcludeConfiguration(): string[] | null {
		const customExclude = configuration.get('exclude')
		return customExclude && customExclude.length > 0 ? customExclude : null
	}

	private getGitIgnoreConfiguration(): boolean | undefined {
		return configuration.getAny<'explorer.excludeGitIgnore', boolean>('explorer.excludeGitIgnore')
	}

	private getSavedGitIgnoreConfiguration(): boolean | undefined {
		const storeLocation = configuration.get('storeLocation')
		return storeLocation === 'user'
			? this.storage.get('savedGitIgnoreState')
			: this.storage.getWorkspace('savedGitIgnoreState')
	}

	private saveGitIgnoreConfiguration(value: boolean | undefined): Promise<void> {
		const storeLocation = configuration.get('storeLocation')
		return storeLocation === 'user'
			? this.storage.store('savedGitIgnoreState', value)
			: this.storage.storeWorkspace('savedGitIgnoreState', value)
	}

	private getAppliedGitIgnoreConfiguration(): boolean | undefined {
		const storeLocation = configuration.get('storeLocation')
		return storeLocation === 'user'
			? this.storage.get('appliedGitIgnoreState')
			: this.storage.getWorkspace('appliedGitIgnoreState')
	}

	private saveAppliedGitIgnoreConfiguration(value: boolean | undefined): Promise<void> {
		const storeLocation = configuration.get('storeLocation')
		return storeLocation === 'user'
			? this.storage.store('appliedGitIgnoreState', value)
			: this.storage.storeWorkspace('appliedGitIgnoreState', value)
	}

	private _loaded = false
	private updateContext(excludes: StoredFilesExcludes | undefined) {
		void setContext('toggleexcludedfiles:toggled', excludes != null)
		if (!this._loaded) {
			this._loaded = true
			void setContext('toggleexcludedfiles:loaded', true)
		}
	}
}
