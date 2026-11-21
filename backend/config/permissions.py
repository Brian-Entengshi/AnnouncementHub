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


class MemberReadManagerWrite(PublicReadManagerWrite):
    def has_permission(self, request, view):
        return request.user.is_authenticated and super().has_permission(request, view)


def public_reader(request):
    return request.method in SAFE_METHODS and (
        not request.user.is_authenticated or request.query_params.get("public") == "1"
    )


def public_author(author):
    return {
        "adviser": "Organization Adviser",
        "officer": "Organization Officer",
    }.get(getattr(author, "role", None), "DLL Elite")


class IsManager(BasePermission):
    def has_permission(self, request, view):
        return manager(request.user)


class IsAdviser(BasePermission):
    def has_permission(self, request, view):
        return adviser(request.user)
