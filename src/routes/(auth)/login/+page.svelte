<script lang="ts">
	import { goto } from '$app/navigation';
	import { login } from '$lib/stores/auth';
	import {
		AuthenticationError,
		RateLimitError,
		DownstreamUnavailableError,
		NetworkError,
		ValidationError
	} from '$lib/api/problem-details';

	let email = $state('');
	let password = $state('');
	let showPassword = $state(false);
	let rememberMe = $state(false);
	let isLoading = $state(false);
	let errorMessage = $state('');
	let emailError = $state('');
	let passwordError = $state('');

	function validateForm(): boolean {
		emailError = '';
		passwordError = '';
		let valid = true;

		if (!email.trim()) {
			emailError = 'Username is required.';
			valid = false;
		}

		if (!password) {
			passwordError = 'Password is required.';
			valid = false;
		}

		return valid;
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		errorMessage = '';

		if (!validateForm()) return;

		isLoading = true;
		try {
			await login(email, password);
			await goto('/dashboard', { replaceState: true });
		} catch (err) {
			if (err instanceof ValidationError || err instanceof AuthenticationError) {
				errorMessage = 'Invalid username or password. Please try again.';
			} else if (err instanceof RateLimitError) {
				errorMessage = 'Too many login attempts. Please wait a moment and try again.';
			} else if (err instanceof DownstreamUnavailableError) {
				errorMessage = 'The authentication service is temporarily unavailable.';
			} else if (err instanceof NetworkError) {
				errorMessage = 'Unable to reach the server. Check your network connection.';
			} else {
				errorMessage = 'An unexpected error occurred. Please try again.';
			}
		} finally {
			isLoading = false;
		}
	}
</script>

<svelte:head>
	<title>Sign In — Texas Operational Portal</title>
</svelte:head>

