(function () {
  "use strict";
  const config = window.RUYA_SUPABASE_CONFIG || {};
  const ready = Boolean(
    window.supabase &&
    /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(config.url || "") &&
    config.anonKey &&
    !String(config.anonKey).includes("YOUR_")
  );
  window.RUYA_BACKEND_READY = ready;
  window.ruyaSupabase = ready
    ? window.supabase.createClient(config.url, config.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      })
    : null;
})();
