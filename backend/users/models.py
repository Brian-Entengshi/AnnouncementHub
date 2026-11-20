from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    role = models.CharField(max_length=10, choices=[(r, r.title()) for r in ("adviser", "officer", "staff")], default="adviser")
    team = models.ForeignKey("teams.Team", null=True, blank=True, on_delete=models.PROTECT, related_name="members")
    position = models.CharField(max_length=100, blank=True)
    contact = models.CharField(max_length=100, blank=True)
    must_change_password = models.BooleanField(default=False)
    created_by = models.ForeignKey("self", null=True, blank=True, on_delete=models.SET_NULL, related_name="created_accounts")

    class Meta:
        constraints = [models.CheckConstraint(condition=~models.Q(role="staff") | models.Q(team__isnull=False), name="staff_has_team")]

    def __str__(self):
        return self.get_full_name() or self.username
