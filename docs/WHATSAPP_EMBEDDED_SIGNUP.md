# WhatsApp Embedded Signup Integration Guide

This guide explains how to set up and use the WhatsApp Embedded Signup flow so your users can connect their own WhatsApp Business Accounts (WABA) to the platform.

## 1. Meta App Configuration

Before writing code, you must configure your application in the [Meta App Dashboard](https://developers.facebook.com/apps/):

1.  **Create a Meta App**: Select "Business" as the app type.
2.  **Add Products**:
    *   Add **WhatsApp**.
    *   Add **Facebook Login for Business**.
3.  **Configure Facebook Login for Business**:
    *   Go to **Settings** > **Basic**.
    *   Add your website domain (must be HTTPS) to **App Domains**.
    *   Go to **Facebook Login for Business** > **Settings**.
    *   Add your redirect URLs (e.g., `https://your-domain.com/dashboard`).
    *   Enable **Login with JavaScript SDK**.
4.  **Permissions**: Ensure your app has advanced access to:
    *   `whatsapp_business_management`
    *   `whatsapp_business_messaging` (or `whatsapp_business_messaging_preview` for development)
5.  **Environment Variables**: Copy your **App ID** and **App Secret** to the backend `.env` file.

## 2. Environment Variables (.env)

Update your `backend/.env` with the following:

```env
META_APP_ID=your_app_id
META_APP_SECRET=your_app_secret
META_API_VERSION=v21.0
WHATSAPP_VERIFY_TOKEN=your_random_string_for_webhooks
```

## 3. Frontend Integration (React)

The platform uses the Facebook JavaScript SDK to trigger the signup flow.

### JavaScript SDK Initialization
Add the following to your `frontend/public/index.html` (inside `<head>` or at the start of `<body>`):

```html
<script async defer crossorigin="anonymous" src="https://connect.facebook.net/en_US/sdk.js"></script>
<script>
  window.fbAsyncInit = function() {
    FB.init({
      appId      : 'YOUR_META_APP_ID',
      cookie     : true,
      xfbml      : true,
      version    : 'v21.0'
    });
  };
</script>
```

### Connection Trigger
In the dashboard, the "Connect Now" button triggers the flow:

```javascript
const launchWhatsAppSignup = () => {
  FB.login((response) => {
    if (response.authResponse) {
      const code = response.authResponse.code;
      // Send this code to our backend to exchange for an access token
      api.post('/whatsapp/onboard', { code })
        .then(res => toast.success("Connected!"))
        .catch(err => toast.error("Failed to onboard"));
    }
  }, {
    scope: 'whatsapp_business_management,whatsapp_business_messaging',
    extras: {
      feature: 'whatsapp_embedded_signup',
      setup: {
        // Optional pre-fill data
      }
    }
  });
};
```

## 4. Backend Integration (FastAPI)

The backend performs the following steps when receiving the `code`:

1.  **Token Exchange**: Exchanges the `code` for a short-lived access token.
2.  **Fetch Assets**: Uses the token to query the `/debug_token` or `/me/accounts` endpoint to get the WABA ID.
3.  **Fetch Phone Numbers**: Queries `/WABA_ID/phone_numbers` to get the Phone ID and name.
4.  **Save Connection**: Stores IDs and the token in the database for the user's workspace.
5.  **Subscribe**: (Optional but recommended) Uses the token to subscribe to the WABA's webhooks.

---

**Note**: For production, you should ideally use a **System User Token** to manage clients' accounts if you are a Business Solution Provider (BSP). For individual SaaS setups, storing the client's access token is standard.
