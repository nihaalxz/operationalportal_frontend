<script lang="ts">
	import { authState, updateProfileState } from '$lib/stores/auth';
	import { apiFetch } from '$lib/api/api-client';
	import { ValidationError, AuthenticationError } from '$lib/api/problem-details';
	import { onMount } from 'svelte';

	let name = $state('');
	let avatarUrl = $state('');
	
	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');

	let isUpdatingProfile = $state(false);
	let isResettingPassword = $state(false);

	let profileSuccessMsg = $state('');
	let profileErrorMsg = $state('');
	let passwordSuccessMsg = $state('');
	let passwordErrorMsg = $state('');

	let nameError = $state('');
	let avatarFileError = $state('');
	let currentPasswordError = $state('');
	let newPasswordError = $state('');
	let confirmPasswordError = $state('');

	let fileInputEl: HTMLInputElement | undefined = $state();

	// Hydrate profile data from authState when available
	$effect(() => {
		if ($authState.user) {
			name = $authState.user.name;
			avatarUrl = $authState.user.avatarUrl ?? '';
		}
	});

	// Check if hash matches for anchor link (scroll to reset password section)
	onMount(() => {
		if (window.location.hash === '#reset-password') {
			const el = document.getElementById('reset-password-section');
			if (el) el.scrollIntoView({ behavior: 'smooth' });
		}
	});

	// Process image file selection and encode to base64
	function handleFileChange(e: Event) {
		avatarFileError = '';
		const target = e.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;

		// Limit to 1.5MB to ensure fast payload transfers
		if (file.size > 1.5 * 1024 * 1024) {
			avatarFileError = 'Image must be smaller than 1.5MB.';
			target.value = ''; // clear input
			return;
		}

		const reader = new FileReader();
		reader.onload = () => {
			avatarUrl = reader.result as string;
		};
		reader.onerror = () => {
			avatarFileError = 'Failed to read file. Please try another image.';
		};
		reader.readAsDataURL(file);
	}

	function handleRemoveAvatar() {
		avatarUrl = '';
		if (fileInputEl) fileInputEl.value = '';
	}

	async function handleUpdateProfile(e: Event) {
		e.preventDefault();
		profileSuccessMsg = '';
		profileErrorMsg = '';
		nameError = '';

		if (!name.trim()) {
			nameError = 'Name is required.';
			return;
		}

		isUpdatingProfile = true;
		try {
			await apiFetch('/api/auth/profile', {
				method: 'PUT',
				body: JSON.stringify({ name: name.trim(), avatarUrl: avatarUrl.trim() || null })
			});
			updateProfileState(name.trim(), avatarUrl.trim() || null);
			profileSuccessMsg = 'Profile updated successfully.';
		} catch (err) {
			if (err instanceof ValidationError) {
				profileErrorMsg = Object.values(err.errors).flat().join(' ') || 'Validation failed.';
			} else {
				profileErrorMsg = 'Failed to update profile. Please try again.';
			}
		} finally {
			isUpdatingProfile = false;
		}
	}

	async function handleResetPassword(e: Event) {
		e.preventDefault();
		passwordSuccessMsg = '';
		passwordErrorMsg = '';
		currentPasswordError = '';
		newPasswordError = '';
		confirmPasswordError = '';

		let valid = true;
		if (!currentPassword) {
			currentPasswordError = 'Current password is required.';
			valid = false;
		}
		if (newPassword.length < 6) {
			newPasswordError = 'New password must be at least 6 characters.';
			valid = false;
		}
		if (newPassword !== confirmPassword) {
			confirmPasswordError = 'Passwords do not match.';
			valid = false;
		}

		if (!valid) return;

		isResettingPassword = true;
		try {
			await apiFetch('/api/auth/reset-password', {
				method: 'POST',
				body: JSON.stringify({ currentPassword, newPassword })
			});
			passwordSuccessMsg = 'Password reset successfully.';
			currentPassword = '';
			newPassword = '';
			confirmPassword = '';
		} catch (err) {
			if (err instanceof ValidationError) {
				passwordErrorMsg = Object.values(err.errors).flat().join(' ') || 'Validation failed.';
			} else if (err instanceof AuthenticationError || (err as any).status === 400) {
				passwordErrorMsg = 'Current password is incorrect.';
				currentPasswordError = 'Current password is incorrect.';
			} else {
				passwordErrorMsg = 'Failed to reset password. Please try again.';
			}
		} finally {
			isResettingPassword = false;
		}
	}
</script>

<svelte:head>
	<title>Profile Settings — Texas Operational Portal</title>
</svelte:head>

