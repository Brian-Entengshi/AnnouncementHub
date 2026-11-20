from django.db import models


CORE_TEAM_NAMES = (
    "Technical Team",
    "Documentation Team",
    "Editing Team",
    "Videographer Team",
)


class Team(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField()

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return self.name
