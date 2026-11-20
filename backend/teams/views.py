from rest_framework.exceptions import ValidationError
from config.api import ResourceViewSet
from .models import CORE_TEAM_NAMES, Team
from .serializers import TeamSerializer


class TeamViewSet(ResourceViewSet):
    queryset = Team.objects.prefetch_related("members")
    serializer_class = TeamSerializer
    search_fields = ["name", "description"]

    def get_queryset(self):
        teams = super().get_queryset()
        if self.action == "list" and self.request.query_params.get("core") == "1":
            return teams.filter(name__in=CORE_TEAM_NAMES)
        return teams

    def perform_destroy(self, instance):
        if instance.name in CORE_TEAM_NAMES:
            raise ValidationError("The four core teams must remain available.")
        super().perform_destroy(instance)

    def perform_update(self, serializer):
        old = serializer.instance.name
        if old in CORE_TEAM_NAMES and serializer.validated_data.get("name", old) != old:
            raise ValidationError("Core team names are fixed.")
        super().perform_update(serializer)
