from django.contrib.auth.models import AbstractUser, UserManager
from django.db import models, transaction


class HubUserManager(UserManager):
    @transaction.atomic
    def create_user(
        self, username, email=None, password=None, *, teams=(), **extra_fields
    ):
        staff = extra_fields.get("role", "staff") == "staff"
        if staff and not teams:
            raise ValueError("A staff account requires at least one team.")
        if not staff and teams:
            raise ValueError("Only staff accounts can be assigned to teams.")
        user = super().create_user(username, email, password, **extra_fields)
        if staff:
            user.teams.set(teams)
        return user

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
    teams = models.ManyToManyField(
        "teams.Team",
        blank=True,
        through="TeamMembership",
        related_name="staff_members",
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

    def __str__(self):
        return self.get_full_name() or self.username


class TeamMembership(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    team = models.ForeignKey("teams.Team", on_delete=models.PROTECT)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=("user", "team"), name="unique_staff_team")
        ]
