"""Consistent JSON error envelopes for the whole API."""

from rest_framework.views import exception_handler


def safevoice_exception_handler(exc, context):
    """Wrap DRF errors in the same ``{success, message}`` shape used by success responses."""
    response = exception_handler(exc, context)
    if response is None:
        return None

    data = response.data
    message = None
    errors = None

    if isinstance(data, dict):
        message = data.get("detail") or data.get("message")
        if not message:
            message = "Request failed."
        errors = data
    elif isinstance(data, list):
        errors = data
        message = "Request failed."

    response.data = {
        "success": False,
        "message": message,
        "errors": errors,
    }
    return response
