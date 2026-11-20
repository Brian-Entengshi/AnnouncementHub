from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.middleware.csrf import get_token
from django.views.decorators.csrf import csrf_protect
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from config.api import ResourceViewSet
from config.permissions import IsManager, adviser
from .models import User
from .serializers import AccountSerializer


class AccountViewSet(ResourceViewSet):
    queryset = User.objects.select_related("team").order_by("username")
    serializer_class = AccountSerializer
    permission_classes = [IsManager]
    http_method_names = ["get", "post", "patch", "head", "options"]
    search_fields = ["username", "first_name", "position"]

    def get_queryset(self):
        users = super().get_queryset()
        return users if adviser(self.request.user) else users.filter(role="staff", is_superuser=False)


def session_data(request):
    user = request.user
    return {"user": AccountSerializer(user).data if user.is_authenticated else None, "csrf": get_token(request)}


@api_view(["GET"])
@permission_classes([AllowAny])
def session(request):
    return Response(session_data(request))


@csrf_protect
@api_view(["POST"])
@permission_classes([AllowAny])
def sign_in(request):
    user = authenticate(request, username=request.data.get("username"), password=request.data.get("password"))
    if user is None:
        return Response({"detail": "Check your username and password or contact your adviser."}, status=400)
    login(request, user)
    return Response(session_data(request))


@api_view(["POST"])
def sign_out(request):
    logout(request)
    return Response(session_data(request))


@api_view(["POST"])
def password(request):
    if not request.user.check_password(request.data.get("current_password", "")):
        return Response({"detail": "The current password is incorrect."}, status=400)
    new = request.data.get("new_password", "")
    try:
        validate_password(new, request.user)
    except ValidationError as exc:
        return Response({"detail": " ".join(exc.messages)}, status=400)
    request.user.set_password(new)
    request.user.must_change_password = False
    request.user.save()
    update_session_auth_hash(request, request.user)
    return Response(session_data(request))
