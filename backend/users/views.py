from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.middleware.csrf import get_token
from django.db import transaction
from django.views.decorators.csrf import csrf_protect
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError as APIValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.authentication import SessionAuthentication
from config.api import DirectoryPagination, ResourceViewSet
from audit_logs.models import AuditLog
from config.permissions import IsManager, adviser
from .models import User
from .serializers import AccountSerializer


class AccountViewSet(ResourceViewSet):
    pagination_class = DirectoryPagination
    exact_filters = ("role",)
    queryset = User.objects.prefetch_related("teams").order_by("username")
    serializer_class = AccountSerializer
    permission_classes = [IsManager]
    http_method_names = ["get", "post", "patch", "head", "options"]
    search_fields = ["username", "first_name", "last_name", "position"]

    def perform_create(self, serializer):
        account = serializer.save()
        names = ", ".join(team.name for team in account.teams.all())
        assignment = f" on {names}" if names else ""
        AuditLog.record(
            self.request.user,
            "Created",
            account,
            resource="account",
            description=f"Created {account.get_role_display().lower()} account “{account}”{assignment}.",
        )

    def perform_update(self, serializer):
        previous = serializer.instance.is_active
        previous_teams = {team.pk for team in serializer.instance.teams.all()}
        password_replaced = "password" in serializer.validated_data
        updated = serializer.save()
        actor = self.request.user
        AuditLog.record(actor, "Updated", updated, resource="account")
        if password_replaced:
            AuditLog.record(
                actor,
                "Password replaced",
                updated,
                resource="account",
                description="Assigned a temporary password and required a password change.",
            )
        teams = list(updated.teams.all())
        if previous_teams != {team.pk for team in teams}:
            description = (
                "Assigned to " + ", ".join(team.name for team in teams) + "."
                if teams
                else "Cleared team assignment."
            )
            AuditLog.record(
                actor,
                "Team assignment changed",
                updated,
                resource="account",
                description=description,
            )
        if previous != updated.is_active:
            AuditLog.record(
                self.request.user,
                "Activated" if updated.is_active else "Deactivated",
                updated,
                resource="account",
            )

    def get_queryset(self):
        users = super().get_queryset()
        if self.action == "partial_update":
            users = users.select_for_update()
        if self.action == "list":
            status = self.request.query_params.get("status")
            if status in ("active", "inactive"):
                users = users.filter(is_active=status == "active")
            if team_id := self.request.query_params.get("team_id"):
                try:
                    users = users.filter(teams=int(team_id))
                except ValueError:
                    raise APIValidationError({"team_id": "Invalid filter value."})
        return (
            users
            if adviser(self.request.user)
            else users.filter(role="staff", is_superuser=False)
        )


def session_data(request):
    user = request.user
    return {
        "user": AccountSerializer(user).data if user.is_authenticated else None,
        "csrf": get_token(request),
    }


@api_view(["GET"])
@permission_classes([AllowAny])
def session(request):
    return Response(session_data(request))


@csrf_protect
@api_view(["POST"])
@permission_classes([AllowAny])
@transaction.atomic
def sign_in(request):
    SessionAuthentication().enforce_csrf(request)
    user = authenticate(
        request,
        username=request.data.get("username"),
        password=request.data.get("password"),
    )
    if user is None:
        AuditLog.authentication(None, "FAILED_LOGIN")
        return Response(
            {"detail": "Check your username and password or contact your adviser."},
            status=400,
        )
    login(request, user)
    AuditLog.authentication(user, "LOGIN")
    return Response(session_data(request))


@api_view(["POST"])
@transaction.atomic
def sign_out(request):
    actor = request.user
    logout(request)
    AuditLog.authentication(actor, "LOGOUT")
    return Response(session_data(request))


@api_view(["POST"])
def password(request):
    if not request.user.check_password(request.data.get("current_password", "")):
        return Response({"detail": "The current password is incorrect."}, status=400)
    new = request.data.get("new_password", "")
    if request.user.check_password(new):
        return Response(
            {"detail": "Choose a password different from your current one."}, status=400
        )
    try:
        validate_password(new, request.user)
    except ValidationError as exc:
        return Response({"detail": " ".join(exc.messages)}, status=400)
    request.user.set_password(new)
    request.user.must_change_password = False
    request.user.save()
    update_session_auth_hash(request, request.user)
    return Response(session_data(request))
