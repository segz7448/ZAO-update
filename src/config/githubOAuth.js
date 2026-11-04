/**
 * Re-export of the runtime client-id helper so Settings / Connectors can
 * import from config without pulling the full device-flow module.
 */
export { getGithubOAuthClientId, GITHUB_OAUTH_SCOPES, GITHUB_DEVICE_VERIFY_URL } from '../connectors/githubOAuth';
