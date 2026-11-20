from django.conf import settings
from django.db import models


class AuditLog(models.Model):
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL
    )
    action = models.CharField(max_length=80)
    resource = models.CharField(max_length=80)
    label = models.CharField(max_length=200)
    object_id = models.PositiveIntegerField()
    at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-at", "-id"]

    @classmethod
    def record(cls, actor, action, obj):
        cls.objects.create(
            actor=actor,
            action=action,
            resource=obj._meta.verbose_name,
            label=str(obj)[:200],
            object_id=obj.pk,
        )