<div class="profile-container">
	<div class="page-header">
		<h1 class="page-title">Profile Settings</h1>
		<p class="page-desc">Manage your operational account settings and security</p>
	</div>

	<div class="profile-grid">
		<!-- Profile Info Section -->
		<section class="settings-card" aria-labelledby="profile-info-heading">
			<h2 id="profile-info-heading" class="settings-card__title">Personal Information</h2>
			<p class="settings-card__desc">Update your profile name and upload a profile picture.</p>

			{#if profileSuccessMsg}
				<div class="status-msg status-msg--success" role="alert">{profileSuccessMsg}</div>
			{/if}
			{#if profileErrorMsg}
				<div class="status-msg status-msg--error" role="alert">{profileErrorMsg}</div>
			{/if}

			<form onsubmit={handleUpdateProfile} class="settings-form" novalidate>
				<div class="avatar-preview-container">
					{#if avatarUrl.trim()}
						<img src={avatarUrl} alt="Avatar preview" class="avatar-preview" onerror={(e) => { (e.target as HTMLImageElement).src = ''; }} />
					{:else}
						<div class="avatar-preview avatar-preview--placeholder">
							{name.charAt(0).toUpperCase() || '?'}
						</div>
					{/if}
					<div class="avatar-meta">
						<p class="avatar-meta__title">Profile Picture Preview</p>
						<p class="avatar-meta__desc">A preview of how your avatar will display in the header.</p>
					</div>
				</div>

				<div class="field">
					<label for="profile-name" class="label">Name</label>
					<input
						id="profile-name"
						type="text"
						bind:value={name}
						class="input"
						class:input--error={!!nameError}
						disabled={isUpdatingProfile}
						required
					/>
					{#if nameError}
						<p class="field-error" role="alert">{nameError}</p>
					{/if}
				</div>

				<div class="field">
					<span class="label">Profile Picture File</span>
					<div class="file-upload-row">
						<input
							type="file"
							accept="image/*"
							bind:this={fileInputEl}
							onchange={handleFileChange}
							class="hidden-file-input"
							id="avatar-file-input"
							disabled={isUpdatingProfile}
						/>
						<label for="avatar-file-input" class="file-upload-btn" class:file-upload-btn--disabled={isUpdatingProfile}>
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
								<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
							</svg>
							Choose Image File
						</label>

						{#if avatarUrl.trim()}
							<button type="button" class="remove-avatar-btn" onclick={handleRemoveAvatar} disabled={isUpdatingProfile}>
								Remove Image
							</button>
						{/if}
					</div>
					{#if avatarFileError}
						<p class="field-error" role="alert">{avatarFileError}</p>
					{:else}
						<p class="field-hint">Supports JPEG, PNG, or WebP. Max file size: 1.5MB.</p>
					{/if}
				</div>

				<button type="submit" class="submit-btn" disabled={isUpdatingProfile}>
					{#if isUpdatingProfile}
						<span class="spinner" aria-hidden="true"></span> Saving changes…
					{:else}
						Save Changes
					{/if}
				</button>
			</form>
		</section>

		<!-- Security / Password Section -->
		<section id="reset-password-section" class="settings-card" aria-labelledby="security-heading">
			<h2 id="security-heading" class="settings-card__title">Security & Password</h2>
			<p class="settings-card__desc">Ensure your account is secure by changing your password.</p>

			{#if passwordSuccessMsg}
				<div class="status-msg status-msg--success" role="alert">{passwordSuccessMsg}</div>
			{/if}
			{#if passwordErrorMsg}
				<div class="status-msg status-msg--error" role="alert">{passwordErrorMsg}</div>
			{/if}

			<form onsubmit={handleResetPassword} class="settings-form" novalidate>
				<div class="field">
					<label for="current-password" class="label">Current Password</label>
					<input
						id="current-password"
						type="password"
						bind:value={currentPassword}
						class="input"
						class:input--error={!!currentPasswordError}
						disabled={isResettingPassword}
						required
					/>
					{#if currentPasswordError}
						<p class="field-error" role="alert">{currentPasswordError}</p>
					{/if}
				</div>

				<div class="field">
					<label for="new-password" class="label">New Password</label>
					<input
						id="new-password"
						type="password"
						bind:value={newPassword}
						class="input"
						class:input--error={!!newPasswordError}
						disabled={isResettingPassword}
						required
					/>
					{#if newPasswordError}
						<p class="field-error" role="alert">{newPasswordError}</p>
					{/if}
				</div>

				<div class="field">
					<label for="confirm-password" class="label">Confirm New Password</label>
					<input
						id="confirm-password"
						type="password"
						bind:value={confirmPassword}
						class="input"
						class:input--error={!!confirmPasswordError}
						disabled={isResettingPassword}
						required
					/>
					{#if confirmPasswordError}
						<p class="field-error" role="alert">{confirmPasswordError}</p>
					{/if}
				</div>

				<button type="submit" class="submit-btn" disabled={isResettingPassword}>
					{#if isResettingPassword}
						<span class="spinner" aria-hidden="true"></span> Resetting password…
					{:else}
						Reset Password
					{/if}
				</button>
			</form>
		</section>
	</div>
</div>

<style>
	.profile-container {
		max-width: 1000px;
		margin: 0 auto;
	}
	.profile-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1.5rem;
		margin-top: 1.5rem;
	}
	@media (min-width: 1024px) {
		.profile-grid {
			grid-template-columns: 1fr 1fr;
			gap: 2rem;
		}
	}

	.settings-card {
		background: #ffffff;
		border: 1px solid hsl(var(--border));
		border-radius: 0.75rem;
		padding: 1.5rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
	}
	.settings-card__title {
		font-size: 1.125rem;
		font-weight: 600;
		color: hsl(var(--foreground));
		margin: 0 0 0.25rem;
	}
	.settings-card__desc {
		font-size: 0.875rem;
		color: hsl(var(--muted-foreground));
		margin: 0 0 1.25rem;
		line-height: 1.4;
	}

	.settings-form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.avatar-preview-container {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid hsl(var(--border));
		margin-bottom: 0.5rem;
	}
	.avatar-preview {
		width: 56px;
		height: 56px;
		border-radius: 50%;
		object-fit: cover;
		background: hsl(var(--primary) / 0.1);
		border: 2px solid hsl(var(--primary) / 0.2);
		flex-shrink: 0;
	}
	.avatar-preview--placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.5rem;
		font-weight: 700;
		color: hsl(var(--primary));
	}
	.avatar-meta {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}
	.avatar-meta__title {
		font-size: 0.875rem;
		font-weight: 600;
		color: hsl(var(--foreground));
		margin: 0;
	}
	.avatar-meta__desc {
		font-size: 0.75rem;
		color: hsl(var(--muted-foreground));
		margin: 0;
	}

	/* Common Form Fields */
	.field {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}
	.label {
		font-size: 0.875rem;
		font-weight: 500;
		color: hsl(var(--foreground));
	}
	.input {
		padding: 0.5rem 0.75rem;
		border: 1px solid hsl(var(--border));
		border-radius: 0.375rem;
		font-size: 0.875rem;
		font-family: inherit;
		color: hsl(var(--foreground));
		background: #ffffff;
		outline: none;
		transition: border-color 0.15s;
	}
	.input:focus {
		border-color: hsl(var(--primary));
		box-shadow: 0 0 0 2px hsl(var(--primary) / 0.15);
	}
	.input--error {
		border-color: hsl(var(--destructive));
	}
	.input:disabled {
		opacity: 0.6;
		background: hsl(var(--muted));
		cursor: not-allowed;
	}
	.field-hint {
		font-size: 0.75rem;
		color: hsl(var(--muted-foreground));
		margin: 0;
	}
	.field-error {
		font-size: 0.75rem;
		color: hsl(var(--destructive));
		margin: 0;
	}

	/* File Upload row */
	.file-upload-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-top: 0.25rem;
	}
	.hidden-file-input {
		display: none;
	}
	.file-upload-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		border: 1px solid hsl(var(--border));
		border-radius: 0.375rem;
		font-size: 0.875rem;
		font-weight: 600;
		color: hsl(var(--foreground));
		background: #ffffff;
		cursor: pointer;
		transition: background 0.15s, border-color 0.15s;
		box-shadow: 0 1px 2px rgba(0,0,0,0.03);
	}
	.file-upload-btn:hover {
		background: hsl(var(--muted));
		border-color: hsl(var(--border-hover, var(--border)));
	}
	.file-upload-btn--disabled {
		opacity: 0.6;
		cursor: not-allowed;
		pointer-events: none;
	}

	.remove-avatar-btn {
		padding: 0.5rem 0.875rem;
		border: 1px solid hsl(var(--border));
		border-radius: 0.375rem;
		font-size: 0.875rem;
		font-weight: 600;
		color: hsl(var(--destructive));
		background: transparent;
		cursor: pointer;
		transition: background 0.15s, border-color 0.15s;
	}
	.remove-avatar-btn:hover:not(:disabled) {
		background: hsl(var(--destructive) / 0.08);
		border-color: hsl(var(--destructive) / 0.3);
	}
	.remove-avatar-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.status-msg {
		font-size: 0.875rem;
		padding: 0.625rem 0.75rem;
		border-radius: 0.375rem;
		margin-bottom: 1rem;
		line-height: 1.4;
	}
	.status-msg--success {
		background: hsl(142.1 76.2% 36.3% / 0.1);
		color: hsl(142.1 76.2% 36.3%);
		border: 1px solid hsl(142.1 76.2% 36.3% / 0.2);
	}
	.status-msg--error {
		background: hsl(var(--destructive) / 0.1);
		color: hsl(var(--destructive));
		border: 1px solid hsl(var(--destructive) / 0.2);
	}

	.submit-btn {
		padding: 0.5rem 1rem;
		background: hsl(var(--primary));
		color: hsl(var(--primary-foreground));
		border: none;
		border-radius: 0.375rem;
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		transition: opacity 0.15s;
		align-self: flex-start;
	}
	.submit-btn:hover:not(:disabled) {
		opacity: 0.9;
	}
	.submit-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.spinner {
		width: 14px;
		height: 14px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top-color: #fff;
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
	}
	@keyframes spin { to { transform: rotate(360deg); } }
</style>
