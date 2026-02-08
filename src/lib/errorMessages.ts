/**
 * Maps technical database/API errors to user-friendly messages.
 * Console still logs the original error for debugging.
 */
export function getUserFriendlyError(error: any, fallback?: string): string {
    const message = error?.message || "";
    const code = error?.code || "";

    // RLS policy violations (permission denied)
    if (code === "42501" || message.includes("row-level security policy")) {
        return "You don't have permission to perform this action. Please contact your administrator if you need access.";
    }

    // Foreign key violations
    if (code === "23503" || message.includes("foreign key constraint")) {
        return "This item is linked to other records and cannot be modified. Please remove the linked items first.";
    }

    // Unique constraint violations
    if (code === "23505" || message.includes("unique constraint") || message.includes("duplicate key")) {
        return "This item already exists. Please use a different name or value.";
    }

    // Not null violations
    if (code === "23502" || message.includes("not-null constraint")) {
        return "Please fill in all required fields.";
    }

    // Network/connection errors
    if (message.includes("network") || message.includes("Failed to fetch") || message.includes("NetworkError")) {
        return "Unable to connect. Please check your internet connection and try again.";
    }

    // Auth errors
    if (message.includes("not authenticated") || message.includes("Invalid login") || message.includes("JWT")) {
        return "Your session has expired. Please sign in again.";
    }

    // Storage errors
    if (message.includes("storage") && message.includes("not found")) {
        return "The file could not be found. It may have been deleted.";
    }

    // Return fallback or original message
    return fallback || message || "An unexpected error occurred. Please try again.";
}
