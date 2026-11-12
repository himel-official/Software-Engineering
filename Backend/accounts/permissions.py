from rest_framework.permissions import BasePermission

from accounts.models import Role


class IsAdmin(BasePermission):
    """Only ADMIN role accounts may access the endpoint."""

    message = "Administrator access is required for this operation."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_admin)


class IsInvestigatorOrAdmin(BasePermission):
    """Both investigators and administrators may access the endpoint."""

    message = "Authorised personnel access is required for this operation."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.role in (Role.INVESTIGATOR, Role.ADMIN)
        )


class IsOwnerOrAdmin(BasePermission):
    """Object level check for resources owned by a staff account."""

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_admin:
            return True
        owner = getattr(obj, "created_by", None) or getattr(obj, "updated_by", None)
        return owner == request.user
