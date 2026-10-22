# JINI Editorial Assistant — deployment notes

This feature is isolated from the public-facing JINI chat widget. It adds an admin-only WordPress menu named **JINI Editorial** and a structured-draft endpoint to UltimateAI.

## Behaviour

- Requires a logged-in WordPress user with `edit_posts`.
- Generates a title and article body through UltimateAI's `FAST_CHAT` route.
- The WordPress admin saves the reviewed output as a **draft** using WordPress REST API and its REST nonce.
- It does not publish posts, set categories/tags/SEO, upload media, or change site settings.
- The JINI API token is not sent to browser JavaScript. WordPress calls the UltimateAI endpoint server-to-server.

## Install the WordPress plugin

1. Copy `wordpress-plugins/jini-editorial-assistant/jini-editorial-assistant.php` into `wp-content/plugins/jini-editorial-assistant/jini-editorial-assistant.php` on beritaindonesia.news.
2. In `wp-config.php`, add a strong random token (the same value must be set in UltimateAI's environment):
   ```php
   define('JINI_EDITORIAL_API_TOKEN', 'REPLACE_WITH_A_LONG_RANDOM_SECRET');
   ```
3. Activate **JINI Editorial Assistant** from WordPress → Plugins.
4. Open **JINI Editorial** in the admin menu and set the HTTPS base URL that reaches the UltimateAI router.
5. Ensure the HTTPS route forwards `POST /api/jini/editorial/draft` to the UltimateAI router and preserves the `Authorization: Bearer …` header. Do not expose the router's other local endpoints publicly.

## Configure UltimateAI

Add the exact same secret to the environment that launches LocalRouterServer:

```env
JINI_EDITORIAL_API_TOKEN=REPLACE_WITH_THE_SAME_LONG_RANDOM_SECRET
```

Restart LocalRouterServer after changing the environment. The new endpoint rejects requests without a valid bearer token and returns only a structured article draft.

## Validation before production use

- Confirm `POST /api/jini/editorial/draft` without a token returns HTTP 401 (or 503 if the token is not configured).
- Confirm an authenticated request returns `success: true` with `article.title` and `article.content`.
- Confirm the WordPress admin can generate text and save a draft.
- Confirm a non-editor account cannot use the JINI Editorial page or its REST endpoint.
- Confirm the public JINI widget and its existing `/api/jini/chat` route remain unchanged.

## Important

The HTTPS endpoint must be secured and routed to the machine running UltimateAI. A `127.0.0.1` URL in WordPress's server-side settings means the WordPress server itself, not the administrator's PC. Do not put the secret into public JavaScript, a public repository, or a chat message.
