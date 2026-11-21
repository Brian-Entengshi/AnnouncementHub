from django.db import models

from config.permissions import manager


CORE_TEAM_NAMES = (
    "Technical Team",
    "Documentation Team",
    "Editing Team",
    "Videographer Team",
)


class Team(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField()
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return self.name


def scope_team_directory(queryset, user):
    if manager(user):
        return queryset
    if not user.is_authenticated:
        return queryset.none()
    return queryset.filter(pk__in=user.teams.values("pk"), is_active=True)
