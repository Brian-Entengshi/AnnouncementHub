from django.contrib.auth.models import AbstractUser, UserManager
from django.db import models


class HubUserManager(UserManager):
    def create_superuser(self, username, email=None, password=None, **extra_fields):
        extra_fields["role"] = "adviser"
        return super().create_superuser(username, email, password, **extra_fields)


class User(AbstractUser):
    objects = HubUserManager()

    role = models.CharField(
        max_length=10,
        choices=[(r, r.title()) for r in ("adviser", "officer", "staff")],
        default="staff",
    )
    team = models.ForeignKey(
        "teams.Team",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="members",
    )
    position = models.CharField(max_length=100, blank=True)
    contact = models.CharField(max_length=100, blank=True)
    must_change_password = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="created_accounts",
    )

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=~models.Q(role="staff") | models.Q(team__isnull=False),
                name="staff_has_team",
            )
        ]

    def __str__(self):
        return self.get_full_name() or self.username
