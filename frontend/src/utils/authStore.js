// Module-level singleton. AuthContext registers its refresh function here
// so apiFetch can trigger a token refresh without a circular import.
export const authStore = {
  refreshFn: null, // () => Promise<string | null>
}
