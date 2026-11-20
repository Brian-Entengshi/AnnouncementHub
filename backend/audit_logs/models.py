from django.conf import settings
from django.db import models


class AuditLog(models.Model):
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL
    )
    actor_name = models.CharField(max_length=200, blank=True)
    actor_role = models.CharField(max_length=20, blank=True)
    action = models.CharField(max_length=80)
    resource = models.CharField(max_length=80)
    label = models.CharField(max_length=200)
    object_id = models.PositiveIntegerField(null=True, blank=True)
    description = models.TextField(blank=True)
    at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-at", "-id"]

    @classmethod
    def authentication(cls, actor, action):
        descriptions = {
            "LOGIN": "Signed in successfully.",
            "LOGOUT": "Signed out.",
            "FAILED_LOGIN": "A sign-in attempt was rejected.",
        }
        return cls.record(
            actor, action, resource="authentication", description=descriptions[action]
        )

    @classmethod
    def record(cls, actor, action, obj=None, *, resource=None, description=""):
        resource = resource or str(obj._meta.verbose_name)
        label = str(obj)[:200] if obj is not None else ""
        return cls.objects.create(
            actor=actor,
            actor_name=str(actor)[:200] if actor else "",
            actor_role=actor.role if actor else "",
            action=action,
            resource=resource,
            label=label,
            object_id=obj.pk if obj is not None else None,
            description=description or f"{action} {resource} “{label}”.",
        )
