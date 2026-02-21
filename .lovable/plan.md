

# Replace Murray Hyundai Assessment and Update Password

## Changes

Two updates needed:

### 1. Replace the HTML file
Copy the uploaded `Murray_Hyundai_Assessment_v3_4.html` to `public/assessments/murray-hyundai-winnipeg.html`, overwriting the existing version.

### 2. Change the password
In `src/pages/MurrayAssessment.tsx`, update line 8:
- **From:** `const ACCESS_PASSWORD = "murray_growth_2026";`
- **To:** `const ACCESS_PASSWORD = "juno";`

## After publishing
Once you click **Publish > Update**, the new assessment will be live at:
- `https://eos-pulse-hub.lovable.app/assessment/murray-hyundai`
- Or `murraygrowth.ca/assessment/murray-hyundai`

Password to view: **juno**

