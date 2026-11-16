import { BAHRAIN_TIMEZONE } from './utils';

export function initBahrainTimezoneDefaults(): void {
  if (typeof window === 'undefined') return;
  if ((window as unknown as { __bahrain_timezone_initialized?: boolean }).__bahrain_timezone_initialized) return;
  (window as unknown as { __bahrain_timezone_initialized?: boolean }).__bahrain_timezone_initialized = true;

  const origToLocaleString = Date.prototype.toLocaleString;
  Date.prototype.toLocaleString = function (locales?: Intl.LocalesArgument, options?: Intl.DateTimeFormatOptions) {
    const opts = { ...options };
    if (!opts.timeZone) {
      opts.timeZone = BAHRAIN_TIMEZONE;
    }
    return origToLocaleString.call(this, locales || 'en-GB', opts);
  };

  const origToLocaleDateString = Date.prototype.toLocaleDateString;
  Date.prototype.toLocaleDateString = function (locales?: Intl.LocalesArgument, options?: Intl.DateTimeFormatOptions) {
    const opts = { ...options };
    if (!opts.timeZone) {
      opts.timeZone = BAHRAIN_TIMEZONE;
    }
    return origToLocaleDateString.call(this, locales || 'en-GB', opts);
  };

  const origToLocaleTimeString = Date.prototype.toLocaleTimeString;
  Date.prototype.toLocaleTimeString = function (locales?: Intl.LocalesArgument, options?: Intl.DateTimeFormatOptions) {
    const opts = { ...options };
    if (!opts.timeZone) {
      opts.timeZone = BAHRAIN_TIMEZONE;
    }
    return origToLocaleTimeString.call(this, locales || 'en-US', opts);
  };
}
