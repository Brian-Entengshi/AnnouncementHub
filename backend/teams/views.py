from rest_framework.exceptions import ValidationError
from config.api import ResourceViewSet
from .models import Team
from .serializers import TeamSerializer


REQUIRED = ("Technical Team", "Documentation Team", "Editing Team", "Videographer Team")


class TeamViewSet(ResourceViewSet):
    queryset = Team.objects.prefetch_related("members")
    serializer_class = TeamSerializer
    search_fields = ["name", "description"]

    def perform_destroy(self, instance):
        if instance.name in REQUIRED:
            raise ValidationError("The four core teams must remain available.")
        super().perform_destroy(instance)

    def perform_update(self, serializer):
        old = serializer.instance.name
        if old in REQUIRED and serializer.validated_data.get("name", old) != old:
            raise ValidationError("Core team names are fixed.")
        super().perform_update(serializer)
