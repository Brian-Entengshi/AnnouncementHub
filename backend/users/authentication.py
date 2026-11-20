from rest_framework.authentication import SessionAuthentication
from rest_framework.exceptions import PermissionDenied


class HubAuthentication(SessionAuthentication):
    def authenticate(self, request):
        result = super().authenticate(request)
        if (
            result
            and result[0].must_change_password
            and request.path not in ("/api/session/", "/api/password/", "/api/logout/")
        ):
            raise PermissionDenied("Change your initial password to continue.")
        return result