<div class="page">
	<main class="card" aria-labelledby="login-heading">

		<!-- Logo & Brand -->
		<div class="brand">
			<div class="brand__avatar" aria-hidden="true">T</div>
			<div>
				<p class="brand__name">TEXAS TRAVELS</p>
				<p class="brand__sub">OPERATIONAL PORTAL</p>
			</div>
		</div>

		<h1 id="login-heading" class="heading">Sign in your account</h1>

		<!-- Global error -->
		{#if errorMessage}
			<div class="alert" role="alert" aria-live="assertive">
				<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
					<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
				</svg>
				{errorMessage}
			</div>
		{/if}

		<form onsubmit={handleSubmit} novalidate>

			<!-- Username / Email -->
			<div class="field">
				<label for="login-email" class="label">
					<span class="label__required">U</span>sername
				</label>
				<input
					id="login-email"
					type="email"
					bind:value={email}
					class="input"
					class:input--error={!!emailError}
					autocomplete="username"
					autocapitalize="none"
					spellcheck="false"
					placeholder="Enter username"
					disabled={isLoading}
					aria-describedby={emailError ? 'email-err' : undefined}
					aria-invalid={!!emailError}
					aria-required="true"
				/>
				{#if emailError}
					<p id="email-err" class="field-error" role="alert">{emailError}</p>
				{/if}
			</div>

			<!-- Password -->
			<div class="field">
				<label for="login-password" class="label">Password</label>
				<div class="input-wrap">
					<input
						id="login-password"
						type={showPassword ? 'text' : 'password'}
						bind:value={password}
						class="input input--has-icon"
						class:input--error={!!passwordError}
						autocomplete="current-password"
						placeholder="••••••"
						disabled={isLoading}
						aria-describedby={passwordError ? 'pw-err' : undefined}
						aria-invalid={!!passwordError}
						aria-required="true"
					/>
					<button
						type="button"
						class="toggle-btn"
						onclick={() => (showPassword = !showPassword)}
						aria-label={showPassword ? 'Hide password' : 'Show password'}
						aria-pressed={showPassword}
						disabled={isLoading}
					>
						{#if showPassword}
							<!-- Eye -->
							<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
								<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
							</svg>
						{:else}
							<!-- Eye-off -->
							<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
								<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
								<line x1="1" y1="1" x2="23" y2="23"/>
							</svg>
						{/if}
					</button>
				</div>
				{#if passwordError}
					<p id="pw-err" class="field-error" role="alert">{passwordError}</p>
				{/if}
			</div>

			<div class="row-opts">
				<label class="remember">
					<input
						type="checkbox"
						bind:checked={rememberMe}
						class="remember__check"
						disabled={isLoading}
					/>
					<span class="remember__label">Remember my preference</span>
				</label>
			</div>

			<!-- Submit -->
			<button
				id="login-submit"
				type="submit"
				class="submit-btn"
				disabled={isLoading}
				aria-busy={isLoading}
			>
				{#if isLoading}
					<span class="spinner" aria-hidden="true"></span>
					Signing in…
				{:else}
					Sign In
				{/if}
			</button>

		</form>
	</main>
</div>

<style>
	/* Page shell */
	.page {
		min-height: 100dvh;
		display: flex;
		align-items: center;
		justify-content: center;
		background: hsl(240 15% 96%);
		padding: 1.5rem;
		font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
	}

	/* Card - Larger and squarer */
	.card {
		background: #ffffff;
		border-radius: 0.375rem;
		border: 1px solid hsl(240 6% 90%);
		box-shadow:
			0 10px 30px -5px rgba(0, 0, 0, 0.08),
			0 4px 12px -2px rgba(0, 0, 0, 0.04);
		padding: 2.75rem 2.5rem 2.5rem;
		width: 100%;
		max-width: 480px;
	}

	/* Brand */
	.brand {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.875rem;
		margin-bottom: 1.5rem;
	}
	.brand__avatar {
		width: 52px;
		height: 52px;
		border-radius: 0.375rem;
		background: #2596be;
		color: #fff;
		font-size: 1.5rem;
		font-weight: 800;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		letter-spacing: -0.02em;
		box-shadow: 0 4px 12px rgba(37, 150, 190, 0.3);
	}
	.brand__name {
		font-size: 1.125rem;
		font-weight: 800;
		color: hsl(240 10% 20%);
		letter-spacing: 0.05em;
		margin: 0 0 0.15rem;
		line-height: 1;
	}
	.brand__sub {
		font-size: 0.75rem;
		font-weight: 600;
		color: #2596be;
		letter-spacing: 0.12em;
		margin: 0;
		line-height: 1;
	}

	/* Heading */
	.heading {
		font-size: 1.25rem;
		font-weight: 700;
		color: hsl(240 10% 22%);
		text-align: center;
		margin: 0 0 1.75rem;
	}

	/* Alert */
	.alert {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		font-size: 0.875rem;
		color: hsl(0 65% 45%);
		background: hsl(0 80% 97%);
		border: 1px solid hsl(0 65% 88%);
		border-radius: 0.25rem;
		padding: 0.75rem 0.875rem;
		margin-bottom: 1.25rem;
	}

	/* Form fields */
	.field {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-bottom: 1.25rem;
	}
	.label {
		font-size: 0.9375rem;
		font-weight: 600;
		color: hsl(240 8% 30%);
	}
	.label__required {
		color: #2596be;
		font-weight: 700;
	}

	.input {
		width: 100%;
		box-sizing: border-box;
		padding: 0.75rem 1rem;
		border: 1.5px solid hsl(240 8% 86%);
		border-radius: 0.25rem;
		font-size: 1rem;
		font-family: inherit;
		color: hsl(240 10% 18%);
		background: #fff;
		outline: none;
		transition: border-color 0.15s, box-shadow 0.15s;
	}
	.input::placeholder { color: hsl(240 6% 68%); }
	.input:focus {
		border-color: #2596be;
		box-shadow: 0 0 0 3px rgba(37, 150, 190, 0.2);
	}
	.input--error { border-color: hsl(0 65% 65%); }
	.input--error:focus { box-shadow: 0 0 0 3px hsl(0 65% 65% / 0.18); }
	.input--has-icon { padding-right: 3rem; }
	.input:disabled { opacity: 0.6; cursor: not-allowed; background: hsl(240 8% 97%); }

	.input-wrap { position: relative; }

	.toggle-btn {
		position: absolute;
		right: 0.75rem;
		top: 50%;
		transform: translateY(-50%);
		background: none;
		border: none;
		cursor: pointer;
		color: hsl(240 6% 60%);
		padding: 0.3rem;
		display: flex;
		align-items: center;
		border-radius: 0.25rem;
		transition: color 0.15s;
	}
	.toggle-btn:hover { color: #2596be; }
	.toggle-btn:focus-visible { outline: 2px solid #2596be; outline-offset: 2px; }
	.toggle-btn:disabled { pointer-events: none; }

	.field-error {
		font-size: 0.8125rem;
		color: hsl(0 65% 50%);
		margin: 0;
	}

	/* Row: remember me */
	.row-opts {
		display: flex;
		align-items: center;
		margin-bottom: 1.5rem;
	}
	.remember {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		cursor: pointer;
	}
	.remember__check {
		width: 17px;
		height: 17px;
		border: 1.5px solid hsl(240 8% 75%);
		border-radius: 0.25rem;
		cursor: pointer;
		accent-color: #2596be;
		flex-shrink: 0;
	}
	.remember__label {
		font-size: 0.875rem;
		color: hsl(240 8% 40%);
		user-select: none;
	}

	/* Submit */
	.submit-btn {
		width: 100%;
		padding: 0.8125rem 1.25rem;
		border-radius: 0.25rem;
		background: #2596be;
		color: #fff;
		font-size: 1rem;
		font-weight: 700;
		font-family: inherit;
		border: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		transition: background 0.15s, box-shadow 0.15s, transform 0.1s;
		box-shadow: 0 4px 12px rgba(37, 150, 190, 0.35);
	}
	.submit-btn:hover:not(:disabled) {
		background: #1f80a3;
		box-shadow: 0 6px 16px rgba(37, 150, 190, 0.45);
	}
	.submit-btn:active:not(:disabled) { transform: translateY(1px); }
	.submit-btn:focus-visible { outline: 2px solid #2596be; outline-offset: 3px; }
	.submit-btn:disabled { opacity: 0.65; cursor: not-allowed; }

	/* Spinner */
	.spinner {
		width: 16px;
		height: 16px;
		border: 2px solid rgba(255,255,255,0.35);
		border-top-color: #fff;
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
	}
	@keyframes spin { to { transform: rotate(360deg); } }
</style>
