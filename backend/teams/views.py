from django.db import transaction
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from audit_logs.models import AuditLog
from config.api import DirectoryPagination, ResourceViewSet
from config.permissions import IsAdviser, IsManager, manager
from users.models import User
from users.serializers import TeamMemberSerializer
from .models import CORE_TEAM_NAMES, Team
from .serializers import TeamSerializer


class TeamViewSet(ResourceViewSet):
    queryset = Team.objects.order_by("id")
    serializer_class = TeamSerializer
    search_fields = ["name", "description"]

    def get_permissions(self):
        if self.action == "create":
            return [IsAdviser()]
        return super().get_permissions()

    def get_queryset(self):
        teams = super().get_queryset()
        user = self.request.user
        can_manage = manager(user)
        if self.action == "list":
            if can_manage and self.request.query_params.get("inactive") == "1":
                teams = teams.filter(is_active=False)
            elif not (
                can_manage and self.request.query_params.get("include_inactive") == "1"
            ):
                teams = teams.filter(is_active=True)
            if user.is_authenticated and self.request.query_params.get("mine") == "1":
                teams = teams.filter(pk__in=user.teams.values("pk"))
            if self.request.query_params.get("core") == "1":
                teams = teams.filter(name__in=CORE_TEAM_NAMES)
        elif not can_manage or self.action == "members":
            teams = teams.filter(is_active=True)
        if user.is_authenticated and self.action in ("list", "retrieve"):
            teams = teams.annotate(
                member_count=Count(
                    "staff_members", filter=Q(staff_members__role="staff")
                )
            )
        return teams

    @action(
        detail=True,
        permission_classes=[IsAuthenticated],
        pagination_class=DirectoryPagination,
    )
    def members(self, request, pk=None):
        team = self.get_object()
        members = team.staff_members.filter(role="staff").order_by("username")
        page = self.paginate_queryset(members)
        return self.get_paginated_response(TeamMemberSerializer(page, many=True).data)

    @action(
        detail=True,
        methods=["delete"],
        url_path=r"members/(?P<member_id>[0-9]+)",
        permission_classes=[IsManager],
    )
    @transaction.atomic
    def remove_member(self, request, pk=None, member_id=None):
        team = self.get_object()
        member = get_object_or_404(
            User.objects.select_for_update(),
            pk=member_id,
            role="staff",
            is_superuser=False,
            teams=team,
        )
        if not member.teams.exclude(pk=team.pk).exists():
            raise ValidationError(
                "Assign this staff member to another team before removing their last membership."
            )
        member.teams.remove(team)
        AuditLog.record(
            request.user,
            "Team assignment changed",
            member,
            resource="account",
            description=f"Removed membership in {team.name}.",
        )
        return Response(status=204)

    def perform_destroy(self, instance):
        if instance.name in CORE_TEAM_NAMES:
            raise ValidationError("The four core teams must remain available.")
        super().perform_destroy(instance)

    def perform_update(self, serializer):
        old = serializer.instance.name
        if old in CORE_TEAM_NAMES:
            if serializer.validated_data.get("name", old) != old:
                raise ValidationError("Core team names are fixed.")
            if serializer.validated_data.get("is_active") is False:
                raise ValidationError("The four core teams must remain available.")
        super().perform_update(serializer)
