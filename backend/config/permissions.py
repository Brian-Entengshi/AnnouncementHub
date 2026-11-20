from rest_framework.permissions import BasePermission, SAFE_METHODS


def manager(user):
    return user.is_authenticated and (
        user.is_superuser or user.role in ("adviser", "officer")
    )


def adviser(user):
    return user.is_authenticated and (user.is_superuser or user.role == "adviser")


class PublicReadManagerWrite(BasePermission):
    def has_permission(self, request, view):
        return request.method in SAFE_METHODS or manager(request.user)


class IsManager(BasePermission):
    def has_permission(self, request, view):
        return manager(request.user)


class IsAdviser(BasePermission):
    def has_permission(self, request, view):
        return adviser(request.user)
