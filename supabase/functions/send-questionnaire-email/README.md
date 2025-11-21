# Send Questionnaire Email Function

This edge function sends a questionnaire email with a secure access link to department managers.

## Important: URL Configuration

The questionnaire links in emails will point to your app's URL. For the links to work:

1. **During Development/Preview**: Links will use the Lovable preview URL and only work when logged into Lovable
2. **After Publishing**: You must publish your app for external users to access the questionnaire links

### To make questionnaire links work externally:

1. Click the **Publish** button in Lovable (top right on desktop)
2. Your app will be deployed and accessible at a public URL
3. Questionnaire links sent after publishing will work for anyone

### Optional: Custom Domain

If you want to use your own domain (e.g., `yourdomain.com`):
1. Go to Project Settings → Domains in Lovable
2. Add your custom domain
3. Questionnaire links will automatically use your custom domain

## How it works

- Generates a secure token that expires in 7 days
- Stores the token in the `questionnaire_tokens` table
- Sends an email via Resend with a link to `/questionnaire/{token}`
- Recipients can fill out and edit their answers until the token expires
